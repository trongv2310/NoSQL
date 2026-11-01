import mongoose, { Model, Types } from 'mongoose';
import { giaBienThe } from '../common/pricing';
import { ALL_MODELS, Quyen, TRANG_THAI } from '../schemas';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type LegacyData = Record<string, Record<string, any>[]>;

const SO_NGUYEN_TO_BOOL = (v: unknown) => v === true || v === 1 || v === '1';

/** Chuỗi 'YYYY-MM-DD[ HH:mm:ss]' của MySQL (giờ Việt Nam) -> Date. */
export function parseNgay(v: unknown): Date | undefined {
  if (!v) {
    return undefined;
  }
  const s = String(v).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00+07:00` : s.replace(' ', 'T') + '+07:00';
  const d = new Date(iso);
  return isNaN(+d) ? undefined : d;
}

/** PRNG có seed để dữ liệu đơn mẫu giống nhau giữa các lần chạy. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function model(name: string): Model<any> {
  const def = ALL_MODELS.find((m) => m.name === name);
  if (!def) {
    throw new Error(`Không có model ${name}`);
  }
  return (mongoose.models[name] as Model<any>) ?? mongoose.model(name, def.schema as any);
}

/**
 * Nhập dữ liệu từ định dạng bảng của bản Laravel (khóa chính MaXxx dạng số) vào MongoDB,
 * đổi các khóa ngoại số sang ObjectId. Hàm không xóa dữ liệu hiện có – xem cờ `reset` ở seed.ts.
 */
export async function importLegacy(data: LegacyData, options: { donMau?: boolean } = {}) {
  const map: Record<string, Map<number, Types.ObjectId>> = {};
  const newId = (bang: string, ma: number) => {
    map[bang] ??= new Map();
    if (!map[bang].has(ma)) {
      map[bang].set(ma, new Types.ObjectId());
    }
    return map[bang].get(ma)!;
  };
  const ref = (bang: string, ma: unknown) => (ma === null || ma === undefined ? undefined : newId(bang, Number(ma)));
  const rows = (bang: string) => data[bang] ?? [];
  const dem: Record<string, number> = {};
  const chen = async (ten: string, docs: any[]) => {
    if (docs.length) {
      await model(ten).insertMany(docs, { ordered: true });
    }
    dem[ten] = docs.length;
  };

  await chen('LoaiSanPham', rows('LoaiSanPham').map((r) => ({ _id: newId('LoaiSanPham', r.MaLoai), tenLoai: r.TenLoai, moTa: r.MoTa })));
  await chen('NhaCungCap', rows('NhaCungCap').map((r) => ({
    _id: newId('NhaCungCap', r.MaNhaCungCap), tenNhaCungCap: r.TenNhaCungCap, diaChi: r.DiaChi, soDienThoai: r.SoDienThoai, email: r.Email,
  })));
  await chen('Hang', rows('Hang').map((r) => ({ _id: newId('Hang', r.MaHang), tenHang: r.TenHang, quocGia: r.QuocGia })));
  await chen('MauSac', rows('MauSac').map((r) => ({ _id: newId('MauSac', r.MaMau), tenMau: r.TenMau })));
  await chen('Size', rows('Size').map((r) => ({ _id: newId('Size', r.MaSize), tenSize: r.TenSize, loaiSize: r.LoaiSize })));
  await chen('KhuyenMai', rows('KhuyenMai').map((r) => ({
    _id: newId('KhuyenMai', r.MaKhuyenMai), tenChuongTrinh: r.TenChuongTrinh, moTa: r.MoTa,
    ngayBatDau: parseNgay(r.NgayBatDau), ngayKetThuc: parseNgay(r.NgayKetThuc),
    phanTramGiam: Number(r.PhanTramGiam ?? 0), giamToiDa: r.GiamToiDa ?? undefined, soLuongSuDung: r.SoLuongSuDung ?? undefined,
  })));

  await chen('TaiKhoan', rows('TaiKhoan').map((r) => ({
    _id: newId('TaiKhoan', r.MaTaiKhoan), tenDangNhap: r.TenDangNhap, matKhau: r.MatKhau, email: r.Email,
    maQuyen: Number(r.MaQuyen ?? Quyen.KhachHang), ngayTao: parseNgay(r.NgayTao) ?? new Date(),
  })));
  await chen('KhachHang', rows('KhachHang').map((r) => ({
    _id: newId('KhachHang', r.MaKhachHang), hoTen: r.HoTen, email: r.Email, soDienThoai: r.SoDienThoai ?? '', diaChi: r.DiaChi ?? '',
    taiKhoan: ref('TaiKhoan', r.MaTaiKhoan), ngayTao: parseNgay(r.NgayTao) ?? new Date(),
  })));

  await chen('SanPham', rows('SanPham').map((r) => ({
    _id: newId('SanPham', r.MaSanPham), tenSanPham: r.TenSanPham, moTa: r.MoTa, giaGoc: Number(r.GiaGoc ?? 0),
    hinhAnhDaiDien: r.HinhAnhDaiDien || 'default-product.jpg',
    loai: ref('LoaiSanPham', r.MaLoai), nhaCungCap: ref('NhaCungCap', r.MaNhaCungCap), hang: ref('Hang', r.MaHang),
    khuyenMai: ref('KhuyenMai', r.MaKhuyenMai) ?? null,
    coSize: SO_NGUYEN_TO_BOOL(r.CoSize), coMau: SO_NGUYEN_TO_BOOL(r.CoMau),
    ngayTao: parseNgay(r.NgayTao) ?? new Date(), deletedAt: parseNgay(r.deleted_at) ?? null,
  })));

  const thongSoTheoBienThe = new Map<number, any>();
  for (const t of rows('ThongSoVot')) {
    thongSoTheoBienThe.set(Number(t.MaChiTiet), {
      doCanBang: t.DoCanBang, trongLuong: t.TrongLuong, doCung: t.DoCung, chieuDai: t.ChieuDai, sucCang: t.SucCang,
    });
  }
  await chen('ChiTietSanPham', rows('ChiTietSanPham').map((r) => ({
    _id: newId('ChiTietSanPham', r.MaChiTiet), sanPham: ref('SanPham', r.MaSanPham), mau: ref('MauSac', r.MaMau), size: ref('Size', r.MaSize),
    giaBan: r.GiaBan ?? undefined, soLuongTon: Number(r.SoLuongTon ?? 0), sku: r.SKU, hinhAnh: r.HinhAnh ?? undefined,
    thongSo: thongSoTheoBienThe.get(Number(r.MaChiTiet)),
  })));

  await chen('PhanHoi', rows('PhanHoi').map((r) => ({
    noiDung: r.NoiDung, ngayPhanHoi: parseNgay(r.NgayPhanHoi) ?? new Date(), danhGia: Number(r.DanhGia ?? 5),
    khachHang: ref('KhachHang', r.MaKhachHang), sanPham: ref('SanPham', r.MaSanPham),
  })));

  await chen('TranDau', rows('TranDau').map((r) => ({
    _id: newId('TranDau', r.MaTranDau), tenGiaiDau: r.TenGiaiDau, vong: r.Vong, noiDung: r.NoiDung, doiA: r.DoiA, doiB: r.DoiB,
    tiSo: r.TiSo ?? undefined, doiThang: r.DoiThang ?? null, ngayThiDau: parseNgay(r.NgayThiDau), diaDiem: r.DiaDiem,
    nguonTin: r.NguonTin, lienKetNguon: r.LienKetNguon,
  })));
  await chen('TinTuc', rows('TinTuc').map((r) => ({
    tieuDe: r.TieuDe, tomTat: r.TomTat, noiDung: r.NoiDung, hinhAnh: r.HinhAnh ?? undefined, loaiTin: r.LoaiTin,
    sanPham: ref('SanPham', r.MaSanPham), tranDau: ref('TranDau', r.MaTranDau), tacGia: ref('TaiKhoan', r.MaTaiKhoan),
    nguonTin: r.NguonTin, lienKetNguon: r.LienKetNguon, noiBat: SO_NGUYEN_TO_BOOL(r.NoiBat), hienThi: r.HienThi === undefined ? true : SO_NGUYEN_TO_BOOL(r.HienThi),
    thuTu: Number(r.ThuTu ?? 1), luotXem: Number(r.LuotXem ?? 0), ngayDang: parseNgay(r.NgayDang) ?? new Date(), deletedAt: parseNgay(r.deleted_at) ?? null,
  })));

  await chen('CauHinh', [
    { khoa: 'logo_url', giaTri: 'images/HUIT.jpg', moTa: 'Đường dẫn logo hệ thống' },
    { khoa: 'site_name', giaTri: 'Shop Cầu Lông', moTa: 'Tên thương hiệu hệ thống' },
    { khoa: 'site_description', giaTri: 'Cửa hàng dụng cụ và phụ kiện cầu lông chính hãng', moTa: 'Mô tả ngắn gọn hệ thống' },
  ]);

  // Đơn hàng: nhập từ dữ liệu cũ nếu có, ngược lại (tùy chọn) sinh đơn mẫu cho trang thống kê.
  const donLegacy = rows('DonHang');
  if (donLegacy.length) {
    const ct = rows('ChiTietDonHang');
    const bienThes = await model('ChiTietSanPham').find().populate('sanPham mau size').lean();
    const bt = new Map(bienThes.map((b: any) => [String(b._id), b]));
    await chen('DonHang', donLegacy.map((d) => ({
      soDonHang: Number(d.MaDonHang), ngayDat: parseNgay(d.NgayDat) ?? new Date(), trangThai: d.TrangThai,
      tongTien: Number(d.TongTien ?? 0), tongTienSauGiam: Number(d.TongTienSauGiam ?? 0), tienGiam: Number(d.TienGiam ?? 0),
      khachHang: ref('KhachHang', d.MaKhachHang), diaChiGiaoHang: d.DiaChiGiaoHang, soDienThoaiNhanHang: d.SoDienThoaiNhanHang, ghiChu: d.GhiChu,
      chiTiet: ct.filter((c) => c.MaDonHang === d.MaDonHang).map((c) => {
        const b: any = bt.get(String(ref('ChiTietSanPham', c.MaChiTietSanPham)));
        return {
          chiTietSanPham: ref('ChiTietSanPham', c.MaChiTietSanPham), sanPham: b?.sanPham?._id, tenSanPham: b?.sanPham?.tenSanPham,
          hinhAnh: b?.hinhAnh || b?.sanPham?.hinhAnhDaiDien, sku: b?.sku, tenMau: b?.mau?.tenMau, tenSize: b?.size?.tenSize,
          soLuong: Number(c.SoLuong ?? 1), donGia: Number(c.DonGia ?? 0), thanhTien: Number(c.ThanhTien ?? 0),
        };
      }),
    })));
  } else if (options.donMau) {
    dem.DonHang = await taoDonMau();
  }
  const max = await model('DonHang').findOne().sort({ soDonHang: -1 }).lean();
  await model('Counter').updateOne({ _id: 'donhang' }, { $set: { seq: (max as any)?.soDonHang ?? 0 } }, { upsert: true });
  return dem;
}

/** 24 đơn mẫu rải trong năm hiện tại (tương đương DonHangMauSeeder của bản Laravel). */
async function taoDonMau(): Promise<number> {
  const rnd = mulberry32(2026);
  const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const khachs = await model('TaiKhoan').find({ maQuyen: Quyen.KhachHang }).lean();
  const khachHangs = await model('KhachHang').find({ taiKhoan: { $in: khachs.map((k: any) => k._id) } }).lean();
  const bienThes: any[] = await model('ChiTietSanPham').find().populate([{ path: 'sanPham', populate: 'khuyenMai' }, 'mau', 'size']).lean();
  if (!khachHangs.length || !bienThes.length) {
    return 0;
  }
  const trangThais = ['Đã hoàn thành', 'Đã hoàn thành', 'Đã hoàn thành', 'Đang giao hàng', 'Đang xử lý', 'Đã hủy'];
  const now = new Date();
  const nam = now.getFullYear();
  const thangHienTai = now.getMonth() + 1;
  const don: any[] = [];
  for (let i = 0; i < 24; i++) {
    const thang = ri(1, thangHienTai);
    const ngay = Math.min(ri(1, 28), thang === thangHienTai ? now.getDate() : 28);
    const ngayDat = new Date(Date.UTC(nam, thang - 1, ngay, ri(8, 21) - 7, ri(0, 59)));
    const chon = [...bienThes].sort(() => rnd() - 0.5).slice(0, ri(1, 3));
    const chiTiet = chon.map((b) => {
      const soLuong = ri(1, 2);
      const donGia = giaBienThe(b, b.sanPham);
      return {
        chiTietSanPham: b._id, sanPham: b.sanPham?._id, tenSanPham: b.sanPham?.tenSanPham, hinhAnh: b.hinhAnh || b.sanPham?.hinhAnhDaiDien,
        sku: b.sku, tenMau: b.mau?.tenMau, tenSize: b.size?.tenSize, soLuong, donGia, thanhTien: donGia * soLuong,
      };
    });
    const tong = chiTiet.reduce((t, c) => t + c.thanhTien, 0);
    don.push({
      soDonHang: i + 1, ngayDat, trangThai: trangThais[ri(0, trangThais.length - 1)], tongTien: tong, tongTienSauGiam: tong, tienGiam: 0,
      khachHang: (khachHangs[ri(0, khachHangs.length - 1)] as any)._id,
      diaChiGiaoHang: '140 Lê Trọng Tấn, Tây Thạnh, Tân Phú, TP.HCM', soDienThoaiNhanHang: '0901234567', ghiChu: 'Đơn hàng mẫu', chiTiet,
    });
  }
  await model('DonHang').insertMany(don);
  return don.length;
}

export const TEN_BANG_CAN_XOA = ALL_MODELS.map((m) => m.name);
export { TRANG_THAI };
