# PLAN — Tinh chỉnh landing 3D "Trải nghiệm" (/trai-nghiem)

Ngày lập: 13/11/2026
Trạng thái: **đã triển khai đủ 5 đợt (13/11/2026), chưa commit.** Theo lựa chọn mặc định: phương án A, ảnh có sẵn trong repo, 4 danh mục thật.

### Kết quả triển khai

- Đợt 1: đã gỡ hết chữ Hán/Kana và chữ tiếng Anh trên giao diện. Đã sửa lỗi cắt dấu (mặt nạ chữ được nới vùng cắt, khoảng dòng tiêu đề tăng lên 1,14). Đã gỡ lớp tiền cảnh giả và lá rơi. Nút ☰ chỉ còn trên mobile, header mobile gọn lại. Tiêu đề chương 04 nằm ngang.
- Đợt 2: 4 thẻ danh mục dùng banner thật (webp trong `public/trai-nghiem/anh/`) và đếm số mẫu còn hàng từ API. Hàng logo 4 hãng kèm số vợt, bấm vào lọc theo `hangs`. Thẻ vợt nổi bật có ảnh và logo. Drawer dùng ảnh sản phẩm thật. Chip hero dẫn tới `loi_choi=cong|toc|toan` và `loai=Giay`.
- Đợt 3: quả cầu dựng lại theo ảnh `pk_cau_thi_dau.jpg`.
- Đợt 4: thay bằng nhà thi đấu: sân chính + 2 sân phụ, băng LED logo, màn LED chiếu banner đổi theo chương, giàn đèn, cột sáng, khán đài. Camera có 6 mốc mới. Bỏ các ô xem 3D trên thẻ và chữ 3D khổng lồ.
- Đợt 5: đã kiểm ở 1440×900 và 390×844, chế độ `?nogl=1`, giảm chuyển động, mở/đóng drawer bằng bàn phím; không có lỗi JS. Tốc độ 66–69 fps trên Iris Xe (bản cũ 59–68).
- Bẫy gặp phải: `pow(0, y)` trong shader cột sáng ra NaN trên ANGLE/D3D, NaN lan qua bloom thành khối đen răng cưa. Đã thay bằng `f*f`.
- Còn chờ chủ dự án: ảnh vợt sạch. Thẻ vợt nổi bật vẫn lộ watermark HVshop, Quốc Việt, Đức An trên ảnh gốc của shop. Trong `ANH_SACH` mới chỉ có `astrox99pro.jpg`.
File chính: `frontend/public/trai-nghiem/index.html` (HTML tĩnh 3.809 dòng, CSS + JS viết thẳng trong file, Three.js r150 bản UMD), `brand-theme.js`

## 1. Cách đã kiểm tra

- Chạy trang thật qua `next dev` (cổng 3010) + backend 4000, Chrome headless dùng GPU thật (Intel Iris Xe, ANGLE D3D11), WebGL bật đầy đủ.
- Chụp 10 mốc cuộn ở 1440×900 và 6 mốc ở 390×844, mở thử bảng mua hàng (drawer).
- Đọc mã dựng cảnh, CSS và phần nối dữ liệu.

Trang được chuyển từ template Kage (đền Kyoto). Bảng màu đã đổi sang màu shop, nhưng bố cục cảnh, chữ phụ, lớp tiền cảnh và tên biến vẫn là của Kage. Phần lớn lỗi dưới đây xuất phát từ đó.

## 2. Lỗi tìm thấy

Mức: **P0** hỏng rõ, ai nhìn cũng thấy · **P1** làm trang kém tin cậy · **P2** đánh bóng.

### P0-1. Chữ Nhật/Trung và tiếng Anh lọt vào giao diện

15 chỗ có chữ Hán/Kana:

| Dòng | Chỗ | Chữ |
|---|---|---|
| 872 | Màn tải | 羽球の極致 |
| 892–895 | Chữ hiện khi rê chuột lên menu | 炭素 · 装備 · 名器 · 張人 |
| 938, 944 | Thẻ "peek" và cột chữ dọc lớn bên phải hero (cỡ 30–54px) | 羽球 · 羽球の極致 |
| 962, 1000, 1044 | Đầu mỗi chương | 炭素 · 装備 · 名器 |
| 1007, 1015, 1023 | Nhãn 3 thẻ danh mục | 強打 · 速攻 · 球靴 |
| 1162 | Chân trang | 羽球の極致 |

