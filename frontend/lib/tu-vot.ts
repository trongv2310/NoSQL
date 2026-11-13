/**
 * Tủ vợt của tôi + nhắc lịch căng cước, lưu trên CHÍNH trình duyệt này (localStorage, không đồng bộ tài khoản, không email/tin nhắn/thông báo ngoài app).
 * Mọi con số (ngày căng, kg căng, chu kỳ nhắc) do người dùng tự nhập. App chỉ đếm số ngày lịch đã trôi qua hoặc còn lại so với chu kỳ người dùng chọn;
 * không ước lượng độ căng còn lại và không khuyên phải thay cước. Ngày tính theo lịch địa phương (không lệch múi giờ/giờ mùa hè).
 */
export const KHOA_TU_VOT = "tu-vot:v1";
export const KHOA_DU_DINH_CANG = "cang-du-dinh:v1";
export const TOI_DA_VOT = 30;
export const TOI_DA_CHU_KY_NGAY = 365;

export type DonViCangNhap = "kg" | "lbs";
export interface VotTrongTu {
  id: string;
  nguon: "catalog" | "tu-nhap";
  sanPhamId: string | null;
  bienTheId: string | null;
  ten: string;
  /** Ngày căng THỰC TẾ do người dùng nhập, `YYYY-MM-DD` (lịch địa phương), hoặc null. */
  ngayCang: string | null;
  /** Số căng THỰC TẾ người dùng nhập, kèm đơn vị họ nhập. */
  cang: { giaTri: number; donVi: DonViCangNhap } | null;
  /** Chu kỳ nhắc (ngày) do người dùng chọn, hoặc null = không nhắc. */
  chuKyNgay: number | null;
  ghiChu: string;
  taoLuc: number;
}
export interface DuLieuTuVot { v: 1; vot: VotTrongTu[] }

