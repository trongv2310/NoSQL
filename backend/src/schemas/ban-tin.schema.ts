import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Loại tin -> [nhãn hiển thị, icon FontAwesome]. */
export const LOAI_TIN: Record<string, [string, string]> = {
  'san-pham-hot': ['Sản phẩm hot', 'fa-fire'],
  'san-pham-moi': ['Sản phẩm mới', 'fa-star'],
  'tran-dau': ['Trận đấu', 'fa-trophy'],
  'tuyen-thu': ['Tuyển thủ', 'fa-user-large'],
  'giai-dau': ['Giải đấu', 'fa-medal'],
};

@Schema({ collection: 'trandaus' })
export class TranDau {
  @Prop({ required: true, maxlength: 150 }) tenGiaiDau: string;
  @Prop({ required: true, maxlength: 60 }) vong: string;
  @Prop({ required: true, maxlength: 60 }) noiDung: string;
  @Prop({ required: true, maxlength: 150 }) doiA: string;
  @Prop({ required: true, maxlength: 150 }) doiB: string;
  @Prop({ maxlength: 60 }) tiSo?: string;
  @Prop({ type: String, enum: ['A', 'B'], default: null }) doiThang?: string | null;
  @Prop({ required: true, index: true }) ngayThiDau: Date;
  @Prop({ maxlength: 120 }) diaDiem?: string;
  @Prop({ maxlength: 150 }) nguonTin?: string;
  @Prop({ maxlength: 300 }) lienKetNguon?: string;
}
export type TranDauDocument = HydratedDocument<TranDau>;
export const TranDauSchema = SchemaFactory.createForClass(TranDau);

@Schema({ collection: 'tintucs' })
export class TinTuc {
  @Prop({ required: true, maxlength: 200 }) tieuDe: string;
  @Prop({ maxlength: 500 }) tomTat?: string;
  @Prop({ required: true }) noiDung: string;
  @Prop() hinhAnh?: string;
  @Prop({ required: true, index: true }) loaiTin: string;
  @Prop({ type: Types.ObjectId, ref: 'SanPham' }) sanPham?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'TranDau' }) tranDau?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'TaiKhoan' }) tacGia?: Types.ObjectId;
  @Prop({ maxlength: 150 }) nguonTin?: string;
  @Prop({ maxlength: 300 }) lienKetNguon?: string;
  @Prop({ default: false }) noiBat: boolean;
  @Prop({ default: true }) hienThi: boolean;
  @Prop({ default: 1 }) thuTu: number;
  @Prop({ default: 0 }) luotXem: number;
  @Prop({ default: () => new Date(), index: true }) ngayDang: Date;
  @Prop({ type: Date, default: null, index: true }) deletedAt?: Date | null;
}
export type TinTucDocument = HydratedDocument<TinTuc>;
export const TinTucSchema = SchemaFactory.createForClass(TinTuc);

@Schema({ collection: 'cauhinhs', timestamps: true })
export class CauHinh {
  @Prop({ required: true, unique: true, maxlength: 60 }) khoa: string;
  @Prop() giaTri?: string;
  @Prop({ maxlength: 255 }) moTa?: string;
}
export type CauHinhDocument = HydratedDocument<CauHinh>;
export const CauHinhSchema = SchemaFactory.createForClass(CauHinh);
