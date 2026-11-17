import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { thuocTinhTuThongSo, ThuocTinh } from '../catalog/thuoc-tinh';

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

  /**
   * Attribute pattern: `thongSo` đọc thành cặp { k, v } dạng số để MongoDB lọc và đánh index được (xem catalog/thuoc-tinh.ts).
   * KHÔNG ghi tay: hook bên dưới tự tính lại mỗi khi `thongSo` được tạo, thay hoặc xoá. Dữ liệu cũ thì chạy `npm run db:chuan-hoa-thong-so`.
   */
  @Prop({
    type: [{ _id: false, k: { type: String, required: true }, v: { type: MongooseSchema.Types.Mixed, required: true } }],
    default: undefined,
  })
  thuocTinh?: ThuocTinh[];
}
export type ChiTietSanPhamDocument = HydratedDocument<ChiTietSanPham>;
export const ChiTietSanPhamSchema = SchemaFactory.createForClass(ChiTietSanPham);
/** Một index cho mọi thuộc tính: lọc `{ thuocTinh: { $elemMatch: { k, v } } }` dùng được cả hai cận (k bằng, v trong khoảng). */
ChiTietSanPhamSchema.index({ 'thuocTinh.k': 1, 'thuocTinh.v': 1 }, { name: 'thuoc_tinh' });

/** Tạo mới / insertMany / save: tính `thuocTinh` từ `thongSo` (không có thông số đọc được thì bỏ hẳn trường). */
ChiTietSanPhamSchema.pre('validate', function () {
  if (this.isNew || this.isModified('thongSo')) {
    const tt = thuocTinhTuThongSo(this.thongSo as ThongSoVot | undefined);
    this.set('thuocTinh', tt.length ? tt : undefined);
  }
});

/** Cập nhật bằng truy vấn: đặt/xoá `thongSo` thì đặt/xoá `thuocTinh` trong CÙNG lệnh, nên hai trường không bao giờ lệch nhau. */
ChiTietSanPhamSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function () {
  const u = this.getUpdate() as Record<string, any> | null;
  if (!u || Array.isArray(u)) return;
  const set: Record<string, any> = { ...u.$set };
  if ('thongSo' in u) {
    set.thongSo = u.thongSo; // cập nhật không có toán tử: Mongoose coi các khoá ở ngoài như $set
    delete u.thongSo;
  }
  if (Object.keys(set).some((k) => k.startsWith('thongSo.'))) {
    throw new Error('Không sửa lẻ thongSo.<trường>: hãy đặt lại cả thongSo để thuocTinh được tính lại cùng lúc.');
  }
  if ('thongSo' in set) {
    const tt = thuocTinhTuThongSo(set.thongSo);
    if (tt.length) set.thuocTinh = tt;
    else u.$unset = { ...u.$unset, thuocTinh: '' };
    u.$set = set;
  } else if (u.$unset && 'thongSo' in u.$unset) {
    u.$unset.thuocTinh = '';
  }
  this.setUpdate(u);
});

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
  /**
   * true = đánh giá do khách gửi qua tài khoản trên hệ thống. Dữ liệu mẫu/import cũ không có cờ này nên bị coi là chưa xác minh:
   * vẫn nằm trong DB (không xóa) nhưng không được hiển thị công khai hay tính vào điểm trung bình.
   */
  @Prop({ default: false, index: true }) daXacMinh: boolean;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'KhachHang' }) khachHang?: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SanPham', required: true, index: true }) sanPham: Types.ObjectId;
}
export type PhanHoiDocument = HydratedDocument<PhanHoi>;
export const PhanHoiSchema = SchemaFactory.createForClass(PhanHoi);
