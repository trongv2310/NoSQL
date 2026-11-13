import { TRANG_THAI } from '../schemas';

/** Các chuyển trạng thái hợp lệ do nhân viên/quản trị thực hiện. */
export const CHUYEN_TRANG_THAI: Record<string, string[]> = {
  [TRANG_THAI.ChoXacNhan]: [TRANG_THAI.DangXuLy, TRANG_THAI.DaHuy],
  [TRANG_THAI.ChoThanhToanMomo]: [TRANG_THAI.DangXuLy, TRANG_THAI.DaHuy],
  [TRANG_THAI.DaThanhToanMomo]: [TRANG_THAI.DangGiao, TRANG_THAI.DaHuy],
  [TRANG_THAI.DangXuLy]: [TRANG_THAI.DangGiao, TRANG_THAI.DaHuy],
  [TRANG_THAI.DangGiao]: [TRANG_THAI.HoanThanh, TRANG_THAI.DaHuy],
};

/** Trạng thái mà khách còn được phép tự hủy. */
export const KHACH_DUOC_HUY: string[] = [
  TRANG_THAI.ChoXacNhan,
  TRANG_THAI.ChoThanhToanMomo,
  TRANG_THAI.DangXuLy,
];

/** Trạng thái không tính vào doanh thu. */
export const TRANG_THAI_LOAI_TRU: string[] = [TRANG_THAI.DaHuy, TRANG_THAI.DaHuyThanhToanThatBai];

/** Trạng thái không tính vào doanh thu/"đã bán": ngoài các đơn hủy còn có đơn MoMo CHƯA thanh toán (tiền chưa về, khách có thể bỏ cổng). */
export const TRANG_THAI_KHONG_TINH_DOANH_THU: string[] = [...TRANG_THAI_LOAI_TRU, TRANG_THAI.ChoThanhToanMomo];

export function coTheChuyen(tu: string, den: string): boolean {
  return (CHUYEN_TRANG_THAI[tu] ?? []).includes(den);
}

export function khachCoTheHuy(trangThai: string): boolean {
  return KHACH_DUOC_HUY.includes(trangThai);
}

export function adminCoTheHuy(trangThai: string): boolean {
  return Object.keys(CHUYEN_TRANG_THAI).includes(trangThai);
}
