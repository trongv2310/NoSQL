import { ModelDefinition } from '@nestjs/mongoose';
import { TaiKhoan, TaiKhoanSchema } from './tai-khoan.schema';
import { KhachHang, KhachHangSchema } from './khach-hang.schema';
import {
  Hang, HangSchema, KhuyenMai, KhuyenMaiSchema, LoaiSanPham, LoaiSanPhamSchema,
  MauSac, MauSacSchema, NhaCungCap, NhaCungCapSchema, Size, SizeSchema,
} from './danh-muc.schema';
import {
  ChiTietSanPham, ChiTietSanPhamSchema, LichSuThayDoiGia, LichSuThayDoiGiaSchema,
  PhanHoi, PhanHoiSchema, SanPham, SanPhamSchema,
} from './san-pham.schema';
import {
  Counter, CounterSchema, DonHang, DonHangSchema, GioHang, GioHangDongBo, GioHangDongBoDong, GioHangDongBoDongSchema, GioHangDongBoSchema, GioHangSchema,
  LogLoiGiaoTac, LogLoiGiaoTacSchema,
} from './don-hang.schema';
import { CauHinh, CauHinhSchema, TinTuc, TinTucSchema, TranDau, TranDauSchema } from './ban-tin.schema';
import { LanCang, LanCangSchema, VotCaNhan, VotCaNhanSchema } from './vot-ca-nhan.schema';
import { LichCang, LichCangSchema } from './lich-cang.schema';
import { GioiHanTanSuat, GioiHanTanSuatSchema } from './gioi-han.schema';
import { LuotXem, LuotXemSchema } from './luot-xem.schema';

export * from './tai-khoan.schema';
export * from './khach-hang.schema';
export * from './danh-muc.schema';
export * from './san-pham.schema';
export * from './don-hang.schema';
export * from './ban-tin.schema';
export * from './vot-ca-nhan.schema';
export * from './lich-cang.schema';
export * from './gioi-han.schema';
export * from './luot-xem.schema';

export const ALL_MODELS: ModelDefinition[] = [
  { name: TaiKhoan.name, schema: TaiKhoanSchema },
  { name: KhachHang.name, schema: KhachHangSchema },
  { name: LoaiSanPham.name, schema: LoaiSanPhamSchema },
  { name: NhaCungCap.name, schema: NhaCungCapSchema },
  { name: Hang.name, schema: HangSchema },
  { name: MauSac.name, schema: MauSacSchema },
  { name: Size.name, schema: SizeSchema },
  { name: KhuyenMai.name, schema: KhuyenMaiSchema },
  { name: SanPham.name, schema: SanPhamSchema },
  { name: ChiTietSanPham.name, schema: ChiTietSanPhamSchema },
  { name: LichSuThayDoiGia.name, schema: LichSuThayDoiGiaSchema },
  { name: PhanHoi.name, schema: PhanHoiSchema },
  { name: DonHang.name, schema: DonHangSchema },
  { name: GioHang.name, schema: GioHangSchema },
  { name: GioHangDongBo.name, schema: GioHangDongBoSchema },
  { name: GioHangDongBoDong.name, schema: GioHangDongBoDongSchema },
  { name: Counter.name, schema: CounterSchema },
  { name: LogLoiGiaoTac.name, schema: LogLoiGiaoTacSchema },
  { name: TranDau.name, schema: TranDauSchema },
  { name: TinTuc.name, schema: TinTucSchema },
  { name: CauHinh.name, schema: CauHinhSchema },
  { name: VotCaNhan.name, schema: VotCaNhanSchema },
  { name: LanCang.name, schema: LanCangSchema },
  { name: LichCang.name, schema: LichCangSchema },
  { name: GioiHanTanSuat.name, schema: GioiHanTanSuatSchema },
  { name: LuotXem.name, schema: LuotXemSchema },
];
