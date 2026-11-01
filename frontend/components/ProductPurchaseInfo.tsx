import type { BienTheV } from "@/lib/types";

const THONG_SO: [keyof NonNullable<BienTheV["thongSo"]>, string][] = [
  ["doCanBang", "Điểm cân bằng"], ["trongLuong", "Trọng lượng"], ["doCung", "Độ cứng"],
  ["chieuDai", "Chiều dài"], ["sucCang", "Sức căng"],
];

/** Thông số luôn lấy từ phiên bản hiện tại. */
export function ProductPurchaseInfo({ bienThe }: { bienThe: BienTheV | null }) {
  const thongSo = THONG_SO.filter(([k]) => bienThe?.thongSo?.[k]);
  const nhan = [bienThe?.mau?.tenMau, bienThe?.size?.tenSize].filter(Boolean).join(" / ");
  return (
    <section id="product-specifications" className="product-spec-section product-section-card" aria-labelledby="product-spec-title">
      <div className="product-card-heading"><span className="product-heading-icon" aria-hidden="true"><i className="fa-solid fa-sliders" /></span><div><h2 id="product-spec-title">Thông số kỹ thuật</h2>
      <p className="product-section-caption">{bienThe ? `Phiên bản ${nhan || "tiêu chuẩn"}` : "Chọn phiên bản để xem thông số"}</p></div></div>
      {thongSo.length ? <dl>{thongSo.map(([k, ten]) => <div key={k}><dt>{ten}</dt><dd>{bienThe?.thongSo?.[k]}</dd></div>)}</dl>
        : <p className="text-muted small">{bienThe ? "Chưa có thông số kỹ thuật cho phiên bản này. Bạn có thể liên hệ cửa hàng để được hỗ trợ." : "Thông số sẽ hiển thị khi bạn chọn màu / size phù hợp."}</p>}
    </section>
  );
}
