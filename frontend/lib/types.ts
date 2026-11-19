export interface KhuyenMaiV {
  id: string; tenChuongTrinh: string; moTa: string | null; ngayBatDau: string | null; ngayKetThuc: string | null;
  phanTramGiam: number; giamToiDa: number | null; soLuongSuDung: number | null; conHieuLuc: boolean;
}

export interface ThongSoVotV { doCanBang?: string; trongLuong?: string; doCung?: string; chieuDai?: string; sucCang?: string }

export interface SanPhamV {
  id: string; tenSanPham: string; moTa: string | null; giaGoc: number; giaSauKhuyenMai: number; dangGiamGia: boolean;
  hinhAnhDaiDien: string; loai: { id: string; tenLoai: string } | null; hang: { id: string; tenHang: string } | null;
  nhaCungCap: { id: string; tenNhaCungCap: string } | null; khuyenMai: KhuyenMaiV | null;
  coSize: boolean; coMau: boolean;
  /** Chỉ API admin (`GET /admin/san-pham`): sản phẩm đang ẩn; thiếu thì coi như false. */
  daAn?: boolean;
  /** null = chưa có đánh giá đã xác minh (không được hiểu là 5 sao). */
  trungBinhDanhGia: number | null; soDanhGia?: number; ngayTao: string; tongTonKho?: number;
  /** Chỉ vợt: thông số đã gộp qua mọi phiên bản (trường các phiên bản khác nhau nằm ở `thongSoKhacNhau`, không lấy bừa một giá trị). */
  thongSoVot?: ThongSoVotV | null; thongSoKhacNhau?: Record<string, string[]>;
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
  /** Chỉ API admin: `false` = đang ẩn khỏi khách; thiếu thì coi như hiển thị. */
  hienThi?: boolean;
}

export interface TinV {
  id: string; tieuDe: string; tomTat: string | null; noiDung: string; loaiTin: string; nhanLoai: string; iconLoai: string;
  hinhAnh: string; nguonTin: string | null; lienKetNguon: string | null; noiBat: boolean; hienThi: boolean; thuTu: number;
  luotXem: number; ngayDang: string; sanPham: SanPhamV | null; tranDau: TranDauV | null; tacGia: string | null;
}

export interface DonHangV {
  id: string; soDonHang: number; ngayDat: string; trangThai: string; tongTien: number; tongTienSauGiam: number; tienGiam: number;
  /** Tên người nhận nhập lúc thanh toán; null với đơn cũ chưa lưu trường này. */
  hoTenNhan?: string | null;
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

/** Trạng thái một dòng giỏ sau khi server tính lại giá và tồn kho. */
export type TrangThaiDong = "ok" | "giam_so_luong" | "het_hang" | "ngung_kinh_doanh" | "khong_ton_tai";

/** Một dòng báo giá của giỏ khách (POST /gio-hang/tinh). `id` chính là id biến thể. */
export interface BaoGiaDong {
  id: string; trangThai: TrangThaiDong; soLuongYeuCau: number; soLuong: number; tenSanPham: string | null; sanPhamId: string | null;
  sanPhamConKinhDoanh: boolean; bienThe: BienTheV | null; donGia: number; thanhTien: number;
}
export interface BaoGiaV { items: BaoGiaDong[]; tongTien: number; tongSoLuong: number }

export type TrangThaiGop = "da_gop" | "giam_so_luong" | "da_ap_dung" | "het_hang" | "ngung_kinh_doanh" | "khong_ton_tai";
export interface KetQuaGopV { chiTietId: string; tenSanPham: string | null; yeuCau: number; daThem: number; trangThai: TrangThaiGop }
/** Kết quả POST /gio-hang/dong-bo: giỏ tài khoản sau khi gộp kèm báo cáo từng dòng của giỏ khách. */
export interface DongBoGioV extends GioHangV { taiKhoanId: string; cartCount: number; daApDungTruoc: boolean; ketQua: KetQuaGopV[] }

export interface LienHeV { dienThoai: string | null; email: string | null; diaChi: string | null; gioMoCua: string | null }

/** Gợi ý mua cùng (GET /goi-y/*, công khai): chỉ kết quả sản phẩm, không có lợi nhuận/hạng/K. `gia` là giá hiện hành; `chiTietMacDinh` = id biến thể còn hàng để thêm vào giỏ. */
export interface SanPhamGoiY { id: string; tenSanPham: string; hinhAnhDaiDien?: string; gia: number; chiTietMacDinh: string }
export interface ComboGoiY { khoa: string; tongGia: number; sanPhams: SanPhamGoiY[] }

/** Khai thác Top-K (chỉ Admin, /admin/khai-thac). `loiNhuan` là utility thuật toán tính trên đơn đã hoàn thành. */
export interface SanPhamTrongTap { id: string; tenSanPham: string; hinhAnhDaiDien?: string }
export interface DongKetQuaTopK { hang: number; sanPhams: SanPhamTrongTap[]; tenTap: string; loiNhuan: number; khoa: string }
export interface KetQuaTopK { k: number; soThang: number; soDonXet: number; soBatch: number; biCat: boolean; thoiGianMs: number; chayLuc: string; ketQua: DongKetQuaTopK[] }
export interface GoiYDaLuuV { coDuLieu: boolean; k?: number; soThang?: number; capNhatLuc?: string; ketQua: DongKetQuaTopK[] }
