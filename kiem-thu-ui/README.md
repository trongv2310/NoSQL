# Kiểm thử giao diện (Playwright) – Shop Cầu Lông

Chạy trên server THẬT đang chạy. Trước khi chạy:

```bash
# Terminal 1 – dữ liệu gốc + backend
cd backend
npm run data:import:reset
npm run db:setup
npm run start:dev          # http://localhost:4000/api

# Terminal 2 – frontend
cd frontend
npm run dev                # http://localhost:3000
```

Chạy test (Terminal 3):

```bash
cd kiem-thu-ui
npm install
npx playwright install chromium
npx playwright test                       # cả desktop và điện thoại
npx playwright test --project=desktop     # chỉ desktop
npx playwright test tests/02-luong-mua-hang.spec.ts
npx playwright show-report bao-cao-html   # xem báo cáo HTML (ảnh chụp từng trang, lỗi, kết quả axe)
```

| File | Kiểm gì |
|---|---|
| `tests/01-duyet-trang.spec.ts` | 54 trang (khách, khách đã đăng nhập, quản trị) × desktop + điện thoại: HTTP, lỗi JS/console, request hỏng, ảnh hỏng, `<h1>`, tràn ngang |
| `tests/02-luong-mua-hang.spec.ts` | Khách vãng lai → giỏ → đăng nhập (gộp giỏ) → thanh toán COD → xem đơn → hủy; đăng nhập sai; form thiếu thông tin |
| `tests/03-accessibility.spec.ts` | axe-core WCAG 2.1 A/AA trên 14 trang; dùng bàn phím (vòng focus) |
| `tests/04-quan-tri-ui.spec.ts` | CRUD khuyến mãi qua form admin, đơn hàng admin, phân quyền nhân viên |

- Máy không ra được Internet (CDN Font Awesome bị chặn): chạy với `BO_QUA_CDN=1` để không tính lỗi tải CDN.
- Đổi địa chỉ: `UI_URL=http://localhost:3000 API_URL=http://localhost:4000/api`.
- Test tạo đơn / khuyến mãi thật trong CSDL. Chạy xong nên `npm run data:import:reset` để về dữ liệu gốc.
