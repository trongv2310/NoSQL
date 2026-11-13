import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const TRANG_THAI = {
  ChoXacNhan: 'Chờ xác nhận',
  ChoThanhToanMomo: 'Chờ thanh toán MoMo',
  DaThanhToanMomo: 'Đã thanh toán bằng MoMo',
  DangXuLy: 'Đang xử lý',
  DangGiao: 'Đang giao hàng',
  HoanThanh: 'Đã hoàn thành',
  DaHuy: 'Đã hủy',
  DaHuyThanhToanThatBai: 'Đã hủy (Thanh toán thất bại)',
} as const;

/** Dòng hàng nhúng trong đơn: lưu ảnh chụp tên/SKU/giá tại thời điểm đặt. */
@Schema({ _id: true })
export class ChiTietDonHang {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ChiTietSanPham' }) chiTietSanPham?: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SanPham' }) sanPham?: Types.ObjectId;
  @Prop() tenSanPham?: string;
  @Prop() hinhAnh?: string;
  @Prop() sku?: string;
  @Prop() tenMau?: string;
  @Prop() tenSize?: string;
  @Prop({ default: 1 }) soLuong: number;
  @Prop({ default: 0 }) donGia: number;
  @Prop({ default: 0 }) thanhTien: number;
}
export const ChiTietDonHangSchema = SchemaFactory.createForClass(ChiTietDonHang);

@Schema({ collection: 'donhangs' })
export class DonHang {
  /** Mã đơn dạng số tăng dần để hiển thị (#12) và làm orderId gửi MoMo. */
  @Prop({ required: true, unique: true })
  soDonHang: number;

  @Prop({ default: () => new Date(), index: true }) ngayDat: Date;
  @Prop({ default: TRANG_THAI.DangXuLy, index: true }) trangThai: string;
  @Prop({ default: 0 }) tongTien: number;
  @Prop({ default: 0 }) tongTienSauGiam: number;
  @Prop({ default: 0 }) tienGiam: number;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'KhachHang', index: true }) khachHang?: Types.ObjectId;
  /** Tên người nhận hàng nhập ở bước thanh toán (có thể khác chủ tài khoản). Đơn cũ không có trường này. */
  @Prop({ maxlength: 100 }) hoTenNhan?: string;
  @Prop({ maxlength: 255 }) diaChiGiaoHang?: string;
  @Prop({ maxlength: 15 }) soDienThoaiNhanHang?: string;
  @Prop({ maxlength: 500 }) ghiChu?: string;
  @Prop({ type: [ChiTietDonHangSchema], default: [] }) chiTiet: ChiTietDonHang[];
}
export type DonHangDocument = HydratedDocument<DonHang>;
export const DonHangSchema = SchemaFactory.createForClass(DonHang);

