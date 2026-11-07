import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ collection: 'sanphams' })
export class SanPham {
  @Prop({ required: true, maxlength: 100, index: true })
  tenSanPham: string;

  @Prop({ maxlength: 5000 })
  moTa?: string;

  @Prop({ default: 0 })
  giaGoc: number;

  @Prop({ default: 'default-product.jpg' })
  hinhAnhDaiDien: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'LoaiSanPham', index: true })
  loai?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'NhaCungCap' })
  nhaCungCap?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Hang', index: true })
  hang?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'KhuyenMai', index: true })
  khuyenMai?: Types.ObjectId;

  @Prop({ default: false })
  coSize: boolean;

  @Prop({ default: false })
  coMau: boolean;

  @Prop({ default: () => new Date(), index: true })
  ngayTao: Date;

  /** Xóa mềm: khác null nghĩa là sản phẩm đã ngừng kinh doanh. */
  @Prop({ type: Date, default: null, index: true })
  deletedAt?: Date | null;
}
export type SanPhamDocument = HydratedDocument<SanPham>;
export const SanPhamSchema = SchemaFactory.createForClass(SanPham);

@Schema({ _id: false })
export class ThongSoVot {
  @Prop() doCanBang?: string;
  @Prop() trongLuong?: string;
  @Prop() doCung?: string;
  @Prop() chieuDai?: string;
  @Prop() sucCang?: string;
}
export const ThongSoVotSchema = SchemaFactory.createForClass(ThongSoVot);

/** Biến thể (màu/size/SKU) của sản phẩm, kèm thông số vợt được nhúng trực tiếp. */
@Schema({ collection: 'chitietsanphams' })
export class ChiTietSanPham {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SanPham', required: true, index: true })
  sanPham: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'MauSac' })
  mau?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Size' })
  size?: Types.ObjectId;

  @Prop({ type: Number })
  giaBan?: number;

  @Prop({ default: 0, min: 0 })
  soLuongTon: number;

  @Prop({ required: true, unique: true, maxlength: 50 })
  sku: string;

  @Prop()
  hinhAnh?: string;

  @Prop({ type: ThongSoVotSchema })
  thongSo?: ThongSoVot;
}
export type ChiTietSanPhamDocument = HydratedDocument<ChiTietSanPham>;
export const ChiTietSanPhamSchema = SchemaFactory.createForClass(ChiTietSanPham);

@Schema({ collection: 'lichsuthaydoigias' })
export class LichSuThayDoiGia {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ChiTietSanPham', index: true })
  chiTiet: Types.ObjectId;

  @Prop({ type: Number }) giaCu?: number;
  @Prop({ type: Number }) giaMoi?: number;
  @Prop({ default: () => new Date() }) ngayThayDoi: Date;
  @Prop({ maxlength: 50 }) nguoiThayDoi?: string;
}
export type LichSuThayDoiGiaDocument = HydratedDocument<LichSuThayDoiGia>;
export const LichSuThayDoiGiaSchema = SchemaFactory.createForClass(LichSuThayDoiGia);

@Schema({ collection: 'phanhois' })
export class PhanHoi {
  @Prop({ maxlength: 255 }) noiDung?: string;
  @Prop({ default: () => new Date(), index: true }) ngayPhanHoi: Date;
  @Prop({ default: 5, min: 1, max: 5, index: true }) danhGia: number;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'KhachHang' }) khachHang?: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SanPham', index: true }) sanPham: Types.ObjectId;
}
export type PhanHoiDocument = HydratedDocument<PhanHoi>;
export const PhanHoiSchema = SchemaFactory.createForClass(PhanHoi);
