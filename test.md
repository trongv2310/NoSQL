# Kết quả sửa lỗi sau kiểm thử – Shop Cầu Lông

Ngày sửa: 21/11/2026 · Cơ sở: báo cáo kiểm thử ngày 20/11/2026 (22 điểm cần khắc phục) · Mã nguồn gốc: nhánh `main`, commit `1f1001d`.

**Tóm tắt:** sửa xong **21/22** điểm, **1/22 sửa một phần** (mục 10). Trong lúc chạy lại test tìm thêm **4 lỗi nhỏ** về accessibility, đã sửa luôn. Còn **1 việc chưa xử lý được** (lỗ hổng trong devDependencies của backend, xem cuối file).

---

## 1. Kết quả test trước và sau khi sửa

| Bộ test | Trước (20/11) | Sau (21/11) |
|---|---|---|
| Backend unit (vitest, MongoDB thật) | 852/852 | **863/863** (thêm 11 test cho các lỗi đã sửa) |
| Backend e2e | 25/26 (1 test lỗi thời) | **26/26** |
| Kiểm thử API (255 ca, chạy trên server thật) | 249/255 (6 lỗi = mục 1, 2, 3, 7, 8, 9) | **255/255** |
| UI: duyệt trang + luồng + axe + bàn phím (Playwright, desktop + mobile) | crawl 90/108, axe 0/15, bàn phím trượt | **130/130 test chạy** (22 test chỉ chạy trên desktop nên bị bỏ qua trên mobile, đúng như thiết kế) |
| Frontend unit | 171/171 | **171/171** |
| Frontend typecheck (`tsc`) | đạt | **đạt** |
| Frontend lint (`eslint .`) | 3 lỗi + 1 cảnh báo | **0 lỗi, 0 cảnh báo** |
| Backend lint (`oxlint`) | 0 lỗi, 33 cảnh báo cũ | 0 lỗi, 33 cảnh báo cũ (**không thêm cảnh báo mới**) |
| `next build` khi KHÔNG có Internet | thất bại (Google Fonts) | **thành công** |
| `npm audit` frontend | 7 lỗ hổng mức trung bình | **0** |

---

## 2. Trạng thái từng điểm

Ký hiệu: ✅ đã sửa · 🟡 sửa một phần · ❌ chưa sửa.

### Nghiêm trọng / quan trọng

| # | Vấn đề | Trạng thái | Đã sửa thế nào | File |
|---|---|---|---|---|
| 1 | Danh sách sản phẩm trang admin hiện giá chưa trừ khuyến mãi | ✅ | Populate thêm `khuyenMai` (`populate('loai hang khuyenMai')`), giá admin giờ giống giá khách thấy | `backend/src/admin/admin-san-pham.controller.ts` |
| 2 | Một khách gửi được nhiều đánh giá cho cùng một sản phẩm (kéo điểm trung bình) | ✅ | Kiểm trước khi ghi: đã có đánh giá thì trả **409** “Bạn đã đánh giá sản phẩm này rồi.” Thêm **index unique + partial** `mot_danh_gia_moi_khach` `{khachHang:1, sanPham:1}`, chỉ áp cho đánh giá đã xác minh nên dữ liệu mẫu không bị ảnh hưởng. Index này chặn cả trường hợp hai request gửi song song (E11000 → 409). `db:setup` báo rõ nếu dữ liệu cũ đang có bản trùng | `phan-hoi/phan-hoi.controller.ts`, `schemas/san-pham.schema.ts`, `csdl/thiet-lap.ts` |
| 3 | Tạo / sửa sản phẩm với loại, hãng không tồn tại vẫn thành công | ✅ | Thêm `kiemTraThamChieu()`: kiểm loại, hãng, nhà cung cấp, khuyến mãi có thật trước khi ghi, sai thì 400 (ảnh vừa upload tự bị xoá) | `admin/admin-san-pham.controller.ts` |
| 4 | `next` 16.4.3 có 7 lỗ hổng mức trung bình | ✅ | Nâng `next` và `eslint-config-next` lên **16.4.6**, chạy `npm audit fix` → frontend còn 0 lỗ hổng | `frontend/package.json`, `package-lock.json` |
| 5 | Test e2e lỗi thời (nhân viên đã được xem sản phẩm) | ✅ | Bỏ `/api/admin/san-pham` khỏi danh sách “nhân viên bị chặn”, thay bằng `/api/admin/dashboard` (chỉ Admin) | `backend/test/routing.e2e-spec.ts` |
| 6 | `default-product.jpg`, `default-category.jpg` rỗng 0 byte → ảnh vỡ | ✅ | Tạo ảnh giữ chỗ thật (600×600, hình quả cầu + chữ “Chưa có ảnh…”, khoảng 10 KB) | `frontend/public/images/default-*.jpg` |
| 7 | Trận đấu: ghi tỉ số B thắng nhưng chọn A thắng vẫn lưu được | ✅ | Đếm ván thắng theo tỉ số: bên thắng phải là bên thắng nhiều ván hơn. Từ chối ván hoà (`21-21`) và tỉ số chưa phân định (`21-15, 15-21`) | `admin/admin-danh-muc.controller.ts` |
| 8 | Xem đơn không tồn tại trả 400 | ✅ | Đổi thành **404** `NotFoundException` | `don-hang/don-hang.controller.ts` |

