import { sanPhamView } from '../common/mappers';

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Dữ liệu gọn cho landing: toàn bộ sản phẩm kèm tồn kho và (với vợt) thông số kỹ thuật, gộp trong một lần gọi
 * để trang chủ không phải gọi chi tiết từng sản phẩm. Thông số lấy từ biến thể đầu tiên có ghi thông số
 * (cùng cách `chiTiet()` chọn `thongSoVot`).
 */
export function ghepTrangChu(
  sanPhams: any[],
  tonKho: Map<string, number>,
  bienThes: { sanPham: unknown; thongSo?: any }[],
) {
  const thongSo = new Map<string, any>();
  for (const b of bienThes) {
    const k = String(b.sanPham);
    if (b.thongSo && !thongSo.has(k)) {
      thongSo.set(k, b.thongSo);
    }
  }
  return sanPhams.map((sp) => ({
    ...sanPhamView(sp),
    tongTonKho: tonKho.get(String(sp._id)) ?? 0,
    thongSoVot: thongSo.get(String(sp._id)) ?? null,
  }));
}
