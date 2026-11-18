# PRODUCT.md — Shop Cầu Lông "Quầy tư vấn"

Hợp đồng sản phẩm và thiết kế cho storefront (hướng đã chọn: Hướng 1 "Quầy tư vấn" trong `HUONG-THIET-KE.md`). Mọi tuyên bố trên giao diện phải truy được về dữ liệu thật của hệ thống hoặc về thông tin do chủ cửa hàng cung cấp.

## 1. Khách hàng và việc cần làm
| Người dùng | Đang cần | Điều shop làm được |
|---|---|---|
| **Người mới chơi** | Biết nên mua cây vợt nào, sợ chọn sai | Hỏi 3 điều (lối chơi, kinh nghiệm, ngân sách), đưa đúng 3 cây còn hàng kèm lý do dựa trên thông số ghi trong kho |
| **Người chơi đều** | So giá, thông số giữa vài cây | Thông số rõ ràng, lọc theo cân bằng/trọng lượng/độ cứng, giá và tồn kho thật |
| **Người thi đấu** | Đúng cây cần, mua nhanh | Lọc nhanh, trang thông số đọc được trong vài giây, thêm vào giỏ không phải đăng nhập |
| **Người mua giày/áo/phụ kiện** | Danh mục, size, giá | Luồng danh mục và size thông thường; không có "hồ sơ hợp" cho nhóm này |

## 2. Giọng điệu
Tiếng Việt, thẳng và cụ thể, như người bán lâu năm đứng quầy: nói điều mình biết, nói rõ điều chưa biết ("chưa có thông tin"). Không hứa quá, không phần trăm tương thích, không so sánh bịa. Câu ngắn, số liệu đi kèm đơn vị.

## 3. Cam kết có thể giữ (chỉ những điều này được viết lên giao diện)
- Giá, khuyến mãi, tồn kho hiển thị là dữ liệu thật và được tính lại ở giỏ hàng và khi đặt hàng.
- Gợi ý vợt dựa trên 5 trường thông số trong kho (cân bằng, trọng lượng, độ cứng, chiều dài, sức căng); là gợi ý tham khảo, không phải đo lường.
- Thanh toán COD hoặc MoMo; thêm vào giỏ không cần đăng nhập, chỉ thanh toán cần tài khoản.
- Đánh giá chỉ hiển thị khi do khách gửi qua tài khoản; chưa có thì nói chưa có.
**Không viết** (cho tới khi chủ cửa hàng cung cấp nguồn): hàng chính hãng/nhập khẩu, phí hay thời gian giao hàng, bảo hành, đổi trả, hotline/email/địa chỉ, khuyến mãi không có trong dữ liệu, số mm điểm cân bằng, "độ tương thích %", biểu đồ 5 trục hiệu năng, mức căng "khuyên dùng", cam kết bảo vệ gối/chân, âm thanh mẫu vợt.

## 4. Hợp đồng thiết kế
- **Bề mặt:** nền sáng như trang thông số catalogue; chữ xanh sân (`--brand-900/700`); **cam chỉ dành cho hành động chính và con số/lựa chọn đang được chọn**. Giữ nhận diện xanh lục + cam, logo, header, footer. Không quay lại ống cầu hay bảng màu cobalt; không WebGL ở trang chủ.
- **Chữ:** tiêu đề tiếng Việt dùng font có đủ dấu với `line-height ≥ 1.25` (không cắt dấu); **Barlow Condensed cho giá, mã U, con số thông số**. Cỡ chữ nhỏ ≥ 4,5:1 tương phản.
- **Màn hình đầu:** dùng được ngay, không chặn điều hướng: chọn lối chơi / kinh nghiệm / ngân sách bằng nút lớn có trạng thái chọn rõ, và **đúng 3 cây vợt thật dựng đứng** có giá, tồn kho, dải thông số, một dòng lý do (khi có hồ sơ). Chưa chọn gì vẫn có 3 lựa chọn nổi bật mua được ngay. Ít hơn 3 vợt khớp thì nói rõ thay vì tự nới bộ lọc.
- **Ảnh:** khung trung tính đồng nhất, vợt dựng đứng, ảnh gốc không bị méo, không gỡ watermark, không ảnh AI. Chưa có ảnh sạch đã duyệt thì hiện khung giữ chỗ ghi rõ "ảnh chuẩn đang cập nhật"; ảnh gốc của sản phẩm vẫn xem được ở trang chi tiết.
- **Hồ sơ người chơi:** URL (`loi_choi`, `trinh_do`, `ngan_sach`) là nguồn chính, được nhớ trong trình duyệt, hiện gọn trên header và xóa được. Query rõ ràng ghi đè hồ sơ đã nhớ.
- **Một thẻ sản phẩm** dùng ở trang chủ, danh sách, khuyến mãi: ảnh, giá, tồn kho, trạng thái, dải thông số (chỉ vợt), nhãn lý do (chỉ khi tính từ dữ liệu thật), thêm nhanh theo đúng phiên bản.
- **Hỏi người bán:** một khung chat nhúng (trang chủ, chi tiết, không có kết quả) dùng chung logic chatbot, không có hai chatbot chạy cùng lúc; nút nổi chỉ khi không có khung nhúng và không bao giờ che thanh thanh toán/mua trên điện thoại.
- **Chuyển động:** tinh tế, có ích (trạng thái chọn, đổi 3 gợi ý, vị trí điểm cân bằng); tôn trọng `prefers-reduced-motion`; mọi điều khiển dùng được bằng bàn phím với viền focus rõ.

## 5. Ngoài phạm vi M2 (làm sau, theo `HUONG-THIET-KE.md` và `GopY.txt`)
So sánh 2–3 vợt có link chia sẻ, phiếu thông số dạng bento chi tiết, chọn mức căng cước trong khoảng `sucCang` thật (chưa bán dịch vụ cước khi chưa có danh mục và giá), tủ vợt/nhắc lịch do người dùng tự nhập, combo chỉ với phụ kiện thật hiện có, âm thanh khi có nguồn.

## 6. Dữ liệu cần chủ cửa hàng cung cấp
Ảnh sạch (ưu tiên 27 vợt, dựng đứng cùng góc), liên hệ thật, nội dung chính sách đã duyệt, danh mục/giá cước và phụ kiện nếu muốn bán, nguồn âm thanh nếu muốn dùng.