Chữ tiếng Anh còn sót: "3D COURT SHOWROOM", "COURT BAG", "Chapter 00" (trong khi chương 04 lại ghi "Chương 04"), màn tải "Tensioning carbon frame & calibrating court lines", chân trang "3D Badminton Showroom" và "WebGL2 · Three.js r150". Tooltip và `aria-label` của thanh chương bên phải là tên chương của Kage: 'The Hidden Gate', 'The Sanmon', 'Still Gardens', 'Sacred Craft', 'Afterlight', 'Colophon' (dòng 3023), trình đọc màn hình sẽ đọc to các tên này.

### P0-2. Kết cấu "đền" chắn ngang hậu cảnh

Ngay sau sân là một khối do 4 hàm dựng:

- `buildShell`: bục 42 × 7 × 24 m, cầu thang 40 bậc rộng 8,4 m, hai tường bên cao 12 m.
- `buildTemple`: mái phẳng, 17 thanh vây dọc, tấm ốp, đèn hắt cam. Từ camera hero nhìn thẳng vào nên nó chiếm gần hết nửa trên khung hình.
- `buildMoon`: vòng tròn "mặt trăng" sau mái, đây là cung xanh phía trên vợt ở hero.
- `buildLantern`, `buildMaple`, `buildRocks`: trụ đèn kiểu đèn đá dọc cầu thang, chậu cây, ghế.

Camera (`CAM`, dòng 2734) leo cầu thang lên "đền" qua các chương 2–5. Kết quả là người xem thấy một ngôi đền có bậc thang chứ không thấy nhà thi đấu cầu lông.

### P0-3. Quả cầu 3D trông như cầu đã đánh nát

`createShowroomShuttle` (dòng 1646):

- Lông dùng texture `texLeaf`, tức một chiếc lá có gân xương cá to, nên nhìn gần giống lá lau.
- Bề rộng lông theo `sin(πt)`: rộng ở giữa, nhọn ở ngọn. Mép trên của váy cầu vì thế thành 16 mũi nhọn rời nhau, giữa các mũi có khe hở. Cầu thật thì ngược lại: phần dưới chỉ có cọng, phần trên là bản lông rộng có ngọn bo tròn, các lông gối mép lên nhau thành một váy liền.
- Lông phẳng, không cong, không xoay quanh cọng nên không gối mép.
- `buildLeafFall` thả thêm 260 "lông" bằng chính texture lá đó khắp sân. Trông như lá hoặc hạt gạo rơi và càng làm cảnh có vẻ cầu bị vặt lông.

### P0-4. Ảnh danh mục là hình vẽ 2D và vẽ sai

`renderBadmintonPoster` (dòng 2509) vẽ bằng canvas:

- Vợt là một hình elip, lưới xiêu vẹo, cán vợt rời khỏi khung.
- Giày là một hình chữ nhật bo góc viền cam, không ra hình giày.
- Chữ in sẵn trong ảnh ("KHUNG KHÍ ĐỘNG HỌC", "ĐẾ GIÀY · ĐỘ BÁM") đè lên nhãn thẻ ("VỢT PHẢN TẠT", "GIÀY CẦU LÔNG").
- Cùng hình vẽ này được dùng lại ở thẻ peek trên hero (kèm nút ▶ như video, nhưng không có video nào) và trong bảng mua hàng thay cho ảnh sản phẩm.
- Ánh xạ sai: chip/thẻ "Căng cước chuẩn" mở một cây vợt bất kỳ (`list.find(isRacket)`). Ba thẻ cũng không khớp 4 danh mục thật của shop (Vợt, Giày, Trang phục, Phụ kiện).

### P0-5. Dấu tiếng Việt bị cắt

- `.mask-line { overflow: hidden }` với line-height 1,055 cắt dấu chồng: tiêu đề hero hiện "MÔI CÚ ĐẬP CẦU" thay vì "MỖI".
- `.word-mask { overflow: hidden }` cắt dấu nặng/dấu hỏi: tiêu đề chương 03 hiện "TUYẾN CHON" thay vì "TUYỂN CHỌN".

### P1-1. Khối mờ hình chữ nhật trên mọi chương

`taoAnhTienCanh` (dòng 1796) vẽ các hình mờ thay cho lớp cỏ, cây, đá của Kage. Chúng được dùng cho 6 mặt phẳng 3D (`buildForeground`) và khoảng 17 ảnh DOM `.fg-el`. Do cạnh canvas sắc, chúng hiện thành các mảng xám trong mờ có viền thẳng: ở chương 01 là mảng từ x≈43 đến 907, ở chương 03 là cả nửa phải sáng hơn. Nhìn như lỗi render.

