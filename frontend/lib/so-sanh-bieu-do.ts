/**
 * Biểu đồ so sánh vợt: toàn bộ phần TÍNH (chuẩn hóa thang, tọa độ radar, thanh giá/tồn, mục "điểm khác biệt", gợi ý cặp vợt) là hàm thuần, không phụ thuộc React.
 *
 * Quy tắc trung thực dữ liệu:
 * - Chỉ dùng 5 thông số thật ghi trong kho (điểm cân bằng, độ cứng thân, trọng lượng U, chiều dài mm, sức căng tối đa) + giá + tồn kho.
 * - Thang là "thang minh họa theo thông số ghi trong kho": khoảng cố định cho mỗi thông số, KHÔNG phải điểm chất lượng; không có điểm sức mạnh/kiểm soát,
 *   không điểm tổng, không xếp hạng "tốt nhất". "Cao/thấp nhất" chỉ nói giá trị của thông số đó lớn/nhỏ hơn.
 * - Thiếu dữ liệu → vị trí `null` (không vẽ, không đặt giá trị thay). Sức căng khác đơn vị (kg và lbs) thì không dựng thang chung (giống `doiChieu`).
 */
import type { HoSoDoiChieu } from "./so-sanh";

export const GHI_CHU_THANG = "Thang minh họa theo thông số ghi trong kho: mỗi thông số có một khoảng cố định để dễ nhìn khoảng cách giữa các vợt. Đây không phải điểm chất lượng hay xếp hạng.";

export type KhoaTruc = "canBang" | "doCung" | "trongLuong" | "chieuDai" | "sucCang";
export interface Moc { vitri: number; chu: string }

/** Khoảng thang cố định (giá trị thật nằm ngoài sẽ bị kẹp ở mép và được đánh dấu `ngoaiThang`). */
export const THANG = {
  canBang: { min: -2, max: 3 },
  doCung: { min: 0, max: 3 },
  /** Số U: 1U (nặng) … 6U (nhẹ). */
  u: { min: 1, max: 6 },
  chieuDaiMm: { min: 640, max: 700 },
  sucCangLbs: { min: 0, max: 40 },
  sucCangKg: { min: 0, max: 18 },
} as const;

export interface DiemTruc {
  /** Vị trí trong mảng hồ sơ đầu vào. */
  idx: number;
  /** Giá trị so sánh được (cao hơn = về phía "cao" của thang); null = không có thông tin. */
  raw: number | null;
  /** 0..1 trên thang minh họa; null = không vẽ (thiếu dữ liệu, hoặc khác đơn vị). */
  vitri: number | null;
  /** Chữ gốc để hiển thị ("Hơi nặng đầu", "4U (80-84g)", "675mm", "tối đa 28 lbs"); null nếu chưa có thông tin. */
  chu: string | null;
  ngoaiThang: boolean;
}

export type TrangThaiTruc = "khac" | "giong" | "chua-du" | "khac-don-vi";

export interface KetQuaTruc {
  khoa: KhoaTruc;
  ten: string;
  /** Hai đầu thước ngang (thấp → cao). */
  dauThap: string;
  dauCao: string;
  /** Hướng đọc ngắn cho radar (tâm → rìa). */
  huongDoc: string;
  moc: Moc[];
  /** Đơn vị ghi cạnh các mốc số ("mm", "lbs", "kg"); null nếu mốc tự mô tả. */
  donViMoc: string | null;
  diem: DiemTruc[];
  trangThai: TrangThaiTruc;
  /** Chỉ số vợt ở đầu cao/thấp của thang (chỉ khi `trangThai === "khac"`). Có thể nhiều vợt nếu bằng nhau. */
  idxCao: number[];
  idxThap: number[];
  /** Các vợt chưa có thông tin thông số này. */
  thieu: number[];
  /** Không vợt nào có dữ liệu vẽ được: radar để trục mờ và ghi "chưa có thông tin". */
  trong: boolean;
}

const kep = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const tiLe = (x: number, min: number, max: number) => (x - min) / (max - min);

interface CauHinhTruc {
  khoa: KhoaTruc; ten: string; dauThap: string; dauCao: string; huongDoc: string;
  lay: (h: HoSoDoiChieu) => { raw: number; chu: string } | null;
}

