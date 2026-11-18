---
target: "storefront: trang chủ → danh sách → chi tiết → giỏ/thanh toán"
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
target_identity: "file:C:\\Users\\Trong\\orca\\workspaces\\DoAnCuoiMon\\ui-claude\\frontend\\app\\(site)"
timestamp: 2026-11-09T14-01-13Z
slug: frontend-app-site
---
Method: dual-agent (A: đánh giá thiết kế · B: bộ dò tự động + trình duyệt)

Phạm vi: worktree `ui-claude` (gồm trang chủ 3D "Match Point" chưa commit), Chrome thật có WebGL, 1440×900 và 390×844, có thử 4G chậm. Hành trình: trang chủ → danh sách → tìm kiếm → chi tiết → giỏ; thanh toán đọc từ mã nguồn. Đường dẫn tính từ `ui-claude/frontend`.

## Gốc rễ: vì sao nhiều hiệu ứng mà không "lưu luyến"
Hiệu ứng kể chuyện về môn cầu lông, không phải về cây vợt. Khách quay lại vì "giúp mình chọn đúng" và "tin được"; màn mở đầu không tạo ra cả hai.
1. Ý tưởng hay nhất bị giấu: bộ chọn lối chơi chấm điểm từ `thongSoVot`, chatbot giải thích và đặt hàng được; nhưng lối chơi mất sau một cú bấm, chatbot là bong bóng che "Mua ngay".
2. Đỉnh ở đầu, kết thấp: rời trang chủ là giao diện Bootstrap xanh chung chung, trang khuyến mãi là phong cách thứ ba.
3. Mọi thứ báo hiệu "demo": ảnh in logo shop khác (TIENDINHSPORT, HVshop, TDS), "Nguyễn Văn A", hotline 0123456789, "Đại lễ 30/4" giữa tháng 11, link chính sách về "/".

## Điểm sức khỏe thiết kế (Nielsen)
| # | Nguyên tắc | Điểm | Vấn đề chính |
|---|---|---|---|
| 1 | Hiển thị trạng thái | 2 | Khách bấm "Thêm vào giỏ" bị chuyển sang đăng nhập không lời giải thích |
| 2 | Khớp thực tế | 2 | 3U/4U ghi là "Kích cỡ"; "Nặng đầu/Cứng" không giải thích; không có chọn mức căng cước |
| 3 | Kiểm soát & tự do | 2 | Không giỏ cho khách; đăng nhập xong mất phiên bản/số lượng; xoá giỏ không hoàn tác |
| 4 | Nhất quán | 1 | Ba ngôn ngữ thị giác, hai component thẻ sản phẩm, ba thang ngân sách |
| 5 | Ngăn lỗi | 2 | Lọc vợt "Dưới 1 triệu" ra 0; menu Túi/Balo ra 0; Q21 chọn "Đen" ảnh trắng |
| 6 | Nhận ra hơn nhớ lại | 2 | Lối chơi không mang theo; tên mobile bị cắt thành hai "Mizuno Fortius 1…" |
| 7 | Linh hoạt & hiệu quả | 2 | Thiếu so sánh, yêu thích, đã xem, thanh mua dính |
| 8 | Thẩm mỹ tối giản | 2 | Trang chủ trang trí dày; banner danh sách chiếm 83% màn đầu mobile |
| 9 | Phục hồi lỗi | 1 | "vợt cho người mới", "astrx" ra 0, không gợi ý chatbot/bộ chọn |
| 10 | Trợ giúp | 2 | Chatbot tốt; bảo hành/đổi trả/FAQ là link chết (`components/SiteChrome.tsx:281`) |
| **Tổng** | | **18/40** | **Kém** |

## Mức độ "riêng"
LLM: chất cầu lông ở bề mặt; thứ riêng thật duy nhất là bộ chọn lối chơi. Khẩu hiệu và bố cục nền tối + chữ hoa đặc + hàng thẻ là mặc định ngành.
Bộ dò: `components/landing` 3 lỗi (gradient-text `landing.module.css:808`, side-tab `showcase.module.css:230`, bounce-easing `phongcach.module.css:392`); `app/(site)` sạch; `public/css/*` thêm 8 (gradient-text ×2, bounce-easing ×5 từ `--ease-spring`, border-accent ×1). Gradient-text là gốc lỗi "BAN".
Trình duyệt (headless, không có tab Human): #148f5f fail chữ nhỏ (4,1:1), badge "-12%" 1,8:1, `.badge-promo` 2,6:1, placeholder tìm kiếm 2,7:1 và ô không có accessible name, CLS trang chi tiết 0,42, `lining_ayzu017.jpg` 1,2 MB hiển thị 281px, `HUIT.jpg` 192 KB hiển thị 44px. Loại ~12 báo sai tương phản do nền canvas WebGL.

