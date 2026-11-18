// 06. Hộ chiếu cây vợt + sổ căng cước: Subset pattern (nhúng 10 lần gần nhất, đủ lịch sử ở collection riêng), Computed pattern
// (lanCangGanNhat, hanNhacLuc), update pipeline ($sortArray, $slice, $dateAdd), transaction đa collection, index sparse/partial unique.
// Script tạo MỘT hộ chiếu thử cho khách đầu tiên, ghi 12 lần căng, chạy truy vấn rồi XOÁ dữ liệu thử.
// Phần (e) cần replica set (có transaction); standalone thì bỏ qua phần đó và in lý do.
// Chạy SAU `npm run db:setup`: mongosh "<chuỗi kết nối>" db/truy-van-mau/06-ho-chieu-vot.mongodb.js

const kh = db.khachhangs.findOne({ taiKhoan: { $exists: true } });
const bt = db.chitietsanphams.findOne({ 'thuocTinh.k': 'sucCangMaxLbs' });
const lay = (k) => bt.thuocTinh.find((t) => t.k === k)?.v;
const votId = db.votcanhans.insertOne({
  khachHang: kh._id, nguon: 'tu-nhap', ten: 'Vợt thử 06 (' + bt.sku + ')', bienThe: bt._id, sanPham: bt.sanPham,
  thongSoChup: { sucCangMinLbs: lay('sucCangMinLbs'), sucCangMaxLbs: lay('sucCangMaxLbs'), trongLuongU: lay('trongLuongU') },
  chuKyNhacNgay: 30, soLanCang: 0, lichSuCang: [], ghiChu: '', taoLuc: new Date(), deletedAt: null,
}).insertedId;
print(`Hộ chiếu thử cho ${kh.hoTen}, phiên bản ${bt.sku}, khoảng căng NSX ${lay('sucCangMinLbs')}–${lay('sucCangMaxLbs')} lbs`);

// a) Ghi một lần căng = MỘT lệnh update dạng pipeline trên hộ chiếu (nguyên tử trên một document):
//    nối lần mới → sắp ngày giảm dần ($sortArray) → giữ 10 ($slice) → tăng bộ đếm → lấy lần mới nhất → tính hạn nhắc ($dateAdd).
function ghiLanCang(ngay, lbs, tenDay) {
  const lan = { _id: new ObjectId(), ngay: new Date(ngay + 'T00:00:00Z'), mucCangLbs: lbs, giaTriNhap: lbs, donViNhap: 'lbs', noiCang: 'ngoai', vuotMucNSX: lbs > lay('sucCangMaxLbs'), ...(tenDay ? { tenDay } : {}) };
  db.lancangs.insertOne({ ...lan, votCaNhan: votId, khachHang: kh._id, nguoiDanhChup: { trinhDo: 'deu' }, laDuLieuMau: true });
  db.votcanhans.updateOne({ _id: votId }, [
    { $set: {
      lichSuCang: { $slice: [{ $sortArray: { input: { $concatArrays: ['$lichSuCang', [{ $literal: lan }]] }, sortBy: { ngay: -1 } } }, 10] },
      soLanCang: { $add: ['$soLanCang', 1] },
    } },
    { $set: { lanCangGanNhat: { $first: '$lichSuCang' } } },
    { $set: { hanNhacLuc: { $dateAdd: { startDate: '$lanCangGanNhat.ngay', unit: 'day', amount: '$chuKyNhacNgay' } } } },
  ]);
}
const ngays = ['05', '01', '12', '03', '09', '02', '11', '07', '04', '10', '06', '08'];
ngays.forEach((d, i) => ghiLanCang(`2026-10-${d}`, 22 + (i % 5), i % 2 ? 'Dây A' : 'Dây B'));
const v = db.votcanhans.findOne({ _id: votId });
print(`\na) Sau 12 lần căng (ghi lộn xộn ngày): soLanCang=${v.soLanCang}, nhúng ${v.lichSuCang.length} lần, ` +
  `ngày nhúng: ${v.lichSuCang.map((x) => x.ngay.toISOString().slice(8, 10)).join(',')}`);
print(`   lanCangGanNhat=${v.lanCangGanNhat.ngay.toISOString().slice(0, 10)}, hanNhacLuc=${v.hanNhacLuc.toISOString().slice(0, 10)} (+30 ngày)`);
print(`   Toàn bộ lịch sử ở lancangs: ${db.lancangs.countDocuments({ votCaNhan: votId })} bản ghi`);

