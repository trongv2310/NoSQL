# PLAN-CSDL: Hộ chiếu cây vợt + Đánh giá từ người chơi giống bạn

Ngày lập: 18/11/2026. Nhánh: `chonqq/mongodb-database-design-82c10f` (đang ở `9a5405d`, landing 3D).
Trạng thái: **mới là plan, chưa code.** Đọc xong mục 0 và chốt 4 quyết định ở mục 1 rồi mới bắt đầu M0.

Mục tiêu môn học: CSDL phải giải một vấn đề thật của người chơi cầu lông, và mỗi phần trong *Chương 2. MongoDB*
(mô hình nhúng/tham chiếu, toán tử cập nhật mảng, truy vấn mảng, Aggregation, Index + explain, sao lưu/phục hồi)
đều có một chỗ dùng thật trong hệ thống, kèm truy vấn mẫu chạy được.

---

## 0. Hiện trạng (đã kiểm ngày 18/11)

| Điểm | Thực tế trong code | Hệ quả |
|---|---|---|
| Danh mục | `sanphams` + `chitietsanphams` + 6 collection danh mục kiểu bảng SQL, nối bằng `populate` | Giống SQL Server chuyển sang |
| Thông số vợt | `chitietsanphams.thongSo` là 5 chuỗi: `"Nặng đầu"`, `"4U (80-84g)"`, `"Cứng"`, `"675mm"`, `"20-28 lbs"` | MongoDB không lọc/đánh index được; backend đọc chuỗi bằng JS (`catalog/vot-thong-so.ts`) |
| Lọc danh sách | `CatalogService.tatCaSanPham()` tải hết rồi `loc()` lọc trong RAM | Không có truy vấn nào để `explain` |
| Tủ vợt + nhắc căng | Chỉ ở localStorage (`frontend/lib/tu-vot.ts`, khoá `tu-vot:v1`, `cang-du-dinh:v1`) | Đổi máy là mất; hệ thống không có dữ liệu |
| Đánh giá | `phanhois`: nội dung, sao, `daXacMinh`; seed chỉ có 3 bản ghi | Không biết người viết chơi thế nào |
| Hồ sơ khách | `khachhangs`: họ tên, email, SĐT, địa chỉ. **Chưa có API sửa hồ sơ** | Phải thêm |
| Mongo cục bộ | 8.3.11, **standalone** (`rs.status()` → `NoReplicationEnabled`) | Không chạy được transaction / change stream |
| Dữ liệu team | `backend/seed-data/mongodb` (16 collection) **chỉ có trên `main`**; gộp thử `main` vào nhánh này: không xung đột | Phải gộp ở M0 |
| Đã làm tốt | Đơn hàng nhúng dòng hàng (chụp giá); `$inc` tồn kho có điều kiện; TTL + unique kép ở giỏ | Giữ nguyên, đưa vào báo cáo |

Dữ liệu thật đáng chú ý: 27 vợt, mọi biến thể đều có đủ 5 trường thông số. Trọng lượng luôn dạng `nU (a-bg)`,
sức căng luôn dạng `a-b lbs`. Cân bằng chỉ là **chữ** (không có số mm) nên **không được tự điền mm**: giữ theo
bậc (−2…3) như `bacCanBang` đang làm. Danh mục **không có sản phẩm dây cước**.

---

## 1. Bốn quyết định cần chốt trước khi code

1. **Chạy MongoDB dạng replica set 1 node (`rs0`)** cho cả team. *Đề xuất: có.* Cần để có transaction (M4, M5).
   Chi phí: mỗi máy sửa `mongod.cfg` (`replication: { replSetName: rs0 }`) rồi gọi `rs.initiate()` một lần;
   `MONGODB_URI` thêm `?replicaSet=rs0`. Nếu không chọn: bỏ transaction, dùng cập nhật nguyên tử như đơn hàng hiện tại.
2. **Dữ liệu mẫu cho thống kê.** Aggregation chỉ có ý nghĩa khi có vài trăm bản ghi, mà dữ liệu thật mới có 3 đánh giá.
   *Đề xuất:* script sinh dữ liệu mẫu, mọi bản ghi gắn `laDuLieuMau: true`. Trang công khai **không** tính các bản ghi này;
   chỉ báo cáo admin và file truy vấn mẫu dùng tới (có ghi rõ "dữ liệu mẫu"). Giống cách `daXacMinh` đang chặn đánh giá chưa xác minh.
3. **Thông tin chấn thương** (đau cổ tay, vai, khuỷu) là dữ liệu sức khoẻ. *Đề xuất:* không bắt buộc, chỉ dùng để lọc nhóm,
   không bao giờ hiện kèm tên người viết; bản chụp trong đánh giá chỉ lưu khi người viết đồng ý.
