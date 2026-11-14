# PLAN — Nâng cấp trải nghiệm và animation cho landing page

Ngày lập: 06/11/2026  
Trạng thái: Kế hoạch đề xuất, chưa triển khai  
Phạm vi chính: Trang chủ giới thiệu của hệ thống cửa hàng cầu lông

## 1. Mục tiêu

Xây dựng một landing page hiện đại, bắt mắt và có tương tác thực sự hữu ích. Người dùng cần hiểu shop bán gì ngay khi truy cập, hứng thú khám phá và dễ tìm đến sản phẩm phù hợp.

Ba ưu tiên:

1. Tạo ấn tượng mạnh bằng hero, hình ảnh thể thao và một chuỗi chuyển động được thiết kế kỹ.
2. Rút gọn nội dung lặp, thay các component nhàm chán bằng bố cục và tương tác phù hợp.
3. Khai thác Next.js để trang tải nhanh, điều hướng mượt và ổn định trên điện thoại.

## 2. Phạm vi và nguyên tắc

### Trong phạm vi

- Thiết kế lại phần nội dung landing page.
- Nâng cấp hero, danh mục, khám phá sản phẩm, hướng dẫn chọn vợt, bài viết và đánh giá.
- Thiết kế hệ thống animation cho landing page.
- Cải thiện kiến trúc tải dữ liệu, hình ảnh, font và metadata của trang chủ.
- Hoàn thiện đoạn chuyển tiếp từ landing page đến trang chi tiết sản phẩm khi cần.
- Kiểm tra responsive, khả năng truy cập và hiệu năng production.

### Giới hạn để kiểm soát thay đổi

- Giữ nhận diện xanh lục + cam, logo và nội dung tiếng Việt.
- Giữ header/footer hiện tại; mọi thay đổi lớn vào hai khu vực này cần được xem xét riêng.
- Giữ URL và các luồng mua hàng đang có.
- Admin, giỏ hàng, thanh toán và tài khoản không thuộc đợt thiết kế lại này.
- Không đưa lại hướng thiết kế ống cầu, bảng màu cobalt hoặc phong cách đã bị từ chối.
- Chỉ thay component dùng chung khi cần thiết; kiểm tra các trang sử dụng component đó.

## 3. Hiện trạng đã khảo sát

Project hiện khai báo Next.js `16.4.3` và React `19.3.0`.

| Hiện trạng | Ảnh hưởng | Hướng xử lý |
|---|---|---|
| Trang chủ là Client Component, lấy dữ liệu bằng `useApi('/landing')` | Banner và nội dung chính cùng phải chờ API | Tách hero khỏi dữ liệu động; chuyển nội dung đọc sang Server Components |
| Nhiều section cùng kiểu tiêu đề + banner + bốn thẻ sản phẩm | Trang dài, nhịp thị giác lặp lại | Gom thành một khu vực sản phẩm có tab và bộ lọc |
| Hiệu ứng chủ yếu hiện dần khi cuộn | Có chuyển động nhưng thiếu điểm nhấn riêng | Phân cấp chuyển động và làm kỹ hero |
| Hero dùng ảnh vòm nghiêng, số lớn trang trí, số liệu và nền gradient | Dễ tạo cảm giác template | Dùng ảnh thể thao hoặc sản phẩm lớn với bố cục riêng |
| Nhiều ảnh banner có chữ quảng cáo in sẵn | Khó cắt ảnh, đặt chữ và animation độc lập | Chuẩn bị bộ ảnh hero/danh mục phù hợp |
| CSS chia thành nhiều file toàn cục, có quy tắc chồng nhau | Dễ ảnh hưởng giao diện ngoài trang chủ | Cô lập style mới bằng CSS Modules và gỡ quy tắc cũ tương ứng |
| Đã có View Transitions và cầu nối ảnh sản phẩm | Có nền tảng để cải thiện điều hướng | Kiểm tra và hoàn thiện thay vì thêm một hệ chuyển trang khác |
| API có thể bổ sung sản phẩm thường vào danh sách `uuDai` | Nhãn “đang giảm giá” có thể gây hiểu nhầm nếu dùng trực tiếp | Lọc theo trạng thái giảm giá thật hoặc đặt nhãn “sản phẩm nổi bật” |

