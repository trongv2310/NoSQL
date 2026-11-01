/** Thanh các bước mua hàng: Giỏ hàng → Thanh toán → Hoàn tất. Không dùng hook nên dùng được ở mọi nơi. */
export function CheckoutSteps({ buoc }: { buoc: 1 | 2 | 3 }) {
  const ds = [["fa-cart-shopping", "Giỏ hàng"], ["fa-truck-fast", "Thanh toán"], ["fa-circle-check", "Hoàn tất"]] as const;
  return (
    <ol className="st-steps" aria-label="Các bước mua hàng">
      {ds.map(([icon, nhan], i) => (
        <li key={nhan} className={i + 1 < buoc ? "is-done" : i + 1 === buoc ? "is-now" : ""} aria-current={i + 1 === buoc ? "step" : undefined}>
          <span><i className={`fa-solid ${i + 1 < buoc ? "fa-check" : icon}`} aria-hidden="true" /></span>
          <b>{nhan}</b>
        </li>
      ))}
    </ol>
  );
}

export type KieuTrangThai = "cho" | "xuly" | "giao" | "xong" | "huy";

/** Gom các trạng thái đơn thành 5 nhóm màu để hiển thị chip thống nhất. */
export function kieuTrangThai(t: string): KieuTrangThai {
  if (t.startsWith("Đã hủy")) return "huy";
  if (t === "Đã hoàn thành") return "xong";
  if (t === "Đang giao hàng") return "giao";
  if (t === "Chờ xác nhận" || t === "Chờ thanh toán MoMo") return "cho";
  return "xuly";
}

const BUOC_DON = ["Đã đặt", "Đang xử lý", "Đang giao", "Hoàn thành"];
const CHI_SO: Record<KieuTrangThai, number> = { cho: 0, xuly: 1, giao: 2, xong: 3, huy: -1 };

export function ChipTrangThai({ t }: { t: string }) {
  const k = kieuTrangThai(t);
  const icon = { cho: "fa-hourglass-half", xuly: "fa-gears", giao: "fa-truck-fast", xong: "fa-circle-check", huy: "fa-ban" }[k];
  return <span className={`st-chip is-${k}`}><i className={`fa-solid ${icon}`} aria-hidden="true" /> {t}</span>;
}

/** Tiến trình của một đơn: các mốc đã qua được tô màu; đơn hủy hiện thành dải thông báo riêng. */
export function OrderTrack({ trangThai }: { trangThai: string }) {
  const k = kieuTrangThai(trangThai);
  if (k === "huy") return <div className="st-track is-cancel"><i className="fa-solid fa-ban" aria-hidden="true" /> {trangThai}</div>;
  const now = CHI_SO[k];
  return (
    <ol className="st-track" aria-label={`Tiến trình đơn hàng: ${trangThai}`}>
      {BUOC_DON.map((nhan, i) => <li key={nhan} className={i < now ? "is-done" : i === now ? "is-now" : ""}><span>{i < now || (i === now && k === "xong") ? <i className="fa-solid fa-check" aria-hidden="true" /> : i + 1}</span><b>{nhan}</b></li>)}
    </ol>
  );
}
