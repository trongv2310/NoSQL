// 03. Attribute pattern: lọc vợt theo thông số ngay trong MongoDB (slide 57 $elemMatch, 62–79 Aggregation, 90 index kép, 110–116 explain).
// Phần A chạy trên CSDL đang dùng (chỉ đọc). Phần B tạo CSDL riêng `shop_caulong_bench` với 50.000 biến thể để đo index, rồi XOÁ nó đi.
// Chạy SAU `npm run db:setup` và `npm run db:chuan-hoa-thong-so`.
// Chạy: mongosh mongodb://127.0.0.1:27017/shop_caulong db/truy-van-mau/03-loc-thong-so.mongodb.js

// ---------- A. Truy vấn trên dữ liệu thật ----------
// Một biến thể sau chuẩn hoá: thongSo (chuỗi, để hiển thị) + thuocTinh (cặp k/v dạng số, để lọc)
printjson(db.chitietsanphams.findOne({ thuocTinh: { $exists: true } }, { _id: 0, sku: 1, thongSo: 1, thuocTinh: 1 }));

// A1. "Vợt nặng đầu, 4U, còn hàng": MỘT biến thể phải thoả cả hai điều kiện ($elemMatch trên cùng một tài liệu),
//     gom theo sản phẩm ($group), lấy tên sản phẩm ($lookup ≈ JOIN), sắp theo số biến thể khớp.
const nangDau4U = {
  $and: [
    { thuocTinh: { $elemMatch: { k: 'canBangBac', v: { $gt: 0 } } } },
    { thuocTinh: { $elemMatch: { k: 'trongLuongU', v: 4 } } },
  ],
  soLuongTon: { $gt: 0 },
};
print('\nA1. Vợt nặng đầu, 4U, còn hàng:');
db.chitietsanphams
  .aggregate([
    { $match: nangDau4U },
    { $group: { _id: '$sanPham', soBienThe: { $sum: 1 }, skus: { $push: '$sku' }, tonKho: { $sum: '$soLuongTon' } } },
    { $lookup: { from: 'sanphams', localField: '_id', foreignField: '_id', as: 'sp' } },
    { $unwind: '$sp' },
    { $match: { 'sp.deletedAt': null } },
    { $project: { _id: 0, ten: '$sp.tenSanPham', soBienThe: 1, skus: 1, tonKho: 1 } },
    { $sort: { tonKho: -1, ten: 1 } },
  ])
  .forEach((r) => print(`  ${r.ten} | ${r.skus.join(', ')} | tồn ${r.tonKho}`));

// A2. Phân bố độ cân bằng của kho: $unwind mảng thuộc tính rồi $group (slide 79)
print('\nA2. Số biến thể theo bậc cân bằng (-2 rất nhẹ đầu … 3 rất nặng đầu):');
db.chitietsanphams
  .aggregate([{ $unwind: '$thuocTinh' }, { $match: { 'thuocTinh.k': 'canBangBac' } }, { $group: { _id: '$thuocTinh.v', soBienThe: { $sum: 1 } } }, { $sort: { _id: 1 } }])
  .forEach((r) => print(`  bậc ${r._id}: ${r.soBienThe}`));

// A3. Khoảng sức căng tối đa theo trọng lượng: một biến thể có nhiều thuộc tính → $arrayToObject biến mảng k/v thành object để dùng như trường thường
print('\nA3. Sức căng tối đa (lbs) theo trọng lượng:');
db.chitietsanphams
  .aggregate([
    { $match: { thuocTinh: { $exists: true } } },
    { $project: { tt: { $arrayToObject: { $map: { input: { $filter: { input: '$thuocTinh', cond: { $ne: ['$$this.k', 'loiChoi'] } } }, in: ['$$this.k', '$$this.v'] } } } } },
    { $group: { _id: '$tt.trongLuongU', thapNhat: { $min: '$tt.sucCangMaxLbs' }, caoNhat: { $max: '$tt.sucCangMaxLbs' }, soBienThe: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
  .forEach((r) => print(`  ${r._id}U: tối đa từ ${r.thapNhat} đến ${r.caoNhat} lbs (${r.soBienThe} biến thể)`));

// ---------- B. Đo index trên 50.000 biến thể ----------
const bench = db.getSiblingDB('shop_caulong_bench');
bench.dropDatabase();
const mau = db.chitietsanphams.find({ thuocTinh: { $exists: true } }, { _id: 0, thuocTinh: 1 }).toArray().map((d) => d.thuocTinh);
let hat = 20261118; // sinh số giả ngẫu nhiên cố định: chạy lại ra cùng dữ liệu
const ngauNhien = (n) => ((hat = (hat * 1103515245 + 12345) % 2147483648), hat % n);
const SO_BIEN_THE = 50000;
for (let lo = 0; lo < SO_BIEN_THE; lo += 5000) {
  const ds = [];
  for (let i = lo; i < lo + 5000; i++) {
    ds.push({ sanPham: ObjectId.createFromTime(1700000000 + ngauNhien(10000)), sku: `BENCH-${i}`, soLuongTon: ngauNhien(50), thuocTinh: mau[ngauNhien(mau.length)] });
  }
  bench.chitietsanphams.insertMany(ds);
}
print(`\nB. Đã sinh ${bench.chitietsanphams.countDocuments()} biến thể giả trong shop_caulong_bench (thuộc tính chép từ ${mau.length} biến thể thật).`);

const locDo = { $and: [{ thuocTinh: { $elemMatch: { k: 'canBangBac', v: { $gt: 0 } } } }, { thuocTinh: { $elemMatch: { k: 'trongLuongU', v: 4 } } }] };
function doLuong(ten, goiY) {
  const e = bench.chitietsanphams.find(locDo).hint(goiY).explain('executionStats');
  const s = e.executionStats;
  print(`  ${ten.padEnd(34)} nReturned=${s.nReturned}  keysExamined=${s.totalKeysExamined}  docsExamined=${s.totalDocsExamined}  ${s.executionTimeMillis} ms`);
}
print('Truy vấn: vợt nặng đầu VÀ 4U');
doLuong('(1) không index ($natural)', { $natural: 1 });
bench.chitietsanphams.createIndex({ 'thuocTinh.k': 1 }, { name: 'chi_khoa' });
doLuong('(2) index đơn {thuocTinh.k}', 'chi_khoa');
bench.chitietsanphams.createIndex({ 'thuocTinh.k': 1, 'thuocTinh.v': 1 }, { name: 'thuoc_tinh' });
doLuong('(3) index kép {thuocTinh.k, thuocTinh.v}', 'thuoc_tinh');

bench.dropDatabase();
print('\nĐã xoá shop_caulong_bench. Thời gian (ms) dao động theo máy; số khoá/tài liệu phải đọc mới là con số so sánh ổn định.');
