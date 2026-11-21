import type { Metadata } from "next";
import { ComboMuaChung } from "@/components/ComboMuaChung";
import { BannerTrangChu } from "@/components/quay/BannerTrangChu";
import { Catalog } from "@/components/landing/Catalog";
import { CongCu, DaiSoLieu } from "@/components/quay/CongCu";
import { DanhMucBento, TamGia, ThuongHieu } from "@/components/quay/GianHang";
import { BangTinTrangChu, HoiDap, QuyTrinh } from "@/components/quay/HuongDan";
import { ConNhieuHang, KeHang, KhuyenMai } from "@/components/quay/KhuyenMai";
import { LoiChoi } from "@/components/quay/LoiChoi";
import { HoiNguoiBanTrangChu } from "@/components/quay/PhanKhac";
import { QuayTuVan } from "@/components/quay/QuayTuVan";

const MO_TA = "Chọn vợt cầu lông theo lối chơi, trình độ và ngân sách: shop đưa ra 3 cây còn hàng kèm lý do từ thông số ghi trong kho. Giá và tồn kho thật, thêm vào giỏ không cần đăng nhập.";

export const metadata: Metadata = {
  title: "Quầy tư vấn vợt cầu lông - Cửa Hàng Cầu Lông",
  description: MO_TA,
  openGraph: { title: "Cửa Hàng Cầu Lông — Quầy tư vấn vợt", description: MO_TA, locale: "vi_VN", type: "website" },
};

/** Giữ cùng thời gian làm mới với LAM_MOI_SAN_PHAM_GIAY trong lib/server-api.ts. */
export const revalidate = 10;

export default function TrangChu() {
  return (
    <main>
      <Catalog>
        <BannerTrangChu />
        <QuayTuVan />
        <DaiSoLieu />
        <CongCu />
        <DanhMucBento />
        <LoiChoi />
        <KhuyenMai />
        <ComboMuaChung />
        <TamGia />
        <ThuongHieu />
        <KeHang />
        <ConNhieuHang />
        <BangTinTrangChu />
        <HoiNguoiBanTrangChu />
        <QuyTrinh />
        <HoiDap />
      </Catalog>
    </main>
  );
}
