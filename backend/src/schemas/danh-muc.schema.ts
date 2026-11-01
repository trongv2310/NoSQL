import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'loaisanphams' })
export class LoaiSanPham {
  @Prop({ required: true, maxlength: 100 })
  tenLoai: string;

  @Prop({ maxlength: 255 })
  moTa?: string;
}
export type LoaiSanPhamDocument = HydratedDocument<LoaiSanPham>;
export const LoaiSanPhamSchema = SchemaFactory.createForClass(LoaiSanPham);

@Schema({ collection: 'nhacungcaps' })
export class NhaCungCap {
  @Prop({ required: true, maxlength: 100 })
  tenNhaCungCap: string;

  @Prop({ maxlength: 255 })
  diaChi?: string;

  @Prop({ maxlength: 15 })
  soDienThoai?: string;

  @Prop({ maxlength: 100 })
  email?: string;
}
export type NhaCungCapDocument = HydratedDocument<NhaCungCap>;
export const NhaCungCapSchema = SchemaFactory.createForClass(NhaCungCap);

@Schema({ collection: 'hangs' })
export class Hang {
  @Prop({ required: true, maxlength: 100 })
  tenHang: string;

  @Prop({ maxlength: 50 })
  quocGia?: string;
}
export type HangDocument = HydratedDocument<Hang>;
export const HangSchema = SchemaFactory.createForClass(Hang);

@Schema({ collection: 'mausacs' })
export class MauSac {
  @Prop({ required: true, maxlength: 50 })
  tenMau: string;
}
export type MauSacDocument = HydratedDocument<MauSac>;
export const MauSacSchema = SchemaFactory.createForClass(MauSac);

@Schema({ collection: 'sizes' })
export class Size {
  @Prop({ required: true, maxlength: 20 })
  tenSize: string;

  @Prop({ required: true, maxlength: 30 })
  loaiSize: string;
}
export type SizeDocument = HydratedDocument<Size>;
export const SizeSchema = SchemaFactory.createForClass(Size);

@Schema({ collection: 'khuyenmais' })
export class KhuyenMai {
  @Prop({ required: true, maxlength: 100 })
  tenChuongTrinh: string;

  @Prop({ maxlength: 255 })
  moTa?: string;

  @Prop({ type: Date })
  ngayBatDau?: Date;

  @Prop({ type: Date })
  ngayKetThuc?: Date;

  @Prop({ default: 0 })
  phanTramGiam: number;

  @Prop({ type: Number })
  giamToiDa?: number;

  @Prop({ type: Number })
  soLuongSuDung?: number;
}
export type KhuyenMaiDocument = HydratedDocument<KhuyenMai>;
export const KhuyenMaiSchema = SchemaFactory.createForClass(KhuyenMai);
