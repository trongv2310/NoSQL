import { idOf, khuyenMaiView, sanPhamView } from '../common/mappers';
import { dangGiamGia } from '../common/pricing';

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Chương trình khuyến mãi được phép hiện công khai: còn hiệu lực theo ngày, có mức giảm > 0 và đang gắn với ít nhất một
 * sản phẩm còn kinh doanh. Chương trình hết hạn, chưa bắt đầu hoặc không có sản phẩm thì không hiện (dữ liệu vẫn nằm trong DB).
 * `sanPhams` phải là danh sách sản phẩm còn kinh doanh đã populate `khuyenMai`.
 */
export function locKhuyenMaiDangChay(khuyenMais: any[], sanPhams: any[]) {
  const spTheoKm = new Map<string, any[]>();
  for (const sp of sanPhams) {
    const km = sp.khuyenMai && sp.khuyenMai._id ? sp.khuyenMai : null;
    if (!km || !dangGiamGia(km)) {
      continue;
    }
    const k = idOf(km) ?? '';
    spTheoKm.set(k, [...(spTheoKm.get(k) ?? []), sp]);
  }
  const hienDuoc = khuyenMais.filter((k) => dangGiamGia(k) && (spTheoKm.get(String(k._id))?.length ?? 0) > 0);
  const ids = new Set(hienDuoc.map((k) => String(k._id)));
  return {
    khuyenMais: hienDuoc.map(khuyenMaiView),
    sanPhams: sanPhams.filter((sp) => sp.khuyenMai && ids.has(idOf(sp.khuyenMai) ?? '')).map(sanPhamView),
  };
}
