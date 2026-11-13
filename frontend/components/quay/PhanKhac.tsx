"use client";

import { HoiNguoiBan } from "@/components/HoiNguoiBan";
import { useHoSo } from "@/components/HoSoChoi";
import { NHAN_LOI_CHOI, NHAN_NGAN_SACH } from "@/lib/ho-so-choi";
import k from "./khu.module.css";

/** Khung "Hỏi người bán" của trang chủ (chỉ một khung chat nhúng mỗi trang); câu hỏi gợi ý dựng từ hồ sơ người chơi đã chọn (nếu có). */
export function HoiNguoiBanTrangChu() {
  const hs = useHoSo();
  const goiY = [
    hs.lc ? `Mình chơi lối ${NHAN_LOI_CHOI[hs.lc]}${hs.ns ? `, ngân sách ${NHAN_NGAN_SACH[hs.ns].toLocaleLowerCase("vi")}` : ""}. Bạn gợi ý vợt giúp mình nhé.` : "Tư vấn vợt cho người mới",
    "Vợt nào đang còn hàng và có khuyến mãi?",
    "Khác nhau giữa vợt nặng đầu và nhẹ đầu là gì?",
    "Kiểm tra đơn hàng",
  ];
  return (
    <section className={`${k.khu} ${k.vienTren}`} aria-label="Hỏi người bán">
      <div className="container" id="hoi-nguoi-ban">
        <HoiNguoiBan mota="Hỏi bằng lời của bạn: shop tra giá, tồn kho, khuyến mãi và gợi ý theo dữ liệu đang có. Chưa có thông tin thì shop nói là chưa có, không đoán." goiY={goiY} />
      </div>
    </section>
  );
}
