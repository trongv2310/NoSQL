import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { DON_VI_CANG } from './vot-ca-nhan.schema';

/**
 * Mỗi khung giờ là một document có sức chứa và mảng `datCho`.
 * Đặt chỗ dùng cập nhật nguyên tử có điều kiện. Index unique trên `ngay` bảo vệ thao tác upsert.
 */
export const TRANG_THAI_DAT_CHO = ['cho', 'xong', 'huy'] as const;
export const SUC_CHUA_MAC_DINH = 2;

@Schema({ _id: true })
export class DatChoCang {
  _id: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'KhachHang', required: true }) khachHang: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'VotCaNhan', required: true }) votCaNhan: Types.ObjectId;
  @Prop({ type: String, maxlength: 80 }) tenVot?: string;
  @Prop({ type: String, maxlength: 100 }) tenKhach?: string;
  @Prop({ type: Number, required: true }) mucCangLbs: number;
  @Prop({ type: Number, required: true }) giaTriNhap: number;
  @Prop({ type: String, enum: DON_VI_CANG, required: true }) donViNhap: string;
  @Prop({ type: String, maxlength: 60 }) tenDay?: string;
  @Prop({ type: String, enum: TRANG_THAI_DAT_CHO, default: 'cho' }) trangThai: string;
  /** Lần căng đã ghi vào sổ khi nhân viên bấm hoàn tất (để tra ngược). */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'LanCang' }) lanCang?: Types.ObjectId;
  @Prop({ type: Date, default: () => new Date() }) taoLuc: Date;
}
export const DatChoCangSchema = SchemaFactory.createForClass(DatChoCang);

@Schema({ collection: 'lichcangs' })
export class LichCang {
  /** Giờ bắt đầu khung (UTC). Unique: mỗi khung đúng một document. */
  @Prop({ type: Date, required: true }) ngay: Date;
  @Prop({ type: Number, required: true, min: 1, max: 10 }) sucChua: number;
  /** Số chỗ đang giữ (chờ + đã xong), luôn bằng số phần tử datCho có trạng thái khác "huy" (validator $expr kiểm). */
  @Prop({ type: Number, required: true, min: 0 }) soDaDat: number;
  @Prop({ type: [DatChoCangSchema], default: [] }) datCho: DatChoCang[];
}
export type LichCangDocument = HydratedDocument<LichCang>;
export const LichCangSchema = SchemaFactory.createForClass(LichCang);
LichCangSchema.index({ ngay: 1 }, { name: 'khung_gio', unique: true });
/** "Lịch của tôi": tìm khung có chỗ của một khách (multikey trên mảng nhúng). */
LichCangSchema.index({ 'datCho.khachHang': 1, ngay: -1 }, { name: 'dat_cho_cua_khach' });
