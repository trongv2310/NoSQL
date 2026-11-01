import { LoaiSP, LoiChoi, NguCanh, NhomPhuKien, SapXep, TrinhDo, YDinh } from './nlu';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface LuotChat {
  vai: 'user' | 'bot';
  text: string;
}

export interface YeuCauChat {
  message: string;
  lichSu: LuotChat[];
  nguCanh: NguCanh;
}

// ---------------------------------------------------------------------------
// Làm sạch dữ liệu client gửi lên (server không tin bất cứ trường nào)
// ---------------------------------------------------------------------------

const LOAI = ['vot', 'giay', 'aoquan', 'phukien'] as const;
const TRINH_DO = ['moi', 'trung_binh', 'nang_cao'] as const;
const LOI_CHOI = ['cong', 'thu', 'toan_dien'] as const;
const SAP_XEP = ['re', 'cao'] as const;
const NHOM = ['cau', 'tui', 'cuon_can'] as const;
const Y_DINH = ['chao_hoi', 'cam_on', 'tam_biet', 'tro_giup', 'don_hang', 'chinh_sach', 'khuyen_mai', 'ton_kho', 'hoi_gia', 'so_sanh', 'dat_hang', 'huong_dan', 'tu_van', 'khac'] as const;
const ID_HEX = /^[0-9a-f]{24}$/i;

const chon = <T extends string>(v: unknown, ds: readonly T[]): T | undefined => (ds as readonly string[]).includes(v as string) ? (v as T) : undefined;
const gia = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1e9 ? Math.round(n) : undefined;
};
const dsId = (v: unknown, toiDa: number): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const r = v.filter((x): x is string => typeof x === 'string' && ID_HEX.test(x)).slice(-toiDa);
  return r.length ? r : undefined;
};

export function lamSachNguCanh(raw: unknown): NguCanh {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kq: NguCanh = {
    loai: chon<LoaiSP>(o.loai, LOAI),
    nhom: chon<NhomPhuKien>(o.nhom, NHOM),
    hang: typeof o.hang === 'string' && o.hang.length <= 50 ? o.hang : undefined,
    giaMin: gia(o.giaMin),
    giaMax: gia(o.giaMax),
    giaTam: gia(o.giaTam),
    trinhDo: chon<TrinhDo>(o.trinhDo, TRINH_DO),
    loiChoi: chon<LoiChoi>(o.loiChoi, LOI_CHOI),
    nheTay: o.nheTay === true ? true : undefined,
    kichCo: typeof o.kichCo === 'string' && /^[0-9a-z]{1,4}$/i.test(o.kichCo) ? o.kichCo : undefined,
    tuKhoa: Array.isArray(o.tuKhoa) ? o.tuKhoa.filter((x): x is string => typeof x === 'string' && /^[a-z0-9]{1,20}$/.test(x)).slice(0, 5) : undefined,
    sapXep: chon<SapXep>(o.sapXep, SAP_XEP),
    sanPhamIds: dsId(o.sanPhamIds, 6),
    daGoiY: dsId(o.daGoiY, 30),
    giaThamChieu: gia(o.giaThamChieu),
    yDinhTruoc: chon<YDinh>(o.yDinhTruoc, Y_DINH),
  };
  if (!kq.tuKhoa?.length) delete kq.tuKhoa;
  return Object.fromEntries(Object.entries(kq).filter(([, v]) => v !== undefined)) as NguCanh;
}

export function lamSachLichSu(raw: unknown): LuotChat[] {
  if (!Array.isArray(raw)) return [];
  const kq: LuotChat[] = [];
  for (const x of raw.slice(-10)) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const vai = o.vai === 'user' || o.vai === 'bot' ? o.vai : undefined;
    const text = typeof o.text === 'string' ? o.text.replace(/\s+/g, ' ').trim().slice(0, 600) : '';
    if (vai && text) kq.push({ vai, text });
  }
  return kq;
}