Các file liên quan chính:

- `frontend/app/(site)/page.tsx`
- `frontend/app/(site)/layout.tsx`
- `frontend/app/(site)/template.tsx`
- `frontend/components/ShopShowcase.tsx`
- `frontend/components/Motion.tsx`
- `frontend/components/Ui.tsx`
- `frontend/lib/hooks.ts`
- `frontend/lib/morph.ts`
- `frontend/public/css/landing.css`
- `frontend/public/css/showcase.css`
- `backend/src/cong-khai/cong-khai.service.ts`

## 4. Hướng thiết kế

### Cảm giác tổng thể

Một thương hiệu thể thao thật: ảnh lớn, chữ rõ, bố cục bất đối xứng và khoảng trống có chủ đích.

- Xanh đậm cho những cảnh tạo cảm xúc.
- Trắng cho sản phẩm, giá và thông tin mua hàng.
- Cam tập trung vào hành động chính và điểm nhấn.
- Tiêu đề ngắn, nói đúng nhu cầu người dùng.
- Mỗi section có cách trình bày phù hợp với nội dung.
- Kiểm tra chữ tiếng Việt, dấu và cách xuống dòng trên mọi kích thước.

### Component cần gỡ hoặc thay

- Nhãn nhỏ thừa phía trên tiêu đề, đặc biệt dạng viên thuốc có chấm màu.
- Số liệu và số thứ tự chỉ dùng để trang trí.
- Khung ảnh vòm nghiêng, vòng tròn nền và vầng sáng không mang ý nghĩa.
- Thẻ gradient nhiều màu có ô icon, tiêu đề và đoạn mô tả giống nhau.
- Các khối quảng cáo chung chung không giúp người dùng quyết định.
- Nhiều section sản phẩm trùng cấu trúc.

Thẻ sản phẩm vẫn được giữ vì phục vụ mua hàng, nhưng cần gọn, rõ giá và có phản hồi tương tác tốt hơn.

## 5. Cấu trúc landing page đề xuất

### 5.1. Hero — Tạo ấn tượng và chỉ đường

- Một cảnh chủ đạo, thay carousel tự đổi liên tục.
- Ảnh người chơi hoặc sản phẩm lớn, có khoảng trống để đặt chữ.
- Tiêu đề ngắn, một đoạn giới thiệu và hai hành động:
  - **Xem sản phẩm**.
  - **Tìm vợt phù hợp** — dẫn tới bộ chọn trong trang.
- Nút hành động xuất hiện sớm, không chờ animation kết thúc.
- Hero độc lập với API sản phẩm để vẫn hiển thị khi API chậm hoặc lỗi.
- Mở đầu chỉ chạy một lần, có chuyển tiếp tự nhiên sang khu danh mục khi cuộn.

### 5.2. Khám phá danh mục

- Bốn danh mục: vợt, giày, trang phục và phụ kiện.
- Bố cục ảnh lớn nhỏ khác nhau, tránh bốn thẻ giống hệt nhau.
- Tên danh mục luôn đọc và bấm được, không phụ thuộc hover.
- Ảnh và mũi tên phản hồi đồng bộ khi rê hoặc chạm.
- Mỗi danh mục dẫn đến danh sách đã lọc tương ứng.

### 5.3. Tìm vợt phù hợp

- Bộ chọn ngắn theo ngân sách, kinh nghiệm và sở thích chơi.
- Các bước rõ ràng, có thể quay lại và thay lựa chọn.
- Kết quả là một số gợi ý hoặc liên kết đến danh sách đã lọc.
- Hiển thị lý do gợi ý ngắn gọn.
- Dựa trên thuộc tính thực có trong dữ liệu; xác minh khả năng lọc trước khi chốt UI.
- Nếu dữ liệu chưa đủ để đối chiếu thông số, sử dụng nhóm sản phẩm được chọn có chủ đích và ghi rõ đây là gợi ý tham khảo.
- Không hứa hẹn tư vấn kỹ thuật chính xác chỉ từ một lựa chọn lối chơi.

### 5.4. Sản phẩm đáng xem

