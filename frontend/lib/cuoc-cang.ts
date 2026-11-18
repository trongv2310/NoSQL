/**
 * Trạm căng cước: đọc "sức căng" của một phiên bản vợt (chuỗi do cửa hàng nhập, ví dụ "20-28 lbs") thành khoảng số thật và đổi đơn vị
 * nhất quán (1 kg = 2,20462262 lbs). Chỉ dùng số nguồn có; thiếu cận dưới thì KHÔNG tự đặt min, thiếu đơn vị hoặc không đọc được thì nói
 * "chưa có thông tin" thay vì dựng thanh trượt. Cảnh báo chỉ so với giới hạn thực, không suy ra tiếng nổ/cổ tay/hiệu suất từ con số.
 */
export const LBS_MOI_KG = 2.20462262;
export type DonViCang = "kg" | "lbs";

export interface KhoangCang {
  /** Cận dưới nguồn ghi; `null` khi nguồn chỉ có mức tối đa (không tự bịa). */
  min: number | null;
  max: number;
  /** Đơn vị gốc của nguồn; mọi tính toán giữ ở đơn vị này để không trôi số khi đổi qua lại. */
  donVi: DonViCang;
  nguon: string;
}
export type KetQuaDocCang = { ok: true; khoang: KhoangCang } | { ok: false; lyDo: "trong" | "khong-doc-duoc" | "thieu-don-vi" | "khoang-sai" };

const SO = "(\\d{1,3}(?:[.,]\\d{1,2})?)";
const DON_VI = "(kgs?|kilogram|lbs?|pounds?)";
const RANGE = new RegExp(`^${SO}\\s*(?:-|–|—|~|đến|to)\\s*${SO}\\s*${DON_VI}?$`, "i");
const TOI_DA = new RegExp(`^(?:tối đa|toi da|max|up to|<=|≤|dưới)\\s*${SO}\\s*${DON_VI}?$`, "i");
const DON = new RegExp(`^${SO}\\s*${DON_VI}?$`, "i");

const so = (s: string) => Number(s.replace(",", "."));
const donVi = (s?: string): DonViCang | null => (!s ? null : /^k/i.test(s) ? "kg" : "lbs");

/** Đọc chuỗi sức căng: "20-28 lbs", "9 – 13 kg", "tối đa 28 lbs", "11,5kg". Một con số trần coi như mức tối đa (không có cận dưới). */
export function docSucCang(chuoi?: string | null): KetQuaDocCang {
  const s = (chuoi ?? "").trim();
  if (!s) return { ok: false, lyDo: "trong" };
  let min: number | null = null, max: number, dv: DonViCang | null;
  let m: RegExpExecArray | null;
  if ((m = RANGE.exec(s))) { min = so(m[1]); max = so(m[2]); dv = donVi(m[3]); }
  else if ((m = TOI_DA.exec(s))) { max = so(m[1]); dv = donVi(m[2]); }
  else if ((m = DON.exec(s))) { max = so(m[1]); dv = donVi(m[2]); }
  else return { ok: false, lyDo: "khong-doc-duoc" };
  if (!dv) return { ok: false, lyDo: "thieu-don-vi" };
  if (!(max > 0) || (min !== null && !(min > 0 && min <= max))) return { ok: false, lyDo: "khoang-sai" };
  return { ok: true, khoang: { min, max, donVi: dv, nguon: s } };
}

export const doiDonVi = (giaTri: number, tu: DonViCang, den: DonViCang): number =>
  tu === den ? giaTri : tu === "kg" ? giaTri * LBS_MOI_KG : giaTri / LBS_MOI_KG;

/** Bước nhập theo đơn vị gốc: lbs nhích 0,5; kg nhích 0,1. */
export const buocCang = (dv: DonViCang): number => (dv === "lbs" ? 0.5 : 0.1);

/**
 * Đưa một giá trị (đơn vị gốc của khoảng) về mức hợp lệ: kẹp trong [min, max] và canh theo bước từ cận dưới (hoặc từ 0 khi không có cận dưới),
 * không bao giờ làm tròn vượt max. Trả `null` khi không phải số hữu hạn.
 */
export function chuanHoaCang(giaTri: number, k: KhoangCang, buoc = buocCang(k.donVi)): number | null {
  if (!Number.isFinite(giaTri)) return null;
  const goc = k.min ?? 0;
  const lo = k.min ?? buoc;
  let v = Math.min(Math.max(giaTri, lo), k.max);
  v = goc + Math.round((v - goc) / buoc) * buoc;
  if (v > k.max) v = goc + Math.floor((k.max - goc) / buoc + 1e-9) * buoc;
  if (v < lo) v = lo;
  return Math.round(v * 100) / 100;
}

/** Giá trị ở đơn vị hiển thị, làm tròn 1 chữ số thập phân (chỉ để hiển thị). */
export const hienThiCang = (giaTri: number, khoang: KhoangCang, dv: DonViCang): number =>
  Math.round(doiDonVi(giaTri, khoang.donVi, dv) * 10) / 10;

export type CanhBaoCang = "sat-toi-thieu" | "bang-toi-da" | "trong-khoang" | "chua-co-can-duoi";

/** Nhãn trung tính theo giới hạn nhà sản xuất ghi; không nói gì về cảm giác hay hiệu suất. */
export function canhBaoCang(giaTri: number, k: KhoangCang): CanhBaoCang {
  if (giaTri >= k.max) return "bang-toi-da";
  if (k.min === null) return "chua-co-can-duoi";
  if (giaTri <= k.min) return "sat-toi-thieu";
  return "trong-khoang";
}

/** Dựng lại giá trị người dùng gõ ở một đơn vị bất kỳ về đơn vị gốc rồi chuẩn hóa; không hợp lệ → null. */
export function nhapCang(chuoi: string, dvNhap: DonViCang, k: KhoangCang): number | null {
  const t = chuoi.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return chuanHoaCang(doiDonVi(Number(t), dvNhap, k.donVi), k);
}