4. **Phạm vi giao diện.** *Đề xuất:* chỉ nối UI tối thiểu: trang `/tu-vot` đọc/ghi API khi đã đăng nhập (giữ localStorage
   cho khách vãng lai), form hồ sơ người chơi, khối "Người chơi giống bạn nói gì" ở trang chi tiết vợt. Không làm lại giao diện.

---

## 2. Thiết kế dữ liệu

Quy ước: tên collection và trường giữ kiểu tiếng Việt không dấu như code hiện có. Đơn vị căng chuẩn hoá trong DB là **lbs**
(nhà sản xuất ghi lbs); kg người dùng nhập được giữ nguyên bên cạnh, đổi theo 1 kg = 2,20462262 lbs (hằng số đã dùng ở `lib/cuoc-cang`).

### 2.1 `chitietsanphams`: thêm `thuocTinh` (Attribute pattern)

Giữ `thongSo` chuỗi để hiển thị. Thêm mảng thuộc tính dạng số để lọc, **chỉ ghi những gì đọc được từ chuỗi gốc**:

```js
thuocTinh: [
  { k: "canBangBac",   v: 2 },     // -2 rất nhẹ đầu … 3 rất nặng đầu (theo bacCanBang)
  { k: "doCungBac",    v: 2 },     // 0 mềm … 3 rất cứng (theo bacDoCung)
  { k: "trongLuongU",  v: 4 },
  { k: "trongLuongMinG", v: 80 }, { k: "trongLuongMaxG", v: 84 },
  { k: "chieuDaiMm",   v: 675 },
  { k: "sucCangMinLbs", v: 20 }, { k: "sucCangMaxLbs", v: 28 },
  { k: "loiChoi",      v: "cong" } // có thể nhiều phần tử, theo loiChoiCuaVot
]
```

- Vì sao Attribute pattern: vợt, giày, áo có bộ thông số khác nhau. Một index `{ "thuocTinh.k": 1, "thuocTinh.v": 1 }`
  phục vụ mọi thuộc tính, kể cả thuộc tính thêm sau. Bên SQL phải làm bảng EAV hoặc mỗi loại một bảng.
- Truy vấn dùng `$elemMatch` (đúng slide 57):
  `{ thuocTinh: { $all: [ { $elemMatch: { k: "canBangBac", v: { $gte: 1 } } }, { $elemMatch: { k: "trongLuongU", v: 4 } } ] } }`
- Validator `$jsonSchema` (mức `moderate` để không chặn bản ghi cũ): `k` là chuỗi trong danh sách cho phép, `v` là số hoặc chuỗi.

### 2.2 `khachhangs`: nhúng `hoSoChoi`

```js
hoSoChoi: {
  trinhDo: "moi" | "phong-trao" | "kha" | "thi-dau",
  noiDung: ["don", "doi"],          // mảng, $addToSet / $pull
  loiChoi: "cong" | "toc" | "toan" | null,
  tayThuan: "phai" | "trai" | null,
  chanThuong: ["co-tay", "vai", "khuyu-tay"],  // tuỳ chọn, xem quyết định 3
  soBuoiMoiTuan: 0..14,
  capNhatLuc: Date
}
```

Nhúng vì luôn đọc cùng khách hàng, nhỏ và không tăng mãi. Index: `{ "hoSoChoi.trinhDo": 1, "hoSoChoi.noiDung": 1 }`
cho báo cáo; **sparse** vì khách cũ chưa có hồ sơ (đúng slide 91–92).

### 2.3 `phanhois`: đánh giá có ngữ cảnh người chơi

Thêm vào schema đang có:

```js
bienThe: ObjectId,                 // 3U hay 4U: ảnh hưởng cảm nhận
nguoiDanh: { trinhDo, noiDung: [...], loiChoi, chanThuong: [...] },  // BẢN CHỤP lúc viết, như đơn hàng chụp giá
mucCangKhiDungLbs: Number,         // tuỳ chọn
the: ["nang-tay", "de-dieu-khien", "rung-tay", "dap-uy-luc", "phan-tat-nhanh"],  // $addToSet
huuIch: [ObjectId],  soHuuIch: Number,  // bấm "hữu ích": $addToSet + $inc có điều kiện, bỏ: $pull
daMuaHang: Boolean,                // đối chiếu donhangs đã hoàn thành có sản phẩm này
laDuLieuMau: Boolean
```

- Vì sao chụp hồ sơ thay vì tham chiếu: hồ sơ thay đổi theo thời gian; đánh giá phải phản ánh người viết **lúc viết**
  (Extended reference / snapshot, cùng lý do `donhangs.chiTiet` lưu `donGia`).
