/* eslint-disable @typescript-eslint/no-explicit-any */
import { dungKho, SanPhamKho } from '../src/cong-khai/chatbot/kho';

/** Dữ liệu mẫu cho test chatbot: có hình dạng như kết quả `populate` của Mongoose. */
let dem = 0;
const id = (p: string) => p + String(++dem).padStart(23, '0');

const LOAI = {
  vot: { _id: id('a'), tenLoai: 'Vợt cầu lông' },
  giay: { _id: id('a'), tenLoai: 'Giày cầu lông' },
  ao: { _id: id('a'), tenLoai: 'Áo quần thể thao' },
  pk: { _id: id('a'), tenLoai: 'Phụ kiện cầu lông' },
};
const HANG = {
  yonex: { _id: id('b'), tenHang: 'Yonex' },
  lining: { _id: id('b'), tenHang: 'Lining' },
  victor: { _id: id('b'), tenHang: 'Victor' },
};
export const KM_10 = { _id: id('c'), tenChuongTrinh: 'Giảm 10%', phanTramGiam: 10, giamToiDa: 500000, ngayBatDau: '2020-01-01', ngayKetThuc: '2099-12-31' };
export const KM_HET_HAN = { _id: id('c'), tenChuongTrinh: 'Đã hết hạn', phanTramGiam: 50, ngayBatDau: '2020-01-01', ngayKetThuc: '2020-12-31' };
const MAU = { den: { _id: id('d'), tenMau: 'Đen' } };
const size = (ten: string) => ({ _id: id('e'), tenSize: ten, loaiSize: 'x' });

interface BtMau {
  size?: string;
  ton: number;
  giaBan?: number;
  thongSo?: { doCanBang?: string; trongLuong?: string; doCung?: string };
}
interface SpMau {
  ten: string;
  loai: keyof typeof LOAI;
  hang?: keyof typeof HANG;
  gia: number;
  km?: any;
  moTa?: string;
  bienThe: BtMau[];
}

const DS: SpMau[] = [
  { ten: 'Vợt Cầu Lông Yonex Astrox 99 Pro', loai: 'vot', hang: 'yonex', gia: 4_190_000, moTa: 'Vợt tấn công cho vận động viên chuyên nghiệp.', bienThe: [
    { size: '3U', ton: 5, thongSo: { doCanBang: 'Nặng đầu', doCung: 'Cứng', trongLuong: '3U (85-89g)' } },
    { size: '4U', ton: 4, thongSo: { doCanBang: 'Nặng đầu', doCung: 'Cứng', trongLuong: '4U (80-84g)' } },
  ] },
  { ten: 'Vợt Cầu Lông Yonex Nanoflare 700', loai: 'vot', hang: 'yonex', gia: 3_000_000, moTa: 'Dòng vợt nhẹ đầu, tốc độ cao.', bienThe: [
    { size: '4U', ton: 10, thongSo: { doCanBang: 'Nhẹ đầu', doCung: 'Trung bình', trongLuong: '4U (80-84g)' } },
  ] },
  { ten: 'Vợt Cầu Lông Lining Tectonic 7', loai: 'vot', hang: 'lining', gia: 3_200_000, moTa: 'Vợt cân bằng, linh hoạt, dễ chơi, phù hợp người chơi phong trào.', bienThe: [
    { size: '4U', ton: 8, thongSo: { doCanBang: 'Cân bằng', doCung: 'Trung bình', trongLuong: '4U (80-84g)' } },
    { size: '5U', ton: 6, thongSo: { doCanBang: 'Cân bằng', doCung: 'Trung bình', trongLuong: '5U (75-79g)' } },
  ] },
  { ten: 'Vợt Cầu Lông Victor Thruster F Claw', loai: 'vot', hang: 'victor', gia: 2_150_000, km: KM_10, moTa: 'Vợt thiên công, nặng đầu.', bienThe: [
    { size: '3U', ton: 3, thongSo: { doCanBang: 'Nặng đầu', doCung: 'Cứng', trongLuong: '3U (85-89g)' } },
  ] },
  { ten: 'Vợt Cầu Lông Lining Calibar 600', loai: 'vot', hang: 'lining', gia: 3_100_000, bienThe: [
    { size: '4U', ton: 0, thongSo: { doCanBang: 'Nặng đầu', doCung: 'Trung bình', trongLuong: '4U (80-84g)' } },
  ] },
  { ten: 'Vợt Cầu Lông Yonex Arcsaber 11 Pro', loai: 'vot', hang: 'yonex', gia: 4_100_000, bienThe: [
    { size: '3U', ton: 4, thongSo: { doCanBang: 'Cân bằng', doCung: 'Cứng', trongLuong: '3U (85-89g)' } },
  ] },
  { ten: 'Giày Cầu Lông Yonex Aerus Z2', loai: 'giay', hang: 'yonex', gia: 3_000_000, bienThe: [{ size: '40', ton: 5 }, { size: '42', ton: 0 }, { size: '43', ton: 3 }] },
  { ten: 'Giày Cầu Lông Lining AYAS012', loai: 'giay', hang: 'lining', gia: 2_400_000, km: KM_HET_HAN, bienThe: [{ size: '41', ton: 2 }, { size: '42', ton: 4 }] },
  { ten: 'Áo Cầu Lông Yonex TRM3089', loai: 'ao', hang: 'yonex', gia: 119_000, km: KM_10, bienThe: [{ size: 'M', ton: 5 }, { size: 'L', ton: 0 }] },
  { ten: 'Cầu Lông Lông Vịt Thi Đấu (Ống 12 Quả)', loai: 'pk', gia: 340_000, bienThe: [{ ton: 20 }] },
  { ten: 'Dây Cuốn Cán Vợt Cầu Lông (Cuộn Đơn)', loai: 'pk', gia: 35_000, bienThe: [{ ton: 50 }] },
];

/** Trả về cặp (sản phẩm, biến thể) giống truy vấn Mongoose đã populate, dùng cho `dungKho` và cho model giả trong test service. */
export function duLieuMau() {
  const sanPhams: any[] = [];
  const bienThes: any[] = [];
  for (const m of DS) {
    const sp = { _id: id('f'), tenSanPham: m.ten, moTa: m.moTa ?? '', giaGoc: m.gia, hinhAnhDaiDien: 'anh.jpg', loai: LOAI[m.loai], hang: m.hang ? HANG[m.hang] : null, khuyenMai: m.km ?? null };
    sanPhams.push(sp);
    for (const b of m.bienThe) {
      bienThes.push({ _id: id('9'), sanPham: sp._id, giaBan: b.giaBan, soLuongTon: b.ton, mau: MAU.den, size: b.size ? size(b.size) : null, thongSo: b.thongSo });
    }
  }
  return { sanPhams, bienThes };
}

export function khoMau(): SanPhamKho[] {
  const { sanPhams, bienThes } = duLieuMau();
  return dungKho(sanPhams, bienThes, new Map(), new Date('2026-06-15T10:00:00'));
}

export const timSp = (kho: SanPhamKho[], tuKhoa: string) => kho.find((s) => s.tenChuan.includes(tuKhoa))!;
