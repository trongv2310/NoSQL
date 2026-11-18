// 12. Change stream: theo dõi đơn mới và tồn kho xuống thấp NGAY KHI xảy ra (cần replica set; xem db/bat-replica-set.ps1).
// Bản trong ứng dụng: backend/src/su-kien/su-kien.service.ts → SSE /api/admin/su-kien → chuông thông báo ở trang quản trị.
// Chạy: mongosh "<chuỗi kết nối>" db/truy-van-mau/12-change-stream.mongodb.js
// Trong lúc script chạy (60 giây), mở cửa sổ khác đặt một đơn hoặc chạy:
//   db.chitietsanphams.updateOne({ sku: '<một SKU>' }, { $set: { soLuongTon: 2 } })

const NGUONG = 3;
const hello = db.hello();
if (!hello.setName) {
  print('MongoDB đang chạy standalone: change stream đọc oplog nên CHỈ có trên replica set / sharded cluster.');
  print('Bật replica set: powershell -ExecutionPolicy Bypass -File backend\\db\\bat-replica-set.ps1');
  quit();
}

// Lọc trên máy chủ: chỉ hai loại sự kiện đi qua mạng; $project bỏ địa chỉ, số điện thoại của khách.
const pipeline = [
  { $match: { $or: [
    { operationType: 'insert', 'ns.coll': 'donhangs' },
    { operationType: 'update', 'ns.coll': 'chitietsanphams', 'updateDescription.updatedFields.soLuongTon': { $lte: NGUONG } },
  ] } },
  { $project: { operationType: 1, ns: 1, documentKey: 1, 'fullDocument.soDonHang': 1, 'fullDocument.tongTienSauGiam': 1, 'fullDocument.sku': 1, 'updateDescription.updatedFields.soLuongTon': 1 } },
];

// Đọc tiếp từ resume token đã lưu (nếu ứng dụng đã từng chạy), không thì bắt đầu từ bây giờ.
const daLuu = db.theodoisukiens.findOne({ _id: 'admin-thong-bao' });
print(`Replica set "${hello.setName}". ${daLuu ? `Có resume token lưu lúc ${daLuu.luc.toISOString()} (ứng dụng dùng nó để không mất sự kiện khi khởi động lại).` : 'Chưa có resume token.'}`);
print('Đang theo dõi 60 giây...\n');

const luong = db.watch(pipeline, { fullDocument: 'updateLookup' });
const ketThuc = Date.now() + 60_000;
let so = 0;
while (Date.now() < ketThuc) {
  const ev = luong.tryNext();
  if (!ev) { sleep(200); continue; }
  so++;
  if (ev.operationType === 'insert') print(`  [đơn mới]   #${ev.fullDocument.soDonHang}  ${ev.fullDocument.tongTienSauGiam} đ`);
  else print(`  [tồn thấp]  ${ev.fullDocument?.sku ?? ev.documentKey._id}: còn ${ev.updateDescription.updatedFields.soLuongTon}`);
  print(`              resume token: ${ev._id._data.slice(0, 32)}…`);
}
luong.close();
print(`\nXong: ${so} sự kiện.`);