- Truy vấn chính (trang chi tiết vợt): một `aggregate` với `$facet`:
  - `tatCa`: điểm TB + số đánh giá;
  - `giongBan`: `$match` cùng `trinhDo` và có chung `noiDung` → điểm TB, số đánh giá;
  - `phanBoSao`: `$group` theo `danhGia`;
  - `theNoiBat`: `$unwind: "$the"` → `$group` → `$sort` → `$limit: 5`.
  Nhóm "giống bạn" dưới 3 đánh giá thì trả `chuaDuDuLieu` thay vì một con số dựa trên 1–2 người.
- Index: `{ sanPham: 1, "nguoiDanh.trinhDo": 1, danhGia: -1 }`; index một phần (`partialFilterExpression: { daXacMinh: true }`)
  để so sánh với sparse trong báo cáo.

### 2.4 `votcanhans` (mới): hộ chiếu một cây vợt cụ thể

```js
{
  khachHang: ObjectId,
  nguon: "mua-tai-shop" | "tu-nhap" | "chuyen-tu-trinh-duyet",
  sanPham: ObjectId?, bienThe: ObjectId?, donHang: ObjectId?,
  ten: String,
  soSerial: String?,                 // unique + sparse (slide 96: {unique:true, sparse:true})
  maCucBo: String?,                  // id "v-uuid" của localStorage, để chuyển dữ liệu không bị nhân đôi
  thongSoChup: { sucCangMinLbs, sucCangMaxLbs, trongLuongU },  // chụp từ biến thể lúc tạo
  ngayMua: Date?, baoHanhDen: Date?,
  chuKyNhacNgay: Number?,            // người dùng tự chọn, như hiện nay
  // Computed pattern: tính sẵn khi ghi để đọc/index nhanh
  lanCangGanNhat: { ngay, mucCangLbs, giaTriNhap, donViNhap, tenDay },
  hanNhacLuc: Date?,                 // = lanCangGanNhat.ngay + chuKyNhacNgay
  soLanCang: Number,
  // Subset pattern: chỉ nhúng 10 lần căng gần nhất; đủ lịch sử ở collection lancangs
  lichSuCang: [ { _id, ngay, mucCangLbs, giaTriNhap, donViNhap, tenDay, coDayMm, noiCang, vuotMucNSX } ],
  suKien: [ { loai: "bao-hanh" | "sua-khung" | "thay-cuoc-dut" | "ghi-chu", ngay, ghiChu } ],
  ghiChu: String, taoLuc: Date, deletedAt: Date?
}
```

- Ghi một lần căng = **một** lệnh nguyên tử:
  `updateOne({ _id, khachHang }, { $push: { lichSuCang: { $each: [lan], $sort: { ngay: -1 }, $slice: 10 } }, $set: { lanCangGanNhat, hanNhacLuc }, $inc: { soLanCang: 1 } })`.
- Căng vượt mức nhà sản xuất:
  - căng ở nơi khác (khách tự ghi): vẫn lưu vì là sự việc có thật, gắn `vuotMucNSX: true` và cảnh báo;
  - đặt căng tại shop (M5): **chặn** ngay trong điều kiện lọc `{ "thongSoChup.sucCangMaxLbs": { $gte: mucCangLbs } }`,
    cùng kiểu chốt chặn với `$inc` tồn kho.
- Validator `$jsonSchema` + `$expr`: `sucCangMinLbs <= sucCangMaxLbs`; `soLanCang >= 0`; giới hạn số phần tử `lichSuCang`.
- Index:
  - `{ khachHang: 1, deletedAt: 1 }`: tủ vợt của tôi;
  - `{ hanNhacLuc: 1 }` + sparse: danh sách vợt đến hạn căng;
  - `{ soSerial: 1 }` unique sparse;
  - `{ khachHang: 1, maCucBo: 1 }` unique, partial (chỉ khi có `maCucBo`): chuyển từ trình duyệt gửi lại cũng không nhân đôi.

### 2.5 `lancangs` (mới): toàn bộ lịch sử căng (tham chiếu)

`{ votCaNhan, khachHang, ngay, mucCangLbs, giaTriNhap, donViNhap, day: { ten, hang, coMm }, noiCang: "shop" | "ngoai",
nguoiDanhChup: { trinhDo, loiChoi }, vuotMucNSX, laDuLieuMau }`

- Tách khỏi `votcanhans` vì tăng không giới hạn (nhúng mãi sẽ phình document; giới hạn 16 MB).
- `nguoiDanhChup` cho phép thống kê theo trình độ mà không `$lookup`.
- Index: `{ votCaNhan: 1, ngay: -1 }`, `{ "nguoiDanhChup.trinhDo": 1, mucCangLbs: 1 }`.

### 2.6 `daycuocs` (mới, nhỏ): danh mục dây cước tham chiếu

Chỉ tên, hãng, cỡ dây (mm). Dùng cho ô chọn dây và thống kê. **Mọi số liệu cỡ dây phải lấy từ trang nhà sản xuất khi nhập,
không điền theo trí nhớ.** Không bán hàng ở đây; đưa dây vào thành sản phẩm là việc riêng, nằm ngoài plan này.