const CAU_HINH: CauHinhTruc[] = [
  { khoa: "canBang", ten: "Điểm cân bằng", dauThap: "Nhẹ đầu", dauCao: "Nặng đầu", huongDoc: "tâm = rất nhẹ đầu, rìa = rất nặng đầu", lay: (h) => (h.canBang ? { raw: h.canBang.bac, chu: h.canBang.chu } : null) },
  { khoa: "doCung", ten: "Độ cứng thân", dauThap: "Mềm", dauCao: "Cứng", huongDoc: "tâm = mềm, rìa = rất cứng", lay: (h) => (h.doCung ? { raw: h.doCung.bac, chu: h.doCung.chu } : null) },
  // U càng nhỏ càng nặng: đảo dấu để "cao" = nặng, đồng nhất với các thước khác.
  { khoa: "trongLuong", ten: "Trọng lượng", dauThap: "Nhẹ", dauCao: "Nặng", huongDoc: "tâm = nhẹ (6U), rìa = nặng (1U)", lay: (h) => (h.trongLuong ? { raw: -h.trongLuong.so, chu: h.trongLuong.chu } : null) },
  { khoa: "chieuDai", ten: "Chiều dài", dauThap: "Ngắn", dauCao: "Dài", huongDoc: "tâm = 640mm, rìa = 700mm", lay: (h) => (h.chieuDaiMm != null ? { raw: h.chieuDaiMm, chu: `${h.chieuDaiMm}mm` } : null) },
  { khoa: "sucCang", ten: "Sức căng tối đa", dauThap: "Thấp", dauCao: "Cao", huongDoc: "tâm = thấp, rìa = cao (theo đơn vị ghi trong kho)", lay: (h) => (h.cangToiDa ? { raw: h.cangToiDa.giaTri, chu: `tối đa ${h.cangToiDa.giaTri} ${h.cangToiDa.donVi}` } : null) },
];

/** Số trục trên radar. */
export const SO_TRUC = CAU_HINH.length;

function vitriVaMoc(khoa: KhoaTruc, raw: number, donVi: string | null): { vitri: number; ngoai: boolean } {
  let min: number, max: number, v = raw;
  switch (khoa) {
    case "canBang": ({ min, max } = THANG.canBang); break;
    case "doCung": ({ min, max } = THANG.doCung); break;
    case "trongLuong": ({ min, max } = THANG.u); v = -raw; break; // raw = -U → U
    case "chieuDai": ({ min, max } = THANG.chieuDaiMm); break;
    default: ({ min, max } = donVi === "kg" ? THANG.sucCangKg : THANG.sucCangLbs);
  }
  // Trọng lượng: U nhỏ → nặng → vị trí cao (1U = 1, 6U = 0).
  const t = khoa === "trongLuong" ? (max - v) / (max - min) : tiLe(v, min, max);
  return { vitri: kep(t, 0, 1), ngoai: t < 0 || t > 1 };
}

function mocCua(khoa: KhoaTruc, donVi: string | null): Moc[] {
  switch (khoa) {
    case "canBang": return [{ vitri: 0, chu: "Rất nhẹ đầu" }, { vitri: tiLe(0, -2, 3), chu: "Cân bằng" }, { vitri: 1, chu: "Rất nặng đầu" }];
    case "doCung": return [{ vitri: 0, chu: "Mềm" }, { vitri: 1 / 3, chu: "Trung bình" }, { vitri: 2 / 3, chu: "Cứng" }, { vitri: 1, chu: "Rất cứng" }];
    case "trongLuong": return [6, 5, 4, 3, 2, 1].map((u) => ({ vitri: (6 - u) / 5, chu: `${u}U` }));
    case "chieuDai": return [640, 660, 680, 700].map((mm) => ({ vitri: tiLe(mm, 640, 700), chu: `${mm}` }));
    default: return donVi === "kg"
      ? [0, 6, 12, 18].map((k) => ({ vitri: k / 18, chu: `${k}` }))
      : [0, 10, 20, 30, 40].map((l) => ({ vitri: l / 40, chu: `${l}` }));
  }
}

/**
 * Chuẩn hóa từng thông số của các vợt lên cùng một thang 0..1 và đánh dấu cao/thấp nhất. Dùng chung cho radar, thước ngang và "điểm khác biệt".
 * Cao/thấp nhất so trên giá trị gốc (không phải vị trí đã kẹp), nên hai vợt cùng nằm ngoài thang vẫn phân biệt đúng.
 */