### Trung bình

| # | Vấn đề | Trạng thái | Đã sửa thế nào | File |
|---|---|---|---|---|
| 9 | Lộ `X-Powered-By: Express`, thiếu header bảo mật | ✅ | Thêm **helmet** (`X-Content-Type-Options`, `X-Frame-Options`, HSTS…) và tắt `x-powered-by`. Để `Cross-Origin-Resource-Policy: cross-origin` cho ảnh `/uploads` mà trang Next.js (khác cổng) nhúng vào | `backend/src/app.setup.ts`, `backend/package.json` (thêm `helmet`) |
| 10 | API tủ vợt trả document thô (`_id`, `__v`, `khachHang`) | 🟡 | Đã thêm `id` dạng chuỗi, **bỏ `__v` và `khachHang`** ở mọi phản hồi tủ vợt / lịch sử căng. **Chưa bỏ `_id`**, xem mục 4 | `tu-vot/tu-vot.controller.ts` |
| 11 | Mở trang thanh toán khi giỏ trống → request 400 đỏ trong console | ✅ | `GET /api/don-hang/checkout` trả 200 với `items: []`, trang tự quay về giỏ hàng. Đặt hàng với giỏ trống (`POST /checkout`, `POST /momo`) **vẫn bị chặn 400** | `don-hang/don-hang.controller.ts`, `frontend/app/(site)/DonHang/Checkout/page.tsx` |
| 12 | Build phụ thuộc Google Fonts và CDN cdnjs | ✅ | Font Inter và Barlow Condensed tự host qua `@fontsource/*`, icon qua `@fortawesome/fontawesome-free` (npm), nạp ở `app/layout.tsx`. Bỏ `next/font/google` và thẻ `<link>` CDN. Trang tĩnh `/trai-nghiem` cũng dùng font tự host (`fonts.css` + 27 file woff2, khoảng 540 KB, chỉ giữ bộ latin / latin-ext / vietnamese). `next build` chạy được khi không có mạng | `app/layout.tsx`, `components/landing/fonts.ts`, `public/css/theme.css`, `public/trai-nghiem/index.html`, `public/trai-nghiem/fonts*` |
| 13 | Logo 1792 px / 192 KB cho chỗ hiển thị 36–56 px | ✅ | Thu về **256×256, 18 KB** (giữ gấp đôi cỡ hiển thị lớn nhất cho màn hình retina) | `frontend/public/images/HUIT.jpg` |
| 14 | Danh sách quản trị phân trang trong bộ nhớ (tải hết rồi cắt) | ✅ | Thêm helper `phanTrangDb()`: `countDocuments` + `skip/limit` ngay trong MongoDB. Áp dụng cho **6 danh sách quản trị**: sản phẩm, đơn hàng, tài khoản, khuyến mãi, trận đấu, bản tin. Danh sách khuyến mãi và trận đấu giờ chỉ đếm số sản phẩm / bài viết của những dòng trong trang hiện tại | `common/helpers.ts`, `admin/admin-san-pham.controller.ts`, `admin/admin-van-hanh.controller.ts`, `admin/admin-danh-muc.controller.ts`, `admin/admin-ban-tin.controller.ts` |
| 15 | Lint frontend lỗi do `three.min.js` | ✅ | ESLint bỏ qua `public/**`. Sửa luôn cảnh báo ở MoMoMockGateway (`window.location.href` → `router.replace`) → 0 lỗi, 0 cảnh báo | `frontend/eslint.config.mjs`, `app/(site)/DonHang/MoMoMockGateway/page.tsx` |
| 16 | 3 trang không có `<h1>` | ✅ | Đổi tiêu đề chính thành `<h1>`, giữ nguyên cỡ chữ cũ bằng class `h2` / `h4`: `/Home/Index`, `/TaiKhoan/DoiMatKhau`, `/ThemPhanHoiSP/ReviewForm/[maSP]` | 3 file `page.tsx` tương ứng |

