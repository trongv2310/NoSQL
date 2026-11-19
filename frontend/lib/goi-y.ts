import type { ComboGoiY, SanPhamGoiY } from "./types";

/**
 * Làm sạch dữ liệu gợi ý mua cùng (GET /goi-y/*) trước khi hiển thị: API công khai nên không tin hình dạng, món thiếu id biến thể hoặc giá hỏng thì bỏ,
 * không để một dòng xấu làm vỡ cả khối. Chỉ giữ trường kết quả sản phẩm; mọi trường khác (nếu có) bị bỏ.
 */
const laChuoi = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

function sanPhamHopLe(v: unknown): SanPhamGoiY | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!laChuoi(o.id) || !laChuoi(o.tenSanPham) || !laChuoi(o.chiTietMacDinh)) return null;
  if (typeof o.gia !== "number" || !Number.isFinite(o.gia) || o.gia < 0) return null;
  return { id: o.id, tenSanPham: o.tenSanPham, hinhAnhDaiDien: typeof o.hinhAnhDaiDien === "string" ? o.hinhAnhDaiDien : undefined, gia: o.gia, chiTietMacDinh: o.chiTietMacDinh };
}

/** Danh sách sản phẩm hợp lệ, bỏ trùng id (giữ thứ tự API). */
function danhSachSanPham(raw: unknown): SanPhamGoiY[] {
  if (!Array.isArray(raw)) return [];
  const thay = new Set<string>();
  const ra: SanPhamGoiY[] = [];
  for (const x of raw) {
    const sp = sanPhamHopLe(x);
    if (sp && !thay.has(sp.id)) { thay.add(sp.id); ra.push(sp); }
  }
  return ra;
}

/** Tổng giá hiện hành của đúng các món đang hiển thị (cũng là các món được thêm vào giỏ); không có giảm giá combo. */
export const tongGiaCombo = (sanPhams: { gia: number }[]): number => sanPhams.reduce((t, s) => t + s.gia, 0);

/** Combo hiển thị ở trang chủ: tối đa `toiDa`, mỗi combo ≥ 2 món hợp lệ (ít hơn thì bỏ cả combo). `raw` = thân phản hồi `{ combos }`. */
export function chonComboHienThi(raw: unknown, toiDa = 3): ComboGoiY[] {
  const ds = (raw as { combos?: unknown } | null | undefined)?.combos;
  if (!Array.isArray(ds)) return [];
  const ra: ComboGoiY[] = [];
  for (const c of ds) {
    if (ra.length >= toiDa) break;
    const sanPhams = danhSachSanPham((c as { sanPhams?: unknown } | null | undefined)?.sanPhams);
    if (sanPhams.length < 2) continue;
    const khoa = laChuoi((c as { khoa?: unknown }).khoa) ? (c as { khoa: string }).khoa : sanPhams.map((s) => s.id).join(",");
    ra.push({ khoa, tongGia: tongGiaCombo(sanPhams), sanPhams });
  }
  return ra;
}

export type KetQuaKiemTon = { ok: true; soLuongTon: number } | { ok: false; thongBao: string };

const LY_DO_KHONG_THEM: Record<string, string> = {
  het_hang: "Đã hết hàng.",
  giam_so_luong: "Không còn đủ hàng.",
  ngung_kinh_doanh: "Sản phẩm không còn kinh doanh.",
  khong_ton_tai: "Phiên bản này không còn tồn tại.",
};

/**
 * Đọc phản hồi POST /gio-hang/tinh (báo giá giỏ khách) cho MỘT món vừa yêu cầu: chỉ `trangThai: "ok"` mới cho thêm vào giỏ.
 * Thiếu dòng của món, hình dạng lạ hoặc trạng thái lạ đều coi là không thêm (không báo "đủ" khi chưa chắc). Id so sánh không phân biệt hoa/thường như giỏ khách.
 */
export function ketQuaKiemTon(baoGia: unknown, khoa: string): KetQuaKiemTon {
  const ds = (baoGia as { items?: unknown } | null | undefined)?.items;
  const dong = Array.isArray(ds) ? (ds as { id?: unknown; trangThai?: unknown; soLuong?: unknown; bienThe?: { soLuongTon?: unknown } | null }[]).find((d) => typeof d?.id === "string" && d.id.toLowerCase() === khoa.toLowerCase()) : undefined;
  if (!dong) return { ok: false, thongBao: "Không kiểm tra được tồn kho của món này." };
  if (dong.trangThai !== "ok") return { ok: false, thongBao: LY_DO_KHONG_THEM[String(dong.trangThai)] ?? "Không kiểm tra được tồn kho của món này." };
  const ton = dong.bienThe?.soLuongTon;
  return { ok: true, soLuongTon: typeof ton === "number" && Number.isFinite(ton) ? ton : Number(dong.soLuong) || 1 };
}

/** "Thường được mua cùng" ở trang chi tiết: tối đa `toiDa`, bỏ chính sản phẩm đang xem. `raw` = thân phản hồi `{ sanPhams }`. */
export function chonGoiYMuaCung(raw: unknown, sanPhamId?: string, toiDa = 4): SanPhamGoiY[] {
  return danhSachSanPham((raw as { sanPhams?: unknown } | null | undefined)?.sanPhams).filter((s) => s.id !== sanPhamId).slice(0, toiDa);
}
