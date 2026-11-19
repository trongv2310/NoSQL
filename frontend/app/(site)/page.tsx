import type { Metadata } from "next";
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

/**
 * Trang chủ "Quầy tư vấn": nền sáng, không có cảnh 3D/WebGL. Màn hình đầu là bộ chọn + 3 vợt thật; bên dưới là các khu có nhịp khác nhau:
 * số liệu kho, công cụ của shop, danh mục, chọn theo lối chơi (Racket DNA), khuyến mãi, tầm giá, thương hiệu, kệ giày/áo quần/phụ kiện, tồn kho,
 * Bảng tin, hỏi người bán, quy trình mua hàng, câu hỏi thường gặp. Mọi con số và danh sách đều đếm/chọn từ dữ liệu thật (lib/landing-data.ts).
 * Trang tĩnh làm mới theo hạn của dữ liệu giá/tồn kho (literal để Next đọc lúc build; bằng LAM_MOI_SAN_PHAM_GIAY trong lib/server-api.ts).
 * Dữ liệu lấy ở server nên HTML đã có sản phẩm; server không lấy được thì client tự tải lại với trạng thái loading/lỗi/thử lại, từng khu độc lập.
 * Mã cảnh 3D cũ (components/landing/World…) được giữ nguyên trong repo nhưng không gắn vào trang.
 */
export const revalidate = 10;

export default function TrangChu() {
  return (
    <main>
      <Catalog>
        <QuayTuVan />
        <DaiSoLieu />
        <CongCu />
        <DanhMucBento />
        <LoiChoi />
        <KhuyenMai />
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
