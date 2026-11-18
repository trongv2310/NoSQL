// 11. Time series collection `luotxems`: lượt xem trang chi tiết sản phẩm.
// Bản trong ứng dụng: backend/src/schemas/luot-xem.schema.ts (tạo bằng npm run db:setup), báo cáo: backend/src/admin/bao-cao-csdl.ts.
// Có số liệu mẫu: npm run db:du-lieu-mau (gắn laDuLieuMau: true). Chỉ đọc.
// Chạy: mongosh "<chuỗi kết nối>" db/truy-van-mau/11-time-series.mongodb.js

const TZ = 'Asia/Ho_Chi_Minh';
const info = db.getCollectionInfos({ name: 'luotxems' })[0];
if (!info) quit(print('Chưa có luotxems: chạy npm run db:setup.'));
print(`Kiểu: ${info.type} | ${JSON.stringify(info.options.timeseries)} | tự xoá sau ${Number(info.options.expireAfterSeconds) / 86400} ngày`);

// 1) Bên trong: MongoDB gom phép đo cùng metaField (sanPham) vào bucket; mỗi bucket lưu min/max thời gian + các cột đã nén.
const s = db.luotxems.aggregate([{ $collStats: { storageStats: {} } }]).toArray()[0].storageStats;
const n = db.luotxems.estimatedDocumentCount();
print(`\n1) ${n} lượt xem nằm trong ${s.timeseries.bucketCount} bucket (≈ ${(n / Math.max(1, s.timeseries.bucketCount)).toFixed(1)} lượt/bucket), ${(s.size / 1024).toFixed(0)} KB.`);
const b = db.getCollection('system.buckets.luotxems').findOne({}, { meta: 1, 'control.min.luc': 1, 'control.max.luc': 1, 'control.count': 1 });
if (b) print(`   Một bucket: sanPham ${b.meta}, từ ${b.control.min.luc.toISOString()} đến ${b.control.max.luc.toISOString()}`);

// 2) Lượt xem theo ngày 14 ngày qua: $dateTrunc theo giờ Việt Nam, $densify thêm ngày trống, $fill điền 0, trung bình trượt 7 ngày.
const homNay = new Date(new Date().toLocaleDateString('en-CA', { timeZone: TZ }) + 'T00:00:00+07:00');
const tu = new Date(homNay.getTime() - 13 * 86400000);
print('\n2) Lượt xem theo ngày (cột) và trung bình 7 ngày:');
db.luotxems.aggregate([
  { $match: { luc: { $gte: tu } } },
  { $group: { _id: { $dateTrunc: { date: '$luc', unit: 'day', timezone: TZ } }, so: { $sum: 1 } } },
  { $densify: { field: '_id', range: { step: 1, unit: 'day', bounds: [tu, new Date(homNay.getTime() + 86400000)] } } },
  { $fill: { output: { so: { value: 0 } } } },
  { $setWindowFields: { sortBy: { _id: 1 }, output: { tb7: { $avg: '$so', window: { documents: [-6, 0] } } } } },
]).forEach((d) => print(`   ${d._id.toLocaleDateString('vi-VN', { timeZone: TZ })}  ${'█'.repeat(Math.round(d.so / 6)).padEnd(40)} ${String(d.so).padStart(4)}  TB7 ${d.tb7.toFixed(1)}`));

// 3) Giờ cao điểm trong tuần qua: $hour theo giờ Việt Nam.
print('\n3) Giờ cao điểm 7 ngày qua:');
db.luotxems.aggregate([
  { $match: { luc: { $gte: new Date(Date.now() - 7 * 86400000) } } },
  { $group: { _id: { $hour: { date: '$luc', timezone: TZ } }, so: { $sum: 1 } } },
  { $sort: { so: -1 } }, { $limit: 5 },
]).forEach((d) => print(`   ${String(d._id).padStart(2, '0')}h: ${d.so}`));

// 4) Sản phẩm "đang lên": một $group đếm hai cửa sổ thời gian cùng lúc bằng $cond (7 ngày này / 7 ngày trước).
print('\n4) Đang lên (7 ngày này / 7 ngày trước):');
const moc = new Date(Date.now() - 7 * 86400000), moc2 = new Date(Date.now() - 14 * 86400000);
db.luotxems.aggregate([
  { $match: { luc: { $gte: moc2 } } },
  { $group: { _id: '$sanPham', nay: { $sum: { $cond: [{ $gte: ['$luc', moc] }, 1, 0] } }, truoc: { $sum: { $cond: [{ $lt: ['$luc', moc] }, 1, 0] } } } },
  { $match: { nay: { $gte: 10 } } },
  { $set: { tiLe: { $divide: ['$nay', { $max: [1, '$truoc'] }] } } },
  { $sort: { tiLe: -1 } }, { $limit: 5 },
  { $lookup: { from: 'sanphams', localField: '_id', foreignField: '_id', as: 'sp' } },
]).forEach((d) => print(`   ×${d.tiLe.toFixed(1)}  ${d.truoc} → ${d.nay}  ${d.sp[0]?.tenSanPham ?? d._id}`));
