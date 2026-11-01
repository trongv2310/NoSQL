export interface KhuyenMaiV {
  id: string; tenChuongTrinh: string; moTa: string | null; ngayBatDau: string | null; ngayKetThuc: string | null;
  phanTramGiam: number; giamToiDa: number | null; soLuongSuDung: number | null; conHieuLuc: boolean;
}

export interface SanPhamV {
  id: string; tenSanPham: string; moTa: string | null; giaGoc: number; giaSauKhuyenMai: number; dangGiamGia: boolean;
  hinhAnhDaiDien: string; loai: { id: string; tenLoai: string } | null; hang: { id: string; tenHang: string } | null;
  nhaCungCap: { id: string; tenNhaCungCap: string } | null; khuyenMai: KhuyenMaiV | null;
  coSize: boolean; coMau: boolean; trungBinhDanhGia: number; ngayTao: string; tongTonKho?: number;
}

export interface BienTheV {
  id: string; sanPhamId: string; sku: string; giaBan: number | null; giaThucTe: number; soLuongTon: number; hinhAnh: string;
  mau: { id: string; tenMau: string } | null; size: { id: string; tenSize: string; loaiSize: string } | null;
  thongSo: { doCanBang?: string; trongLuong?: string; doCung?: string; chieuDai?: string; sucCang?: string } | null;
}

export interface Trang<T> { items: T[]; total: number; page: number; perPage: number; pages: number }

export interface TranDauV {
  id: string; tenGiaiDau: string; vong: string; noiDung: string; doiA: string; doiB: string; tiSo: string | null;
  doiThang: string | null; tenDoiThang: string | null; ngayThiDau: string; diaDiem: string | null; nguonTin: string | null;
  lienKetNguon: string | null; tinTucs: { id: string; tieuDe: string }[]; soTin?: number;
}

export interface TinV {
  id: string; tieuDe: string; tomTat: string | null; noiDung: string; loaiTin: string; nhanLoai: string; iconLoai: string;
  hinhAnh: string; nguonTin: string | null; lienKetNguon: string | null; noiBat: boolean; hienThi: boolean; thuTu: number;
  luotXem: number; ngayDang: string; sanPham: SanPhamV | null; tranDau: TranDauV | null; tacGia: string | null;
}

export interface DonHangV {
  id: string; soDonHang: number; ngayDat: string; trangThai: string; tongTien: number; tongTienSauGiam: number; tienGiam: number;
  diaChiGiaoHang: string; soDienThoaiNhanHang: string; ghiChu: string;
  khachHang: { id: string; hoTen: string; email: string; soDienThoai: string } | null;
  chiTiet: {
    id: string; chiTietSanPhamId: string | null; sanPhamId: string | null; tenSanPham: string; hinhAnh: string; sku: string;
    tenMau?: string; tenSize?: string; soLuong: number; donGia: number; thanhTien: number;
  }[];
  soDong: number;
}

export interface GioHangV {
  items: {
    id: string; soLuong: number; tenSanPham: string; sanPhamId: string; sanPhamConKinhDoanh: boolean;
    bienThe: BienTheV; donGia: number; thanhTien: number;
  }[];
  tongTien: number; tongSoLuong: number;
}