## Điểm làm tốt
1. Mô hình lối chơi dựa trên dữ liệu (`goiYVot`, lý do, "nên cầm thử", "Vợt gần nhất").
2. Chatbot là người bán thật (tồn kho, khuyến mãi, đơn, thẻ "Đặt hàng", giọng nói).
3. Trạng thái tải/lỗi/thử lại đủ; 25/25 điểm Tab có focus; bản tắt 3D vẫn đẹp.

## Vấn đề ưu tiên (theo ảnh hưởng tới việc mua)
- [P0] 1. Bắt đăng nhập khi thêm giỏ (`app/(site)/Home/ChiTietSanPham/[id]/page.tsx:106-108`), mất phiên bản/số lượng; thanh toán hai nút submit, MoMo `btn-danger` (`DonHang/Checkout/page.tsx:80-81`), không phí ship, không trang xác nhận. Sửa: giỏ khách + COD bằng SĐT (cần backend); tối thiểu "Đăng nhập để mua" + giữ lựa chọn. Lệnh: /impeccable harden
- [P0] 2. Niềm tin mâu thuẫn "chính hãng": watermark shop khác, "Nguyễn Văn A", hotline giả, "đến 50%" có 0 sản phẩm, 30/4 "Còn 177 ngày". Sửa: ảnh sạch, ẩn đánh giá đến khi có thật, chính sách thật cạnh nút mua, liên hệ thật, tự tắt khuyến mãi hết hạn. Lệnh: /impeccable clarify
- [P1] 3. Thông số/lối chơi chỉ có ở trang chủ: chip "Vot", không lọc lối chơi/cân bằng/độ cứng dù 27 vợt có dữ liệu, thẻ không thông số, chi tiết không giải thích. Sửa: lối chơi lên URL, facet thông số, dải thông số trên thẻ, câu giải thích. Lệnh: /impeccable shape
- [P1] 4. Mobile: giá đầu tiên ở 2,4 màn; thẻ đầu danh sách ở 704/844px; nút giỏ cách 1,5 màn, không thanh dính, chat che "Mua ngay" (`public/css/Site.css:636`); 3D vẫn bật ở CPU chậm 4x (`components/landing/World.tsx:49`). Sửa: thanh mua dính, thu gọn đầu danh sách, cổng 3D theo năng lực máy. Lệnh: /impeccable adapt
- [P1] 5. Lỗi dấu: "LÀ CỦA BAN." (gradient clip + line-height 1, `landing.module.css:805-812`), "CHON xong" (line-height 1,05), Câu chuyện chồng dòng 21px. Lệnh: /impeccable typeset
- [P2] 6. Ba hệ thị giác + hai ProductCard (`components/landing/ProductCard.tsx`, `components/Ui.tsx`); bản sắc là logo trường. Lệnh: /impeccable shape

## Persona
- Casey: hero mobile ẩn mô tả; 3D vẫn tải; Đăng nhập/Đăng ký chiếm header; chat che "Mua ngay"; cuối là form tên đăng nhập.
- Riley: chip "Vot"; lọc dưới 1 triệu trống; phiên bản không lưu URL; "Đen" ảnh trắng; "0 – 3000000 đ"; chi tiết render client.
- Jordan: không giải thích thông số; menu theo dòng Astrox/Nanoflare; "Mới chơi" ra vợt 3,2tr+; tìm "vợt cho người mới" ra 0.

## Quan sát nhỏ
Header 3 tầng 145px; 3 link trùng mỗi thẻ; SKU 10,4px, nhãn thông số 10,6px; chữ Câu chuyện vô hình khi dừng giữa; "Cần tư vấn thêm?" sang Liên hệ thay vì chatbot; "Lựa chọn khác" Mizuno cho Astrox; mặc định "Mới nhất" mở bằng quần short 96k; API `trungBinhDanhGia: 5` cho sản phẩm chưa đánh giá; favicon 404.

## Câu hỏi
- Nếu cảnh 3D biến mất, khách tiếc điều gì: cây vợt hay cái sân?
- Vì sao chatbot, người bán giỏi nhất, là bong bóng che "Mua ngay"?
- Nếu lối chơi là cách điều hướng của cả shop thì sao?
- Shop dành cho ai: hàng toàn vợt 2tr+ nhưng trang chủ mời "Mới chơi"?
