// 05. Đánh giá theo nhóm người chơi: bản chụp nhúng (Extended reference), $facet, index kép + index partial, cập nhật có điều kiện.
// Script thêm 7 đánh giá MẪU (laDuLieuMau: true) cho một cây vợt, chạy các truy vấn rồi XOÁ chúng: dữ liệu thật không bị đụng.
// Chạy SAU `npm run db:setup`. Chạy: mongosh mongodb://127.0.0.1:27017/shop_caulong db/truy-van-mau/05-danh-gia-theo-nhom.mongodb.js

const vot = db.sanphams.findOne({ tenSanPham: /Nanoflare 700/ }) ?? db.sanphams.findOne({ tenSanPham: /^Vợt/ });
print(`Sản phẩm: ${vot.tenSanPham}`);
const MAU = { laDuLieuMau: true, daXacMinh: true, sanPham: vot._id, ngayPhanHoi: new Date(), soHuuIch: 0, daMuaHang: false };
const ids = db.phanhois.insertMany([
  { ...MAU, danhGia: 5, noiDung: 'Phản tạt rất nhanh', nguoiDanh: { trinhDo: 'deu', noiDung: ['doi'] }, the: ['phan-tat-nhanh', 'de-dieu-khien'] },
  { ...MAU, danhGia: 4, noiDung: 'Nhẹ đầu, dễ đánh', nguoiDanh: { trinhDo: 'deu', noiDung: ['don', 'doi'] }, the: ['phan-tat-nhanh'] },
  { ...MAU, danhGia: 4, noiDung: 'Ổn với tầm giá', nguoiDanh: { trinhDo: 'deu', noiDung: ['doi'], chanThuong: ['co-tay'] }, the: ['em-tay'] },
  { ...MAU, danhGia: 2, noiDung: 'Đập không đủ lực', nguoiDanh: { trinhDo: 'thi', noiDung: ['don'] }, the: ['nang-tay'] },
  { ...MAU, danhGia: 3, noiDung: 'Hơi khó làm quen', nguoiDanh: { trinhDo: 'moi', noiDung: ['doi'] } },
  { ...MAU, danhGia: 5, noiDung: 'Không chia sẻ hồ sơ' },
  { ...MAU, danhGia: 1, noiDung: 'Chưa xác minh', daXacMinh: false },
]).insertedIds;
const idMau = Object.values(ids);

// a) Bản chụp nhúng: mỗi đánh giá mang theo hồ sơ người viết LÚC VIẾT, nên lọc theo nhóm KHÔNG cần $lookup sang khachhangs.
printjson(db.phanhois.findOne({ _id: idMau[0] }, { _id: 0, danhGia: 1, nguoiDanh: 1, the: 1 }));

// b) MỘT lệnh aggregate, $facet chạy 5 nhánh thống kê trên cùng tập đánh giá đã $match (thay cho 5 truy vấn riêng).
const nhom = { 'nguoiDanh.trinhDo': 'deu', 'nguoiDanh.noiDung': { $in: ['doi'] } };
const [kq] = db.phanhois.aggregate([
  { $match: { sanPham: vot._id, daXacMinh: true } }, // bản thật thêm laDuLieuMau: { $ne: true }
  {
    $facet: {
      tatCa: [{ $group: { _id: null, tb: { $avg: '$danhGia' }, so: { $sum: 1 } } }],
      phanBoSao: [{ $group: { _id: '$danhGia', so: { $sum: 1 } } }, { $sort: { _id: -1 } }],
      theNoiBat: [{ $unwind: '$the' }, { $group: { _id: '$the', so: { $sum: 1 } } }, { $sort: { so: -1, _id: 1 } }, { $limit: 5 }],
      theoTrinhDo: [{ $match: { 'nguoiDanh.trinhDo': { $exists: true } } }, { $group: { _id: '$nguoiDanh.trinhDo', tb: { $avg: '$danhGia' }, so: { $sum: 1 } } }],
      giongBan: [{ $match: nhom }, { $group: { _id: null, tb: { $avg: '$danhGia' }, so: { $sum: 1 } } }],
    },
  },
]).toArray();
print('\nb) Kết quả $facet (chỉ đánh giá mẫu của script này nằm trên sản phẩm nếu sản phẩm chưa có đánh giá thật):');
printjson(kq);

// c) Index kép danh_gia_theo_nhom {sanPham, nguoiDanh.trinhDo, danhGia:-1}: lọc theo nhóm VÀ sắp theo sao mà không cần SORT.
const e = db.phanhois.find({ sanPham: vot._id, 'nguoiDanh.trinhDo': 'deu' }).sort({ danhGia: -1 }).explain('executionStats');
const kh = JSON.stringify(e.queryPlanner.winningPlan);
print(`\nc) Nhóm "chơi đều" sắp theo sao: ${kh.includes('danh_gia_theo_nhom') ? 'IXSCAN danh_gia_theo_nhom' : 'KHÔNG dùng index nhóm'}, có SORT trong bộ nhớ: ${kh.includes('"SORT"') ? 'có' : 'không'}, docsExamined=${e.executionStats.totalDocsExamined}`);

// d) Partial index (khác sparse): cong_khai_moi_nhat chỉ chứa đánh giá daXacMinh: true. Truy vấn phải có điều kiện đó mới dùng được index.
const p1 = JSON.stringify(db.phanhois.find({ sanPham: vot._id, daXacMinh: true }).sort({ ngayPhanHoi: -1 }).explain().queryPlanner.winningPlan);
const p2 = JSON.stringify(db.phanhois.find({ sanPham: vot._id }).sort({ ngayPhanHoi: -1 }).explain().queryPlanner.winningPlan);
print(`d) Có daXacMinh: true → dùng cong_khai_moi_nhat: ${p1.includes('cong_khai_moi_nhat')}; không có điều kiện đó → dùng: ${p2.includes('cong_khai_moi_nhat')}`);

// e) "Hữu ích": điều kiện huuIch: {$ne: toi} nằm CÙNG lệnh với $addToSet + $inc. Bấm 3 lần chỉ tính 1.
const toi = new ObjectId();
for (let i = 0; i < 3; i++) db.phanhois.updateOne({ _id: idMau[1], huuIch: { $ne: toi } }, { $addToSet: { huuIch: toi }, $inc: { soHuuIch: 1 } });
print(`\ne) Sau 3 lần bấm của cùng một người: soHuuIch = ${db.phanhois.findOne({ _id: idMau[1] }).soHuuIch}`);
db.phanhois.updateOne({ _id: idMau[1], huuIch: toi }, { $pull: { huuIch: toi }, $inc: { soHuuIch: -1 } });
print(`   Bỏ bấm: soHuuIch = ${db.phanhois.findOne({ _id: idMau[1] }).soHuuIch}`);

// f) Validator $expr: bộ đếm phải bằng số người trong huuIch, nên cộng tay soHuuIch bị từ chối.
try {
  db.phanhois.updateOne({ _id: idMau[1] }, { $inc: { soHuuIch: 5 } });
  print('f) [KHÔNG BỊ CHẶN] kiểm tra lại validator!');
} catch (err) {
  print(`f) [BỊ CHẶN] cộng tay soHuuIch: ${err.codeName ?? err.code}`);
}

const xoa = db.phanhois.deleteMany({ _id: { $in: idMau } }).deletedCount;
print(`\nĐã xoá ${xoa} đánh giá mẫu của script.`);