### 2.7 Sơ đồ quan hệ

```
khachhangs ─┬─< votcanhans ─< lancangs
 (hoSoChoi) │      │  └ lichSuCang[≤10] (nhúng)
            │      └─> chitietsanphams (bienThe) ─> sanphams
            ├─< phanhois (nguoiDanh: bản chụp) ─> sanphams
            └─< donhangs (chiTiet: bản chụp) ──> votcanhans tạo khi đơn hoàn thành
```

---

## 3. Các mốc

Mỗi mốc kết thúc bằng: test xanh (`npm test`), file truy vấn mẫu chạy được bằng `mongosh`, và một đoạn trong tài liệu báo cáo.

### M0. Nền móng: XONG 18/11 (4 quyết định ở mục 1 chốt theo đề xuất)
- Đã gộp `main` (commit gộp `0b33538`): có `seed-data` và `data:import`.
- Hướng dẫn bật replica set `rs0`: `backend/db/README.md`. API in trạng thái lúc khởi động (`KiemTraMoiTruongMongo`).
- **Đổi so với dự kiến:**
  - Validator viết bằng TS ở `src/csdl/validators.ts`, không dùng JSON, để test được.
  - Index **không** có file khai báo riêng. Schema Mongoose vẫn là nơi khai báo duy nhất; `db:setup` so với CSDL rồi tạo phần thiếu (`src/csdl/so-sanh-index.ts`).
- Validator `$jsonSchema` (strict/error) cho `sanphams`, `chitietsanphams`, `donhangs`, `khachhangs`, `phanhois`, `taikhoans`.
  - `donhangs` có thêm `$expr` khớp tiền: thành tiền = SL × đơn giá; tổng = Σ thành tiền; sau giảm = tổng − giảm.
  - `taikhoans.matKhau` phải là chuỗi băm bcrypt.
  - Đã đối chiếu: 0 vi phạm trên seed và trên `shop_caulong`.
- Index mới `donhangs.don_cua_khach {khachHang:1, ngayDat:-1, soDonHang:-1}` thay `khachHang_1`. Explain: hết bước SORT.
- `PhanHoi.sanPham` thành `required` trong Mongoose. Spec đối chiếu validator ↔ schema đã bắt được chỗ lệch này.
- `npm run db:setup` / `db:setup:dry`: chạy lại không đổi gì. Truy vấn mẫu `db/truy-van-mau/00–02`.
- Đã kiểm: 270 test xanh; API thật chạy trên CSDL đã gắn validator (đăng ký, giỏ, đặt, huỷ, đánh giá, đổi mật khẩu, admin đổi trạng thái) đều qua.
- **Chưa làm (việc của từng máy):** chạy `npm run db:setup -- --xoa-index-thua` trên CSDL thật; bật `rs0`.

### M1. Chuẩn hoá thông số vợt: XONG 18/11
- `src/catalog/thuoc-tinh.ts`: hàm `thuocTinhTuThongSo` và `dieuKienThuocTinh`. Đọc đủ 8 thuộc tính số ở cả 56 biến thể seed.
- Bằng chứng bộ lọc mới cho kết quả trùng bộ lọc cũ:
  - 4.096 tổ hợp × 56 biến thể khớp `bienTheKhopBoLoc` (unit);
  - 4.095 tổ hợp trên MongoDB thật cho tập sản phẩm trùng (`bo-loc-mongo.spec.ts`, cần `MONGO_TEST_URI`).
- Hook trên schema là nơi duy nhất tính `thuocTinh`:
  - `pre('validate')` khi tạo/insertMany;
  - `pre(update*)` đặt/xoá cùng lệnh với `thongSo`;
  - sửa lẻ `thongSo.x` thì báo lỗi.
- Validator: `thuocTinh` chỉ nhận khoá trong `KHOA_THUOC_TINH`. Index `thuoc_tinh {thuocTinh.k, thuocTinh.v}`.
- `CatalogService.sanPhamKhopThongSo`: `$match` + `$group` trên `chitietsanphams` thay cho việc lọc thông số trong RAM.
  Các bộ lọc khác (loại, hãng, giá, từ khoá) vẫn chạy trong JS như cũ.
- `seed-data/mongodb/chitietsanphams.json` đã có `thuocTinh`. Script `db:chuan-hoa-thong-so` chạy lại không ghi gì.
- Truy vấn mẫu `03-loc-thong-so.mongodb.js`: $elemMatch/$group/$lookup/$unwind/$arrayToObject.
  Bench 50.000 biến thể cho truy vấn "nặng đầu VÀ 4U":
  - không index: đọc 50.000 tài liệu;
  - index đơn `thuocTinh.k`: 50.000 khoá + 50.000 tài liệu, **chậm hơn** không index;
  - index kép `k+v`: 14.297 khoá/tài liệu.
