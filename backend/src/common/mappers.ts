import { dangGiamGia, giaBienThe, giaSauKhuyenMai, khuyenMaiConHieuLuc } from './pricing';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const idOf = (v: any): string | null => (v ? String(v._id ?? v) : null);

export function khuyenMaiView(km: any) {
  if (!km || !km._id) {
    return null;
  }
  return {
    id: idOf(km),
    tenChuongTrinh: km.tenChuongTrinh,
    moTa: km.moTa ?? null,
    ngayBatDau: km.ngayBatDau ?? null,
    ngayKetThuc: km.ngayKetThuc ?? null,
    phanTramGiam: Number(km.phanTramGiam ?? 0),
    giamToiDa: km.giamToiDa ?? null,
    soLuongSuDung: km.soLuongSuDung ?? null,
    conHieuLuc: khuyenMaiConHieuLuc(km),
  };
}

/** Sản phẩm đã populate (loai, hang, khuyenMai) -> dạng trả về cho client. */
export function sanPhamView(sp: any) {
  const km = sp.khuyenMai && sp.khuyenMai._id ? sp.khuyenMai : null;
  return {
    id: idOf(sp),
    tenSanPham: sp.tenSanPham,
    moTa: sp.moTa ?? null,
    giaGoc: Number(sp.giaGoc ?? 0),
    giaSauKhuyenMai: giaSauKhuyenMai(sp.giaGoc, km),
    dangGiamGia: dangGiamGia(km),
    hinhAnhDaiDien: sp.hinhAnhDaiDien || 'default-product.jpg',
    loai: sp.loai && sp.loai._id ? { id: idOf(sp.loai), tenLoai: sp.loai.tenLoai } : null,
    hang: sp.hang && sp.hang._id ? { id: idOf(sp.hang), tenHang: sp.hang.tenHang, quocGia: sp.hang.quocGia ?? null } : null,
    nhaCungCap:
      sp.nhaCungCap && sp.nhaCungCap._id
        ? { id: idOf(sp.nhaCungCap), tenNhaCungCap: sp.nhaCungCap.tenNhaCungCap }
        : null,
    khuyenMai: khuyenMaiView(km),
    coSize: !!sp.coSize,
    coMau: !!sp.coMau,
    trungBinhDanhGia: Number(sp.trungBinhDanhGia ?? 5),
    ngayTao: sp.ngayTao,
  };
}

/** Biến thể đã populate (mau, size) + sản phẩm cha (kèm khuyenMai). */
export function bienTheView(ct: any, sp?: any) {
  const cha = sp ?? (ct.sanPham && ct.sanPham._id ? ct.sanPham : null);
  return {
    id: idOf(ct),
    sanPhamId: idOf(ct.sanPham),
    sku: ct.sku,
    giaBan: ct.giaBan ?? null,
    giaThucTe: giaBienThe(ct, cha),
    soLuongTon: Number(ct.soLuongTon ?? 0),
    hinhAnh: ct.hinhAnh || cha?.hinhAnhDaiDien || 'default-product.jpg',
    mau: ct.mau && ct.mau._id ? { id: idOf(ct.mau), tenMau: ct.mau.tenMau } : null,
    size: ct.size && ct.size._id ? { id: idOf(ct.size), tenSize: ct.size.tenSize, loaiSize: ct.size.loaiSize } : null,
    thongSo: ct.thongSo ?? null,
  };
}
