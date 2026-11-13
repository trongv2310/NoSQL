/**
 * Hồ sơ người chơi (lối chơi, trình độ, ngân sách): luật thuần, không phụ thuộc React hay trình duyệt để kiểm thử được bằng `node --test`.
 *
 * Thứ tự ưu tiên: giá trị HỢP LỆ trong URL (`loi_choi`, `trinh_do`, `ngan_sach`) ghi đè giá trị đã nhớ, theo TỪNG trường; trường nào URL không có
 * (hoặc có giá trị không hợp lệ, bị bỏ qua) thì dùng giá trị đã nhớ trong localStorage. Hồ sơ cũ của bản landing trước (`sessionStorage`
 * `landing:phong-cach`: `{lc, ns}`) được chuyển sang một lần nếu chưa có hồ sơ mới.
 */

export const LOI_CHOI_HOP_LE = ["cong", "toc", "toan"] as const;
export const TRINH_DO_HOP_LE = ["moi", "deu", "thi"] as const;
export const NGAN_SACH_HOP_LE = ["re", "vua", "cao"] as const;
export type LoiChoiKhoa = (typeof LOI_CHOI_HOP_LE)[number];
export type TrinhDoKhoa = (typeof TRINH_DO_HOP_LE)[number];
export type NganSachKhoa = (typeof NGAN_SACH_HOP_LE)[number];

export interface HoSo { lc: LoiChoiKhoa | null; kn: TrinhDoKhoa | null; ns: NganSachKhoa | null }
export const HO_SO_TRONG: HoSo = { lc: null, kn: null, ns: null };

export const KHOA_LUU = "ho-so-choi:v1";
export const KHOA_PHIEN_CU = "landing:phong-cach";
export const THAM_SO = { lc: "loi_choi", kn: "trinh_do", ns: "ngan_sach" } as const;

const trong = <T extends string>(ds: readonly T[], v: unknown): T | null => (typeof v === "string" && (ds as readonly string[]).includes(v) ? (v as T) : null);

/** Làm sạch một đối tượng bất kỳ (từ localStorage hoặc nguồn cũ) thành hồ sơ hợp lệ; giá trị lạ thành null. */
export function lamSachHoSo(raw: unknown): HoSo {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { lc: trong(LOI_CHOI_HOP_LE, o.lc), kn: trong(TRINH_DO_HOP_LE, o.kn), ns: trong(NGAN_SACH_HOP_LE, o.ns) };
}

/** Trường nào có trong URL VÀ hợp lệ thì có mặt (trường không có hoặc không hợp lệ là `undefined`). */
export function docTuQuery(q: { get(k: string): string | null }): Partial<HoSo> {
  const r: Partial<HoSo> = {};
  const lc = trong(LOI_CHOI_HOP_LE, q.get(THAM_SO.lc));
  const kn = trong(TRINH_DO_HOP_LE, q.get(THAM_SO.kn));
  const ns = trong(NGAN_SACH_HOP_LE, q.get(THAM_SO.ns));
  if (lc) r.lc = lc;
  if (kn) r.kn = kn;
  if (ns) r.ns = ns;
  return r;
}

/** URL ghi đè theo từng trường; trường còn lại lấy từ hồ sơ đã nhớ. */
export function hopNhat(url: Partial<HoSo>, luu: HoSo): HoSo {
  return { lc: url.lc ?? luu.lc, kn: url.kn ?? luu.kn, ns: url.ns ?? luu.ns };
}

export const hoSoTrong = (h: HoSo) => !h.lc && !h.kn && !h.ns;
export const giongNhau = (a: HoSo, b: HoSo) => a.lc === b.lc && a.kn === b.kn && a.ns === b.ns;

/**
 * Đọc hồ sơ đã nhớ: `local` là chuỗi JSON của `KHOA_LUU`, `phienCu` là chuỗi JSON của khóa sessionStorage cũ.
 * Hồ sơ mới hợp lệ (có ít nhất một trường) thắng; không có thì chuyển từ khóa cũ.
 */
export function docDaNho(local: string | null, phienCu: string | null): HoSo {
  const phan = (s: string | null) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
  const moi = lamSachHoSo(phan(local));
  if (!hoSoTrong(moi)) return moi;
  const cu = lamSachHoSo(phan(phienCu));
  return { lc: cu.lc, kn: null, ns: cu.ns };
}

/** Ghi hồ sơ vào chuỗi query (không có dấu `?`), giữ nguyên mọi tham số khác; trường rỗng thì bỏ tham số. Không thêm `page`. */
export function ghiVaoQuery(search: string, h: HoSo): string {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  (Object.keys(THAM_SO) as (keyof HoSo)[]).forEach((k) => {
    const v = h[k];
    if (v) q.set(THAM_SO[k], v); else q.delete(THAM_SO[k]);
  });
  return q.toString();
}

export const NHAN_LOI_CHOI: Record<LoiChoiKhoa, string> = { cong: "Uy lực", toc: "Tốc độ", toan: "Kiểm soát" };
export const NHAN_TRINH_DO: Record<TrinhDoKhoa, string> = { moi: "Mới chơi", deu: "Chơi đều", thi: "Thi đấu" };
export const NHAN_NGAN_SACH: Record<NganSachKhoa, string> = { re: "Dưới 3,5 triệu", vua: "3,5 – 4,5 triệu", cao: "Từ 4,5 triệu" };

/** Các nhãn ngắn của hồ sơ để hiện trên header/chip, theo thứ tự lối chơi, trình độ, ngân sách. */
export function nhanHoSo(h: HoSo): string[] {
  return [h.lc && NHAN_LOI_CHOI[h.lc], h.kn && NHAN_TRINH_DO[h.kn], h.ns && NHAN_NGAN_SACH[h.ns]].filter((x): x is string => !!x);
}