### Accessibility (WCAG 2.1 AA)

| # | Vấn đề | Trạng thái | Đã sửa thế nào | File |
|---|---|---|---|---|
| 17 | Chữ trắng trên nút xanh #148f5f chỉ đạt 4,09:1 | ✅ | Màu chủ đạo đổi thành **#117a51** (5,35:1), áp cho `--brand`, `--bs-primary`, `--bs-success` và các `rgba` dẫn xuất; màu hover `--brand-700` đổi thành #0c6142 | `public/css/theme.css`, `public/css/Site.css` |
| 18 | Nhãn giảm giá chữ đỏ trên nền cam (1,79:1) | ✅ | Chữ trắng trên đỏ đậm #b42318 (6,57:1) | `public/css/Site.css` |
| 19 | Chữ xám nhỏ ở trang chi tiết sản phẩm thiếu tương phản | ✅ | Bộ đếm ảnh, SKU, ghi chú tồn kho, mô tả “sản phẩm liên quan” dùng #55635a / #3f6b4c. `--muted` (dùng cho `.text-muted`) đổi thành #5b6a62, đạt 4,5:1 cả trên nền xanh nhạt | `public/css/Site.css`, `public/css/theme.css` |
| 20 | `flash-dock` có `aria-label` nhưng không có role | ✅ | Thêm `role="region"` | `components/AppProviders.tsx` |
| 21 | Ô tìm kiếm nhận focus bằng Tab nhưng không có viền focus | ✅ | Thêm `:focus-visible` (viền 2px màu chủ đạo) cho ô tìm kiếm ở header và ô tìm kiếm trang Bảng tin | `public/css/Site.css`, `public/css/storefront-news.css` |
| 22 | Header dính che phần tử khi trình duyệt tự cuộn tới | ✅ | `html { scroll-padding-top: 120px; }` | `public/css/theme.css` |

---

## 3. Lỗi tìm thêm trong lúc chạy lại test (đã sửa)

| Lỗi | Phát hiện bằng | Cách sửa | File |
|---|---|---|---|
| Link trong dòng đường dẫn (breadcrumb) ở trang chi tiết sản phẩm chỉ phân biệt với chữ thường bằng màu (axe `link-in-text-block`) | axe | Gạch chân link, thêm `aria-label="Đường dẫn"` cho `<nav>` | `Home/ChiTietSanPham/[id]/page.tsx`, `public/css/Site.css` |
| Icon cúp “Đội thắng” ở Bảng tin có `aria-label` nhưng thiếu role (axe `aria-prohibited-attr`) — chỉ lộ ra sau khi icon Font Awesome tải được | axe | Thêm `role="img"` | `components/News.tsx` |
| Ô tìm kiếm trang Bảng tin không có viền focus | Kiểm thử bàn phím | Thêm `:focus-visible` | `public/css/storefront-news.css` |
| Trang `/trai-nghiem` vẫn gọi Google Fonts → lỗi console khi không có mạng | Crawl Playwright | Tự host font (xem mục 12) | `public/trai-nghiem/*` |

---

## 4. Chưa sửa được / còn tồn đọng

