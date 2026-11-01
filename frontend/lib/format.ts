export const vnd = (n: number | null | undefined) => `${Math.round(Number(n ?? 0)).toLocaleString("vi-VN")} đ`;

export function ngayGio(d?: string | Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleString("vi-VN", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" });
}

export function ngay(d?: string | Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

/** Giá trị cho <input type="date"> theo giờ Việt Nam. */
export function ngayInput(d?: string | Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}

/** Ảnh tĩnh nằm ở /images, ảnh upload (uploads/...) được Next chuyển tiếp sang backend. */
export function imgUrl(p?: string | null, macDinh = "default-product.jpg") {
  const path = p || macDinh;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return path;
  if (path.startsWith("uploads/") || path.startsWith("images/")) return `/${path}`;
  return `/images/${path}`;
}

export const tenTrangThaiClass = (t: string) => {
  if (t.startsWith("Đã hủy")) return "bg-danger";
  if (t === "Đã hoàn thành") return "bg-success";
  if (t === "Đang giao hàng") return "bg-info";
  if (t.includes("MoMo")) return "bg-warning text-dark";
  return "bg-secondary";
};