- Ghi chú dữ liệu: Astrox 77 Pro có mô tả "Vợt cân bằng" nhưng thông số ghi "Hơi nặng đầu". Đây là lệch nội dung có sẵn, chưa sửa.
- **Chưa làm (việc của từng máy):** `npm run db:chuan-hoa-thong-so` trên `shop_caulong` thật (dry-run: 56 biến thể cần ghi).

Dự kiến ban đầu:
- Hàm thuần `thuocTinhTuThongSo(thongSo)` dùng lại `bacCanBang`, `bacDoCung`, `loiChoiCuaVot`; thêm đọc `nU (a-bg)`, `a-b lbs`, `675mm`.
  Không đọc được → bỏ thuộc tính đó, không đoán. Test với toàn bộ 41 tổ hợp thông số đang có trong seed.
- Script chuyển dữ liệu `npm run db:chuan-hoa-thong-so -- --dry-run` in báo cáo (bao nhiêu biến thể, thuộc tính nào thiếu), bỏ `--dry-run` mới ghi.
- Admin lưu biến thể thì tính lại `thuocTinh` (một chỗ duy nhất, không để hai bản logic lệch nhau).
- Bộ lọc vợt chuyển xuống MongoDB: `aggregate` trên `chitietsanphams` (`$match` + `$elemMatch`) → `$group` theo `sanPham` → `$lookup` `sanphams`.
  Giữ API trả về y như cũ; test so kết quả cũ/mới trên dữ liệu seed phải trùng 100%.
- Báo cáo hiệu năng: 103 biến thể thì chênh lệch thời gian không đáng kể, nên dùng `totalDocsExamined` / `totalKeysExamined`.
  Thêm DB riêng `shop_caulong_bench` sinh 50.000 biến thể giả để đo như bài `zips` (không index → index đơn → index kép).

### M2. Hồ sơ người chơi: XONG 18/11
- **Đổi so với mục 2.2:**
  - `trinhDo` dùng 3 mức `moi | deu | thi` (Mới chơi / Chơi đều / Thi đấu). Frontend đã có hồ sơ ở Quầy tư vấn (`frontend/lib/ho-so-choi.ts`, localStorage) với đúng bộ khoá này, nên không tạo thêm khái niệm thứ hai.
  - `chanThuong` gồm `co-tay | khuyu-tay | vai`.
- `khachhangs.hoSoChoi` (nhúng, `_id: false`) + validator (enum, `uniqueItems`, `minItems: 1`, `additionalProperties: false`) + index **sparse** `ho_so_choi {hoSoChoi.trinhDo, hoSoChoi.noiDung}`.
- API `GET/PUT/DELETE /auth/ho-so-choi` (chỉ chủ tài khoản).
  - PUT = một lệnh `$set`/`$unset` trên trường con bằng ký pháp chấm; trường trống thì xoá hẳn, hết trường thì `$unset` cả hồ sơ.
  - Lệnh do `lenhCapNhatHoSo` dựng (common/ho-so-choi.ts).
- Trang `/TaiKhoan/HoSoChoi`, có liên kết từ trang Thông tin tài khoản.
  - Lần đầu mở thì điền sẵn trình độ/lối chơi từ Quầy tư vấn.
  - Lưu xong thì Quầy tư vấn trên máy đổi theo; xoá thì dọn luôn.
- `$addToSet`/`$pull` minh hoạ trong `db/truy-van-mau/04-ho-so-choi.mongodb.js` (API dùng PUT ghi đè cả mảng vì form gửi đủ lựa chọn).
- Đã kiểm:
  - unit + e2e (401, 400 với 8 kiểu giá trị sai);
  - MongoDB thật (`ho-so-choi-mongo.spec.ts`);
  - bấm thử giao diện thật: điền sẵn, lưu, sửa, xoá, đối chiếu DB.
- **Chưa làm (việc của từng máy):** chạy `npm run db:setup` để áp validator mới cho `khachhangs` và tạo index `ho_so_choi`.

Dự kiến ban đầu:
- API `GET/PATCH /auth/ho-so-choi`, đặt cạnh các API tài khoản đang có trong `AuthController` (validate bằng DTO; `noiDung`, `chanThuong` cập nhật bằng `$addToSet`/`$pull`).
- Form trong trang `TaiKhoan` (`frontend/app/(site)/TaiKhoan`). Lấp luôn chỗ thiếu "không có API sửa hồ sơ" đã ghi nhận.

### M3. Đánh giá theo ngữ cảnh: XONG 18/11
- `phanhois` có thêm các trường:
  - `bienThe`;
  - `nguoiDanh`: bản chụp hồ sơ lúc viết, mặc định có; `chanThuong` chỉ khi đồng ý riêng và không bao giờ trả công khai;
  - `the`: 8 thẻ cảm nhận;
  - `huuIch` + `soHuuIch`;
  - `daMuaHang`: đối chiếu đơn đã hoàn thành có `chiTiet.sanPham`;
  - `laDuLieuMau`.