// b) Vợt đến hạn căng lại (truy vấn khoảng trên trường tính sẵn, index sparse han_nhac).
const den = new Date('2026-12-01T00:00:00Z');
const e = db.votcanhans.find({ hanNhacLuc: { $lte: den }, deletedAt: null }).explain('executionStats');
print(`\nb) Vợt đến hạn trước 01/12/2026: ${e.executionStats.nReturned} | ${JSON.stringify(e.queryPlanner.winningPlan).includes('han_nhac') ? 'IXSCAN han_nhac' : 'không dùng han_nhac'}, docsExamined=${e.executionStats.totalDocsExamined}`);

// c) Lịch sử đầy đủ của một cây vợt: index lich_su_cua_vot {votCaNhan, ngay:-1}, đọc thẳng theo thứ tự index.
print('c) 3 lần căng mới nhất từ lancangs:');
db.lancangs.find({ votCaNhan: votId }, { _id: 0, ngay: 1, mucCangLbs: 1, tenDay: 1 }).sort({ ngay: -1 }).limit(3).forEach((l) => print(`   ${l.ngay.toISOString().slice(0, 10)}  ${l.mucCangLbs} lbs  ${l.tenDay}`));

// d) Thống kê sổ căng: mức căng TB theo dây ($group), khoảng cách giữa hai lần căng liên tiếp ($setWindowFields + $shift).
print('d) Mức căng trung bình theo dây:');
db.lancangs.aggregate([{ $match: { votCaNhan: votId } }, { $group: { _id: '$tenDay', tb: { $avg: '$mucCangLbs' }, so: { $sum: 1 } } }, { $sort: { _id: 1 } }])
  .forEach((r) => print(`   ${r._id}: ${r.tb.toFixed(1)} lbs (${r.so} lần)`));
const ck = db.lancangs.aggregate([
  { $match: { votCaNhan: votId } },
  { $setWindowFields: { partitionBy: '$votCaNhan', sortBy: { ngay: 1 }, output: { truoc: { $shift: { output: '$ngay', by: -1 } } } } },
  { $match: { truoc: { $ne: null } } },
  { $group: { _id: null, tbNgay: { $avg: { $dateDiff: { startDate: '$truoc', endDate: '$ngay', unit: 'day' } } } } },
]).toArray()[0];
print(`   Khoảng cách trung bình giữa hai lần căng: ${ck.tbNgay.toFixed(1)} ngày`);

// e) Transaction đa collection: thêm lancangs + cập nhật votcanhans cùng thành công hoặc cùng huỷ.
const hello = db.hello();
if (!hello.setName) {
  print('\ne) Bỏ qua: MongoDB đang standalone (chưa có transaction). Bật replica set theo db/README.md rồi chạy lại.');
} else {
  const s = db.getMongo().startSession();
  const sdb = s.getDatabase(db.getName());
  const truoc = db.lancangs.countDocuments({ votCaNhan: votId });
  s.startTransaction();
  sdb.lancangs.insertOne({ votCaNhan: votId, khachHang: kh._id, ngay: new Date(), mucCangLbs: 25, giaTriNhap: 25, donViNhap: 'lbs', noiCang: 'ngoai', laDuLieuMau: true });
  print(`\ne) Trong transaction: thấy ${sdb.lancangs.countDocuments({ votCaNhan: votId })} lần; ngoài transaction vẫn thấy ${db.lancangs.countDocuments({ votCaNhan: votId })}`);
  s.abortTransaction(); // giả lập bước cập nhật hộ chiếu thất bại
  print(`   Sau abortTransaction: ${db.lancangs.countDocuments({ votCaNhan: votId })} lần (trước đó ${truoc}): không có lần căng mồ côi.`);
  s.endSession();
}

// f) Validator chặn ghi sai luật
for (const [moTa, lenh] of [
  ['soLanCang nhỏ hơn số lần nhúng', () => db.votcanhans.updateOne({ _id: votId }, { $set: { soLanCang: 1 } })],
  ['khoảng căng NSX min > max', () => db.votcanhans.updateOne({ _id: votId }, { $set: { 'thongSoChup.sucCangMinLbs': 40 } })],
  ['mức căng 250 lbs (gõ thừa số 0)', () => db.lancangs.insertOne({ votCaNhan: votId, khachHang: kh._id, ngay: new Date(), mucCangLbs: 250, giaTriNhap: 250, donViNhap: 'lbs', noiCang: 'ngoai' })],
]) {
  try { lenh(); print(`f) [KHÔNG BỊ CHẶN] ${moTa}`); } catch (err) { print(`f) [BỊ CHẶN] ${moTa}: ${err.codeName ?? err.code}`); }
}

db.lancangs.deleteMany({ votCaNhan: votId });
db.votcanhans.deleteOne({ _id: votId });
print('\nĐã xoá hộ chiếu và sổ căng thử.');