### P1-2. Thương hiệu chỉ là chữ

Tên hãng hiện bằng chữ giãn cách ("M i z u n o") cạnh tên vợt, khối số liệu chỉ ghi "4 / Thương hiệu", còn drawer ghi chữ "YONEX". Repo đã có logo `public/images/brands/{yonex,lining,victor,mizuno}.svg`, dùng màu gốc (Li-Ning đỏ, Mizuno xanh navy, Yonex xanh dương/xanh lá), nên cần thêm bản đơn sắc để đặt trên nền tối. Các sản phẩm phụ kiện có `hang = null`.

### P1-3. Bố cục và nội dung từng khu

- **Hero:** chữ 3D "SHOP CẦU LÔNG" chiếm nửa dưới màn hình và bị thẻ peek đè. Khi cuộn, nó trôi ra sau đoạn văn chương 01 làm chữ khó đọc. Trên desktop 4 chip chỉ còn số "01 02 03 04", vì nhãn bị ẩn bằng `clip`. Nút ☰ hiện trên desktop nhưng bấm không làm gì (`if (vpW() > 820) return`).
- **Chương 03 (Vợt nổi bật):** tiêu đề "Dòng vợt tuyển chọn. Giá và tồn kho lấy từ cửa hàng." cùng hai câu chú thích lặp ý, giọng như ghi chú kỹ thuật. Thẻ chỉ có chữ, không ảnh. Vợt được chọn theo "đang giảm → giá cao", nên có thể lấy phải ảnh xấu (`mizuno_jpx_reserve.jpg` chỉ 225px).
- **Chương 04:** tiêu đề xoay dọc 90° sát mép phải, khó đọc. Lông cầu khổng lồ che đoạn văn bên trái. Hai nút CTA chỉ có viền mờ, tương phản thấp. Menu ghi "Đan vợt" nhưng dẫn đến khu "Bước vào trận đấu".
- **Drawer:** dùng hình vẽ thay ảnh sản phẩm, có câu đệm "Chọn sản phẩm và phiên bản phù hợp với phong cách của bạn.", nút giảm số lượng dùng dấu "-" ASCII.
- **Mobile 390px:** header quá chật ("COURT BAG ( 0 )" xuống 2 dòng, "VÀO CỬA HÀNG" xuống 3 dòng). Cột chữ dọc tiếng Nhật vẫn hiện và đè lên đoạn văn hero, vì luật `body[data-layout-hero="b"] .hero-side{display:block}` mạnh hơn luật ẩn ở ≤820px. 4 chip chồng lên cảnh 3D ở đáy màn hình.

### P2. Ghi chú kỹ thuật

- Một file 218 KB chứa cả CSS và JS. Three.js r150 bản UMD đã báo deprecated trong console. Font Google tải theo kiểu chặn hiển thị.
- Tên hàm/biến vẫn theo Kage (`buildTemple`, `buildTorii` dùng cho lưới, `buildMoon`, `buildMaple`, `texLeaf`, log `[kage]`), dễ gây nhầm khi bảo trì.

## 3. Những gì nên giữ

- Bảng màu `BRAND_THEME`, sân đúng vạch BWF, lưới, vợt khớp chữ T, hậu kỳ bloom/grain, hiệu ứng vải trên thẻ (vẫn dùng được với ảnh thật).
- Dữ liệu thật từ API: số vợt còn hàng, 5 vợt nổi bật, drawer chọn phiên bản, mức căng dự định, giỏ khách dùng chung với web.
- Chế độ dự phòng khi không có WebGL, tôn trọng `prefers-reduced-motion`, tham số `?shot=0..5` để chụp từng mốc cố định.

## 4. Thay "đền" bằng gì: 3 phương án

### A. Nhà thi đấu ban đêm (đề xuất)

Bỏ bục, cầu thang, "đền", vòng trăng, trụ đèn đá, chậu cây, lá rơi và lớp tiền cảnh giả. Thay bằng những thứ có thật trong một nhà thi đấu, giữ thấp hoặc treo cao để không chắn tầm nhìn:

1. **Sân chính và hai sân phụ hai bên** mờ dần trong sương, để người xem nhận ra ngay đây là nhà thi đấu. Quanh sân là sàn tối.
2. **Băng LED quảng cáo** cao khoảng 0,8 m chạy quanh sân, hiện logo 4 hãng và tên shop, chạy chậm. Băng vẽ bằng CanvasTexture từ các file SVG logo, và đáp ứng luôn yêu cầu đưa logo vào.
3. **Màn hình LED treo cuối nhà thi đấu** ở chỗ "đền" cũ, nhưng là tấm mỏng treo cao (kiểu jumbotron) chứ không phải khối đặt trên nền. Màn chiếu banner sản phẩm thật và đổi theo chương, ví dụ Astrox 99 ở phần vợt tấn công, Nanoflare 1000 ở phần tốc độ. Màn này là điểm nhìn mới cho camera.
4. **Giàn đèn trần** (khung truss) với dải LED và vài cột sáng rọi xuống sân. Bụi lấp lánh trong cột sáng thay cho lá rơi.
5. **Khán đài thấp, tối màu** hai bên để tạo chiều sâu. Dựng bằng instancing, không cần chi tiết.
6. **Vợt khổng lồ và quả cầu mới** lơ lửng trên lưới, làm nhân vật chính.

Camera mới, vẫn 6 mốc khớp 6 khối của trang:

| Mốc | Khu | Camera |
|---|---|---|
| 0 | Hero | Góc rộng từ sau đường biên cuối, hơi cao, nhìn qua lưới về màn LED |
| 1 | Công nghệ | Quay quanh vợt khổng lồ, cận khớp chữ T và khung (khớp nội dung chương) |
| 2 | Bộ sưu tập | Hướng vào màn LED và băng logo |
| 3 | Vợt nổi bật | Lướt dọc băng LED, màn LED chiếu banner vợt |
| 4 | Ra sân | Hạ ngang mặt lưới, nhìn sang nửa sân bên kia ("bước vào trận đấu") |
| 5 | Chân trang | Kéo lên cao, nhìn toàn cảnh |

### B. Studio trưng bày tối giản

Nền tối vô cực, một bục tròn thấp xoay chậm, đèn rọi, chỉ có vợt và cầu.
Ưu: gọn nhất, tập trung vào sản phẩm, nhẹ máy.
Nhược: mất cảm giác sân đấu, dễ giống một trang sản phẩm bình thường.

### C. Giữ sân, thay "đền" bằng tường vợt

Thay đền bằng một bức tường trưng bày thấp (cao khoảng 3 m) có 5 hốc đèn treo 5 vợt nổi bật dựng 3D. Camera chương 03 lướt dọc tường.
Ưu: gắn thẳng với chương "Vợt nổi bật".
Nhược: vẫn là một khối nằm cuối tầm nhìn, nếu làm không khéo sẽ thành một "đền" khác.

Đề xuất chọn **A**, và có thể mượn ý tường vợt của C làm nội dung cho màn LED.

## 5. Kế hoạch theo đợt

Mỗi đợt xong đều chụp lại các mốc `?shot=0..5` ở 1440×900 và 390×844 để so với ảnh trước khi sửa.

### Đợt 1: Dọn sạch và sửa lỗi hiển thị (nhỏ, rủi ro thấp)

1. Việt hóa toàn bộ: gỡ 15 chỗ chữ Hán/Kana. Bỏ hiệu ứng đổi chữ phụ khi rê chuột lên menu, hoặc dùng chữ phụ tiếng Việt. Đổi các chữ tiếng Anh: "Showroom 3D", "Giỏ hàng (0)", "Chương 00", màn tải "Đang dựng sân…". Bỏ dòng kỹ thuật ở chân trang. Đặt tên chương tiếng Việt cho tooltip và `aria-label` của thanh chương.
2. Sửa cắt dấu: thêm `padding-block: .2em; margin-block: -.2em` cho `.mask-line` và `.word-mask` (hoặc dùng `overflow: clip` + `overflow-clip-margin`). Kiểm lại các chữ "Mỗi", "Tuyển chọn", "Ỗ Ữ Ặ Ậ Ỷ".
3. Gỡ lớp tiền cảnh giả: các khối `.fg` trong HTML, `buildForeground`, `taoAnhTienCanh`, `wireForegroundStages`, `#fg-sky`. Gỡ luôn `buildLeafFall`.
4. Bố cục: ẩn `.hero-side` trên mobile, ẩn nút ☰ trên desktop. Header mobile gọn lại (giỏ thành icon kèm số, nút "Cửa hàng" ngắn). Tiêu đề chương 04 nằm ngang.
5. Sửa nhãn và ánh xạ: chip "Căng cước chuẩn" dẫn tới danh sách vợt, không mở vợt ngẫu nhiên. Đổi nhãn menu "Đan vợt" thành "Ra sân".