- Gom các nhóm sản phẩm lặp thành một khu vực có tab danh mục.
- Tích hợp lọc ngân sách tại đây.
- Giới hạn số sản phẩm hiển thị ban đầu, có đường dẫn xem đầy đủ.
- Giữ chiều cao ổn định khi chuyển tab hoặc tải dữ liệu.
- Tên, giá, tình trạng và hành động xem chi tiết luôn rõ ràng.
- Chỉ gắn nhãn giảm giá, bán chạy hoặc còn ít khi dữ liệu hỗ trợ đúng tuyên bố đó.

### 5.5. Câu chuyện trên sân

- Một khối ảnh thể thao lớn tạo khoảng nghỉ giữa các phần mua sắm.
- Kết hợp bài hướng dẫn hoặc bài viết nổi bật có liên quan.
- Desktop có thể có một đoạn kể chuyện ngắn theo cuộn; mobile chuyển thành bố cục dọc.
- Kết quả thi đấu ở trang bảng tin; chỉ đưa lên trang chủ khi có nội dung thực sự nổi bật.

### 5.6. Niềm tin và hỗ trợ

- Đánh giá thật, gắn với sản phẩm khi có dữ liệu.
- Logo thương hiệu trình bày gọn, không làm thành nhiều thẻ trang trí lớn.
- Chỉ trình bày cam kết có cơ sở.
- Kết thúc bằng đường đi tiếp: xem sản phẩm hoặc mở trợ lý tư vấn.
- Tránh lặp lại thông tin đã có đầy đủ trong footer.

## 6. Thiết kế animation

### Phân cấp

1. **Chuyển động chủ đạo:** Hero và đoạn chuyển từ hero sang khám phá sản phẩm.
2. **Chuyển động nội dung:** Chuyển bước, chuyển tab, đổi nhóm sản phẩm, đoạn ảnh thể thao theo cuộn.
3. **Phản hồi thao tác:** Nút, liên kết, thẻ sản phẩm, lựa chọn bộ lọc.

| Vị trí | Desktop | Mobile |
|---|---|---|
| Hero mở màn | Mở ảnh bằng lớp cắt; chữ hiện theo dòng; sản phẩm dịch chuyển và xoay nhẹ về vị trí cuối | Giảm quãng di chuyển; ưu tiên nội dung và CTA |
| Hero khi cuộn | Các lớp ảnh dịch chuyển khác tốc độ, nối vào danh mục | Giảm hoặc bỏ parallax tùy khả năng thiết bị |
| Danh mục | Phóng ảnh nhẹ trong khung; tên và mũi tên chuyển đồng bộ | Phản hồi khi chạm; nội dung luôn hiện |
| Bộ chọn vợt | Chuyển bước, lựa chọn và kết quả mượt | Nút lớn, quay lại được, không tự cuộn bất ngờ |
| Tab sản phẩm | Vạch tab trượt; nội dung đổi mượt và giữ chiều cao | Tab cuộn ngang có dấu hiệu nhận biết |
| Thẻ sản phẩm | Ảnh nâng nhẹ; hành động xem chi tiết phản hồi | Hành động luôn truy cập được |
| Khối ảnh thể thao | Một cảnh theo cuộn có giới hạn; có thể dùng sticky nếu phù hợp | Bố cục dọc, không ghim cảnh |
| Mở trang chi tiết | Chuyển tiếp ảnh từ thẻ sang gallery nếu trình duyệt hỗ trợ | Có phương án điều hướng thông thường |

### Thông số khởi điểm để tinh chỉnh

- Phản hồi nút: 150–220ms.
- Chuyển nội dung: 250–450ms.
- Cảnh mở đầu: 700–1.000ms.
- Ưu tiên `transform` và `opacity`; đánh giá chi phí của mask, clip và blur trước khi dùng.
- Không chạy animation layout nặng theo từng sự kiện cuộn.
- Không dùng React state để cập nhật từng frame cuộn.

### Quy tắc trải nghiệm

