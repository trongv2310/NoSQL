# Kế hoạch nâng cấp Landing 3D `/trai-nghiem` (đợt 3, 14/11/2026)

File: `frontend/public/trai-nghiem/index.html` (HTML tĩnh, Three.js r150).

## 1. Chẩn đoán (từ ảnh chụp thực tế 1440×900)

| Nhận xét của người dùng | Nguyên nhân nhìn thấy trên màn hình |
| --- | --- |
| Khán giả "như game rẻ tiền" | Mỗi người là một hình quân cờ (trụ + cầu), áo màu rực bão hoà cao, ngồi thẳng hàng đều tăm tắp trên ghế xanh sáng, sáng đều như nhau, không có bóng tối nên lộ hết hình khối thô. Làn sóng lặp máy móc 9 giây một lần. |
| Vợt và cầu "đơn sơ" | Khung vợt là một vòng xuyến đen trơn, cước là đường kẻ 1px, không sơn, không hoạ tiết, không chữ, cán trơn. Trên hero đầu vợt chỉ ~150px và chồng lên màn LED nên chìm. Quả cầu đứng yên, nhỏ, không có ánh sáng riêng. |
| Vào trang "chưa có gì ấn tượng" | Màn tải chỉ là thanh tiến độ. Mở màn chỉ có mờ dần 0,7s + camera lùi nhẹ. Cảnh phẳng một màu xanh, không có điểm nhấn sáng tối, không có khoảnh khắc nào "xảy ra". Không có gì để tương tác ngoài cuộn. |

## 2. Hướng giải quyết: "Đêm chung kết"

Nhà thi đấu thật vào trận đêm: khán đài chìm trong tối, sân chính sáng rực, khán giả chỉ còn là bóng người có viền sáng và ánh đèn điện thoại. Vợt và cầu là "ngôi sao" được rọi đèn riêng. Vào trang là một màn bật đèn + một cú đập cầu.

Nguyên tắc giữ nguyên: kiểu chữ/nút của web, hiệu ứng không lấn sản phẩm (các chương sau hero giữ tĩnh), không bịa số liệu, các đường lui `?nogl=1`, `?q=low`, giảm chuyển động, cảm ứng vẫn chạy.

## 3. Các đợt

### Đợt 1 — Ánh sáng "đêm thi đấu" + khán giả
- Hạ sáng tường, trần, khán đài, sân phụ; dồn sáng vào sân chính (tương phản sáng/tối).
- Ghế tối màu, bớt bão hoà.
- Dựng lại khán giả: dáng người ngồi (vai rộng hơn eo, cổ, đầu có tóc, đùi đưa ra trước, tay đặt trên đùi), bảng màu áo trầm, viền sáng ngược (rim light) để tách khỏi nền, kích cỡ/tư thế lệch nhau, ~10% giơ tay cổ vũ.
- Đèn điện thoại lấp lánh trên khán đài (điểm sáng nhấp nháy, ăn bloom), vài que sáng màu thương hiệu.
- Bỏ làn sóng máy móc: thay bằng lắc lư nhẹ + bật dậy reo khi có cú đập.

### Đợt 2 — Vợt và quả cầu
- Khung vợt đúng hình isometric (đầu hơi vuông), tiết diện khí động; sơn bóng phủ clearcoat, hoạ tiết xanh thương hiệu → carbon, điểm cam, các dải decal màu trên khung và thân (không in chữ hay tên hãng).
- Cước là hình khối thật (22 dọc × 21 ngang, đan trên dưới), có logo stencil trên mặt cước; dải gen + lỗ gen.
- Khớp chữ T vuốt liền, thân vợt thon dần có decal, nón cán, cán quấn chéo có gờ, nắp đuôi.
- Giữ nguyên hệ toạ độ cục bộ của vợt để chú thích cấu tạo (chương 01) vẫn bám đúng.
- Quả cầu: lông có gân, đế bần có viền, to và rõ hơn, có vệt sáng khi bay.
- Đèn rọi riêng cho vợt/cầu; trên hero vợt lớn hơn, tách khỏi màn LED.

### Đợt 3 — Mở màn và hero
- Màn tải mới: vợt vẽ nét dần theo tiến độ, tên shop, phần trăm lớn.
- Chuỗi "bật đèn": tối hẳn → từng dãy đèn trần bật từ xa đến gần → màn LED nháy lên → băng LED chạy → đèn điện thoại khán đài → đèn rọi vào vợt.
- Camera hạ cần cẩu từ trên cao xuống vị trí hero (~3s; cuộn là bỏ qua).
- Cú đập cầu đồng bộ với tiêu đề "Mỗi cú đập cầu…": vợt vung, cầu lao đi kèm vệt sáng, rung nhẹ camera, quầng sáng nơi cầu chạm sân, băng LED quanh sân loé một nhịp, khán đài bật dậy reo và loé đèn.
- Trong hero: cứ ~8s lặp lại một pha; bấm/chạm vào sân để tự đập cầu (có gợi ý nhỏ). Qua chương khác thì dừng hẳn.

### Đợt 4 — Kiểm tra
- Chụp 6 mốc camera + chuỗi mở màn ở 1440×900 và 390×844; không lỗi console.
- Đo fps (mốc cũ 66–69 fps trên Iris Xe), kiểm `?q=low`, `?nogl=1`, giảm chuyển động.
- Không commit (chờ người dùng xem).

## 4. Trạng thái
- [x] Đợt 1 — ánh sáng đêm thi đấu, khán giả shader mới, đèn điện thoại
- [x] Đợt 2 — vợt, quả cầu, đèn rọi, tư thế hero
- [x] Đợt 3 — màn tải vẽ vợt, chuỗi bật đèn, camera cần cẩu, cú đập cầu (tự động + bấm vào sân)
- [ ] Đợt 4 — mới xong một phần (xem dưới)

### Đã kiểm (14/11/2026, Chrome có GPU, 1440×900)
- Trang tải không có `pageerror` sau lần sửa cuối; script nội tuyến qua kiểm cú pháp; file vẫn LF.
- Chuỗi mở màn tốc độ thật (`v2h-intro-*`): tối → bật đèn → vợt được rọi → cú đập đầu tiên → gợi ý "Bấm vào sân để đập cầu".
- Cú đập quay chậm (`v2g-*`): lấy đà → chớp sáng lúc chạm → vệt sao chổi → quầng sáng ở sân bên kia.

### Chưa kiểm sau khi xong Đợt 2–3
Máy chủ tĩnh tạm (cổng 4173) bị dừng vì máy thiếu RAM nên các mục sau còn treo:
- 6 mốc `?shot=0..5` (chú thích cấu tạo chương 01 có còn bám đúng vợt mới; các chương sau có giữ tĩnh).
- Di động 390×844, `?q=low`, `?nogl=1`, `?post=0`, giảm chuyển động.
- Đo lại fps so với mốc 66–69.
- Nhịp loé của băng LED khi cầu chạm sân ở tốc độ thật.

### Điểm còn có thể chỉnh
- Quả cầu chờ nằm sát mép dưới thanh điều hướng (hạ `PROPS.hero.hy` nếu thấy chật).
- Mấy cột đèn dọc ở tường xa chạy xuyên sau tiêu đề hero, hơi rối chữ.
