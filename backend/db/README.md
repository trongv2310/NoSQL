# Thiết lập CSDL MongoDB

Thư mục này gồm hướng dẫn vận hành và các file truy vấn mẫu cho báo cáo môn NoSQL. Code thật nằm ở `src/csdl/`:

| File | Vai trò |
|---|---|
| `src/csdl/validators.ts` | Validator `$jsonSchema` (+ `$expr`) cho 6 collection chính |
| `src/csdl/thiet-lap.ts` | Script `db:setup`: áp validator, tạo index còn thiếu |
| `src/csdl/so-sanh-index.ts` | So index khai báo trong schema Mongoose với index đang có trong CSDL |
| `src/csdl/moi-truong.ts` | Đọc phiên bản MongoDB, có replica set hay không (in lúc API khởi động) |
| `src/catalog/thuoc-tinh.ts` | Attribute pattern: đọc `thongSo` (chuỗi) thành `thuocTinh` [{k, v}] dạng số; dựng điều kiện lọc `$elemMatch` |
| `src/csdl/chuan-hoa-thong-so.ts` | Script `db:chuan-hoa-thong-so`: tính lại `thuocTinh` cho dữ liệu cũ |
| `src/phan-hoi/danh-gia-nhom.ts` | Đánh giá theo nhóm người chơi: bản chụp hồ sơ, pipeline `$facet`, ngưỡng "chưa đủ dữ liệu" |
| `src/common/ho-so-choi.ts` | Hồ sơ người chơi nhúng trong `khachhangs`: danh sách giá trị, lệnh `$set`/`$unset` trường con (API `GET/PUT/DELETE /auth/ho-so-choi`) |
| `db/truy-van-mau/*.mongodb.js` | Truy vấn mẫu chạy bằng `mongosh` hoặc Compass, dùng để minh hoạ trong báo cáo |

Index chỉ khai báo ở **một chỗ**: trong các file `src/schemas/*.schema.ts` (`@Prop({ index: true })` hoặc `XxxSchema.index(...)`).
`db:setup` đọc khai báo đó, so với CSDL và tạo phần còn thiếu. Nó không xoá index nào, trừ khi chạy kèm `--xoa-index-thua`.

## Chạy

```bash
cd backend
npm run db:setup:dry      # chỉ kiểm tra: in số tài liệu vi phạm, index thiếu/thừa; không ghi gì
npm run db:setup          # áp validator + tạo index còn thiếu (chạy lại nhiều lần không sao)
npm run db:chuan-hoa-thong-so -- --dry-run   # bao nhiêu biến thể có thuocTinh lệch với thongSo
npm run db:chuan-hoa-thong-so                # ghi phần lệch (bản ghi đã đúng không bị đụng tới)
```

`thuocTinh` được hook của schema `ChiTietSanPham` tự tính mỗi khi `thongSo` được tạo, thay hoặc xoá qua Mongoose.
Chỉ cần chạy `db:chuan-hoa-thong-so` cho dữ liệu có từ trước, hoặc dữ liệu bị sửa thẳng bằng mongosh/Compass.
Bộ `seed-data` đã có sẵn `thuocTinh`.

Kiểm thử trên MongoDB thật (mỗi file tạo một CSDL tạm rồi xoá): `MONGO_TEST_URI=mongodb://127.0.0.1:27017 npx vitest run src/catalog/bo-loc-mongo.spec.ts src/common/ho-so-choi-mongo.spec.ts src/phan-hoi/danh-gia-mongo.spec.ts`.

- Script dùng `MONGODB_URI` trong `.env`. Ghi lên MongoDB không phải của máy mình thì phải thêm `-- --force`.
- Collection nào còn tài liệu vi phạm thì validator **không** được áp. Script in vài `_id` để sửa dữ liệu, rồi kết thúc với mã lỗi 1.
- Sau khi gộp nhánh này, chạy thêm `npm run db:setup -- --xoa-index-thua` một lần để xoá `donhangs.khachHang_1`.
  Index này đã được thay bằng index kép `don_cua_khach`.
- Thứ tự cho máy mới: `npm run data:import`, rồi `npm run db:setup`.
- Máy đã có dữ liệu từ trước: `npm run db:setup -- --xoa-index-thua`, rồi `npm run db:chuan-hoa-thong-so`.

## Bật replica set `rs0` (để có transaction)

MongoDB chạy một máy (standalone) không có transaction và change stream. Replica set một node vẫn chạy trên đúng một máy, giữ nguyên
dữ liệu cũ, chỉ bật thêm nhật ký sao chép (oplog). Mỗi thành viên làm **một lần**:

1. Mở file cấu hình của dịch vụ MongoDB. Đường dẫn nằm trong lệnh khởi động dịch vụ: `sc qc MongoDB` (dòng `BINARY_PATH_NAME`, phần sau `--config`).
   Bản cài mặc định thường là `C:\Program Files\MongoDB\Server\<phiên bản>\bin\mongod.cfg`.
2. Thêm vào cuối file (thụt lề bằng dấu cách, không dùng tab):
   ```yaml
   replication:
     replSetName: rs0
   ```
3. Khởi động lại dịch vụ bằng PowerShell **chạy với quyền Administrator**:
   ```powershell
   Restart-Service MongoDB
   ```
4. Khởi tạo replica set (chỉ một lần):
   ```bash
   mongosh --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })"
   ```
   Đợi vài giây rồi chạy `mongosh --eval "rs.status().members[0].stateStr"`; kết quả phải là `PRIMARY`.
5. Trong `backend/.env`, thêm `?replicaSet=rs0` vào cuối chuỗi kết nối:
   `MONGODB_URI=mongodb://127.0.0.1:27017/shop_caulong?replicaSet=rs0`

Kiểm tra: khi `npm run start:dev`, log phải có dòng `replica set "rs0": có transaction.` thay cho cảnh báo standalone.

Muốn quay lại standalone: xoá khối `replication` ở bước 2, khởi động lại dịch vụ, bỏ `?replicaSet=rs0`. Dữ liệu vẫn còn nguyên.

## Sao lưu trước khi thử nghiệm

```bash
mongodump --db shop_caulong --out ./sao-luu/truoc-csdl      # sao lưu
mongorestore --drop --db shop_caulong ./sao-luu/truoc-csdl/shop_caulong   # phục hồi (ghi đè)
```

`mongodump`/`mongorestore` nằm trong gói *MongoDB Database Tools* (cài riêng, không đi kèm `mongosh`).
