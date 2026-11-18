/**
 * So sánh 2–3 vợt. URL chia sẻ được: `/so-sanh?v1=<id sản phẩm>&v2=…[&v3=…]` kèm `b1/b2/b3=<id phiên bản>` khi người dùng đã chọn một phiên bản cụ thể
 * (để mở lại đúng thông số). Quy tắc thuần ở đây; dữ liệu sản phẩm thật do trang tải từ API. Lời đối chiếu chỉ nêu CHÊNH LỆCH của dữ liệu thật
 * (cân bằng, trọng lượng U, độ cứng, chiều dài, sức căng tối đa, giá, tồn kho), không dự đoán kết quả thi đấu.
 */
export const TOI_DA_SO_SANH = 3;
export const TOI_THIEU_SO_SANH = 2;
const ID24 = /^[0-9a-f]{24}$/;

export interface MucSoSanh { sanPhamId: string; bienTheId: string | null }
export type LoiUrlSoSanh = "id-sai" | "bien-the-sai" | "trung" | "vuot-ba" | "thieu-id";
export interface KetQuaDocUrl { muc: MucSoSanh[]; loi: { khoa: string; loai: LoiUrlSoSanh }[] }

type NguonQuery = { get(k: string): string | null };

/** Đọc v1..v3 / b1..b3. Bỏ ID sai định dạng và ID trùng sản phẩm, ghi lại lỗi để trang báo; khe trống được nén lại; quá ba thì bỏ phần dư. */
export function docUrlSoSanh(q: NguonQuery): KetQuaDocUrl {
  const muc: MucSoSanh[] = [];
  const loi: KetQuaDocUrl["loi"] = [];
  const thay = new Set<string>();
  for (let i = 1; i <= 6; i++) {
    const v = (q.get(`v${i}`) ?? "").trim().toLowerCase();
    const b = (q.get(`b${i}`) ?? "").trim().toLowerCase();
    if (!v) { if (b) loi.push({ khoa: `b${i}`, loai: "thieu-id" }); continue; }
    if (!ID24.test(v)) { loi.push({ khoa: `v${i}`, loai: "id-sai" }); continue; }
    if (thay.has(v)) { loi.push({ khoa: `v${i}`, loai: "trung" }); continue; }
    if (b && !ID24.test(b)) { loi.push({ khoa: `b${i}`, loai: "bien-the-sai" }); }
    if (muc.length >= TOI_DA_SO_SANH) { loi.push({ khoa: `v${i}`, loai: "vuot-ba" }); continue; }
    thay.add(v);
    muc.push({ sanPhamId: v, bienTheId: b && ID24.test(b) ? b : null });
  }
  return { muc, loi };
}

/** Chuỗi query chuẩn (`v1=…&b1=…&v2=…`); chỉ ghi `b` khi có phiên bản được chọn. */
export function taoQuerySoSanh(muc: MucSoSanh[]): string {
  const p = new URLSearchParams();
  muc.slice(0, TOI_DA_SO_SANH).forEach((m, i) => {
    p.set(`v${i + 1}`, m.sanPhamId);
    if (m.bienTheId) p.set(`b${i + 1}`, m.bienTheId);
  });
  return p.toString();
}

export const duongDanSoSanh = (muc: MucSoSanh[]) => (muc.length ? `/so-sanh?${taoQuerySoSanh(muc)}` : "/so-sanh");

export type KetQuaThem = { ok: true; muc: MucSoSanh[] } | { ok: false; lyDo: "day" | "id-sai"; muc: MucSoSanh[] };

/** Thêm một vợt: không trùng sản phẩm (đã có thì chỉ cập nhật phiên bản được chọn), tối đa ba. */
export function themVaoSoSanh(ds: MucSoSanh[], m: MucSoSanh): KetQuaThem {
  if (!ID24.test(m.sanPhamId)) return { ok: false, lyDo: "id-sai", muc: ds };
  const bien = m.bienTheId && ID24.test(m.bienTheId) ? m.bienTheId : null;
  const i = ds.findIndex((x) => x.sanPhamId === m.sanPhamId);
  if (i >= 0) return { ok: true, muc: ds.map((x, k) => (k === i ? { sanPhamId: x.sanPhamId, bienTheId: bien ?? x.bienTheId } : x)) };
  if (ds.length >= TOI_DA_SO_SANH) return { ok: false, lyDo: "day", muc: ds };
  return { ok: true, muc: [...ds, { sanPhamId: m.sanPhamId, bienTheId: bien }] };
}
export const boKhoiSoSanh = (ds: MucSoSanh[], sanPhamId: string) => ds.filter((x) => x.sanPhamId !== sanPhamId);
/** Thay vợt ở vị trí `vi` bằng vợt khác (không tạo trùng). */
export function thayTrongSoSanh(ds: MucSoSanh[], vi: number, m: MucSoSanh): MucSoSanh[] {
  if (!ID24.test(m.sanPhamId) || vi < 0 || vi >= ds.length) return ds;
  if (ds.some((x, k) => k !== vi && x.sanPhamId === m.sanPhamId)) return ds;
  return ds.map((x, k) => (k === vi ? { sanPhamId: m.sanPhamId, bienTheId: m.bienTheId && ID24.test(m.bienTheId) ? m.bienTheId : null } : x));
}