@Schema({ collection: 'giohangs' })
export class GioHang {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'KhachHang', required: true, index: true })
  khachHang: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ChiTietSanPham', required: true })
  chiTietSanPham: Types.ObjectId;

  @Prop({ default: 1, min: 1 }) soLuong: number;
  @Prop({ default: () => new Date() }) ngayThem: Date;

  /**
   * Các lần đồng bộ giỏ khách (syncId) đã được cộng vào dòng này, kèm thời điểm. Là chốt chặn NGUYÊN TỬ để một lần đồng bộ chỉ cộng
   * vào dòng đúng một lần dù bị gửi lại hoặc gửi song song (điều kiện `dongBo.t != syncId` nằm cùng thao tác cộng số lượng).
   * Mã KHÔNG bị loại theo số lượng (loại theo số lượng từng làm một biên nhận dở dang cộng đôi); chỉ bỏ mã quá `HAN_MA_DONG_BO_MS`
   * (bằng thời hạn của biên nhận) và có trần số lượng, quá trần thì từ chối chứ không âm thầm bỏ mã.
   * Sổ cái `GioHangDongBoDong` giữ phần "đã cộng" khi dòng giỏ bị khách xóa (xóa dòng sẽ mất cả mã ở đây).
   */
  @Prop({ type: [{ _id: false, t: String, ts: Date }], default: undefined }) dongBo?: { t: string; ts: Date }[];

  /**
   * Dòng đã bị khách xóa nhưng còn giữ lại vì đang mang mã đồng bộ (xem `xoaDongGio`). Không hiển thị, không đếm, không đưa vào đơn.
   * Thêm lại hoặc đồng bộ bằng mã mới sẽ kích hoạt lại dòng (số lượng tính từ 0). Dòng cũ không có trường này là dòng hoạt động.
   */
  @Prop({ type: Boolean, default: undefined }) daXoa?: boolean;
  /** Thời điểm xóa; chỉ mục TTL gỡ vật lý dòng đã xóa sau 30 ngày (dài hơn thời hạn gửi lại 14 ngày của trình duyệt). */
  @Prop({ type: Date, default: undefined }) ngayXoa?: Date;
}
export type GioHangDocument = HydratedDocument<GioHang>;
export const GioHangSchema = SchemaFactory.createForClass(GioHang);
GioHangSchema.index({ khachHang: 1, chiTietSanPham: 1 }, { unique: true });
GioHangSchema.index({ ngayXoa: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

/**
 * Dấu vết một lần đồng bộ giỏ khách sau đăng nhập (một bản ghi cho mỗi cặp khách hàng + syncId).
 * `dau` là băm nội dung đã gộp: cùng syncId mà nội dung khác thì bị từ chối thay vì âm thầm bỏ qua.
 * `trangThai` chỉ thành "xong" sau khi mọi dòng đã được áp dụng; "dang_xu_ly" nghĩa là lần trước có thể đã ghi dở.
 */
@Schema({ collection: 'giohang_dongbo' })
export class GioHangDongBo {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'KhachHang', required: true }) khachHang: Types.ObjectId;
  @Prop({ required: true, maxlength: 64 }) syncId: string;
  @Prop({ required: true, maxlength: 64 }) dau: string;
  @Prop({ required: true, enum: ['dang_xu_ly', 'xong'], default: 'dang_xu_ly' }) trangThai: string;
  @Prop({ default: () => new Date() }) ngayTao: Date;
}
export type GioHangDongBoDocument = HydratedDocument<GioHangDongBo>;
export const GioHangDongBoSchema = SchemaFactory.createForClass(GioHangDongBo);
GioHangDongBoSchema.index({ khachHang: 1, syncId: 1 }, { unique: true });
// Dấu vết chỉ cần đủ lâu để chặn các lần gửi lại; tự xóa sau 30 ngày.
GioHangDongBoSchema.index({ ngayTao: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

/**
 * Sổ cái từng dòng của một lần đồng bộ: "mã syncId này đã cộng biến thể này vào giỏ của khách này". Khác mã trên dòng giỏ, bản ghi này
 * KHÔNG mất khi khách xóa dòng giỏ, nên gửi lại một biên nhận dở dang không làm dòng đã xóa sống lại. Ghi ngay sau khi cộng.
 */
@Schema({ collection: 'giohang_dongbo_dong' })
export class GioHangDongBoDong {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'KhachHang', required: true }) khachHang: Types.ObjectId;
  @Prop({ required: true, maxlength: 64 }) syncId: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ChiTietSanPham', required: true }) chiTiet: Types.ObjectId;
  @Prop({ default: 0 }) daThem: number;
  @Prop({ default: () => new Date() }) ngayTao: Date;
}
export type GioHangDongBoDongDocument = HydratedDocument<GioHangDongBoDong>;
export const GioHangDongBoDongSchema = SchemaFactory.createForClass(GioHangDongBoDong);
GioHangDongBoDongSchema.index({ khachHang: 1, syncId: 1, chiTiet: 1 }, { unique: true });
// Cùng thời hạn với biên nhận (30 ngày); trình duyệt bỏ bản chụp chờ sau 14 ngày nên không bao giờ gửi lại mã đã hết hạn ở đây.
GioHangDongBoDongSchema.index({ ngayTao: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

@Schema({ collection: 'counters' })
export class Counter {
  @Prop({ required: true }) _id: string;
  @Prop({ default: 0 }) seq: number;
}
export type CounterDocument = HydratedDocument<Counter>;
export const CounterSchema = SchemaFactory.createForClass(Counter);

@Schema({ collection: 'logloigiaotacs' })
export class LogLoiGiaoTac {
  @Prop({ default: () => new Date() }) thoiGian: Date;
  @Prop() noiDungLoi?: string;
  @Prop({ maxlength: 100 }) maGiaoTac?: string;
}
export type LogLoiGiaoTacDocument = HydratedDocument<LogLoiGiaoTac>;
export const LogLoiGiaoTacSchema = SchemaFactory.createForClass(LogLoiGiaoTac);
