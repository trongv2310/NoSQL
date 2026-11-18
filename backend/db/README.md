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
| `src/tu-vot/` | Hộ chiếu cây vợt (`votcanhans`) + sổ căng (`lancangs`): update pipeline ghi lần căng, transaction khi có replica set, tạo hộ chiếu khi đơn hoàn thành |
| `src/tu-vot/lich-cang.service.ts` | Lịch căng tại shop (`lichcangs`): giữ chỗ bằng một lệnh có điều kiện, huỷ bằng toán tử vị trí `$`, hoàn tất trong transaction |
| `src/csdl/du-lieu-mau.ts`, `sinh-du-lieu-mau.ts` | Dữ liệu MẪU cho thống kê (`npm run db:du-lieu-mau`, `-- --xoa` để xoá); mọi tài liệu gắn `laDuLieuMau: true` |
| `src/admin/bao-cao-csdl.ts` | Pipeline báo cáo cho trang `/admin/bao-cao-csdl` ($group, $bucket, $setWindowFields, $median, $lookup, $facet) |
| `src/csdl/sao-luu.ts`, `phuc-hoi.ts` | Sao lưu/phục hồi: mongodump/mongorestore nếu có, không thì bản tự viết giữ cả validator + index |
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

Kiểm thử trên MongoDB thật (mỗi file tạo một CSDL tạm rồi xoá): `MONGO_TEST_URI=mongodb://127.0.0.1:27017 npx vitest run src/catalog/bo-loc-mongo.spec.ts src/common/ho-so-choi-mongo.spec.ts src/phan-hoi/danh-gia-mongo.spec.ts src/tu-vot src/csdl/validators-mongo.spec.ts`.
Thêm `MONGO_RS_TEST_URI` (một replica set, ví dụ `mongodb://127.0.0.1:27018/?replicaSet=rs-thu`) để `tu-vot-mongo.spec.ts` chạy cả đường có transaction.
Replica set thử nghiệm không cần đụng dịch vụ MongoDB đang chạy: `mongod --replSet rs-thu --port 27018 --dbpath <thư mục trống>` rồi `rs.initiate(...)`.

- Script dùng `MONGODB_URI` trong `.env`. Ghi lên MongoDB không phải của máy mình thì phải thêm `-- --force`.
- Collection nào còn tài liệu vi phạm thì validator **không** được áp. Script in vài `_id` để sửa dữ liệu, rồi kết thúc với mã lỗi 1.
- Sau khi gộp nhánh này, chạy thêm `npm run db:setup -- --xoa-index-thua` một lần để xoá `donhangs.khachHang_1`.
  Index này đã được thay bằng index kép `don_cua_khach`.
- Thứ tự cho máy mới: `npm run data:import`, rồi `npm run db:setup`.
- Máy đã có dữ liệu từ trước: `npm run db:setup -- --xoa-index-thua`, rồi `npm run db:chuan-hoa-thong-so`.

## Bật replica set `rs0` (để có transaction)

MongoDB chạy một máy (standalone) không có transaction và change stream. Replica set một node vẫn chạy trên đúng một máy, giữ nguyên
dữ liệu cũ, chỉ bật thêm nhật ký sao chép (oplog). Mỗi thành viên làm **một lần**.

**Cách nhanh:** mở PowerShell bằng *Run as Administrator* rồi chạy script (tự sao lưu `mongod.cfg` và `.env`, chạy lại không sao):

```powershell
powershell -ExecutionPolicy Bypass -File backend\db\bat-replica-set.ps1 -ThuKhongGhi   # xem trước, không ghi gì
powershell -ExecutionPolicy Bypass -File backend\db\bat-replica-set.ps1                # bật rs0
powershell -ExecutionPolicy Bypass -File backend\db\bat-replica-set.ps1 -HoanTac       # quay lại standalone
```

Đường dẫn cấu hình mặc định là `F:\MongoDB\bin\mongod.cfg`; máy khác thì thêm `-Cfg "<đường dẫn>"`. Làm tay thì theo các bước dưới.

Khi có replica set, các việc sau chạy trong MỘT transaction (lỗi giữa chừng thì MongoDB huỷ hết): đặt hàng (trừ kho + số đơn + tạo đơn),
huỷ đơn (đổi trạng thái + hoàn kho), gửi đánh giá (thêm đánh giá + cộng điểm tổng hợp), ghi lần căng và hoàn tất lịch căng.
Standalone vẫn chạy được: dùng cập nhật nguyên tử có điều kiện và tự bù trừ, chỉ khác là bộ đếm số đơn có thể nhảy số khi lỗi
(xem `src/don-hang/dat-hang-mongo.spec.ts`, chạy cả hai chế độ).

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

## Dữ liệu mẫu cho thống kê

```bash
npm run db:du-lieu-mau            # xoá dữ liệu mẫu cũ rồi sinh: ~40 người chơi, ~80 hộ chiếu, ~700 lần căng, ~160 đánh giá
npm run db:du-lieu-mau -- --xoa   # chỉ xoá
```

Dữ liệu mẫu là GIẢ LẬP theo vài quy tắc ghi trong `src/csdl/du-lieu-mau.ts`, chỉ để minh hoạ truy vấn. Trang công khai không tính nó,
trừ khi API chạy với `HIEN_DU_LIEU_MAU=true` (máy demo). Khi đó giao diện ghi rõ "dữ liệu mẫu". Trang báo cáo admin có công tắc bật/tắt.

## Sao lưu và phục hồi

```bash
npm run db:sao-luu                                         # vào backend/sao-luu/<thời điểm>/ (đã gitignore)
npm run db:phuc-hoi -- --from=sao-luu/<thời điểm>          # chỉ chạy khi collection đích còn trống
npm run db:phuc-hoi -- --from=sao-luu/<thời điểm> --drop   # ghi đè
```

- Máy có *MongoDB Database Tools* thì script gọi `mongodump`/`mongorestore`.
- Không có thì dùng bản tự viết: mỗi collection một file `.jsonl` (Extended JSON canonical, giữ đúng kiểu số), kèm `_meta.json` ghi validator và index.
  Khi phục hồi, collection được tạo lại kèm validator TRƯỚC khi nạp dữ liệu, rồi mới tạo lại index.
- Đã thử 18/11/2026: sao lưu rồi phục hồi sang CSDL khác. `dbHash` của cả 24 collection trùng nhau; số index (68) và số validator (9) khớp.

Lệnh gốc của bài giảng (cần cài Database Tools):

```bash
mongodump --db shop_caulong --out ./sao-luu/truoc-csdl      # sao lưu
mongorestore --drop --db shop_caulong ./sao-luu/truoc-csdl/shop_caulong   # phục hồi (ghi đè)
```

`mongodump`/`mongorestore` nằm trong gói *MongoDB Database Tools* (cài riêng, không đi kèm `mongosh`).