const ID24 = /^[0-9a-f]{24}$/;
const NGAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` hợp lệ theo lịch (không nhận 2026-02-30) → true. */
export function ngayHopLe(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = NGAY.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 2000 || y > 2100) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** Ngày hôm nay theo lịch địa phương của trình duyệt. */
export function homNayDiaPhuong(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Số ngày lịch từ `tu` đến `den` (âm nếu `den` trước `tu`). Dùng UTC của ngày lịch nên không lệch do giờ mùa hè. */
export function soNgayGiua(tu: string, den: string): number {
  const a = NGAY.exec(tu), b = NGAY.exec(den);
  if (!a || !b) return NaN;
  return Math.round((Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 86_400_000);
}

export interface DauVaoVot {
  nguon: "catalog" | "tu-nhap";
  sanPhamId?: string | null;
  bienTheId?: string | null;
  ten: string;
  ngayCang?: string | null;
  cangGiaTri?: number | string | null;
  cangDonVi?: DonViCangNhap;
  chuKyNgay?: number | string | null;
  ghiChu?: string;
}
export type KetQuaKiemTra = { ok: true; vot: Omit<VotTrongTu, "id" | "taoLuc"> } | { ok: false; loi: Partial<Record<"ten" | "ngayCang" | "cang" | "chuKy" | "chung", string>> };

const soHuuHan = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

/** Kiểm tra dữ liệu người dùng nhập; trả từng lỗi theo trường (tiếng Việt) để hiện cạnh ô nhập. */
export function kiemTraVot(x: DauVaoVot, homNay: string = homNayDiaPhuong()): KetQuaKiemTra {
  const loi: Partial<Record<"ten" | "ngayCang" | "cang" | "chuKy" | "chung", string>> = {};
  // Dữ liệu có thể đến từ kho bị sửa tay: giá trị không phải chuỗi KHÔNG được ép thành "[object Object]" mà bị coi là sai kiểu.
  const chuoi = (v: unknown): string | null => (v === null || v === undefined ? "" : typeof v === "string" ? v : null);
  const tenTho = chuoi(x.ten), ghiChuTho = chuoi(x.ghiChu), ngayTho = chuoi(x.ngayCang);
  if (tenTho === null || ghiChuTho === null || ngayTho === null) {
    return { ok: false, loi: { chung: "Dữ liệu vợt sai định dạng (tên, ngày hoặc ghi chú không phải chuỗi)." } };
  }
  const ten = tenTho.trim().replace(/\s+/g, " ");
  if (!ten) loi.ten = "Nhập tên cây vợt.";
  else if (ten.length > 80) loi.ten = "Tên vợt tối đa 80 ký tự.";
  const ngay = ngayTho.trim();
  let ngayCang: string | null = null;
  if (ngay) {
    if (!ngayHopLe(ngay)) loi.ngayCang = "Ngày không hợp lệ. Chọn một ngày có thật trên lịch.";
    else if (ngay > homNay) loi.ngayCang = "Ngày căng không thể ở tương lai.";
    else ngayCang = ngay;
  }
  let cang: VotTrongTu["cang"] = null;
  const kg = soHuuHan(x.cangGiaTri);
  const dv: DonViCangNhap = x.cangDonVi === "lbs" ? "lbs" : "kg";
  if (kg !== null) {
    const tran = dv === "kg" ? 40 : 90;
    if (Number.isNaN(kg) || kg <= 0) loi.cang = "Số căng phải là số lớn hơn 0.";
    else if (kg > tran) loi.cang = `Số căng quá lớn (tối đa ${tran} ${dv}).`;
    else cang = { giaTri: Math.round(kg * 100) / 100, donVi: dv };
  }
  let chuKyNgay: number | null = null;
  const ck = soHuuHan(x.chuKyNgay);
  if (ck !== null) {
    if (Number.isNaN(ck) || !Number.isInteger(ck) || ck < 1 || ck > TOI_DA_CHU_KY_NGAY) loi.chuKy = `Chu kỳ nhắc là số ngày nguyên từ 1 đến ${TOI_DA_CHU_KY_NGAY}.`;
    else chuKyNgay = ck;
  }
  if (chuKyNgay !== null && ngayCang === null && !loi.ngayCang) loi.ngayCang = "Muốn được nhắc, hãy nhập ngày căng thực tế.";
  if (Object.keys(loi).length) return { ok: false, loi };
  const sanPhamId = x.sanPhamId && ID24.test(x.sanPhamId) ? x.sanPhamId : null;
  const bienTheId = x.bienTheId && ID24.test(x.bienTheId) ? x.bienTheId : null;
  return { ok: true, vot: { nguon: x.nguon === "catalog" && sanPhamId ? "catalog" : "tu-nhap", sanPhamId, bienTheId, ten, ngayCang, cang, chuKyNgay, ghiChu: ghiChuTho.trim().slice(0, 200) } };
}

export function hopLeDuLieu(x: unknown): x is DuLieuTuVot {
  return !!x && typeof x === "object" && (x as DuLieuTuVot).v === 1 && Array.isArray((x as DuLieuTuVot).vot);
}

const laDoiTuong = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const laChuoiHoacRong = (x: unknown): x is string | null | undefined => x === null || x === undefined || typeof x === "string";

/**
 * Đọc MỘT bản ghi chưa biết kiểu từ kho. Chỉ nhận khi đúng kiểu từng trường (tên/ghi chú/ngày là chuỗi, số căng và chu kỳ là số hữu hạn, đơn vị kg|lbs)
 * rồi mới đi qua `kiemTraVot`. Bản ghi sai kiểu (null, số, mảng, đối tượng lồng sai) trả null: KHÔNG ném lỗi và không bị ép thành chuỗi.
 */
export function docBanGhiTu(r: unknown, homNay: string = homNayDiaPhuong()): VotTrongTu | null {
  if (!laDoiTuong(r)) return null;
  const { id, nguon, sanPhamId, bienTheId, ten, ngayCang, cang, chuKyNgay, ghiChu, taoLuc } = r;
  if (typeof id !== "string" || !id || id.length > 80) return null;
  if (typeof ten !== "string" || !laChuoiHoacRong(ngayCang) || !laChuoiHoacRong(ghiChu) || !laChuoiHoacRong(sanPhamId) || !laChuoiHoacRong(bienTheId)) return null;
  if (chuKyNgay !== null && chuKyNgay !== undefined && (typeof chuKyNgay !== "number" || !Number.isFinite(chuKyNgay))) return null;
  let cangGiaTri: number | null = null;
  let cangDonVi: DonViCangNhap | undefined;
  if (cang !== null && cang !== undefined) {
    if (!laDoiTuong(cang) || typeof cang.giaTri !== "number" || !Number.isFinite(cang.giaTri) || (cang.donVi !== "kg" && cang.donVi !== "lbs")) return null;
    cangGiaTri = cang.giaTri;
    cangDonVi = cang.donVi;
  }
  const kt = kiemTraVot({
    nguon: nguon === "catalog" ? "catalog" : "tu-nhap", sanPhamId: sanPhamId ?? null, bienTheId: bienTheId ?? null, ten, ngayCang: ngayCang ?? null,
    cangGiaTri, cangDonVi, chuKyNgay: (chuKyNgay as number | null | undefined) ?? null, ghiChu: ghiChu ?? "",
  }, homNay);
  if (!kt.ok) return null;
  return { ...kt.vot, id, taoLuc: typeof taoLuc === "number" && Number.isFinite(taoLuc) ? taoLuc : 0 };
}

/**
 * Làm sạch dữ liệu đọc từ kho (có thể bị sửa tay) theo TỪNG bản ghi: bản ghi hợp lệ được giữ (tối đa TOI_DA_VOT), bản ghi sai/trùng id/vượt trần
 * được trả về nguyên văn trong `phanHong` để giao diện báo thật và ghi lại khi lưu, không tự xóa dữ liệu của người dùng.
 */
export function lamSachTuChiTiet(d: DuLieuTuVot, homNay: string = homNayDiaPhuong()): { ds: VotTrongTu[]; phanHong: unknown[] } {
  const ds: VotTrongTu[] = [];
  const phanHong: unknown[] = [];
  const thay = new Set<string>();
  for (const r of d.vot as unknown[]) {
    const v = ds.length >= TOI_DA_VOT ? null : docBanGhiTu(r, homNay);
    if (!v || thay.has(v.id)) { phanHong.push(r); continue; }
    thay.add(v.id);
    ds.push(v);
  }
  return { ds, phanHong };
}

export const lamSachTu = (d: DuLieuTuVot, homNay: string = homNayDiaPhuong()): VotTrongTu[] => lamSachTuChiTiet(d, homNay).ds;

export function taoIdVot(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.randomUUID) return `v-${c.randomUUID()}`;
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type TrangThaiNhac =
  | { loai: "chua-co-ngay" }
  | { loai: "khong-nhac"; daQuaNgay: number }
  | { loai: "con-han"; daQuaNgay: number; conNgay: number }
  | { loai: "den-han"; daQuaNgay: number; quaNgay: number };

/** Nhắc theo LỊCH: chỉ số ngày đã trôi qua kể từ ngày căng người dùng ghi so với chu kỳ người dùng chọn. Không đoán độ căng còn lại. */
export function tinhNhac(v: Pick<VotTrongTu, "ngayCang" | "chuKyNgay">, homNay: string = homNayDiaPhuong()): TrangThaiNhac {
  if (!v.ngayCang || !ngayHopLe(v.ngayCang)) return { loai: "chua-co-ngay" };
  const da = Math.max(0, soNgayGiua(v.ngayCang, homNay));
  if (v.chuKyNgay === null) return { loai: "khong-nhac", daQuaNgay: da };
  if (da >= v.chuKyNgay) return { loai: "den-han", daQuaNgay: da, quaNgay: da - v.chuKyNgay };
  return { loai: "con-han", daQuaNgay: da, conNgay: v.chuKyNgay - da };
}

export const soVotDenHan = (ds: VotTrongTu[], homNay?: string) => ds.filter((v) => tinhNhac(v, homNay).loai === "den-han").length;

/** Lời nhắc hiển thị: chỉ nêu số ngày theo lịch người dùng đặt. */
export function loiNhac(t: TrangThaiNhac): string {
  switch (t.loai) {
    case "chua-co-ngay": return "Chưa có ngày căng, nhập ngày căng thực tế nếu muốn được nhắc.";
    case "khong-nhac": return `Đã ${t.daQuaNgay} ngày kể từ ngày căng bạn ghi. Bạn chưa đặt chu kỳ nhắc.`;
    case "con-han": return `Đã ${t.daQuaNgay} ngày kể từ ngày căng bạn ghi; còn ${t.conNgay} ngày đến lịch nhắc bạn đặt.`;
    case "den-han": return t.quaNgay === 0
      ? `Đã ${t.daQuaNgay} ngày kể từ ngày căng bạn ghi: đến lịch nhắc bạn đặt.`
      : `Đã ${t.daQuaNgay} ngày kể từ ngày căng bạn ghi: quá lịch nhắc bạn đặt ${t.quaNgay} ngày.`;
  }
}

/* ───────── Dự định căng (kế hoạch) — KHÔNG phải lần căng thực tế ───────── */
export interface DuDinhCang { bienTheId: string; sanPhamId: string; giaTri: number; donVi: DonViCangNhap; luc: number }
export interface DuLieuDuDinh { v: 1; muc: DuDinhCang[] }
export const hopLeDuDinh = (x: unknown): x is DuLieuDuDinh => !!x && typeof x === "object" && (x as DuLieuDuDinh).v === 1 && Array.isArray((x as DuLieuDuDinh).muc);
export function lamSachDuDinh(d: DuLieuDuDinh): DuDinhCang[] {
  return d.muc.filter((m) => m && ID24.test(m.bienTheId) && ID24.test(m.sanPhamId) && Number.isFinite(m.giaTri) && m.giaTri > 0 && (m.donVi === "kg" || m.donVi === "lbs")).slice(0, 60);
}
