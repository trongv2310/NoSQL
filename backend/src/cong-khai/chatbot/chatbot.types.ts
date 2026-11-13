import { docLienHe, type LienHe } from '../../common/lien-he';
import { NguCanh, YDinh } from './nlu';

/** Thẻ sản phẩm trả về cho giao diện chat (ảnh, giá, tình trạng kho, lý do gợi ý). */
export interface TheSanPham {
  id: string;
  ten: string;
  hang: string | null;
  loai: string | null;
  anh: string;
  gia: number;
  giaGoc: number;
  /** Có nhiều mức giá giữa các biến thể (hiển thị "Từ ..."). */
  tuGia: boolean;
  phanTramGiam: number;
  tenKhuyenMai: string | null;
  conHang: boolean;
  tonKho: number;
  link: string;
  lyDo: string[];
  thongSo: string;
  danhGia: number | null;
  vuotNganSach: boolean;
}

export interface TheDonHang {
  soDonHang: number;
  trangThai: string;
  ngayDat: string;
  tongTien: number;
  soDong: number;
  link: string;
}

export interface HanhDong {
  loai: 'thanh_toan';
  href: string;
  nhan: string;
  /** Tổng số lượng trong giỏ sau khi thêm, để cập nhật biểu tượng giỏ hàng. */
  soLuongGio: number;
}

export interface PhanHoiChatbot {
  success: boolean;
  reply: string;
  products: TheSanPham[];
  donHang: TheDonHang[];
  quickReplies: string[];
  /** Nút điều hướng (ví dụ "Đăng nhập") hiển thị dưới lời đáp. */
  lienKet: { nhan: string; href: string }[];
  /** Hành động cho giao diện thực hiện sau lời đáp (ví dụ chuyển tới trang thanh toán). */
  hanhDong: HanhDong | null;
  context: NguCanh;
  /** "ai" khi lời đáp do Gemini diễn đạt; "tra-cuu" khi đến từ tra cứu kho (không key, lỗi hoặc hết hạn mức). */
  nguon: 'ai' | 'tra-cuu';
  yDinh: YDinh;
}

export const THONG_TIN_CUA_HANG = {
  ten: 'Cửa hàng Cầu Lông HUIT',
} as const;

/**
 * Câu mô tả cách liên hệ cửa hàng, chỉ gồm thông tin đã được cấu hình (xem common/lien-he.ts).
 * Chưa cấu hình gì thì nói thẳng là đang cập nhật, không dùng số điện thoại/địa chỉ mẫu.
 */
export function lienHeCuaHang(lh: LienHe = docLienHe()): string {
  const phan = [
    lh.diaChi && `địa chỉ ${lh.diaChi}`,
    lh.dienThoai && `điện thoại ${lh.dienThoai}`,
    lh.email && `email ${lh.email}`,
    lh.gioMoCua && `giờ mở cửa ${lh.gioMoCua}`,
  ].filter((x): x is string => !!x);
  return phan.length
    ? `${THONG_TIN_CUA_HANG.ten}: ${phan.join(', ')}.`
    : 'Thông tin liên hệ của cửa hàng (địa chỉ, điện thoại, email, giờ mở cửa) đang được cập nhật.';
}
