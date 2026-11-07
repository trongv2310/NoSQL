/** Cuộn mượt tới một phần tử, chừa chỗ cho header dính; giảm chuyển động thì nhảy thẳng. Trả focus về phần tử cho người dùng bàn phím. */
export function cuonToi(el: HTMLElement) {
  const giam = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector<HTMLElement>(".main-header");
  const chiemCho = Math.min(header ? header.getBoundingClientRect().height : 128, 132);
  const y = el.getBoundingClientRect().top + window.scrollY - chiemCho + 1;
  window.scrollTo({ top: Math.max(0, y), behavior: giam ? "auto" : "smooth" });
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}
