import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum Quyen {
  Admin = 1,
  NhanVien = 2,
  KhachHang = 3,
}

export const TEN_QUYEN: Record<number, string> = {
  [Quyen.Admin]: 'admin',
  [Quyen.NhanVien]: 'nhanvien',
  [Quyen.KhachHang]: 'khachhang',
};

@Schema({ collection: 'taikhoans' })
export class TaiKhoan {
  @Prop({ required: true, unique: true, trim: true, maxlength: 50 })
  tenDangNhap: string;

  @Prop({ required: true })
  matKhau: string;

  @Prop({ trim: true, maxlength: 100 })
  email?: string;

  @Prop({ required: true, default: Quyen.KhachHang, index: true })
  maQuyen: number;

  @Prop({ default: () => new Date() })
  ngayTao: Date;
}
export type TaiKhoanDocument = HydratedDocument<TaiKhoan>;
export const TaiKhoanSchema = SchemaFactory.createForClass(TaiKhoan);
