/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Phân loại thông số vợt (5 trường chuỗi ở `ChiTietSanPham.thongSo`) cho bộ lọc danh sách và dữ liệu danh sách/trang chủ.
 * Cách hiểu chuỗi trùng với `bacCanBang`/`bacDoCung` ở frontend (`lib/landing-data.ts`) để "lối chơi" ở hai nơi cho cùng kết quả.
 * Chỉ dựa trên giá trị thật trong kho: không suy đoán, không điền số mm, không chấm điểm hiệu năng.
 */
export interface ThongSoVotTho { doCanBang?: string; trongLuong?: string; doCung?: string; chieuDai?: string; sucCang?: string }

export type NhomCanBang = 'nang' | 'can-bang' | 'nhe';
export type NhomDoCung = 'mem' | 'vua' | 'cung';
export type LoiChoiKhoa = 'cong' | 'toc' | 'toan';
export const NHOM_CAN_BANG: NhomCanBang[] = ['nang', 'can-bang', 'nhe'];
export const NHOM_DO_CUNG: NhomDoCung[] = ['mem', 'vua', 'cung'];
export const LOI_CHOI_KHOA: LoiChoiKhoa[] = ['cong', 'toc', 'toan'];

const thuong = (s?: string | null) => String(s ?? '').toLocaleLowerCase('vi');

/** Độ cân bằng → số: dương nặng đầu, âm nhẹ đầu, 0 cân bằng; null nếu không ghi/không nhận ra. */
export function bacCanBang(ts?: ThongSoVotTho | null): number | null {
  const s = thuong(ts?.doCanBang);
  if (!s) return null;
  if (s.includes('rất nặng')) return 3;
  if (s.includes('hơi nặng')) return 1;
  if (s.includes('nặng')) return 2;
  if (s.includes('cân bằng')) return 0;
  if (s.includes('rất nhẹ')) return -2;
  if (s.includes('nhẹ')) return -1;
  return null;
}

/** Độ cứng → 0 mềm … 3 rất cứng; null nếu không ghi. */
export function bacDoCung(ts?: ThongSoVotTho | null): number | null {
  const s = thuong(ts?.doCung);
  if (!s) return null;
  if (s.includes('rất cứng')) return 3;
  if (s.includes('cứng')) return 2;
  if (s.includes('trung bình')) return 1;
  if (s.includes('mềm') || s.includes('dẻo')) return 0;
  return null;
}

export function nhomCanBang(ts?: ThongSoVotTho | null): NhomCanBang | null {
  const b = bacCanBang(ts);
  return b === null ? null : b > 0 ? 'nang' : b === 0 ? 'can-bang' : 'nhe';
}

export function nhomDoCung(ts?: ThongSoVotTho | null): NhomDoCung | null {
  const c = bacDoCung(ts);
  return c === null ? null : c >= 2 ? 'cung' : c === 1 ? 'vua' : 'mem';
}

/** "3U (85-89g)" → "3u". */
export function nhomTrongLuong(ts?: ThongSoVotTho | null): string | null {
  const m = /^\s*(\d)\s*U/i.exec(String(ts?.trongLuong ?? ''));
  return m ? `${m[1]}u` : null;
}

/**
 * Những lối chơi mà vợt "hợp" (mức khớp ≥ 2/3 như `chamVot` ở frontend): Uy lực = nặng đầu từ "hơi nặng"; Tốc độ = nhẹ đầu;
 * Kiểm soát = cân bằng hoặc hơi nặng đầu. Cần có cả độ cân bằng lẫn độ cứng như bộ gợi ý ở frontend; thiếu thì không thuộc lối chơi nào.
 */
export function loiChoiCuaVot(ts?: ThongSoVotTho | null): LoiChoiKhoa[] {
  const b = bacCanBang(ts);
  if (b === null || bacDoCung(ts) === null) return [];
  const r: LoiChoiKhoa[] = [];
  if (b >= 1) r.push('cong');
  if (b <= -1) r.push('toc');
  if (b === 0 || b === 1) r.push('toan');
  return r;
}

export interface BoLocThongSo {
  loiChoi: string[];
  canBang: string[];
  trongLuong: string[];
  doCung: string[];
}

export const coBoLocThongSo = (b: BoLocThongSo) => !!(b.loiChoi.length || b.canBang.length || b.trongLuong.length || b.doCung.length);

/** Một phiên bản thỏa MỌI nhóm lọc đã chọn (trong mỗi nhóm, khớp một trong các giá trị). */
export function bienTheKhopBoLoc(ts: ThongSoVotTho | null | undefined, b: BoLocThongSo): boolean {
  if (!ts) return false;
  const trong = (ds: string[], gt: string | null) => !ds.length || (gt !== null && ds.includes(gt));
  return (
    (!b.loiChoi.length || loiChoiCuaVot(ts).some((l) => b.loiChoi.includes(l))) &&
    trong(b.canBang, nhomCanBang(ts)) &&
    trong(b.trongLuong, nhomTrongLuong(ts)) &&
    trong(b.doCung, nhomDoCung(ts))
  );
}

const TRUONG: (keyof ThongSoVotTho)[] = ['doCanBang', 'trongLuong', 'doCung', 'chieuDai', 'sucCang'];

/**
 * Gộp thông số các phiên bản của MỘT sản phẩm. Trường mà mọi phiên bản (có ghi trường đó) cùng một giá trị thì giữ giá trị;
 * trường mà các phiên bản KHÁC nhau thì bỏ khỏi `thongSoVot` và liệt kê ở `khacNhau` (kèm các giá trị) để giao diện nói rõ
 * "tùy phiên bản" thay vì lấy bừa phiên bản đầu. Không có phiên bản nào ghi thông số → `thongSoVot: null`.
 */
export function gopThongSoBienThe(ds: (ThongSoVotTho | null | undefined)[]) {
  const co = ds.filter((t): t is ThongSoVotTho => !!t);
  if (!co.length) return { thongSoVot: null as ThongSoVotTho | null, khacNhau: {} as Record<string, string[]> };
  const thongSoVot: ThongSoVotTho = {};
  const khacNhau: Record<string, string[]> = {};
  for (const k of TRUONG) {
    const gt = [...new Set(co.map((t) => (t[k] ? String(t[k]) : '')).filter(Boolean))];
    if (gt.length === 1) thongSoVot[k] = gt[0];
    else if (gt.length > 1) khacNhau[k] = gt;
  }
  return { thongSoVot: Object.keys(thongSoVot).length ? thongSoVot : null, khacNhau };
}
