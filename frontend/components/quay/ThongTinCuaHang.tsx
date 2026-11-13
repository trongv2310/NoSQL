"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProviders";
import { OpenChatButton } from "@/components/landing/OpenChatButton";
import s from "./huong-dan.module.css";

/**
 * Khung thông tin cửa hàng. Chỉ hiện địa chỉ, số điện thoại, email, giờ mở cửa khi cấu hình hệ thống (`/site` → lienHe) có giá trị;
 * chưa có thì nói rõ là đang cập nhật, không bịa gì. Không dùng mô tả cửa hàng tự do vì có thể chứa khẳng định không kiểm chứng.
 */
export function ThongTinCuaHang() {
  const { site } = useApp();
  const lh = site.lienHe;
  const co = !!(lh?.diaChi || lh?.dienThoai || lh?.email || lh?.gioMoCua);
  return (
    <aside className={`${s.cuaHang} sf-reveal`} aria-labelledby="cua-hang-tieu-de">
      <h3 id="cua-hang-tieu-de" className={s.cuaHangTen}>{site.tenSite || "Cửa hàng cầu lông"}</h3>
      {co ? (
        <ul className={s.lienHe}>
          {lh?.diaChi && <li><span>Địa chỉ</span>{lh.diaChi}</li>}
          {lh?.dienThoai && <li><span>Điện thoại</span><a href={`tel:${lh.dienThoai.replace(/[^0-9+]/g, "")}`}>{lh.dienThoai}</a></li>}
          {lh?.email && <li><span>Email</span><a href={`mailto:${lh.email}`}>{lh.email}</a></li>}
          {lh?.gioMoCua && <li><span>Giờ mở cửa</span>{lh.gioMoCua}</li>}
        </ul>
      ) : (
        <p className={s.chuaCo}>Thông tin liên hệ (địa chỉ, điện thoại, giờ mở cửa) đang được cập nhật. Trong lúc chờ, bạn có thể hỏi người bán ngay trên website.</p>
      )}
      <p className={s.thanhToan}>Thanh toán: <b>COD</b> <span aria-hidden="true">·</span> <img src="/images/momo-logo.png" alt="MoMo" height={22} /></p>
      <div className={s.cuaHangNut}>
        <OpenChatButton className={s.nutCam}>Hỏi người bán</OpenChatButton>
        <Link href="/Home/Contact" className={s.nutVien}>Trang liên hệ</Link>
      </div>
    </aside>
  );
}