/** Bỏ ký tự điều khiển và gom khoảng trắng (giữ xuống dòng đơn). */
export function lamSachTinNhan(raw: unknown): string {
  return (typeof raw === 'string' ? raw : '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Giới hạn tần suất (cửa sổ trượt, giữ trong bộ nhớ)
// ---------------------------------------------------------------------------

export interface LuatGioiHan {
  /** Độ dài cửa sổ (ms). */
  cua: number;
  toiDa: number;
}

export type KetQuaGioiHan = { duoc: true } | { duoc: false; thuLaiSau: number };

export class GioiHanTanSuat {
  private readonly lich = new Map<string, number[]>();
  private lanDonCuoi = 0;

  constructor(
    private readonly luat: LuatGioiHan[],
    private readonly now: () => number = Date.now,
  ) {}

  /** Ghi nhận một lượt dùng; trả `duoc: false` kèm số giây phải chờ nếu vượt bất kỳ luật nào. */
  thu(khoa: string): KetQuaGioiHan {
    const t = this.now();
    this.donDep(t);
    const dai = Math.max(...this.luat.map((l) => l.cua));
    const moc = (this.lich.get(khoa) ?? []).filter((x) => t - x < dai);
    let cho = 0;
    for (const l of this.luat) {
      const trong = moc.filter((x) => t - x < l.cua);
      if (trong.length >= l.toiDa) {
        cho = Math.max(cho, l.cua - (t - trong[trong.length - l.toiDa]));
      }
    }
    if (cho > 0) {
      this.lich.set(khoa, moc);
      return { duoc: false, thuLaiSau: Math.max(1, Math.ceil(cho / 1000)) };
    }
    moc.push(t);
    this.lich.set(khoa, moc);
    return { duoc: true };
  }

  private donDep(t: number) {
    if (this.lich.size < 2000 && t - this.lanDonCuoi < 60_000) return;
    this.lanDonCuoi = t;
    const dai = Math.max(...this.luat.map((l) => l.cua));
    for (const [k, v] of this.lich) {
      if (!v.length || t - v[v.length - 1] >= dai) this.lich.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Cầu dao cho Gemini: lỗi liên tiếp thì tạm bỏ qua AI để khách khỏi chờ lâu
// ---------------------------------------------------------------------------

export class CauDao {
  private thatBai = 0;
  private moDen = 0;

  constructor(
    private readonly nguong = 3,
    private readonly nghiMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  choPhep(): boolean {
    return this.now() >= this.moDen;
  }

  thanhCong() {
    this.thatBai = 0;
    this.moDen = 0;
  }

  loi() {
    this.thatBai += 1;
    if (this.thatBai >= this.nguong) {
      this.moDen = this.now() + this.nghiMs;
      this.thatBai = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Chống AI bịa giá: mọi số tiền trong câu trả lời phải có trong dữ liệu đã đưa cho AI
// ---------------------------------------------------------------------------

/** Trích các số tiền (VNĐ) trong câu trả lời, kèm sai số cho phép do làm tròn ("3,8 triệu" ≈ 3.771.000). */
export function trichSoTien(text: string): { v: number; dungSai: number }[] {
  const kq: { v: number; dungSai: number }[] = [];
  const t = text.replace(/\*\*/g, '');
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(triệu|tr|nghìn|ngàn|k)(?![a-zà-ỹ])/giu)) {
    const donVi = /^(triệu|tr)$/i.test(m[2]) ? 1_000_000 : 1_000;
    const thapPhan = /[.,]\d+$/.test(m[1]) ? m[1].split(/[.,]/).pop()!.length : 0;
    kq.push({ v: parseFloat(m[1].replace(',', '.')) * donVi, dungSai: (donVi / 10 ** thapPhan) * 0.5 });
  }
  for (const m of t.matchAll(/(\d{1,3}(?:[.,]\d{3})+|\d{4,})\s*(?:đ|₫|vnđ|vnd|đồng)?/giu)) {
    // Bỏ phần đã bắt ở dạng "triệu/k" (số có đơn vị theo sau) và năm (2024...).
    const sau = t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 6);
    if (/^\s*(triệu|tr|nghìn|ngàn|k)\b/i.test(sau)) continue;
    const v = parseInt(m[1].replace(/[.,]/g, ''), 10);
    if (/^(19|20)\d{2}$/.test(m[1])) continue;
    if (/[đ₫]|vnđ|vnd|đồng/i.test(m[0]) || /[.,]/.test(m[1])) kq.push({ v, dungSai: 1 });
  }
  return kq;
}

/** true nếu mọi số tiền xuất hiện trong `text` đều khớp với một giá trong `choPhep`. */
export function giaHopLe(text: string, choPhep: number[]): boolean {
  return trichSoTien(text).every(({ v, dungSai }) => choPhep.some((p) => Math.abs(p - v) <= dungSai));
}
