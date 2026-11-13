import { sanPhamView } from '../common/mappers';
import { gopThongSoBienThe } from './vot-thong-so';

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Dữ liệu gọn cho landing: toàn bộ sản phẩm kèm tồn kho và (với vợt) thông số kỹ thuật, gộp trong một lần gọi
 * để trang chủ không phải gọi chi tiết từng sản phẩm. Thông số gộp từ MỌI phiên bản (xem `gopThongSoBienThe`): trường nào các phiên bản
 * khác nhau thì không được lấy bừa một giá trị mà nằm ở `thongSoKhacNhau`.
 */
export function ghepTrangChu(
  sanPhams: any[],
  tonKho: Map<string, number>,
  bienThes: { sanPham: unknown; thongSo?: any }[],
) {
  const theoSp = gomThongSoTheoSanPham(bienThes);
  return sanPhams.map((sp) => {
    const g = gopThongSoBienThe(theoSp.get(String(sp._id)) ?? []);
    return {
      ...sanPhamView(sp),
      tongTonKho: tonKho.get(String(sp._id)) ?? 0,
      thongSoVot: g.thongSoVot,
      thongSoKhacNhau: g.khacNhau,
    };
  });
}

/** Nhóm thông số theo sản phẩm (mỗi phiên bản có ghi thông số một phần tử). */
export function gomThongSoTheoSanPham(bienThes: { sanPham: unknown; thongSo?: any }[]): Map<string, any[]> {
  const m = new Map<string, any[]>();
  for (const b of bienThes) {
    if (!b.thongSo) continue;
    const k = String(b.sanPham);
    m.set(k, [...(m.get(k) ?? []), b.thongSo]);
  }
  return m;
}