- Không khóa hoặc thay đổi cơ chế cuộn mặc định.
- Không bắt người dùng xem hết animation mới thao tác được.
- Không thay con trỏ toàn trang.
- Không giấu thông tin mua hàng sau hover.
- Không dùng cùng một hiệu ứng xuất hiện cho mọi section.
- Dừng animation nền khi ra khỏi màn hình hoặc tab không còn hiển thị.
- Hủy observer, timer và animation khi component unmount.
- Hỗ trợ `prefers-reduced-motion`, kể cả khi người dùng thay thiết lập trong phiên.
- Nội dung vẫn đọc được khi animation chưa khởi tạo hoặc không được hỗ trợ.

## 7. Kiến trúc Next.js đề xuất

### Server Components và streaming

- Chuyển khung trang, nội dung giới thiệu và các vùng chỉ đọc sang Server Components.
- Chỉ hero tương tác, bộ chọn vợt, tab và điều khiển animation cần Client Components.
- Dùng Suspense cho các khối dữ liệu động, với skeleton đúng kích thước cuối.
- Hero và CTA không nằm sau một nhánh loading phụ thuộc toàn bộ API.
- Tạo lớp lấy dữ liệu phía server riêng; không tái sử dụng trực tiếp helper dùng URL tương đối dành cho trình duyệt.
- Dùng địa chỉ backend phía server từ cấu hình môi trường; không tạo vòng gọi qua chính frontend khi không cần.

### Cache và độ mới dữ liệu

- Chọn chiến lược theo tài liệu đi kèm phiên bản Next.js đang cài.
- Cache nội dung giới thiệu và dữ liệu ít thay đổi.
- Giá, khuyến mãi và tồn kho có thời hạn làm mới phù hợp; trạng thái mua cuối cùng phải được xác minh bởi backend.
- Không cache dữ liệu tài khoản hoặc giỏ hàng dùng chung cho các người dùng.
- Phân biệt rõ: với API `/landing` tổng hợp hiện tại, các section có thể dùng chung một request; Suspense không tự tạo ra các nguồn dữ liệu độc lập.
- Giai đoạn đầu tái sử dụng API hiện có. Chỉ tách endpoint hoặc bổ sung truy vấn khi có bằng chứng cần giảm độ trễ hoặc tải dữ liệu.

### Ảnh, font và điều hướng

- Dùng `next/image` với kích thước và `sizes` chính xác.
- Ưu tiên ảnh hero; lazy-load ảnh bên dưới.
- Có vùng giữ chỗ và tỷ lệ ảnh để hạn chế layout shift.
- Dùng `next/font`, bảo đảm hỗ trợ đầy đủ tiếng Việt.
- Dùng `Link` và prefetch có chọn lọc.
- Kiểm tra View Transitions và cơ chế chuyển ảnh hiện có trên đúng phiên bản cài đặt.
- Có fallback khi chuyển tiếp ảnh không hoạt động hoặc người dùng giảm chuyển động.
- Khai báo metadata, mô tả và ảnh chia sẻ phía server.

### Tổ chức CSS và animation

- Style landing mới dùng CSS Modules và token hiện có.
- Gỡ quy tắc landing cũ tương ứng thay vì nối thêm nhiều tầng override.
- Giới hạn phạm vi selector, không dùng selector toàn cục để thay header/footer hoặc các trang khác.
- CSS xử lý các phản hồi nhỏ.
- Motion xử lý chuỗi chuyển động, chuyển trạng thái và tiến trình cuộn cần phối hợp.
- Dùng `LazyMotion` và tải theo nhu cầu ở nơi phù hợp.
- Không thêm đồng thời nhiều thư viện animation để xử lý cùng một trách nhiệm.
- Mỗi phần tử chỉ có một cơ chế quản lý animation chính; tránh `ShopMotion`, `SiteMotion` và hiệu ứng mới cùng điều khiển một thuộc tính.
- 3D/WebGL chỉ xem xét ở giai đoạn sau nếu có asset phù hợp và đo được hiệu năng chấp nhận được.

## 8. Bộ hình ảnh cần chuẩn bị

| Asset | Yêu cầu |
|---|---|
| Hero desktop | Ảnh chất lượng cao, bố cục chừa chỗ cho chữ và CTA |
| Hero mobile | Bản cắt dọc riêng, giữ rõ chủ thể |
| Sản phẩm tách nền | Hai đến ba ảnh, đúng mẫu đang bán |
| Danh mục | Bốn ảnh đồng nhất về ánh sáng và cách chụp |
| Ảnh giữa trang | Người chơi hoặc sân cầu phù hợp nội dung |
| Poster dự phòng | Dùng khi video hoặc hiệu ứng nâng cao chưa tải được |

