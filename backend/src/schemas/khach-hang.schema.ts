import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

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
}
export type KhachHangDocument = HydratedDocument<KhachHang>;
export const KhachHangSchema = SchemaFactory.createForClass(KhachHang);