Nghiệm thu: tìm theo dải Unicode CJK không còn kết quả, không còn khối mờ chữ nhật trên ảnh chụp, dấu tiếng Việt đủ ở mọi tiêu đề.

### Đợt 2: Ảnh thật và logo hãng (vừa)

1. **Bộ sưu tập theo 4 danh mục thật** (Vợt, Giày, Trang phục, Phụ kiện). Bố cục bento: 1 thẻ lớn và 3 thẻ nhỏ. Mỗi thẻ có ảnh banner thật, số sản phẩm còn hàng đếm từ API và link `/SanPham/Index?loai=Vot|Giay|AoQuan|PhuKien`. Bỏ `renderBadmintonPoster`. Hiệu ứng vải vẫn giữ, vì `clothPlate` nhận vào bất kỳ ảnh nào.
   - Ảnh lấy từ repo nếu chủ dự án không đưa ảnh mới: `banner2.png` (Astrox 99 "Pure Power") cho Vợt, `landing/cat-giay.webp` (giày Li-Ning) cho Giày, `landing/cat-aoquan.webp` cho Trang phục, `landing/cat-phukien.webp` (ảnh quả cầu thật) cho Phụ kiện, `banner3.png` (Nanoflare 1000) cho màn LED và thẻ hero. Không dùng `cat-vot.webp` vì chỉ rộng 350px.
   - Khai báo ảnh ở một chỗ (`ANH_DANH_MUC`: đường dẫn + điểm lấy nét), xuất webp 2 cỡ, sau này thay ảnh chỉ cần sửa một dòng.
2. **Thẻ hero:** bỏ nút ▶. Dùng ảnh banner thật kèm nhãn ngắn, link tới sản phẩm hoặc danh mục. Nếu chọn phương án A thì có thể bỏ hẳn thẻ này, vì màn LED đã làm việc đó.
3. **Logo hãng:** làm bản đơn sắc (`fill="currentColor"`) của 4 SVG, dùng ở 4 chỗ:
   - Thẻ vợt nổi bật, thay cho chữ giãn cách.
   - Khối số liệu chương 01: thay chữ "4 / Thương hiệu" bằng hàng 4 logo kèm số vợt còn hàng của mỗi hãng, bấm vào thì lọc theo hãng.
   - Đầu drawer.
   - Băng LED 3D (đợt 4).

   Sản phẩm không có hãng thì không hiện logo.
4. **Vợt nổi bật:** thêm ảnh sản phẩm (`hinhAnhDaiDien`) đặt trên nền sáng. Chọn vợt ưu tiên ảnh sạch (danh sách `ANH_SACH` trong `lib/landing-data.ts`), rồi đến tồn kho. Viết lại tiêu đề cho gọn, giữ một dòng nhỏ "Giá và tồn kho cập nhật từ cửa hàng".
5. **Drawer:** dùng ảnh sản phẩm thật, logo hãng ở đầu, bỏ câu đệm, đổi "-" thành "−".

Lưu ý: nhiều ảnh vợt trong kho còn watermark của shop khác (HVshop, TDS, Covi Sport, Quốc Việt, Đức An). Thẻ vợt nổi bật sẽ chỉ đẹp hẳn khi có ảnh sạch.

### Đợt 3: Làm lại quả cầu (vừa)

Số đo theo luật BWF: 16 lông, dài 62–70 mm, đường tròn ngọn lông 58–68 mm, đế 25–28 mm. Tỉ lệ của mô hình hiện tại gần đúng, phần cần làm lại là lông và vật liệu:

