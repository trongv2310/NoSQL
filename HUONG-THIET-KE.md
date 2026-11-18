# Hướng thiết kế lại Shop Cầu Lông

Ngày lập: 09/11/2026
Trạng thái: Đã chọn hướng, chưa sửa code
Bản được đánh giá: worktree `ui-claude` (gồm trang chủ 3D "Match Point" chưa commit)
Bản lưu đánh giá đầy đủ: `ui-claude/.impeccable/critique/2026-11-09T14-01-13Z__frontend-app-site.md`

## Quyết định

| Câu hỏi | Lựa chọn |
|---|---|
| Hướng thiết kế lại | **Hướng 1: "Quầy tư vấn"** |
| Thứ tự | **Sửa nền móng trước**, sau đó mới thiết kế lại |
| Ảnh sản phẩm | **Chủ dự án tự thay ảnh sạch** (tự chụp hoặc ảnh chính hãng) |

## 1. Vì sao nhiều hiệu ứng mà vẫn không "lưu luyến"

Hiệu ứng đang kể chuyện về môn cầu lông, không phải về cây vợt. Cảnh 3D có sân, lưới, cầu và bảng quảng cáo hãng, nhưng không có cây vợt nào được ngắm kỹ, so sánh hay giải thích. Người ta quay lại một shop vì hai điều: *"chỗ này giúp mình chọn đúng"* và *"chỗ này tin được"*. Màn mở đầu đẹp không tạo ra điều nào trong hai điều đó.

1. **Ý tưởng hay nhất bị giấu.** Bộ chọn Uy lực / Tốc độ / Kiểm soát chấm điểm từ thông số thật (`thongSoVot`), còn chatbot giải thích được "nặng đầu" và đặt hàng được. Nhưng lối chơi vừa chọn mất ngay sau một cú bấm, và chatbot chỉ là bong bóng che nút "Mua ngay".
2. **Đỉnh cảm xúc ở đầu, kết thúc thấp.** Rời trang chủ là rơi xuống giao diện Bootstrap xanh chung chung. Trang khuyến mãi lại theo một phong cách thứ ba.
3. **Nhiều chi tiết báo hiệu "demo":**
   - ảnh vợt in logo shop khác (TIENDINHSPORT, HVshop, TDS);
   - người đánh giá tên "Nguyễn Văn A", hotline 0123456789;
   - chương trình "Đại lễ 30/4" vẫn chạy giữa tháng 11;
   - link chính sách trỏ về "/".

Điểm Nielsen: **18/40** (mức Kém). Điểm bị kéo xuống chủ yếu ở các trang shop phía sau, không phải ở trang chủ.

## 2. Vấn đề xếp theo ảnh hưởng tới việc mua

| Mức | Vấn đề | Vị trí |
|---|---|---|
| P0 | Bấm "Thêm vào giỏ" là bị chuyển sang trang đăng nhập, không giải thích, và mất phiên bản/số lượng đã chọn. Trang thanh toán có hai nút gửi (MoMo màu đỏ `btn-danger`), không phí ship, không trang xác nhận | `app/(site)/Home/ChiTietSanPham/[id]/page.tsx:106-108`, `app/(site)/DonHang/Checkout/page.tsx:80-81` |
| P0 | Tín hiệu niềm tin mâu thuẫn với chữ "chính hãng": ảnh in logo shop khác, đánh giá và liên hệ giả, khuyến mãi hết hạn hoặc trống, màu đang chọn không khớp ảnh | `components/SiteChrome.tsx:281`, trang `/KhuyenMai/Index` |
| P1 | Lối chơi và thông số chỉ có ở trang chủ: danh sách không lọc được theo thông số, thẻ sản phẩm không hiện thông số, chip hiện "Vot", trang chi tiết không giải thích thông số | `components/ProductListing.tsx`, trang chi tiết |
| P1 | Trên điện thoại: phải cuộn 2,4 màn hình mới thấy giá đầu tiên; nút "Thêm vào giỏ" cách 1,5 màn hình; không có thanh mua dính; nút chat che "Mua ngay"; 3D vẫn chạy trên máy yếu | `public/css/Site.css:636`, `components/landing/World.tsx:49` |
| P1 | Lỗi dấu tiếng Việt: "LÀ CỦA BAN.", "CHON xong", các dòng chữ ở khối Câu chuyện chồng lên nhau; màu xanh #148f5f không đủ tương phản cho chữ nhỏ | `components/landing/landing.module.css:805-812` |
| P2 | Ba hệ hình ảnh khác nhau và hai component thẻ sản phẩm; bản sắc duy nhất là logo trường | `components/landing/ProductCard.tsx`, `components/Ui.tsx` |

