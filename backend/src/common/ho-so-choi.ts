/**
 * Hồ sơ nhúng trong `khachhangs.hoSoChoi`, gồm các trường tùy chọn do người chơi tự khai.
 * API công khai không trả thông tin chấn thương.
 */

/** Cùng khoá với hồ sơ ở Quầy tư vấn (frontend/lib/ho-so-choi.ts): Mới chơi / Chơi đều / Thi đấu. */
export const TRINH_DO = ['moi', 'deu', 'thi'] as const;
export const NOI_DUNG = ['don', 'doi'] as const;
export const LOI_CHOI = ['cong', 'toc', 'toan'] as const; // cùng khoá với lối chơi của vợt (catalog/vot-thong-so)
export const TAY_THUAN = ['phai', 'trai'] as const;
export const CHAN_THUONG = ['co-tay', 'khuyu-tay', 'vai'] as const;
export const TOI_DA_BUOI_MOI_TUAN = 14;

export type TrinhDo = (typeof TRINH_DO)[number];
export type NoiDung = (typeof NOI_DUNG)[number];
export type LoiChoi = (typeof LOI_CHOI)[number];
export type TayThuan = (typeof TAY_THUAN)[number];
export type ChanThuong = (typeof CHAN_THUONG)[number];

export interface HoSoChoiNhap {
  trinhDo?: TrinhDo | null;
  noiDung?: NoiDung[] | null;
  loiChoi?: LoiChoi | null;
  tayThuan?: TayThuan | null;
  chanThuong?: ChanThuong[] | null;
  soBuoiMoiTuan?: number | null;
}

const MANG = ['noiDung', 'chanThuong'] as const;
const DON = ['trinhDo', 'loiChoi', 'tayThuan', 'soBuoiMoiTuan'] as const;

/**
 * Bản khai đầy đủ (PUT) → MỘT lệnh cập nhật trên trường con bằng ký pháp chấm:
 * trường có giá trị → `$set: { "hoSoChoi.x": ... }`; trường bỏ trống / null / mảng rỗng → `$unset: { "hoSoChoi.x": "" }`.
 * Không trường nào có giá trị → `$unset` cả `hoSoChoi` (không để lại object rỗng chỉ có ngày cập nhật).
 * Mảng được khử trùng lặp và sắp theo thứ tự cố định để cùng một lựa chọn luôn lưu ra cùng một mảng.
 */
export function lenhCapNhatHoSo(n: HoSoChoiNhap, luc: Date): { $set?: Record<string, unknown>; $unset?: Record<string, ''> } {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};
  for (const k of DON) {
    const v = n[k];
    if (v === null || v === undefined) unset[`hoSoChoi.${k}`] = '';
    else set[`hoSoChoi.${k}`] = v;
  }
  for (const k of MANG) {
    const thuTu: readonly string[] = k === 'noiDung' ? NOI_DUNG : CHAN_THUONG;
    const v = [...new Set(n[k] ?? [])].sort((a, b) => thuTu.indexOf(a) - thuTu.indexOf(b));
    if (v.length) set[`hoSoChoi.${k}`] = v;
    else unset[`hoSoChoi.${k}`] = '';
  }
  if (!Object.keys(set).length) return { $unset: { hoSoChoi: '' } };
  set['hoSoChoi.capNhatLuc'] = luc;
  // MongoDB từ chối toán tử rỗng ("$unset is empty"), nên chỉ thêm $unset khi có trường cần xoá.
  return Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set };
}
