/**
 * Cầu nối cho hiệu ứng "ảnh sản phẩm bay từ thẻ sang trang chi tiết" (View Transitions).
 * - Chỉ ảnh của thẻ vừa được bấm mới được đặt tên chuyển tiếp (trang có thể có cùng sản phẩm ở nhiều chỗ,
 *   mà tên trùng nhau sẽ làm trình duyệt hủy cả hiệu ứng).
 * - Trang chi tiết tải dữ liệu bằng client nên lúc mới vào chưa có ảnh; ta nhớ ảnh vừa bấm để dựng khung
 *   tạm ngay trong lần render đầu, nhờ đó hai phần tử cùng tên ghép được với nhau.
 */
export const TEN_ANH_MORPH = "sp-hero";

let daBam: { id: string; src: string } | null = null;

export function ghiNhoAnhBam(id: string, anh: HTMLImageElement | null) {
  if (!anh) return;
  daBam = { id, src: anh.currentSrc || anh.src };
  // Trên trang chi tiết, ảnh gallery đã mang sẵn tên này; gỡ đi để không có hai phần tử trùng tên.
  document.querySelectorAll<HTMLElement>(".pdp-gallery img").forEach((el) => el.style.removeProperty("view-transition-name"));
  anh.style.setProperty("view-transition-name", TEN_ANH_MORPH);
  // Nếu việc chuyển trang bị hủy, trả tên về để không giữ lại phần tử có tên trên trang cũ.
  window.setTimeout(() => anh.style.removeProperty("view-transition-name"), 2500);
}

export function anhDaBam(id: string): string | null {
  return daBam && daBam.id === id ? daBam.src : null;
}
