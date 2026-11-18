import s from "./landing.module.css";

/**
 * Nhãn đầu mỗi phần của trang chủ: chấm cam, tên phần, một vạch mảnh và nhãn phụ bên phải.
 */
export function SecHead({ label, tag }: { label: string; tag: string }) {
  return (
    <div className={s.secHead} data-rv="up" aria-hidden="true">
      <span className={s.secK}><i aria-hidden="true" />{label}</span>
      <span className={s.secRule} />
      <span className={s.secTag}>{tag}</span>
    </div>
  );
}