| Việc | Vì sao chưa làm | Hướng xử lý |
|---|---|---|
| **Mục 10 – API tủ vợt vẫn còn `_id`** | Giao diện tủ vợt (`components/TuVotTaiKhoan.tsx`) và trang lịch căng đang đọc `_id` ở rất nhiều chỗ (sửa vợt, xoá vợt, lịch sử căng, đặt chỗ). Bỏ `_id` ngay sẽ làm hỏng các chức năng đó, nên tạm giữ song song `id` + `_id` | Đổi các chỗ `v._id` / `l._id` trong `TuVotTaiKhoan.tsx` sang `id`, rồi xoá `_id` trong hàm `xemTaiLieu()` ở `tu-vot.controller.ts` |
| **Backend còn 5 lỗ hổng trong devDependencies** (`tmp`, `undici`: 2 cao, 1 trung bình, 2 thấp) | Chỉ nằm trong công cụ phát triển (`@nestjs/cli`, công cụ test), **không có trong bản chạy thật**: `npm audit --omit=dev` = 0. `npm audit fix` thường đã giảm từ 7 xuống 5. Phần còn lại cần `npm audit fix --force` (cài bản `@nestjs/*` có thay đổi phá vỡ) nên không tự chạy | Chờ `@nestjs/cli` ra bản mới rồi `npm update`, hoặc thử `--force` trên một nhánh riêng và chạy lại toàn bộ test |
| Danh mục công khai (`/api/san-pham`) và gợi ý trang chủ vẫn lọc / phân trang trong bộ nhớ (`phanTrang` ở `catalog.service.ts`, `cong-khai.service.ts`) | Không thuộc 22 điểm. Bộ lọc dựa trên giá sau khuyến mãi, tồn kho và thông số kỹ thuật được tính ở ứng dụng, chuyển sang `skip/limit` cần viết lại thành một pipeline aggregation | Có thể làm tiếp khi dữ liệu lớn; với khoảng 90 sản phẩm hiện tại chưa ảnh hưởng tốc độ |
| Header `Strict-Transport-Security` (do helmet thêm) | Không phải lỗi: trình duyệt bỏ qua HSTS khi chạy `http://localhost`, chỉ có hiệu lực khi triển khai HTTPS | Không cần làm gì |

---

## 5. Việc cần làm trên máy Windows sau khi nhận code

```bat
cd E:\NoSQL\backend
npm install            :: cài helmet và lockfile mới
npm run db:setup       :: tạo index mới mot_danh_gia_moi_khach cho phanhois

cd E:\NoSQL\frontend
npm install            :: next 16.4.6, @fontsource/*, @fortawesome/fontawesome-free
```

- Nếu `db:setup` báo *“không tạo được index unique … vì dữ liệu đang có bản trùng”*: trong database đang có một khách đánh giá cùng sản phẩm nhiều lần (thường do chạy bộ kiểm thử API). Hai cách xử lý:
  - chạy `npm run data:import:reset` rồi `npm run db:setup`;
  - hoặc xoá các bản trùng bằng mongosh.
- Chạy lại test:
  - `npm test` và `npm run test:e2e` trong `backend`;
  - `npx vitest run --config ./vitest.config.api.mts` (cần backend đang chạy);
  - `npx playwright test` trong `kiem-thu-ui`, không còn cần biến `BO_QUA_CDN`.

## 6. Test mới thêm

- `backend/src/admin/sua-loi-kiem-thu.spec.ts` gồm 7 test:
  - `phanTrangDb` đọc đúng trang và kéo trang vượt quá về trang cuối; không có dữ liệu thì không đọc trang nào;
  - tạo sản phẩm với loại / nhà cung cấp / hãng / khuyến mãi không tồn tại → 400, không ghi DB;
  - danh sách admin populate `khuyenMai`.
- `backend/src/admin/admin-tran-dau.spec.ts` thêm 4 ca: tỉ số không khớp bên thắng, ván hoà, tỉ số chưa phân định.
- Các file test cũ được cập nhật mock để hợp với phân trang trong MongoDB:
  - `admin-xoa-an.spec.ts`, `admin-tran-dau.spec.ts`, `admin-tai-khoan.spec.ts`, `admin-san-pham-anh.spec.ts`;
  - `catalog.service.spec.ts`: mỗi đánh giá đã xác minh một khách riêng, theo index unique mới.