## 3. Ba hướng đã cân nhắc

### Hướng 1: "Quầy tư vấn", shop hiểu lối chơi của bạn ✅ ĐÃ CHỌN

**Ý tưởng.** Trang web đóng vai ông chủ shop cầu lông đứng quầy: hỏi bạn đánh thế nào, đưa ra đúng 3 cây vợt, giải thích vì sao, rồi căng cước đúng số kg.

**Màn hình đầu.** Thay khẩu hiệu bằng một bộ chọn dùng được ngay: lối chơi, trình độ, ngân sách. Ngay trong màn hình đó hiện 3 vợt thật, có giá và nút thêm vào giỏ. Mỗi vợt có:
- một dải thông số: vạch điểm cân bằng trên thân vợt, trọng lượng U, độ cứng;
- một dòng lý do vì sao hợp.

**Xuyên suốt shop:**
- Lối chơi thành "hồ sơ": ghi lên URL (`?loi_choi=...`), được nhớ lại và hiện trên header.
- Trang danh sách lọc được theo lối chơi, điểm cân bằng, trọng lượng, độ cứng. Thẻ sản phẩm có dải thông số và nhãn "hợp với bạn".
- Trang chi tiết có "phiếu thông số" giải thích bằng lời thường (ví dụ "Nặng đầu → đập mạnh, vung chậm hơn"), cho so sánh 2–3 vợt, và cho chọn mức căng cước như một dịch vụ.
- Chatbot thành ô "hỏi người bán" nằm ngay trong trang, không còn là bong bóng.
- Gộp về một component thẻ sản phẩm duy nhất.

**Hình ảnh:**
- Nền sáng như trang thông số trong catalogue vợt, chữ màu xanh sân.
- Màu cam chỉ dùng cho hành động và con số đang được chọn.
- Số liệu dùng chữ đặc Barlow Condensed (đã có sẵn).
- 3D thu về một chỗ thật sự có ích: vợt xoay ở trang chi tiết, có đánh dấu điểm cân bằng (dùng lại `RacketLive`).

**Vì sao chọn:**
- Chữa thẳng vấn đề P1 về thông số và nỗi bối rối của người mới chơi.
- Cho khách lý do quay lại (hồ sơ lối chơi, so sánh vợt).
- Tận dụng hai thứ mạnh nhất đang có: `goiYVot`/`thongSoVot` và chatbot.
- Với đồ án NoSQL, dữ liệu thông số theo từng biến thể là điểm đáng khoe.

**Rủi ro:**
- Chỉ 27/48 sản phẩm có thông số, nên giày và áo cần lối đi đơn giản hơn (bảng size).
- Thông số phải chính xác.
- Giây đầu tiên ít "wow" hơn sân 3D.

### Hướng 2: "Tường vợt", sản phẩm là màn trình diễn

**Ý tưởng.** Bước vào shop là thấy cả bức tường vợt treo theo hãng. Vợt được dựng đứng đúng tỉ lệ thay vì nằm trong thẻ vuông. Mỗi cây treo một thẻ giá kiểu "3.980.000đ · 4U · Nặng đầu". Chạm vào một cây là "nhấc ra" thành khung xem nhanh có nút thêm vào giỏ. Trên điện thoại thì vuốt ngang.

**Ưu điểm:**
- Thấy sản phẩm ngay ở màn đầu.
- Đường tới giỏ hàng ngắn nhất.
- Nhẹ nhất trên điện thoại.

**Rủi ro:** phụ thuộc hoàn toàn vào ảnh tách nền, cùng góc chụp, không logo. Nếu giữ ảnh hiện tại, hướng này phơi bày điểm yếu rõ nhất.

**Có thể mượn cho Hướng 1:** cách trưng vợt dựng đứng.

### Hướng 3: "Sân đấu xuyên suốt", giữ 3D nhưng bắt nó bán hàng

**Ý tưởng.** Giữ sân đêm và engine 3D, nhưng để cảnh 3D trình diễn đặc tính của cây vợt đang xem bằng `setStyle` (nặng đầu thì quỹ đạo đập mạnh, nhẹ đầu thì phản tạt nhanh). Ngôn ngữ đồ họa truyền hình giải đấu được đưa vào mọi trang.

**Ưu điểm:**
- Ít phải làm lại nhất.
- Giữ được cái "wow".