- Validator có thêm `$expr`: `soHuuIch` = số phần tử `huuIch`.
- Index:
  - kép `danh_gia_theo_nhom {sanPham, nguoiDanh.trinhDo, danhGia:-1}`: không cần SORT;
  - partial `cong_khai_moi_nhat {sanPham, ngayPhanHoi:-1}`, `partialFilterExpression: {daXacMinh:true}`.
- Bộ lọc công khai thành hàm `locPhanHoiCongKhai()`: loại `laDuLieuMau` trừ khi `HIEN_DU_LIEU_MAU=true` (máy demo; API trả `coDuLieuMau` để ghi rõ).
- API:
  - `GET /phan-hoi/san-pham/:id?trinhDo=&noiDung=`: MỘT `$facet` gồm tất cả, phân bố sao, thẻ nổi bật, theo trình độ, đã mua, giống bạn (ngưỡng 3);
  - `POST /phan-hoi/:id/huu-ich`: bật/tắt bằng cập nhật có điều kiện, không tự bấm cho mình.
- Frontend:
  - form đánh giá có thẻ, phiên bản, đồng ý kèm hồ sơ/chấn thương;
  - khối `NguoiChoiGiongBan`;
  - chip người viết / đã mua / phiên bản;
  - nút Hữu ích.
- Đã kiểm:
  - unit (11);
  - MongoDB thật (5): `$facet` khớp số tính tay, bấm song song 5 lần chỉ +1, `$expr` chặn;
  - HTTP smoke đủ luồng;
  - truy vấn mẫu `05-danh-gia-theo-nhom.mongodb.js`.

Dự kiến ban đầu:
- Gửi đánh giá: tự chụp `hoSoChoi` (nếu khách đồng ý), tự tính `daMuaHang` bằng một truy vấn trên `donhangs`
  (index `{ khachHang: 1, "chiTiet.sanPham": 1, trangThai: 1 }`).
- API `GET /san-pham/:id/danh-gia?trinhDo=&noiDung=` trả kết quả `$facet` ở mục 2.3.
- Nút "hữu ích": bấm hai lần không cộng hai lần (điều kiện `huuIch: { $ne: toi }` nằm cùng lệnh `$inc`).
- Khối "Người chơi giống bạn nói gì" ở trang chi tiết vợt; chưa đủ dữ liệu thì nói thẳng.

### M4. Hộ chiếu cây vợt: XONG 18/11
- `votcanhans`:
  - **Subset pattern:** nhúng 10 lần căng gần nhất.
  - **Computed pattern:** `lanCangGanNhat`, `hanNhacLuc`, `soLanCang`.
  - `thongSoChup`: chụp khoảng căng từ `thuocTinh` của phiên bản.
  - `maNguon`: khoá idempotent, `cb:` khi chuyển từ trình duyệt, `dh:` khi tạo từ đơn hàng.
  - Index: `tu_vot_cua_khach`, sparse `han_nhac`, partial unique `so_serial` và `ma_nguon`.
- `lancangs`: lịch sử đầy đủ, chụp trình độ/lối chơi của người căng, cờ `vuotMucNSX`.
  - Index: `lich_su_cua_vot`, `muc_cang_theo_trinh_do`.
- **Đổi so với dự kiến:** bỏ `daycuocs`. Tên dây do khách tự nhập, để không phải bịa số liệu cỡ dây.
- Ghi lần căng bằng MỘT update pipeline:
  - `$concatArrays` + `$sortArray` + `$slice`;
  - `$first` lấy lần mới nhất, `$dateAdd` tính hạn nhắc;
  - giá trị người dùng nhập được bọc `$literal`.
- Hai collection được ghi cùng lúc theo hai đường:
  - có replica set: transaction;
  - standalone: ghi `lancangs` trước rồi bù trừ (xoá) nếu bước cập nhật hộ chiếu lỗi.
- Căng **tại shop** vượt mức tối đa của nhà sản xuất thì bị chặn; căng ở ngoài thì vẫn ghi và gắn cờ.
- Đơn chuyển sang "Đã hoàn thành": tạo hộ chiếu cho từng cây vợt (bỏ qua giày/áo) trong cùng transaction với việc đổi trạng thái.
- API `/tu-vot` gồm: CRUD, `lan-cang`, `su-kien`, `chuyen-tu-trinh-duyet`.
- Frontend: `/tu-vot` dùng `TuVotTaiKhoan` cho khách đã đăng nhập (nút chuyển dữ liệu từ trình duyệt; ghi lần căng; sổ căng; chu kỳ nhắc). Khách vãng lai vẫn dùng bản localStorage.
- Đã kiểm:
  - unit (8);
  - MongoDB thật **cả standalone lẫn replica set** (16): transaction huỷ hoặc bù trừ không để lần căng mồ côi;
  - validator được máy chủ chấp nhận (8): test này bắt được lỗi `exclusiveMinimum` và đã sửa;
  - e2e 26;
  - bấm thử giao diện trên replica set;
  - truy vấn mẫu `06-ho-chieu-vot.mongodb.js` (có phần transaction abort).
