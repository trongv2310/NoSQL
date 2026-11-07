# Bộ dữ liệu MongoDB dùng chung cho team

Bộ dữ liệu mẫu để mọi thành viên thử nghiệm trên **cùng một dữ liệu, cùng ObjectId** (đường dẫn như
`/Home/ChiTietSanPham/<id>` mở được trên máy của bất kỳ ai). Khác với `npm run seed:reset` (nạp từ `legacy.json`,
mỗi lần chạy sinh ObjectId mới), bộ này là bản chụp cố định của CSDL.

## Nội dung

| Collection | Số tài liệu | Ghi chú |
|---|---:|---|
| `sanphams` | 48 | 27 vợt (đủ độ cân bằng, độ cứng, trọng lượng), 10 giày, 6 trang phục, 5 phụ kiện |
| `chitietsanphams` | 103 | biến thể (màu/size), tồn kho, thông số vợt |
| `loaisanphams`, `hangs`, `nhacungcaps`, `mausacs`, `sizes` | 4 · 4 · 5 · 10 · 26 | danh mục, hãng (Yonex, Li-Ning, Victor, Mizuno) |
| `khuyenmais` | 8 | chương trình khuyến mãi (xem lưu ý hạn dưới đây) |
| `taikhoans`, `khachhangs` | 4 · 4 | 1 quản trị, 1 nhân viên, 2 khách |
| `donhangs`, `counters` | 24 · 1 | đơn mẫu đủ các trạng thái cho trang thống kê |
| `phanhois` | 3 | đánh giá sản phẩm |
| `tintucs`, `trandaus`, `cauhinhs` | 12 · 11 · 3 | bảng tin, kết quả thi đấu, cấu hình logo/footer |

Không có: giỏ hàng, nhật ký lỗi, lịch sử đổi giá (dữ liệu phát sinh khi dùng, nên không đưa vào bộ dùng chung).
Mọi tham chiếu ảnh đều trỏ tới file có sẵn trong `frontend/public/images`.

### Tài khoản mẫu

| Tên đăng nhập | Mật khẩu | Vai trò | Đăng nhập tại |
|---|---|---|---|
| `admin` | `admin@123` | Quản trị viên | `/admin` |
| `nhanvien_banhang` | `nv@123` | Nhân viên bán hàng | `/admin` |
| `nguyenvana` | `vana@123` | Khách hàng | `/TaiKhoan/DangNhap` |
| `tranthib` | `thib@123` | Khách hàng | `/TaiKhoan/DangNhap` |

Đây là dữ liệu giả để thử nghiệm (mật khẩu trong file đã băm bcrypt). **Không dùng cho môi trường thật.**

## Nhập dữ liệu

Cần MongoDB đang chạy và file `backend/.env` (xem `.env.example`). Chạy trong thư mục `backend`:

```bash
npm run data:import          # chỉ nhập khi CSDL còn trống
npm run data:import:reset    # xóa sạch dữ liệu của hệ thống rồi nhập lại (dùng khi muốn trở về dữ liệu gốc)
```

- Script giữ nguyên ObjectId, tạo index (`sku`, `tenDangNhap`… duy nhất) trước khi nhập và kiểm tra số tài liệu khớp `manifest.json`.
- `--reset` **chỉ chạy trên MongoDB của máy này** (`localhost`/`127.0.0.1`); muốn chạy trên máy chủ khác phải thêm `--force`.
- Chỉ xóa tài liệu trong các collection của hệ thống (khai báo trong `src/schemas`), không đụng collection khác trong cùng CSDL.

### Không muốn dùng script của dự án?

Mỗi file là một mảng JSON ở dạng Extended JSON nên nhập được bằng công cụ chính thức của MongoDB:

```bash
mongoimport --db shop_caulong --collection sanphams --jsonArray --file seed-data/mongodb/sanphams.json
```

Nhớ tự tạo index duy nhất (`chitietsanphams.sku`, `taikhoans.tenDangNhap`) nếu nhập kiểu này; script `data:import` làm sẵn việc đó.

## Cập nhật bộ dữ liệu

Khi thay đổi dữ liệu mẫu (thêm sản phẩm, đơn…), xuất lại và commit cùng thay đổi:

```bash
npm run data:export
```

**Chỉ xuất từ CSDL sạch** (vừa `npm run data:import:reset`, rồi chỉ chỉnh những gì muốn đưa vào bộ mẫu). Script xuất mọi thứ đang có trong CSDL;
nếu CSDL có đơn thử, tài khoản tự tạo hay dữ liệu cá nhân, chúng sẽ đi vào file và lên git.
File được sắp theo `_id`, mỗi tài liệu một dòng nên `git diff` chỉ hiện phần thật sự đổi.

## Lưu ý

- **Khuyến mãi có hạn:** các chương trình giảm giá trong dữ liệu kết thúc từ 05/2027 đến 12/2027. Sau đó giá/nhãn giảm giá sẽ biến mất;
  cần gia hạn `ngayKetThuc` trong `khuyenmais.json` (hoặc sửa trong trang quản trị rồi xuất lại).
- **Ảnh upload:** ảnh do người dùng tải lên qua trang quản trị nằm trong `backend/uploads` (không có trong repo); dữ liệu mẫu chỉ dùng ảnh tĩnh có sẵn.
- Dữ liệu gốc của bộ này lấy từ `legacy.json` (xem `tools/export-laravel-seed.php`) cộng 24 đơn mẫu do seeder sinh.