1. **Hình lông:** khoảng 40% dưới chỉ là cọng (nằm trong vùng chỉ buộc). Bản lông bắt đầu từ đó, rộng dần lên trên, ngọn bo tròn. Bề rộng ở ngọn khoảng 1,3 lần chu vi chia 16, để các lông gối mép nhau.
2. **Gối mép:** xoay mỗi lông 12–18° quanh cọng của nó theo cùng một chiều, như cánh tuabin. Uốn bản lông hơi khum. Lưới hình học dày hơn (khoảng 6 × 12 đoạn mỗi lông).
3. **Texture mới:** kênh alpha theo đường viền ngọn bo, vân lông rất mảnh (các nét mảnh chéo 60° so với cọng, tương phản thấp), màu trắng ngà `#f4f1e8`, bỏ gân lá. Thêm hiệu ứng xuyên sáng nhẹ (sửa shader qua `onBeforeCompile`) để lông hơi sáng lên khi có đèn phía sau.
4. **Đế và chỉ:** đế gồm nửa cầu và thân trụ ngắn bọc da trắng, có một băng màu xanh của shop. Hai vòng chỉ buộc màu kem, hơi bóng như có keo.
5. Dùng chung mô hình này cho mọi chỗ có quả cầu. Không thả lông rơi nữa.

Nghiệm thu: chụp cận ở 1440px, váy cầu liền mạch, 16 ngọn bo đều, nhìn ngang không thấy khe hở. Đặt cạnh ảnh `images/pk_cau_thi_dau.jpg` mà vẫn trông như quả cầu mới.

### Đợt 4: Bố trí lại cảnh 3D theo phương án đã chọn (lớn)

Với phương án A:

1. Gỡ `buildShell` (bục, cầu thang, tường 12 m), `buildTemple`, `buildMoon`, `buildLantern`, `buildMaple`, `buildRocks` và các đèn gắn với "đền" trong `buildLights`.
2. Dựng sân phụ, sàn, băng LED có logo (texture chạy chậm), màn LED treo chiếu banner thật (đổi ảnh theo chương, có chuyển cảnh mềm), giàn đèn trần và cột sáng, khán đài.
3. Viết lại 6 mốc `CAM` và góc nhìn 4 thẻ (`buildCards`), kiểm tra lại `fitAspect` cho màn dọc.
4. Mỗi khối chữ có nền tối riêng, không dựa vào cảnh phía sau để đọc được chữ.
5. Đổi tên hàm/biến theo đúng vật thể (`buildArena`, `buildNet`, `buildLedBoards`…), bỏ log `[kage]`.

Nghiệm thu: ở hero thấy rõ sân, lưới và màn LED. Không vật thể nào phía sau sân che quá 25% khung hình. FPS trên Iris Xe không thấp hơn hiện tại (theo dõi `PERF.scale`).

### Đợt 5: Hoàn thiện trải nghiệm và kiểm thử (nhỏ)

1. Chip hero hiện đủ nhãn, không chỉ có số. Mỗi chip dẫn tới đúng lối chơi: `/SanPham/Index?loai=Vot&loi_choi=cong|toc|toan`, riêng chip giày dẫn tới `loai=Giay`.
2. Chữ 3D "SHOP CẦU LÔNG": thu nhỏ và giảm độ sáng, hoặc chuyển lên băng LED. Không để chữ này nằm sau đoạn văn chương 01.
3. Chương 04: nút chính nền cam đặc, nút phụ có viền.
4. Kiểm thử ở 1440×900, 1280×720, 390×844. Kiểm thêm chế độ giảm chuyển động, `?nogl=1` (không WebGL), điều hướng bằng bàn phím (Tab qua thẻ, mở/đóng drawer, bẫy focus) và đọc console không còn lỗi.

## 6. Thứ tự đề xuất

Làm đợt 1 trước: thay đổi nhỏ nhưng xóa được phần lớn cảm giác "trang lỗi". Sau đó làm đợt 2 và 3 (hai đợt độc lập, làm song song được), rồi đợt 4, cuối cùng đợt 5. Đợt 4 viết lại camera nên kéo theo vị trí vợt/cầu và góc nhìn các thẻ. Vì vậy đợt 3 chỉ làm mô hình quả cầu, chưa đặt vị trí.

## 7. Cần chủ dự án quyết

1. **Phương án thay "đền":** A (nhà thi đấu, đề xuất), B (studio) hay C (tường vợt).
2. **Nguồn ảnh banner:** dùng ảnh có sẵn trong repo (mục 5, đợt 2) hay chủ dự án gửi banner chính hãng độ phân giải cao hơn. Ảnh của hãng có bản quyền. Với đồ án học tập thường chấp nhận được, nhưng nên ghi nguồn vào `images/CREDITS.txt`.
3. **Khu Bộ sưu tập:** đổi sang 4 danh mục thật của shop (đề xuất) hay giữ 3 thẻ theo lối chơi (tấn công / phản tạt / giày).