- Giới hạn còn lại: chấm đỏ nhắc trên thanh điều hướng vẫn chỉ đếm vợt trong localStorage.

Dự kiến ban đầu:
- API CRUD `votcanhans` + `POST /tu-vot/:id/lan-cang` (một lệnh nguyên tử, mục 2.4) + ghi `lancangs`.
  Có replica set: hai lần ghi trong **một transaction**; không có: ghi `lancangs` trước rồi cập nhật hộ chiếu, có thể chạy lại không nhân đôi.
- Chuyển tủ vợt từ localStorage: `POST /tu-vot/chuyen-tu-trinh-duyet` nhận mảng `VotTrongTu`, upsert theo `{ khachHang, maCucBo }`.
  Áp dụng lại bài học đồng bộ giỏ khách: gửi lại hay gửi song song không được nhân đôi.
- Đơn hàng chuyển sang "Đã hoàn thành" → tạo hộ chiếu cho từng dòng là vợt, **trong cùng transaction** với việc đổi trạng thái.
- `/tu-vot` dùng API khi đã đăng nhập; logic nhắc (`tinhNhac`) giữ nguyên, chỉ đổi nguồn dữ liệu.

### M5. Đặt căng tại shop: XONG 18/11
- `lichcangs`: mỗi khung giờ là MỘT document (`sucChua`, `soDaDat`, mảng nhúng `datCho`). Index unique `khung_gio`, multikey `dat_cho_cua_khach`.
- Giữ chỗ: MỘT lệnh có điều kiện `soDaDat < sucChua` + `$push` + `$inc`, với upsert cho khung chưa có document.
  - Khung kín thì upsert đụng index unique và trả lỗi 11000; trường hợp này được thử lại đúng 1 lần.
  - Không cần khoá hay transaction.
- Huỷ: toán tử vị trí `$` trên phần tử khớp `$elemMatch`, cùng `$inc -1`.
- Validator `$expr`: `soDaDat ≤ sucChua` và `soDaDat` = số chỗ chưa huỷ.
- Hoàn tất (nhân viên): chỗ chuyển sang "xong" + ghi lần căng "tại shop" vào sổ (`lancangs` + `votcanhans`).
  - Có replica set: chung MỘT transaction.
  - Standalone: CAS rồi ghi sổ, lỗi thì trả chỗ về "chờ".
  - `TuVotService.ghiLanCangTrongPhien` nhận `session` của người gọi.
- Shop chặn mức căng vượt tối đa nhà sản xuất ngay lúc đặt; một cây vợt chỉ có một lịch đang chờ.
- API:
  - `/lich-cang` (`khung`, đặt, `cua-toi`, huỷ);
  - `/admin/lich-cang` (danh sách, `xong`).
- UI: khách đặt và huỷ ở tủ vợt; nhân viên dùng trang `/admin/lich-cang` (có trong menu admin).
- Đã kiểm:
  - unit 3;
  - MongoDB thật cả 2 chế độ (12 test), trong đó **5 người đặt cùng lúc vào khung 2 chỗ thì đúng 2 người được**;
  - bấm thử giao diện khách + nhân viên trên replica set;
  - truy vấn mẫu `07-lich-cang.mongodb.js`.

Dự kiến ban đầu:
- `lichcangs`: khung giờ có sức chứa; đặt lịch = transaction giữ chỗ + ghi lần căng dự kiến; chặn mức căng vượt NSX.
- Bỏ được mốc này nếu thiếu thời gian, M0–M4 vẫn đủ cho đồ án.

### M6. Báo cáo, dữ liệu mẫu, vận hành: XONG 18/11
- **Dữ liệu mẫu:** `npm run db:du-lieu-mau`, có seed cố định.
  - Gồm 40 người chơi (không có tài khoản), ~80 hộ chiếu, ~730 lần căng, ~160 đánh giá; tất cả gắn `laDuLieuMau`.
  - Quy tắc giả lập ghi ngay trong code; tất cả đều qua validator.
- **Báo cáo** `/admin/bao-cao-csdl` (7 aggregation song song, có công tắc tính dữ liệu mẫu):
  - mức căng theo trình độ ($stdDevPop);
  - phân bố mức căng ($bucket);
  - dây theo lối chơi ($group hai tầng + $slice);
  - chu kỳ căng lại thực tế ($setWindowFields + $shift + $dateDiff + $median);
  - tỉ lệ vượt mức NSX ($cond);
  - vợt được chấm cao theo trình độ ($lookup);
  - vợt đến hạn.
