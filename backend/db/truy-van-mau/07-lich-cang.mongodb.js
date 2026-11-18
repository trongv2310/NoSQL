// 07. Lịch căng tại shop: mỗi khung giờ là MỘT document chứa sức chứa + mảng chỗ đặt (nhúng).
// Giữ chỗ không vượt sức chứa bằng MỘT lệnh có điều kiện (không khoá, không transaction); upsert + index unique cho khung chưa có ai đặt;
// toán tử vị trí $ để huỷ đúng chỗ; validator $expr giữ bộ đếm khớp mảng.
// Script dùng một khung giờ năm 2099 (không trùng dữ liệu thật) và XOÁ nó ở cuối. Chạy SAU `npm run db:setup`.
// Chạy: mongosh "<chuỗi kết nối>" db/truy-van-mau/07-lich-cang.mongodb.js

const KHUNG = new Date('2099-01-01T03:00:00Z'); // 10:00 giờ VN
const SUC_CHUA = 2;
db.lichcangs.deleteMany({ ngay: KHUNG });
const cho = (ten) => ({ _id: new ObjectId(), khachHang: new ObjectId(), votCaNhan: new ObjectId(), tenKhach: ten, mucCangLbs: 25, giaTriNhap: 25, donViNhap: 'lbs', trangThai: 'cho', taoLuc: new Date() });

// a) Đặt chỗ = updateOne có điều kiện "còn chỗ" + $push + $inc; khung chưa có document thì upsert tạo mới.
function datCho(ten) {
  try {
    const r = db.lichcangs.updateOne(
      { ngay: KHUNG, soDaDat: { $lt: SUC_CHUA } },
      { $push: { datCho: cho(ten) }, $inc: { soDaDat: 1 }, $setOnInsert: { sucChua: SUC_CHUA } },
      { upsert: true },
    );
    return r.upsertedId ? 'tạo khung + giữ chỗ' : 'giữ chỗ';
  } catch (e) {
    // Khung đã kín: điều kiện $lt không khớp → upsert định chèn document mới → đụng index unique khung_gio → 11000.
    return e.code === 11000 ? 'KÍN CHỖ (11000)' : `lỗi ${e.code}`;
  }
}
print('a) Bốn khách lần lượt đặt vào khung 2 chỗ:');
['An', 'Bình', 'Chi', 'Dũng'].forEach((t) => print(`   ${t}: ${datCho(t)}`));
let k = db.lichcangs.findOne({ ngay: KHUNG });
print(`   → soDaDat=${k.soDaDat}/${k.sucChua}, số chỗ trong mảng=${k.datCho.length}, số document của khung=${db.lichcangs.countDocuments({ ngay: KHUNG })}`);

// b) Huỷ đúng chỗ của An bằng toán tử vị trí $ (phần tử khớp $elemMatch), trả lại một chỗ trong cùng lệnh.
const an = k.datCho.find((d) => d.tenKhach === 'An');
db.lichcangs.updateOne(
  { _id: k._id, datCho: { $elemMatch: { _id: an._id, trangThai: 'cho' } } },
  { $set: { 'datCho.$.trangThai': 'huy' }, $inc: { soDaDat: -1 } },
);
k = db.lichcangs.findOne({ _id: k._id });
print(`\nb) An huỷ: soDaDat=${k.soDaDat}; trạng thái: ${k.datCho.map((d) => `${d.tenKhach}=${d.trangThai}`).join(', ')}`);
print(`   Chi đặt lại: ${datCho('Chi')} → soDaDat=${db.lichcangs.findOne({ _id: k._id }).soDaDat}`);

// c) Truy vấn: khung còn chỗ ($expr so hai trường) và "lịch của tôi" ($unwind mảng nhúng rồi lọc lại).
print(`\nc) Khung năm 2099 còn chỗ: ${db.lichcangs.countDocuments({ ngay: { $gte: new Date('2099-01-01') }, $expr: { $lt: ['$soDaDat', '$sucChua'] } })}`);
const binh = k.datCho.find((d) => d.tenKhach === 'Bình').khachHang;
const cuaBinh = db.lichcangs.aggregate([
  { $match: { 'datCho.khachHang': binh } }, { $unwind: '$datCho' }, { $match: { 'datCho.khachHang': binh } },
  { $project: { _id: 0, ngay: 1, trangThai: '$datCho.trangThai' } },
]).toArray();
print(`   Lịch của Bình: ${JSON.stringify(cuaBinh)}`);
const e = db.lichcangs.find({ 'datCho.khachHang': binh }).explain('queryPlanner');
print(`   Kế hoạch: ${JSON.stringify(e.queryPlanner.winningPlan).includes('dat_cho_cua_khach') ? 'IXSCAN dat_cho_cua_khach (multikey)' : 'không dùng index'}`);

// d) Validator $expr: soDaDat phải bằng số chỗ chưa huỷ và không vượt sức chứa.
for (const [moTa, lenh] of [
  ['cộng tay soDaDat', { $inc: { soDaDat: 1 } }],
  ['giảm sức chứa xuống dưới số chỗ đã giữ', { $set: { sucChua: 1 } }],
]) {
  try { db.lichcangs.updateOne({ _id: k._id }, lenh); print(`d) [KHÔNG BỊ CHẶN] ${moTa}`); } catch (err) { print(`d) [BỊ CHẶN] ${moTa}: ${err.codeName ?? err.code}`); }
}

db.lichcangs.deleteMany({ ngay: KHUNG });
print('\nĐã xoá khung thử.');
