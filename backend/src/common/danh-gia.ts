/** Điều kiện chọn đánh giá được phép hiển thị công khai (xem `PhanHoi.daXacMinh`). */
export const LOC_PHAN_HOI_CONG_KHAI = { daXacMinh: true } as const;

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