- **Sao lưu/phục hồi** (`db:sao-luu`, `db:phuc-hoi`): dùng mongodump/mongorestore nếu có, không thì bản tự viết giữ cả validator và index.
  Đã chứng minh `dbHash` khớp ở cả 24 collection.
- **Không làm:** cập nhật `seed-data` với collection mới. Các collection này rỗng trong dữ liệu dùng chung, và dữ liệu mẫu được sinh bằng script thay vì lưu file.
- Truy vấn mẫu `08-bao-cao.mongodb.js`.
- Test:
  - `bao-cao-mongo.spec` (7): mỗi pipeline khớp kết quả tính bằng JS;
  - `du-lieu-mau.spec` (4).

Dự kiến ban đầu:
- Sinh dữ liệu mẫu (quyết định 2): ~40 khách có hồ sơ, ~120 hộ chiếu, ~600 lần căng, ~300 đánh giá; cố định seed ngẫu nhiên để cả team ra cùng số.
- Trang báo cáo admin + file `truy-van-mau/bao-cao.mongodb.js`:
  - mức căng trung bình theo trình độ (`$group`), phân bố mức căng (`$bucket`);
  - dây được dùng nhiều nhất theo lối chơi (`$unwind` + `$group` + `$sort`);
  - **chu kỳ căng lại thực tế** của từng người: `$setWindowFields` + `$shift` lấy khoảng cách giữa hai lần căng liên tiếp;
  - tỉ lệ lần căng vượt mức nhà sản xuất;
  - vợt được nhóm "phong trào + đánh đôi" chấm cao nhất (`$match` trên bản chụp + `$group` + `$lookup` tên).
- Cập nhật `seed-data/mongodb` + `manifest.json` cho các collection mới; script `npm run db:backup` / `db:restore` gọi `mongodump` / `mongorestore`.
- Tài liệu báo cáo `docs/csdl/THIET-KE-CSDL.md`: mỗi quyết định thiết kế ghi rõ vì sao nhúng hay tham chiếu.

---

## 4. Đối chiếu với bài giảng

| Slide | Nội dung | Chỗ dùng trong đồ án |
|---|---|---|
| 15–20 | Embedded vs Reference | `hoSoChoi`, `lichSuCang[≤10]` nhúng; `lancangs`, `votcanhans→bienThe` tham chiếu |
| 33–37 | `$set` theo vị trí, trường con | Sửa một lần căng `lichSuCang.$`, sửa `hoSoChoi.trinhDo` |
| 38–39 | `$push`, `$addToSet`, `$pull` | Ghi lần căng (`$push` + `$slice`), thẻ đánh giá, nút hữu ích, `noiDung` |
| 48–59 | Lọc trường, `$in`, regex, so sánh, `$elemMatch`, sort/skip/limit | Bộ lọc vợt theo `thuocTinh`; danh sách vợt đến hạn |
| 62–82 | Aggregation: `$group`, `$project`, `$unwind`, `$push`/`$addToSet`, `$first`/`$last` | Báo cáo M6; `$first` lần căng đầu tiên của mỗi cây vợt |
| 83–99 | Index đơn, kép, sparse, unique | Mục 2: serial unique sparse, `hanNhacLuc`, `thuocTinh.k+v`, đánh giá |
| 110–116 | `explain("executionStats")` | Đo bộ lọc vợt trên DB bench (M1) |
| 27–29 | import/export, dump/restore | `data:import/export`, `db:backup/restore` (M6) |
| Vượt chương trình | `$jsonSchema`, `$facet`, `$bucket`, `$lookup`, `$setWindowFields`, transaction, TTL, partial index | Ghi rõ trong báo cáo là phần mở rộng |

---

## 5. Rủi ro

- **Replica set trên Windows của từng thành viên:** nếu một người không bật được, backend vẫn phải chạy (đường không transaction ở M4).
- **Hai bản logic đọc thông số** (frontend `lib/landing-data.ts` và backend): sau M1, frontend nên đọc `thuocTinh` từ API thay vì tự đọc chuỗi, nhưng làm sau, không gộp vào M1.
- **Dữ liệu mẫu lẫn vào số liệu công khai:** mọi truy vấn công khai phải có `laDuLieuMau: { $ne: true }`; có test riêng cho điều này.
- **Bịa số:** cỡ dây, mức căng khuyến nghị theo trình độ, cân bằng mm. Không có nguồn thì không ghi. Hệ thống chỉ thống kê từ dữ liệu người dùng nhập.
- **Đồ án nhóm:** collection và script mới phải vào `seed-data` để mọi máy có cùng `_id`.
