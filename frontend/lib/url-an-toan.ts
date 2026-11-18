/**
 * Địa chỉ quay lại sau đăng nhập/đăng ký (`returnUrl`). Chỉ nhận đường dẫn TRONG trang web: phân tích như trình duyệt rồi đối chiếu origin, nên các dạng
 * lách bộ lọc cũ ("/\evil.com", "/%5Cevil.com", "//evil.com", "/\t/evil.com", "javascript:", URL tuyệt đối) đều bị từ chối. Trả về path+query+hash đã chuẩn hóa.
 */
export function returnUrlAnToan(u: string | null | undefined): string | null {
  if (!u || u[0] !== "/" || u[1] === "/" || u[1] === "\\") return null;
  if (/[\u0000-\u001f\u007f\\]/.test(u)) return null; // ký tự điều khiển hoặc dấu gạch chéo ngược: trình duyệt sẽ coi là "/"
  try {
    const goc = "http://noi-bo.invalid";
    const x = new URL(u, goc);
    if (x.origin !== goc) return null;
    const ra = `${x.pathname}${x.search}${x.hash}`;
    return ra.startsWith("//") ? null : ra;
  } catch {
    return null;
  }
}