export function tinhTruc(ds: HoSoDoiChieu[]): KetQuaTruc[] {
  const dvSucCang = [...new Set(ds.map((h) => h.cangToiDa?.donVi).filter((x): x is string => !!x))];
  return CAU_HINH.map((c) => {
    const khacDv = c.khoa === "sucCang" && dvSucCang.length > 1;
    const donVi = c.khoa === "sucCang" && dvSucCang.length === 1 ? dvSucCang[0] : null;
    const diem: DiemTruc[] = ds.map((h, idx) => {
      const g = c.lay(h);
      if (!g) return { idx, raw: null, vitri: null, chu: null, ngoaiThang: false };
      if (khacDv) return { idx, raw: g.raw, vitri: null, chu: g.chu, ngoaiThang: false };
      const { vitri, ngoai } = vitriVaMoc(c.khoa, g.raw, donVi);
      return { idx, raw: g.raw, vitri, chu: g.chu, ngoaiThang: ngoai };
    });
    const co = diem.filter((d) => d.raw !== null);
    const thieu = diem.filter((d) => d.raw === null).map((d) => d.idx);
    let trangThai: TrangThaiTruc = "chua-du";
    let idxCao: number[] = [], idxThap: number[] = [];
    if (khacDv) trangThai = "khac-don-vi";
    else if (co.length >= 2) {
      const max = Math.max(...co.map((d) => d.raw as number)), min = Math.min(...co.map((d) => d.raw as number));
      if (max === min) trangThai = "giong";
      else { trangThai = "khac"; idxCao = co.filter((d) => d.raw === max).map((d) => d.idx); idxThap = co.filter((d) => d.raw === min).map((d) => d.idx); }
    }
    return {
      khoa: c.khoa, ten: c.ten, dauThap: c.dauThap, dauCao: c.dauCao, huongDoc: c.huongDoc, moc: mocCua(c.khoa, donVi),
      donViMoc: c.khoa === "chieuDai" ? "mm" : c.khoa === "sucCang" ? donVi : null,
      diem, trangThai, idxCao, idxThap, thieu, trong: diem.every((d) => d.vitri === null),
    };
  });
}

/* ───────── Radar ───────── */

export interface Diem2D { x: number; y: number }

/** Bán kính tối thiểu (tỉ lệ) để giá trị thấp nhất của thang không dồn hết vào một điểm ở tâm. Vòng ngoài cùng = đầu cao của thang. */
export const SAN_BAN_KINH = 0.1;