- Kiểm tra quyền sử dụng và nguồn ảnh trước khi đưa vào bản phát hành.
- Không dùng ảnh có chữ quảng cáo in sẵn làm lớp nền hero mới.
- Có thể tái sử dụng ảnh hiện có cho bài viết và khuyến mãi nếu phù hợp.
- Nếu bộ ảnh mới chưa có, xây prototype bằng ảnh sẵn có và ghi rõ asset nào còn tạm.
- Video là hạng mục bổ sung sau khi bản ảnh tĩnh và hiệu năng đạt yêu cầu; video tắt âm và không chặn nội dung.

## 9. Lộ trình triển khai

### Mốc A — Chốt thiết kế

- [ ] Ghi nhận giao diện và số đo hiệu năng hiện tại làm mốc so sánh.
- [ ] Rà ảnh và nội dung đang có.
- [ ] Dựng hai phương án hero bằng nội dung thực.
- [ ] Dựng một phương án bố cục toàn trang trên desktop và mobile.
- [ ] Chốt cách dùng màu, chữ, ảnh và mật độ thông tin.

**Đầu ra:** Bản thiết kế xem được, thể hiện rõ toàn bộ hành trình trang chủ.

### Mốc B — Prototype chuyển động

- [ ] Làm hero và đoạn chuyển sang danh mục.
- [ ] Kiểm tra CTA trong màn hình đầu ở laptop và điện thoại.
- [ ] Kiểm tra tốc độ, cảm giác cuộn và chế độ giảm chuyển động.
- [ ] Đánh giá hướng thiết kế trước khi mở rộng sang toàn trang.

**Đầu ra:** Bản chạy trên trình duyệt, có animation thật.

**Điểm kiểm tra quan trọng:** Chỉ nhân rộng hướng thiết kế và chuyển động khi prototype đã phù hợp với phản hồi của người dùng.

### Mốc C — Xây nền kỹ thuật

- [ ] Tách Server/Client Components.
- [ ] Tổ chức lấy dữ liệu và trạng thái lỗi.
- [ ] Tách hero khỏi nhánh chờ API.
- [ ] Thiết lập cache theo độ mới cần thiết.
- [ ] Tối ưu ảnh, font và metadata.
- [ ] Cô lập CSS và thống nhất cơ chế animation.

**Đầu ra:** Trang tải từng phần, ổn định và không ảnh hưởng các trang khác.

### Mốc D — Hoàn thiện trải nghiệm

- [ ] Danh mục có bố cục mới.
- [ ] Bộ chọn vợt hoạt động với dữ liệu thực.
- [ ] Khu sản phẩm có tab và ngân sách.
- [ ] Khối ảnh thể thao và bài viết.
- [ ] Đánh giá, thương hiệu và hỗ trợ.
- [ ] Trạng thái loading, empty, error và thử lại.
- [ ] Chuyển tiếp từ landing sang trang chi tiết.

**Đầu ra:** Landing page đầy đủ hành trình sử dụng.

### Mốc E — Kiểm tra và phát hành

- [ ] Kiểm tra responsive và nội dung dài.
- [ ] Kiểm tra bàn phím, focus, độ tương phản và giảm chuyển động.
- [ ] Kiểm tra API chậm, API lỗi và ảnh lỗi.
- [ ] Kiểm tra thao tác chọn sản phẩm và điều hướng quay lại.
- [ ] Đo hiệu năng trên bản production.
- [ ] Chạy build, typecheck và lint.
- [ ] Chụp ảnh so sánh và ghi hình các animation chính.
- [ ] Kiểm tra lại header/footer và các trang dùng chung component.

**Đầu ra:** Bản hoàn chỉnh có bằng chứng kiểm tra và danh sách giới hạn còn lại nếu có.

## 10. Cách tổ chức thay đổi

