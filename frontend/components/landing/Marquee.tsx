import { fontTieuDe } from "./fonts";
import s from "./marquee.module.css";

/** Bốn thương hiệu shop bán, xen với khẩu hiệu của trang. */
const TU = ["Yonex", "Li-Ning", "Victor", "Mizuno", "Đúng vợt", "Đúng giày", "Vào trận"];

function Group() {
  return (
    <span className={s.group}>
      {TU.map((w, i) => (
        <span key={w} className={s.item}>
          <span className={`${s.word} ${i >= 4 ? s.accent : i % 2 ? s.line : s.solid}`}>{w}</span>
          <span className={s.star}>✦</span>
        </span>
      ))}
    </span>
  );
}

/**
 * Dải chữ chạy ngang giữa hai khu: một hàng thấp, tốc độ đều. Trang trí thuần (`aria-hidden`); giảm chuyển động thì đứng yên.
 * Cố ý gọn và không phản ứng với cuộn: khách cần tới sản phẩm nhanh, dải này chỉ làm nhịp nghỉ.
 */
export function Marquee() {
  return (
    <div className={`${s.band} ${fontTieuDe.className}`} aria-hidden="true">
      <div className={s.track}><Group /><Group /></div>
    </div>
  );
}