**Rủi ro:**
- Nền tối cộng hiệu ứng là kiểu mặc định của ngành, nên khó tạo khác biệt.
- Nặng trên máy yếu (13 tác vụ dài, khoảng 3,9 giây lúc tải, đo trên bản dev).
- Không tự giải quyết được vấn đề niềm tin.

### Lựa chọn thứ tư (không chọn)

Làm một shop chuẩn mực, sạch sẽ như các shop lớn, không thử nghiệm gì.

## 4. Lộ trình

### Đợt 1: Nền móng (làm trước)

1. **Đăng nhập và thanh toán**
   - [ ] Đổi nút thành "Đăng nhập để mua" và giữ phiên bản + số lượng trong `returnUrl`.
   - [ ] Viết lời chào riêng cho khách mới (hiện đang là "Chào mừng bạn quay lại sân").
   - [ ] *(Tùy phạm vi backend)* Giỏ hàng cho khách chưa đăng nhập, và đặt COD chỉ bằng tên, số điện thoại, địa chỉ.
   - [ ] Thanh toán: chọn phương thức bằng thẻ chọn, một nút "Đặt hàng", hiện phí ship và thời gian giao, có trang xác nhận kèm mã đơn.
2. **Niềm tin**
   - [ ] Ẩn khối đánh giá giả và dòng "(0.0) (0 đánh giá)" cho đến khi có đánh giá thật.
   - [ ] Viết trang chính sách bảo hành, đổi trả, giao hàng; đặt link cạnh nút mua và ở footer.
   - [ ] Dùng thông tin liên hệ thật.
   - [ ] Khuyến mãi hết hạn hoặc không có sản phẩm thì tự ẩn.
   - [ ] Sửa ảnh của biến thể không khớp màu (quần Q21).
   - [ ] Sửa API đang trả `trungBinhDanhGia: 5` cho sản phẩm chưa có đánh giá.
   - [ ] Thay ảnh sạch (chủ dự án cung cấp), ưu tiên 27 cây vợt.
3. **Chữ và tương phản**
   - [ ] Sửa "LÀ CỦA BAN": chừa khoảng dưới cho dấu, hoặc bỏ chữ gradient.
   - [ ] Sửa "CHON xong" và các dòng chồng nhau ở khối Câu chuyện: tăng line-height cho chữ hoa nhiều dòng.
   - [ ] Đổi sang màu xanh đậm hơn cho chữ nhỏ; sửa nhãn "-12%" (1,8:1) và nhãn khuyến mãi (2,6:1).
   - [ ] Thêm nhãn cho ô tìm kiếm.
4. **Điện thoại**
   - [ ] Thanh mua dính ở đáy trang chi tiết, có giá và nút thêm vào giỏ.
   - [ ] Không để nút chat che "Mua ngay".
   - [ ] Thu gọn phần đầu trang danh sách.
   - [ ] Chỉ bật 3D khi máy đủ mạnh.

### Đợt 2: Dựng Hướng 1 "Quầy tư vấn"

5. [ ] Viết PRODUCT.md (đối tượng khách, giọng điệu, cam kết thương hiệu), sau đó chốt hợp đồng hướng thiết kế.
6. [ ] Trang chủ: bộ chọn ở màn đầu, đưa ra 3 vợt thật có giá và dải thông số.
7. [ ] Lối chơi lên URL và được ghi nhớ; bộ lọc thông số ở trang danh sách; một component thẻ sản phẩm có dải thông số.
8. [ ] Trang chi tiết: phiếu thông số, so sánh vợt, chọn mức căng cước, vợt 3D có điểm cân bằng.
9. [ ] Chatbot thành ô "hỏi người bán" trong trang; trang không có kết quả tìm kiếm thì gợi ý chatbot và bộ chọn.
10. [ ] Rà soát cuối (polish), rồi chạy lại critique để so với mốc 18/40.

## 5. Cần chủ dự án cung cấp

- Ảnh sạch cho sản phẩm, ưu tiên 27 cây vợt. Không dùng ảnh có logo shop khác.
- Thông tin liên hệ thật: hotline, email, địa chỉ.
- Duyệt nội dung chính sách (có thể nhờ viết nháp trước).
- Quyết định có làm giỏ hàng cho khách chưa đăng nhập ở backend trong phạm vi đồ án hay không.

## 6. Giữ nguyên

- Nhận diện xanh lục + cam, nội dung tiếng Việt, các URL và luồng mua hiện có (theo `PLAN.md`).
- Không đưa lại hướng thiết kế ống cầu và bảng màu cobalt.
