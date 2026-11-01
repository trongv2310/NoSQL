export interface KhuyenMaiLike {
  ngayBatDau?: Date | string | null;
  ngayKetThuc?: Date | string | null;
  phanTramGiam?: number | null;
  giamToiDa?: number | null;
}

function dauNgay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Khuyến mãi còn hiệu lực theo ngày hôm nay (so sánh theo ngày, không theo giờ). */
export function khuyenMaiConHieuLuc(km?: KhuyenMaiLike | null, now: Date = new Date()): boolean {
  if (!km) {
    return false;
  }
  const homNay = dauNgay(now);
  if (km.ngayBatDau && dauNgay(new Date(km.ngayBatDau)) > homNay) {
    return false;
  }
  if (km.ngayKetThuc && dauNgay(new Date(km.ngayKetThuc)) < homNay) {
    return false;
  }
  return true;
}

/** Giá sau khuyến mãi; mức giảm bị chặn bởi giamToiDa nếu có. */
export function giaSauKhuyenMai(giaGoc: number, km?: KhuyenMaiLike | null, now: Date = new Date()): number {
  const goc = Number(giaGoc ?? 0);
  if (goc <= 0) {
    return 0;
  }
  if (km && khuyenMaiConHieuLuc(km, now)) {
    let giam = (goc * Number(km.phanTramGiam ?? 0)) / 100;
    if (km.giamToiDa && giam > Number(km.giamToiDa)) {
      giam = Number(km.giamToiDa);
    }
    return Math.max(0, goc - giam);
  }
  return goc;
}

/** Giá thực tế của một biến thể: giaBan riêng, nếu không có thì giá gốc sản phẩm. */
export function giaBienThe(
  bienThe: { giaBan?: number | null },
  sanPham?: { giaGoc?: number | null; khuyenMai?: KhuyenMaiLike | null } | null,
  now: Date = new Date(),
): number {
  const co = Number(bienThe.giaBan ?? sanPham?.giaGoc ?? 0);
  return giaSauKhuyenMai(co, sanPham?.khuyenMai, now);
}

/** Khuyến mãi đang chạy và có phần trăm giảm > 0. */
export function dangGiamGia(km?: KhuyenMaiLike | null): boolean {
  return !!km && Number(km.phanTramGiam ?? 0) > 0 && khuyenMaiConHieuLuc(km);
}
