/** Combo bán chạy (Top-K, trang admin): kiểm đầu vào cùng khoảng với backend (k 1..50, soThang 1..12) để báo lỗi sớm; backend vẫn là nơi kiểm cuối cùng. */
export const K_TOI_DA = 50;
export const THANG_TOI_DA = 12;

export type ThamSoTopK = { ok: true; k: number; soThang: number } | { ok: false; loiK?: string; loiThang?: string };

/** Chỉ nhận số nguyên dương viết bằng chữ số (không "5.5", "1e1", "-3", rỗng, khoảng trắng ở giữa); trả null nếu ngoài khoảng. */
function soNguyenTrongKhoang(s: string, toiDa: number): number | null {
  const t = s.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= toiDa ? n : null;
}

export function kiemTraThamSo(k: string, soThang: string): ThamSoTopK {
  const nk = soNguyenTrongKhoang(k, K_TOI_DA);
  const nt = soNguyenTrongKhoang(soThang, THANG_TOI_DA);
  if (nk !== null && nt !== null) return { ok: true, k: nk, soThang: nt };
  return {
    ok: false,
    ...(nk === null ? { loiK: `Số combo phải là số nguyên từ 1 đến ${K_TOI_DA}.` } : {}),
    ...(nt === null ? { loiThang: `Số tháng phải là số nguyên từ 1 đến ${THANG_TOI_DA}.` } : {}),
  };
}

/** Thời gian chạy dễ đọc: dưới 1 giây hiện mili giây, từ 1 giây hiện giây (2 chữ số lẻ). Giá trị lạ → "—". */
export function dinhDangThoiGian(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "—";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2).replace(".", ",")} giây`;
}
