import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { CHAN_THUONG, LOI_CHOI, NOI_DUNG, TAY_THUAN, TOI_DA_BUOI_MOI_TUAN, TRINH_DO } from '../common/ho-so-choi';

/** Hồ sơ người chơi tự khai, nhúng trong khách hàng (xem common/ho-so-choi.ts). Mọi trường đều không bắt buộc. */
@Schema({ _id: false })
export class HoSoChoi {
  @Prop({ type: String, enum: TRINH_DO }) trinhDo?: string;
  @Prop({ type: [String], enum: NOI_DUNG, default: undefined }) noiDung?: string[];
  @Prop({ type: String, enum: LOI_CHOI }) loiChoi?: string;
  @Prop({ type: String, enum: TAY_THUAN }) tayThuan?: string;
  @Prop({ type: [String], enum: CHAN_THUONG, default: undefined }) chanThuong?: string[];
  @Prop({ type: Number, min: 0, max: TOI_DA_BUOI_MOI_TUAN }) soBuoiMoiTuan?: number;
  @Prop({ type: Date }) capNhatLuc?: Date;
}
export const HoSoChoiSchema = SchemaFactory.createForClass(HoSoChoi);

@Schema({ collection: 'khachhangs' })
export class KhachHang {
  @Prop({ required: true, trim: true, maxlength: 100 })
  hoTen: string;

  @Prop({ trim: true, maxlength: 100 })
  email?: string;

  @Prop({ trim: true, maxlength: 15, default: '' })
  soDienThoai?: string;

  @Prop({ trim: true, maxlength: 255, default: '' })
  diaChi?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TaiKhoan', unique: true, sparse: true })
  taiKhoan?: Types.ObjectId;

  @Prop({ default: () => new Date() })
  ngayTao: Date;

  @Prop({ type: HoSoChoiSchema, default: undefined })
  hoSoChoi?: HoSoChoi;
}
export type KhachHangDocument = HydratedDocument<KhachHang>;
export const KhachHangSchema = SchemaFactory.createForClass(KhachHang);
/**
 * Thống kê/so khớp theo nhóm người chơi (trình độ + nội dung đánh). SPARSE (slide 91–92): khách chưa khai hồ sơ không có hai
 * trường này nên không chiếm chỗ trong index.
 */
KhachHangSchema.index({ 'hoSoChoi.trinhDo': 1, 'hoSoChoi.noiDung': 1 }, { name: 'ho_so_choi', sparse: true });
