import Link from "next/link";
import { vnd } from "@/lib/format";
import type { BienTheV } from "@/lib/types";

const THONG_SO: [keyof NonNullable<BienTheV["thongSo"]>, string][] = [
  ["doCanBang", "Điểm cân bằng"], ["trongLuong", "Trọng lượng"], ["doCung", "Độ cứng"],
  ["chieuDai", "Chiều dài"], ["sucCang", "Sức căng"],
];

/** Nội dung mua hàng lấy từ đúng biến thể đang chọn, không dùng thông số của biến thể đầu tiên. */
export function ProductPurchaseInfo({ bienThe, soLuong, gia, giaGoc, coGiam }: {
  bienThe: BienTheV | null; soLuong: number; gia: number; giaGoc: number; coGiam: boolean;
}) {
  const nhan = [bienThe?.mau?.tenMau, bienThe?.size?.tenSize].filter(Boolean).join(" / ");
  const thongSo = THONG_SO.filter(([k]) => bienThe?.thongSo?.[k]);
  const duHang = !!bienThe && bienThe.soLuongTon >= soLuong;

  return (
    <div className="purchase-info">
      <section className="purchase-summary" aria-labelledby="purchase-summary-title">
        <div className="purchase-info-heading">
          <span className="purchase-info-icon" aria-hidden="true"><i className="fa-solid fa-bag-shopping" /></span>
          <div><h2 id="purchase-summary-title">Lựa chọn của bạn</h2><p>Kiểm tra nhanh trước khi thêm giỏ</p></div>
          <span className={`purchase-status ${duHang ? "is-ready" : ""}`}>{duHang ? "Sẵn hàng" : bienThe ? "Chưa đủ hàng" : "Chưa chọn"}</span>
        </div>
        <dl className="purchase-selection">
          <div><dt>Phiên bản</dt><dd>{bienThe ? nhan || "Tiêu chuẩn" : "Vui lòng chọn màu / size"}</dd></div>
          <div><dt>Số lượng</dt><dd>{soLuong} sản phẩm</dd></div>
          {coGiam && bienThe && <div className="purchase-saving"><dt>Tiết kiệm</dt><dd>{vnd((giaGoc - gia) * soLuong)}</dd></div>}
        </dl>
        <div className="purchase-subtotal" aria-live="polite" aria-atomic="true">
          <span>Tạm tính <small>Cho sản phẩm đang chọn</small></span>
          <strong>{bienThe ? vnd(gia * soLuong) : "—"}</strong>
        </div>
        <p className="purchase-note">Chưa bao gồm phí giao hàng. Bạn có thể kiểm tra các sản phẩm trong giỏ trước khi xác nhận đặt hàng.</p>
      </section>

      {thongSo.length > 0 && (
        <section className="purchase-specs" aria-labelledby="purchase-specs-title">
          <div className="purchase-section-title"><h2 id="purchase-specs-title">Thông số phiên bản</h2>{nhan && <span>{nhan}</span>}</div>
          <dl>{thongSo.map(([k, ten]) => <div key={k}><dt>{ten}</dt><dd>{bienThe?.thongSo?.[k]}</dd></div>)}</dl>
        </section>
      )}

      <div className="purchase-help">
        <div><i className="fa-solid fa-wallet" aria-hidden="true" /><p><strong>Chọn cách thanh toán phù hợp</strong><span>Thanh toán khi nhận hàng (COD) hoặc qua MoMo ở bước thanh toán.</span></p></div>
        <div><i className="fa-regular fa-comments" aria-hidden="true" /><p><strong>Cần hỗ trợ chọn size hoặc phiên bản?</strong><span><Link href="/Home/Contact">Liên hệ cửa hàng <span aria-hidden="true">↗</span></Link> để được tư vấn trước khi mua.</span></p></div>
      </div>
    </div>
  );
}
