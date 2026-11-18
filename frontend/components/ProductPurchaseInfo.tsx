import { PhieuThongSo } from "@/components/product/PhieuThongSo";
import type { BienTheV } from "@/lib/types";

/** Thông số luôn lấy từ phiên bản hiện tại; trình bày dạng phiếu sáng kèm giải thích từng trường (xem PhieuThongSo). */
export function ProductPurchaseInfo({ bienThe, khacNhau }: { bienThe: BienTheV | null; khacNhau?: Record<string, string[]> }) {
  const nhan = [bienThe?.mau?.tenMau, bienThe?.size?.tenSize].filter(Boolean).join(" / ") || "tiêu chuẩn";
  const coThongSo = !!bienThe?.thongSo && Object.values(bienThe.thongSo).some(Boolean);
  return (
    <section id="product-specifications" className="product-section-card" aria-labelledby="product-spec-title">
      <div className="product-card-heading"><span className="product-heading-icon" aria-hidden="true"><i className="fa-solid fa-sliders" /></span><div><h2 id="product-spec-title">Thông số kỹ thuật</h2>
      <p className="product-section-caption">{bienThe ? `Phiên bản ${nhan}` : "Chọn phiên bản để xem thông số"}</p></div></div>
      {coThongSo ? <PhieuThongSo ts={bienThe?.thongSo} nhanPhienBan={nhan} khacNhau={khacNhau} />
        : <p className="text-muted small">{bienThe ? "Chưa có thông số kỹ thuật cho phiên bản này. Bạn có thể hỏi người bán bên dưới để được hỗ trợ." : "Thông số sẽ hiển thị khi bạn chọn màu / size phù hợp."}</p>}
    </section>
  );
}
