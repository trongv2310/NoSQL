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
}
export type GioHangDocument = HydratedDocument<GioHang>;
export const GioHangSchema = SchemaFactory.createForClass(GioHang);
GioHangSchema.index({ khachHang: 1, chiTietSanPham: 1 }, { unique: true });

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
