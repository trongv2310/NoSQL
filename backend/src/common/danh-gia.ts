/**
 * Điều kiện chọn đánh giá được phép hiển thị công khai và tính vào điểm trung bình:
 * - `daXacMinh: true`: gửi qua tài khoản khách hàng thật (xem `PhanHoi.daXacMinh`);
 * - KHÔNG phải dữ liệu mẫu (`laDuLieuMau`), trừ khi máy chạy demo bật `HIEN_DU_LIEU_MAU=true`. Khi đó API trả kèm cờ để giao diện ghi rõ "dữ liệu mẫu".
 * Là hàm (đọc biến môi trường lúc gọi) vì module này được nạp trước khi ConfigModule đọc file .env.
 */
export const hienDuLieuMau = () => process.env.HIEN_DU_LIEU_MAU === 'true';
export function locPhanHoiCongKhai(): Record<string, unknown> {
  return hienDuLieuMau() ? { daXacMinh: true } : { daXacMinh: true, laDuLieuMau: { $ne: true } };
}

/** Thẻ cảm nhận chọn sẵn khi viết đánh giá (lưu bằng $addToSet nên không trùng). */
export const THE_DANH_GIA = ['dap-uy-luc', 'phan-tat-nhanh', 'de-dieu-khien', 'nang-tay', 'rung-tay', 'em-tay', 'ben', 'dung-size'] as const;
export type TheDanhGia = (typeof THE_DANH_GIA)[number];

export interface TongKetDanhGia {
  /** `null` khi chưa có đánh giá nào: không được thay bằng 5 sao mặc định. */
  trungBinh: number | null;
  so: number;
}

export function tongKetDanhGia(ds: { danhGia: number }[]): TongKetDanhGia {
  if (!ds.length) {
    return { trungBinh: null, so: 0 };
  }
  const tb = ds.reduce((t, r) => t + Number(r.danhGia), 0) / ds.length;
  return { trungBinh: Math.round(tb * 10) / 10, so: ds.length };
}