/** Góc của trục thứ `i` trên `n` trục: trục đầu hướng lên trên, đi theo chiều kim đồng hồ. */
export const gocTruc = (i: number, n: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;

/** Tọa độ trên trục `i` ở mức `vitri` (0..1; null → null). */
export function diemTrenTruc(vitri: number | null, i: number, n: number, tam: Diem2D, r: number): Diem2D | null {
  if (vitri === null || !Number.isFinite(vitri)) return null;
  const g = gocTruc(i, n);
  const rr = r * (SAN_BAN_KINH + (1 - SAN_BAN_KINH) * kep(vitri, 0, 1));
  return { x: round(tam.x + rr * Math.cos(g)), y: round(tam.y + rr * Math.sin(g)) };
}

const round = (x: number) => Math.round(x * 100) / 100;

export interface DaGiacVot {
  idx: number;
  /** Điểm theo thứ tự trục; null = vợt này thiếu dữ liệu ở trục đó (KHÔNG vẽ). */
  diem: (Diem2D | null)[];
  /** Đường `d` của SVG nối các điểm có thật theo thứ tự trục: ≥3 điểm là đa giác kín, 2 điểm là đoạn thẳng, ít hơn thì rỗng. */
  duong: string;
  soDiem: number;
  /** Tên các trục mà vợt này chưa có thông tin (để chú thích bên dưới biểu đồ). */
  thieu: string[];
  /** Tên các trục vợt này CÓ số liệu nhưng khác đơn vị với vợt khác (kg/lbs) nên không vẽ chung một thang; số vẫn ghi ở thước đo và mô tả chữ. */
  khacDonVi: string[];
  /** true khi có trục bị bỏ nên hình không khép đủ 5 đỉnh. */
  khuyet: boolean;
}

export interface KetQuaRadar {
  /** Đỉnh ngoài cùng của từng trục (đặt nhãn). */
  dauTruc: Diem2D[];
  /** Các vòng lưới (đa giác đều) ở 25/50/75/100%. */
  vong: string[];
  vot: DaGiacVot[];
}

export function taoRadar(truc: KetQuaTruc[], soVot: number, tam: Diem2D, r: number): KetQuaRadar {
  const n = truc.length;
  const dauTruc = truc.map((_, i) => diemTrenTruc(1, i, n, tam, r) as Diem2D);
  const vong = [0.25, 0.5, 0.75, 1].map((f) => {
    const p = truc.map((_, i) => diemTrenTruc(f === 1 ? 1 : (f - SAN_BAN_KINH) / (1 - SAN_BAN_KINH), i, n, tam, r) as Diem2D);
    return `${p.map((q, i) => `${i ? "L" : "M"}${q.x},${q.y}`).join(" ")} Z`;
  });
  const vot: DaGiacVot[] = Array.from({ length: soVot }, (_, idx) => {
    const diem = truc.map((t, i) => diemTrenTruc(t.diem[idx]?.vitri ?? null, i, n, tam, r));
    const co = diem.filter((p): p is Diem2D => p !== null);
    const thieu = truc.filter((t) => t.diem[idx]?.vitri == null && t.diem[idx]?.raw == null).map((t) => t.ten);
    const khacDonVi = truc.filter((t) => t.diem[idx]?.vitri == null && t.diem[idx]?.raw != null).map((t) => t.ten);
    const duong = co.length >= 2 ? `${co.map((q, i) => `${i ? "L" : "M"}${q.x},${q.y}`).join(" ")}${co.length >= 3 ? " Z" : ""}` : "";
    return { idx, diem, duong, soDiem: co.length, thieu, khacDonVi, khuyet: co.length < n };
  });
  return { dauTruc, vong, vot };
}

/* ───────── Thanh giá / tồn kho ───────── */

export interface ThanhGia { idx: number; giaTri: number; ti: number; reNhat: boolean; datNhat: boolean }
export interface KetQuaThanhGia { thanh: ThanhGia[]; giongNhau: boolean }

/** Thanh giá bắt đầu từ 0 (độ dài tỉ lệ thật so với giá cao nhất). Bằng nhau thì không đánh dấu rẻ/đắt nhất. */
export function tinhThanhGia(ds: HoSoDoiChieu[]): KetQuaThanhGia {
  const gia = ds.map((h) => h.gia);
  const max = Math.max(0, ...gia), min = gia.length ? Math.min(...gia) : 0;
  const giongNhau = gia.length >= 2 && max === min;
  const biet = gia.length >= 2 && !giongNhau;
  return {
    giongNhau,
    thanh: gia.map((g, idx) => ({ idx, giaTri: g, ti: max > 0 ? kep(g / max, 0, 1) : 0, reNhat: biet && g === min, datNhat: biet && g === max })),
  };
}

export interface ThanhTon { idx: number; giaTri: number; ti: number; het: boolean; nhieuNhat: boolean }
/** Thanh tồn kho: tỉ lệ theo vợt còn nhiều nhất trong nhóm đang so; hết hàng thì thanh rỗng. */
export function tinhThanhTon(ds: HoSoDoiChieu[]): { thanh: ThanhTon[]; giongNhau: boolean } {
  const ton = ds.map((h) => Math.max(0, h.ton));
  const max = Math.max(0, ...ton), min = ton.length ? Math.min(...ton) : 0;
  const giongNhau = ton.length >= 2 && max === min;
  return { giongNhau, thanh: ton.map((t, idx) => ({ idx, giaTri: t, ti: max > 0 ? t / max : 0, het: t <= 0, nhieuNhat: ton.length >= 2 && !giongNhau && t === max })) };
}

/* ───────── Điểm khác biệt (dạng thẻ) ───────── */

export type KieuKhacBiet = "khac" | "giong" | "thieu" | "khac-don-vi" | "het-hang" | "phien-ban";
export interface HuyHieu { idx: number | null; /** Cụm chữ nói về vợt này ("nặng đầu hơn", "ở giữa"…). */ nhan: string; giaTri: string }
export interface MucKhacBiet { khoa: string; tieuDe: string; kieu: KieuKhacBiet; huyHieu: HuyHieu[]; ghiChu?: string }

const CUM_TU: Record<KhoaTruc, { cao: string; thap: string }> = {
  canBang: { cao: "nặng đầu hơn", thap: "nhẹ đầu hơn" },
  doCung: { cao: "cứng hơn", thap: "mềm hơn" },
  trongLuong: { cao: "nặng hơn (số U nhỏ hơn)", thap: "nhẹ hơn (số U lớn hơn)" },
  chieuDai: { cao: "dài hơn", thap: "ngắn hơn" },
  sucCang: { cao: "cao hơn", thap: "thấp hơn" },
};
const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} đ`;

/**
 * Biến chênh lệch dữ liệu thật thành các mục có cấu trúc để vẽ thẻ/huy hiệu. Cùng nội dung với `doiChieu`: chỉ nêu ai cao/thấp hơn, giống nhau,
 * chưa có thông tin, hết hàng, thay đổi theo phiên bản. Không có mục nào kết luận cây nào hay hơn.
 */
export function diemKhacBiet(ds: HoSoDoiChieu[], truc = tinhTruc(ds)): MucKhacBiet[] {
  const ra: MucKhacBiet[] = [];
  if (ds.length < 2) return ra;
  for (const t of truc) {
    const { khoa, ten } = t;
    if (t.trangThai === "khac-don-vi") {
      ra.push({ khoa, tieuDe: ten, kieu: "khac-don-vi", huyHieu: t.diem.filter((d) => d.chu).map((d) => ({ idx: d.idx, nhan: "ghi", giaTri: d.chu as string })), ghiChu: "Các vợt ghi sức căng theo đơn vị khác nhau nên chưa đối chiếu trực tiếp." });
    } else if (t.trangThai === "giong") {
      const co = t.diem.filter((d) => d.raw !== null);
      ra.push({ khoa, tieuDe: ten, kieu: "giong", huyHieu: co.map((d) => ({ idx: d.idx, nhan: "giống nhau", giaTri: d.chu as string })) });
    } else if (t.trangThai === "khac") {
      const hh: HuyHieu[] = t.diem.filter((d) => d.raw !== null).map((d) => ({
        idx: d.idx, giaTri: d.chu as string,
        nhan: t.idxCao.includes(d.idx) ? CUM_TU[khoa].cao : t.idxThap.includes(d.idx) ? CUM_TU[khoa].thap : "ở giữa",
      }));
      ra.push({ khoa, tieuDe: ten, kieu: "khac", huyHieu: hh });
    }
    if (t.thieu.length && t.trangThai !== "khac-don-vi") {
      ra.push({ khoa: `${khoa}-thieu`, tieuDe: ten, kieu: "thieu", huyHieu: t.thieu.map((i) => ({ idx: i, nhan: "chưa có thông tin", giaTri: "" })), ghiChu: t.trangThai === "chua-du" ? "Chưa đủ dữ liệu để đối chiếu thông số này." : undefined });
    }
  }
  const g = tinhThanhGia(ds);
  if (g.giongNhau) ra.push({ khoa: "gia", tieuDe: "Giá", kieu: "giong", huyHieu: g.thanh.map((b) => ({ idx: b.idx, nhan: "giống nhau", giaTri: vnd(b.giaTri) })) });
  else if (ds.length >= 2) ra.push({ khoa: "gia", tieuDe: "Giá", kieu: "khac", huyHieu: g.thanh.map((b) => ({ idx: b.idx, giaTri: vnd(b.giaTri), nhan: b.datNhat ? "đắt hơn" : b.reNhat ? "rẻ hơn" : "ở giữa" })) });
  const het = ds.map((h, i) => (h.ton <= 0 ? i : -1)).filter((i) => i >= 0);
  if (het.length) ra.push({ khoa: "ton", tieuDe: "Tồn kho", kieu: "het-hang", huyHieu: het.map((i) => ({ idx: i, nhan: "hiện hết hàng", giaTri: "" })) });
  ds.forEach((h, i) => {
    if (h.tuyPhienBan.length) ra.push({ khoa: `pb-${i}`, tieuDe: "Theo phiên bản", kieu: "phien-ban", huyHieu: [{ idx: i, nhan: `${h.tuyPhienBan.join(", ")} thay đổi theo phiên bản`, giaTri: "" }], ghiChu: "Đang so theo phiên bản đã chọn." });
  });
  return ra;
}

/* ───────── Mô tả chữ cho trình đọc màn hình ───────── */

/** Mô tả đầy đủ số liệu của biểu đồ nhện bằng chữ (dùng cho aria-label/mô tả ẩn). */
export function moTaBieuDo(ds: HoSoDoiChieu[], truc = tinhTruc(ds)): string {
  const phan = ds.map((h, i) => {
    const ten = h.nhan ?? `Vợt ${i + 1}`;
    const co = truc.filter((t) => t.diem[i]?.chu).map((t) => `${t.ten.toLowerCase()} ${t.diem[i].chu}`);
    const thieu = truc.filter((t) => !t.diem[i]?.chu).map((t) => t.ten.toLowerCase());
    return `${ten} (${h.ten}): ${co.length ? co.join("; ") : "chưa có thông số nào"}${thieu.length ? `. Chưa có thông tin: ${thieu.join(", ")}` : ""}.`;
  });
  return `Biểu đồ nhện ${ds.length} vợt theo ${truc.length} thông số ghi trong kho, trên thang minh họa (không phải điểm chất lượng). ${phan.join(" ")}`;
}

/* ───────── Gợi ý cặp vợt để so ngay ───────── */

export interface UngVienSoSanh {
  id: string; ten: string; hang: string | null; gia: number; ton: number;
  canBang: { bac: number; chu: string } | null;
  doCung: { bac: number; chu: string } | null;
}
export interface CapGoiY { a: UngVienSoSanh; b: UngVienSoSanh; /** Thông số mà hai vợt ghi KHÁC nhau (chỉ tính khi cả hai có dữ liệu). */ khacNhau: string[]; diem: number }

function chamCap(a: UngVienSoSanh, b: UngVienSoSanh): CapGoiY {
  const khac: string[] = [];
  let diem = 0;
  if (a.canBang && b.canBang && a.canBang.bac !== b.canBang.bac) { khac.push("điểm cân bằng"); diem += Math.abs(a.canBang.bac - b.canBang.bac); }
  if (a.doCung && b.doCung && a.doCung.bac !== b.doCung.bac) { khac.push("độ cứng thân"); diem += Math.abs(a.doCung.bac - b.doCung.bac); }
  return { a, b, khacNhau: khac, diem };
}

/**
 * Chọn vài cặp vợt còn hàng để khách so ngay. Chỉ chọn cặp có ít nhất một thông số ghi khác nhau (có gì để thấy trên biểu đồ); ưu tiên khác nhiều,
 * rồi giá gần nhau (dễ so). Không dùng vợt hết hàng. `giu` = đã có một vợt, chỉ gợi ý bạn đồng hành cho vợt đó (không lặp bạn). Đây là gợi ý để xem
 * khác biệt, không phải khuyến nghị mua.
 */
export function goiYCapVot(ds: UngVienSoSanh[], { giu = null, toiDa = 3 }: { giu?: string | null; toiDa?: number } = {}): CapGoiY[] {
  const con = ds.filter((v) => v.ton > 0 && (v.canBang || v.doCung));
  const cap: CapGoiY[] = [];
  if (giu) {
    const goc = ds.find((v) => v.id === giu);
    if (!goc) return [];
    for (const v of con) if (v.id !== giu) cap.push(chamCap(goc, v));
  } else {
    for (let i = 0; i < con.length; i++) for (let j = i + 1; j < con.length; j++) cap.push(chamCap(con[i], con[j]));
  }
  const thuTu = (x: CapGoiY, y: CapGoiY) => y.diem - x.diem || Math.abs(x.a.gia - x.b.gia) - Math.abs(y.a.gia - y.b.gia) || (x.a.id + x.b.id).localeCompare(y.a.id + y.b.id);
  const tot = cap.filter((c) => c.diem > 0).sort(thuTu);
  if (giu) return tot.slice(0, toiDa);
  const dung = new Set<string>();
  const ra: CapGoiY[] = [];
  for (const c of tot) {
    if (ra.length >= toiDa) break;
    if (dung.has(c.a.id) || dung.has(c.b.id)) continue;
    dung.add(c.a.id); dung.add(c.b.id); ra.push(c);
  }
  return ra;
}
