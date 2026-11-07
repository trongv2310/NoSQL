/** Chỉ chạy sau khi API thêm giỏ thành công. Không chờ animation để cập nhật dữ liệu giỏ thật. */
export async function bayVaoGio(nguon?: HTMLElement | null, anhDuPhong?: string): Promise<void> {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const gio = document.querySelector<HTMLElement>("[data-cart-target]");
  if (!gio || !nguon) return;
  const dau = nguon.getBoundingClientRect();
  const dich = gio.getBoundingClientRect();
  if (!dau.width || !dau.height || dau.bottom <= 0 || dau.top >= innerHeight || dich.bottom <= 0) return;
  const trenCung = document.elementFromPoint(dich.left + dich.width / 2, dich.top + dich.height / 2);
  if (!trenCung || !gio.contains(trenCung)) return; // Ví dụ chatbot đang phủ kín màn hình mobile.
  const anh = nguon instanceof HTMLImageElement ? nguon : nguon.querySelector("img");
  const banSao = document.createElement("div");
  banSao.className = "cart-flight";
  banSao.setAttribute("aria-hidden", "true");
  const src = anh?.complete && anh.naturalWidth ? (anh.currentSrc || anh.src) : anhDuPhong;
  if (src) {
    const hinh = document.createElement("img");
    hinh.src = src;
    hinh.alt = "";
    banSao.append(hinh);
  } else {
    banSao.textContent = "🏸";
  }
  const x = dau.left + dau.width / 2 - 32;
  const y = Math.max(8, dau.top + Math.min(dau.height / 2, 160) - 32);
  banSao.style.left = `${x}px`;
  banSao.style.top = `${y}px`;
  document.body.append(banSao);
  const dx = dich.left + dich.width / 2 - 32 - x;
  const dy = dich.top + dich.height / 2 - 32 - y;
  try {
    await banSao.animate([
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * .45}px, ${Math.min(-90, dy - 70)}px) scale(.85)`, opacity: 1, offset: .45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.12)`, opacity: 0 },
    ], { duration: 720, easing: "cubic-bezier(.4,0,.2,1)" }).finished;
    gio.animate([
      { transform: "scale(1)" }, { transform: "scale(1.22) rotate(-8deg)" },
      { transform: "scale(.96) rotate(4deg)" }, { transform: "scale(1)" },
    ], { duration: 380, easing: "ease-out" });
  } catch {
    // Trang có thể đổi hoặc trình duyệt hủy animation; giỏ vẫn đã được cập nhật.
  } finally {
    banSao.remove();
  }
}
