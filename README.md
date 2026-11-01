# Shop Cầu Lông – NestJS + Next.js + MongoDB

Bản chuyển đổi của dự án Laravel `php_caulong` (MySQL, Blade) sang:

| Lớp | Công nghệ |
|---|---|
| Backend API | **NestJS 12** (TypeScript) + **Mongoose** |
| Cơ sở dữ liệu | **MongoDB** |
| Frontend | **Next.js 16** (App Router, TypeScript, React 19) |
| Xác thực | JWT trong cookie `httpOnly` (thay cho session của Laravel) |

```
backend/    API NestJS (cổng 4000, tiền tố /api)
frontend/   Giao diện Next.js (cổng 3000) – proxy /api và /uploads sang backend
```

## Chạy thử

Yêu cầu: Node.js ≥ 20, MongoDB ≥ 6 (cài sẵn hoặc `docker run -d -p 27017:27017 --name mongo mongo:7`).

```bash
# 1. Backend
cd backend
cp .env.example .env          # chỉnh MONGODB_URI, JWT_SECRET...
npm install
npm run seed:reset            # nạp dữ liệu mẫu (48 sản phẩm, 103 biến thể, tin tức, 24 đơn mẫu)
npm run start:dev             # http://localhost:4000/api

# 2. Frontend (terminal khác)
cd frontend
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

Tài khoản mẫu (lấy từ seeder gốc): `admin / admin@123`, `nhanvien_banhang / nv@123`, `nguyenvana / vana@123`, `tranthib / thib@123`.
Trang quản trị: `/admin` (admin và nhân viên đăng nhập tại đây).

## Ánh xạ Laravel → NestJS

| Laravel | NestJS / MongoDB |
|---|---|
| Migration + Eloquent Model | Schema Mongoose trong `backend/src/schemas` |
| Controller + `routes/web.php` | Controller theo module (`catalog`, `gio-hang`, `don-hang`, `cong-khai`, `admin/*`) |
| FormRequest | DTO + `class-validator` (thông báo lỗi tiếng Việt giữ nguyên) |
| Middleware `check.login` / `role:` | `AccessGuard` + decorator `@CanDangNhap()` / `@Roles(...)` |
| Session + `Auth::user()` | JWT cookie + `@CurrentUser()` |
| `OrderService` (DB::transaction) | `OrderService` (trừ kho bằng `$inc` có điều kiện, hoàn kho khi lỗi) |
| `MomoPaymentService`, `GeminiChatbotService` | `MomoService`, `ChatbotService` (dùng `fetch`) |
| Seeder | `npm run seed` đọc `backend/seed-data/legacy.json` |
| Blade view | Trang React trong `frontend/app` (giữ nguyên URL kiểu `/SanPham/Index`, `/DonHang/Checkout`…) |

CSS (`Site.css`, `theme.css`, `landing.css`…) và ảnh được chép nguyên từ `public/` của bản Laravel nên giao diện giữ nét cũ.

## Thiết kế dữ liệu MongoDB

Khóa chính số tăng dần của MySQL được thay bằng `ObjectId`. Quyết định embed/reference:

- **Embed** `ThongSoVot` vào biến thể (`chitietsanphams.thongSo`) – luôn đọc cùng nhau.
- **Embed** `ChiTietDonHang` vào đơn (`donhangs.chiTiet[]`) kèm *ảnh chụp* tên, SKU, màu, size, đơn giá lúc đặt → đơn cũ không đổi khi sản phẩm bị sửa/xóa.
- Bảng `PhanQuyen` bỏ đi, thay bằng `maQuyen` (1 Admin, 2 Nhân viên, 3 Khách).
- **Reference** các quan hệ còn lại (sản phẩm → loại/hãng/khuyến mãi; biến thể → sản phẩm/màu/size; giỏ hàng; đánh giá; tin tức).
- Đơn hàng có thêm `soDonHang` (số tăng dần qua collection `counters`) để hiển thị `#12` và làm `orderId` gửi MoMo.
- Xóa mềm (`deletedAt`) giữ nguyên cho sản phẩm và tin tức.
- Giá sau khuyến mãi tính trong code (`backend/src/common/pricing.ts`), danh mục sản phẩm nhỏ nên lọc/sắp xếp trong bộ nhớ.

### Chuyển dữ liệu thật từ MySQL

`npm run seed -- --reset --file=duong/dan.json` nhận file JSON có dạng `{ "TenBang": [ {cột...}, ... ] }` với đúng tên bảng/cột của Laravel
(`SanPham`, `ChiTietSanPham`, `ThongSoVot`, `DonHang`, `ChiTietDonHang`…) và tự đổi khóa ngoại số sang `ObjectId`.
`backend/tools/export-laravel-seed.php` là ví dụ cách sinh `legacy.json` từ các seeder PHP (không cần cài Laravel).

## Kiểm thử

```bash
cd backend && npm test                                  # unit: tính giá, luật chuyển trạng thái đơn, chữ ký MoMo, parse ngày
cd backend && npx vitest run --config ./vitest.config.e2e.mts   # e2e: định tuyến, phân quyền 401/403, validation (không cần MongoDB)
cd frontend && npm run lint && npm run build
```

## Biến môi trường chính (`backend/.env`)

`MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `GEMINI_API_KEY` (tùy chọn – bỏ trống thì chatbot trả lời bằng dữ liệu kho),
`MOMO_MOCK=true` (cổng MoMo giả lập; đặt `false` và khai báo `MOMO_*` để dùng MoMo sandbox).

## Hạn chế đã biết

- Chưa chạy được với MongoDB thật trong môi trường phát triển ban đầu (không tải được bản nhị phân MongoDB): các truy vấn Mongoose/aggregation mới được kiểm tra kiểu và định tuyến, **cần chạy thử `npm run seed:reset` + luồng mua hàng trên máy bạn**.
- MongoDB bản standalone không có transaction nên đặt/hủy đơn dùng cập nhật nguyên tử + hoàn kho thủ công; nếu cần ACID đầy đủ hãy chạy replica set rồi dùng `session.withTransaction`.
- Giao diện Landing/Bảng tin được dựng lại gọn hơn bản Blade (không có slider/hiệu ứng cuộn, khối “nổi bật” đơn giản); trình soạn thảo CKEditor được thay bằng ô HTML có xem trước, chèn ảnh và nút AI soạn nháp.
- Trang khách render phía client (gọi API sau khi tải) nên SEO kém hơn bản Blade; có thể chuyển các trang công khai sang Server Components khi cần.

## Chatbot tư vấn

`POST /api/chatbot/ask` nhận `{ message, history?, context? }` và trả `{ reply, products[], donHang[], quickReplies[], lienKet[], context, nguon }`.

- **Hiểu ý định bằng luật** (`backend/src/cong-khai/chatbot/nlu.ts`): tư vấn vợt/giày/áo quần/phụ kiện theo ngân sách, trình độ, lối chơi, hãng, size; hỏi giá, tồn kho, khuyến mãi, so sánh, trạng thái đơn (cần đăng nhập, chỉ đơn của chính tài khoản), thanh toán/hủy đơn/cửa hàng.
- **Tra cứu và xếp hạng từ MongoDB** (`kho.ts`, `xep-hang.ts`): giá sau khuyến mãi, chỉ gợi ý hàng còn kho, chấm điểm theo thông số vợt (cân bằng, độ cứng, trọng lượng). Chính sách nào hệ thống chưa có (bảo hành, đổi trả, phí ship) thì bot nói thẳng là chưa có và hướng dẫn liên hệ cửa hàng.
- **Ngữ cảnh nhiều lượt**: server không lưu phiên; mỗi phản hồi trả `context`, client gửi lại ở lượt sau (đã được làm sạch phía server).
- **Gemini (tùy chọn)**: có `GEMINI_API_KEY` thì AI diễn đạt lại dữ kiện đã tra cứu (system prompt chống bịa, mọi số tiền trong câu trả lời phải khớp dữ liệu kho, ngược lại bị loại). Lỗi/timeout/hết hạn mức → tự dùng lời đáp tra cứu; lỗi liên tiếp sẽ tạm ngưng gọi AI 60 giây.
- **Giới hạn tần suất**: 15 tin/phút và 200 tin/giờ mỗi khách (IP hoặc tài khoản), 300 tin/phút toàn hệ thống; vượt quá trả HTTP 429.