- Tạo nhánh triển khai riêng và commit theo từng mốc.
- Có URL preview để xem landing mới trước khi thay trang chủ chính thức.
- Preview tái sử dụng component và nguồn dữ liệu thực, tránh phát triển hai bản song song không đồng nhất.
- Giữ bản hiện tại để đối chiếu hoặc quay lại từng mốc.
- Không tự mở rộng thành redesign toàn hệ thống.
- Không tự triển khai lên môi trường public hoặc push khi chưa có yêu cầu.

## 11. Tiêu chí nghiệm thu

### Giao diện và nội dung

- [ ] Người dùng hiểu shop bán gì và thấy CTA trong màn hình đầu tại `1366×768`.
- [ ] Có điểm nhấn thị giác rõ ràng và nhịp bố cục thay đổi hợp lý.
- [ ] Không còn bốn section sản phẩm cùng cấu trúc lặp lại.
- [ ] Không còn các thành phần trang trí thừa đã xác định trong phạm vi landing.
- [ ] Giá, nhãn khuyến mãi và tồn kho đúng dữ liệu.
- [ ] Không thêm tuyên bố “bán chạy”, “đã mua hàng” hoặc cam kết khi chưa có dữ liệu chứng minh.

### Tương tác và khả năng truy cập

- [ ] Kiểm tra các chiều rộng đại diện: 360, 390, 768, 1280, 1366 và 1440px.
- [ ] Mobile có bố cục phù hợp, không tràn ngang và không phụ thuộc hover.
- [ ] Các điều khiển dùng được bằng bàn phím, có trạng thái focus rõ.
- [ ] Animation không chặn thao tác, không khóa cuộn và không gây lỗi hydration.
- [ ] Chế độ giảm chuyển động giữ đầy đủ nội dung và chức năng.
- [ ] API chậm hoặc lỗi vẫn hiện hero, điều hướng và cách phục hồi.
- [ ] Kiểm tra trình duyệt desktop và ít nhất một môi trường mobile thực hoặc mô phỏng được ghi rõ.

### Hiệu năng và chất lượng kỹ thuật

- [ ] Build, typecheck và lint đạt yêu cầu; các cảnh báo có sẵn được phân biệt rõ với cảnh báo mới.
- [ ] Đo trên bản production, ghi lại thiết bị, điều kiện mạng và kết quả trước/sau.
- [ ] Mục tiêu LCP ≤ 2,5 giây và CLS ≤ 0,1 trong điều kiện đo thống nhất.
- [ ] Mục tiêu INP ≤ 200ms khi có dữ liệu sử dụng thực tế; kiểm tra phản hồi thao tác trong quá trình phát triển.
- [ ] Animation hướng đến 60fps trên thiết bị thử nghiệm; giảm độ phức tạp khi xuất hiện giật hình.
- [ ] Không tải video, thư viện hoặc asset nặng vào lượt tải đầu khi chưa cần.
- [ ] Không làm sai giao diện header/footer hoặc chức năng của các trang liên quan.

Các chỉ số trên là mục tiêu cần đo, không phải kết quả đã đạt hay bảo đảm cho mọi thiết bị và điều kiện mạng.

## 12. Thứ tự ưu tiên

1. Hero và chuyển cảnh sang danh mục.
2. Rút gọn các khối sản phẩm lặp và cải thiện khám phá sản phẩm.
3. Bộ chọn vợt hữu ích, dựa trên dữ liệu thực.
4. Cấu trúc tải trang, ảnh, font và hiệu năng.
5. Khối nội dung thể thao, đánh giá và các animation phụ.
6. Video hoặc 3D chỉ bổ sung khi phiên bản chính đã đạt tiêu chí.

## 13. Tài liệu tham khảo

- Tài liệu Next.js đi kèm project: `frontend/node_modules/next/dist/docs/` — kiểm tra trước khi dùng API mới hoặc thay cấu hình.
- [Motion — useScroll](https://motion.dev/docs/react-use-scroll)
- [Motion — LazyMotion](https://motion.dev/docs/react-lazy-motion)
- [Motion — useReducedMotion](https://motion.dev/docs/react-use-reduced-motion)
- [Next.js — View Transitions](https://nextjs.org/docs/app/guides/view-transitions)

Tài liệu web có thể mô tả phiên bản mới hơn; khi triển khai phải đối chiếu phiên bản thực tế trong project.
