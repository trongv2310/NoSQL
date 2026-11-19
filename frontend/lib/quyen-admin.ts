/**
 * Quyền vào khu quản trị theo vai trò (`maQuyen`: 1 = Quản trị, 2 = Nhân viên, 3 = Khách). Chỉ để chọn giao diện; hàng rào thật là `@Roles` ở backend.
 * Nhân viên chỉ vào Sản phẩm (kèm biến thể), Đơn hàng, Bảng tin, Trận đấu; Quản trị vào mọi `/admin/**`. Mặc định từ chối: vai trò lạ, đường dẫn lạ → false.
 * `/admin/khai-thac` (Combo bán chạy, Top-K) chỉ dành cho Quản trị: không nằm trong danh sách nhân viên nên tự bị chặn và không có trong menu nhân viên.
 */

/** Trang đích của nhân viên sau đăng nhập (và khi gõ `/admin`). */
export const TRANG_NHAN_VIEN = "/admin/don-hang";

/** Gốc đường dẫn nhân viên được vào: khớp cả gốc lẫn mọi trang con (theo đoạn đường dẫn, không khớp chuỗi thô). `bien-the` không có mục menu riêng. */
const GOC_NHAN_VIEN = ["/admin/san-pham", "/admin/bien-the", "/admin/don-hang", "/admin/ban-tin", "/admin/tran-dau"];
/** Mục menu nhân viên thấy (mọi mục trên trừ `bien-the`). */
const MENU_NHAN_VIEN = GOC_NHAN_VIEN.filter((g) => g !== "/admin/bien-the");

/** Chuẩn hóa đường dẫn: bỏ query/hash và `/` cuối, giải mã %xx; null nếu có dạng lách (`..`, `.`, `//`, `\`, ký tự điều khiển, mã hóa hỏng). Phân biệt hoa thường như router. */
function chuanHoa(pathname: string | null | undefined): string | null {
  if (!pathname || pathname[0] !== "/") return null;
  let p = pathname.split(/[?#]/)[0];
  try {
    p = decodeURIComponent(p);
  } catch {
    return null;
  }
  if (/[\u0000-\u001f\u007f\\]/.test(p)) return null;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  const doan = p.split("/").slice(1);
  if (p !== "/" && doan.some((d) => d === "" || d === "." || d === "..")) return null;
  return p;
}

const trongGoc = (p: string, goc: string) => p === goc || p.startsWith(`${goc}/`);

/** Vai trò này có được vào đường dẫn khu quản trị này không. Khách, chưa đăng nhập, vai trò lạ → false. */
export function duongDanDuocPhep(maQuyen: number | null | undefined, pathname: string | null | undefined): boolean {
  if (maQuyen !== 1 && maQuyen !== 2) return false;
  const p = chuanHoa(pathname);
  if (p === null) return false;
  if (maQuyen === 1) return trongGoc(p, "/admin");
  return GOC_NHAN_VIEN.some((g) => trongGoc(p, g));
}

/** Mục menu (theo `href` trong `AdminShell`) có hiện với vai trò này không. Quản trị thấy tất cả. */
export function mucMenuTheoQuyen(maQuyen: number | null | undefined, href: string): boolean {
  if (maQuyen === 1) return true;
  return maQuyen === 2 && MENU_NHAN_VIEN.includes(href);
}

/** Nhân viên đang ở đúng trang gốc `/admin` (Thống kê, không được vào) → cần chuyển về `TRANG_NHAN_VIEN`. */
export function canChuyenVeTrangNhanVien(maQuyen: number | null | undefined, pathname: string | null | undefined): boolean {
  return maQuyen === 2 && chuanHoa(pathname) === "/admin";
}

/** Trang đến sau đăng nhập: nhân viên → đơn hàng; còn lại giữ như cũ (form quản trị → `/admin`, form khách → `/`). */
export function trangSauDangNhap(maQuyen: number, quanTri: boolean): string {
  if (maQuyen === 2) return TRANG_NHAN_VIEN;
  return quanTri ? "/admin" : "/";
}

/** Chỉ Quản trị được xóa (sản phẩm, biến thể, bài viết, trận đấu); nhân viên chỉ ẩn/hiện. Khách, chưa đăng nhập, vai trò lạ → false. */
export function coQuyenXoa(maQuyen: number | null | undefined): boolean {
  return maQuyen === 1;
}
