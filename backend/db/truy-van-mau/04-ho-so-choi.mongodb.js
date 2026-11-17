// 04. Hồ sơ người chơi nhúng trong khachhangs (slide 15–16 Embedded, 33–39 cập nhật trường con/mảng, 56 truy vấn document con, 91–92 sparse).
// Script tạo MỘT khách hàng thử (hoTen "Khách thử 04"), thao tác trên hồ sơ của khách đó rồi xoá khách đó ở cuối: dữ liệu thật không bị đụng.
// Chạy SAU `npm run db:setup`. Chạy: mongosh mongodb://127.0.0.1:27017/shop_caulong db/truy-van-mau/04-ho-so-choi.mongodb.js

const id = db.khachhangs.insertOne({ hoTen: 'Khách thử 04', ngayTao: new Date() }).insertedId;
const xem = (nhan) => print(`${nhan}\n  ${JSON.stringify(db.khachhangs.findOne({ _id: id }, { _id: 0, hoSoChoi: 1 }).hoSoChoi ?? null)}`);

// a) $set trường con bằng ký pháp chấm: tạo hồ sơ nếu chưa có, không đụng các trường khác của khách hàng (cách API PUT /auth/ho-so-choi làm)
db.khachhangs.updateOne({ _id: id }, { $set: { 'hoSoChoi.trinhDo': 'deu', 'hoSoChoi.noiDung': ['doi'], 'hoSoChoi.capNhatLuc': new Date() } });
xem('a) Sau $set "hoSoChoi.trinhDo" và "hoSoChoi.noiDung":');

// b) $addToSet: thêm vào mảng nếu CHƯA có (bấm hai lần vẫn chỉ một phần tử); $push thì thêm trùng (slide 38)
db.khachhangs.updateOne({ _id: id }, { $addToSet: { 'hoSoChoi.noiDung': 'don' } });
db.khachhangs.updateOne({ _id: id }, { $addToSet: { 'hoSoChoi.noiDung': 'don' } });
xem('b) Sau hai lần $addToSet "don":');

// c) $addToSet + $each: thêm nhiều vị trí chấn thương một lúc
db.khachhangs.updateOne({ _id: id }, { $addToSet: { 'hoSoChoi.chanThuong': { $each: ['co-tay', 'vai'] } } });
xem('c) Sau $addToSet $each chấn thương:');

// d) $pull: bỏ một phần tử khỏi mảng (slide 39)
db.khachhangs.updateOne({ _id: id }, { $pull: { 'hoSoChoi.chanThuong': 'vai' } });
xem('d) Sau $pull "vai":');

// e) Validator chặn: $push trùng phần tử (uniqueItems) và giá trị ngoài danh sách
for (const [moTa, lenh] of [
  ['$push "doi" lần nữa (trùng)', { $push: { 'hoSoChoi.noiDung': 'doi' } }],
  ['trình độ "sieu-cap"', { $set: { 'hoSoChoi.trinhDo': 'sieu-cap' } }],
]) {
  try {
    db.khachhangs.updateOne({ _id: id }, lenh);
    print(`e) [KHÔNG BỊ CHẶN] ${moTa}: kiểm tra lại validator!`);
  } catch (e) {
    print(`e) [BỊ CHẶN] ${moTa}: ${e.codeName ?? e.code}`);
  }
}

// f) Truy vấn document con (slide 56) và mảng (slide 55): người chơi đều, có đánh đôi. Có index sparse ho_so_choi.
const loc = { 'hoSoChoi.trinhDo': 'deu', 'hoSoChoi.noiDung': 'doi' };
print(`\nf) Khách "chơi đều + đánh đôi": ${db.khachhangs.countDocuments(loc)}`);
const e = db.khachhangs.find(loc).explain('executionStats');
print(`   kế hoạch: ${JSON.stringify(e.queryPlanner.winningPlan).includes('ho_so_choi') ? 'IXSCAN ho_so_choi' : 'không dùng ho_so_choi'}, docsExamined=${e.executionStats.totalDocsExamined}`);

// g) Index sparse: chỉ khách CÓ hồ sơ nằm trong index
print(`g) ho_so_choi sparse=${db.khachhangs.getIndexes().find((i) => i.name === 'ho_so_choi')?.sparse === true}; khách có hồ sơ: ${db.khachhangs.countDocuments({ hoSoChoi: { $exists: true } })} / ${db.khachhangs.countDocuments()}`);

// h) Thống kê theo nhóm (sẽ dùng nhiều ở M3/M6): $unwind nội dung đánh rồi $group theo trình độ
print('\nh) Số người chơi theo trình độ × nội dung:');
db.khachhangs
  .aggregate([{ $match: { hoSoChoi: { $exists: true } } }, { $unwind: '$hoSoChoi.noiDung' }, { $group: { _id: { trinhDo: '$hoSoChoi.trinhDo', noiDung: '$hoSoChoi.noiDung' }, so: { $sum: 1 } } }, { $sort: { '_id.trinhDo': 1, '_id.noiDung': 1 } }])
  .forEach((r) => print(`  ${r._id.trinhDo ?? '(chưa khai)'} / ${r._id.noiDung}: ${r.so}`));

// i) $unset cả hồ sơ (nút "Xoá hồ sơ"), rồi dọn khách thử
db.khachhangs.updateOne({ _id: id }, { $unset: { hoSoChoi: '' } });
xem('\ni) Sau $unset hoSoChoi:');
db.khachhangs.deleteOne({ _id: id });
print('Đã xoá khách thử 04.');