/** Một vợt đã chuẩn hóa số để đối chiếu; `null` = nguồn không có thông tin (không đoán). */
export interface HoSoDoiChieu {
  ten: string;
  /** Nhãn dùng trong lời đối chiếu (mặc định "Vợt n" theo thứ tự); trang so sánh truyền đúng số cột để khớp tiêu đề cột. */
  nhan?: string;
  gia: number;
  ton: number;
  canBang: { bac: number; chu: string } | null;
  trongLuong: { so: number; chu: string } | null;
  doCung: { bac: number; chu: string } | null;
  chieuDaiMm: number | null;
  cangToiDa: { giaTri: number; donVi: string } | null;
  /** Trường mà các phiên bản của vợt này khác nhau (không ghi vào so sánh như một giá trị chung). */
  tuyPhienBan: string[];
}

const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} đ`;

/** Trích số mm: "675mm" → 675. */
export const soMm = (s?: string | null): number | null => { const m = /(\d{3})\s*mm/i.exec(s ?? ""); return m ? Number(m[1]) : null; };
/** Trích số U: "4U (80-84g)" → 4 (U càng nhỏ càng nặng). */
export const soU = (s?: string | null): number | null => { const m = /(\d)\s*U/i.exec(s ?? ""); return m ? Number(m[1]) : null; };

/**
 * Lời đối chiếu từ chênh lệch dữ liệu thật. Mỗi dòng nói về MỘT thông số: ai cao/thấp hơn, hoặc "giống nhau", hoặc "chưa đủ thông tin".
 * Không có dòng nào kết luận cây nào hay hơn.
 */
export function doiChieu(ds: HoSoDoiChieu[]): string[] {
  const ra: string[] = [];
  if (ds.length < 2) return ra;
  const ten = (i: number) => ds[i].nhan ?? `Vợt ${i + 1}`;
  const thieu = (lay: (h: HoSoDoiChieu) => unknown) => ds.map((h, i) => (lay(h) == null ? i : -1)).filter((i) => i >= 0);
  const nhanThieu = (idx: number[], truong: string) => (idx.length ? `${truong}: chưa có thông tin của ${idx.map(ten).join(", ")} nên chưa đối chiếu đủ.` : "");

  const soSanhSo = (truong: string, lay: (h: HoSoDoiChieu) => number | null, cao: string, thap: string, chu: (h: HoSoDoiChieu) => string) => {
    const co = ds.map((h, i) => ({ i, v: lay(h) })).filter((x): x is { i: number; v: number } => x.v !== null);
    const mat = nhanThieu(thieu(lay), truong);
    if (co.length < 2) { if (mat) ra.push(mat); return; }
    const max = Math.max(...co.map((x) => x.v)), min = Math.min(...co.map((x) => x.v));
    if (max === min) ra.push(`${truong}: giống nhau (${chu(ds[co[0].i])}).`);
    else {
      const iMax = co.filter((x) => x.v === max).map((x) => ten(x.i)).join(", ");
      const iMin = co.filter((x) => x.v === min).map((x) => ten(x.i)).join(", ");
      ra.push(`${truong}: ${iMax} ${cao} (${chu(ds[co.find((x) => x.v === max)!.i])}); ${iMin} ${thap} (${chu(ds[co.find((x) => x.v === min)!.i])}).`);
    }
    if (mat) ra.push(mat);
  };

  soSanhSo("Điểm cân bằng", (h) => h.canBang?.bac ?? null, "nặng đầu hơn", "nhẹ đầu hơn", (h) => h.canBang?.chu ?? "");
  soSanhSo("Trọng lượng", (h) => h.trongLuong?.so ?? null, "nhẹ hơn (số U lớn hơn)", "nặng hơn (số U nhỏ hơn)", (h) => h.trongLuong?.chu ?? "");
  soSanhSo("Độ cứng thân", (h) => h.doCung?.bac ?? null, "cứng hơn", "mềm hơn", (h) => h.doCung?.chu ?? "");
  soSanhSo("Chiều dài", (h) => h.chieuDaiMm, "dài hơn", "ngắn hơn", (h) => `${h.chieuDaiMm}mm`);
  const cungDv = new Set(ds.map((h) => h.cangToiDa?.donVi).filter(Boolean)).size <= 1;
  if (cungDv) soSanhSo("Sức căng tối đa nhà sản xuất ghi", (h) => h.cangToiDa?.giaTri ?? null, "cao hơn", "thấp hơn", (h) => `${h.cangToiDa?.giaTri} ${h.cangToiDa?.donVi}`);
  else ra.push("Sức căng: các vợt ghi theo đơn vị khác nhau nên chưa đối chiếu trực tiếp.");
  soSanhSo("Giá", (h) => h.gia, "đắt hơn", "rẻ hơn", (h) => vnd(h.gia));
  const het = ds.map((h, i) => (h.ton <= 0 ? ten(i) : null)).filter(Boolean);
  if (het.length) ra.push(`Tồn kho: ${het.join(", ")} hiện hết hàng.`);
  ds.forEach((h, i) => { if (h.tuyPhienBan.length) ra.push(`${ten(i)}: ${h.tuyPhienBan.join(", ")} thay đổi theo phiên bản; đang so theo phiên bản đã chọn.`); });
  return ra.filter(Boolean);
}
