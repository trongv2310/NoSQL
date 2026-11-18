/**
 * Giữ Tab/Shift+Tab trong một vùng (menu trượt đang mở): từ phần tử cuối Tab quay về đầu, từ đầu Shift+Tab đi về cuối.
 * Chỉ gọi khi menu đang mở; tháo trình nghe khi đóng/rời trang nên không chặn phím toàn trang.
 */
export function giuFocusTrongVung(e: KeyboardEvent, vung: HTMLElement | null): void {
  if (e.key !== "Tab" || !vung) return;
  const ds = Array.from(vung.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter((el) => el.getClientRects().length > 0);
  if (!ds.length) return;
  const dau = ds[0], cuoi = ds[ds.length - 1];
  const dang = document.activeElement;
  if (!vung.contains(dang)) { e.preventDefault(); (e.shiftKey ? cuoi : dau).focus(); return; }
  if (e.shiftKey && dang === dau) { e.preventDefault(); cuoi.focus(); }
  else if (!e.shiftKey && dang === cuoi) { e.preventDefault(); dau.focus(); }
}
