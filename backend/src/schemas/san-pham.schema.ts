import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { thuocTinhTuThongSo, ThuocTinh } from '../catalog/thuoc-tinh';
import { dungTruongTimKiem } from '../catalog/tim-kiem';
import { THE_DANH_GIA } from '../common/danh-gia';
import { CHAN_THUONG, LOI_CHOI, NOI_DUNG, TRINH_DO } from '../common/ho-so-choi';

@Schema({ _id: false })
export class DanhGiaTongHop {
  @Prop({ type: Number, default: 0 }) so: number;
  @Prop({ type: Number, default: 0 }) tong: number;
  @Prop({ type: Number, default: null }) trungBinh?: number | null;
}
export const DanhGiaTongHopSchema = SchemaFactory.createForClass(DanhGiaTongHop);

@Schema({ _id: false })
export class TimKiem {
  @Prop({ type: String, required: true }) chuoi: string;
  @Prop({ type: [String], default: undefined }) tu: string[];
  @Prop({ type: [String], default: undefined }) baKyTu: string[];
}
export const TimKiemSchema = SchemaFactory.createForClass(TimKiem);

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

  /**
   * Xóa mềm: khác null nghĩa là sản phẩm đã ngừng kinh doanh. Không đánh index riêng trường này: index MỘT PHẦN `dang_ban_moi_nhat`
   * bên dưới chỉ chứa sản phẩm chưa xóa, đúng tập mà cửa hàng luôn đọc.
   */
  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  /** Computed pattern: tổng hợp đánh giá công khai thật (xem phan-hoi/tong-hop-danh-gia.ts). */
  @Prop({ type: DanhGiaTongHopSchema, default: undefined })
  danhGiaTongHop?: DanhGiaTongHop;

  /** Tên đã chuẩn hoá cho tìm kiếm (không dấu, tách từ, bộ ba ký tự). Hook bên dưới tự dựng; xem catalog/tim-kiem.ts. */
  @Prop({ type: TimKiemSchema, default: undefined })
  timKiem?: TimKiem;
}
export type SanPhamDocument = HydratedDocument<SanPham>;
export const SanPhamSchema = SchemaFactory.createForClass(SanPham);
/**
 * Partial index: chỉ sản phẩm đang bán (deletedAt null), theo đúng thứ tự trang danh sách dùng (mới nhất trước).
 * Truy vấn `{ deletedAt: null }` + sort này đọc thẳng index; sản phẩm đã xóa không chiếm chỗ trong index.
 */
SanPhamSchema.index({ ngayTao: -1, _id: -1 }, { name: 'dang_ban_moi_nhat', partialFilterExpression: { deletedAt: null } });

/**
 * Tìm kiếm (catalog/tim-kiem.ts). Cả ba index đều MỘT PHẦN như trên: sản phẩm đã xoá không nằm trong index, truy vấn luôn kèm
 * `deletedAt: null`. Mỗi collection chỉ được MỘT text index; default_language 'none' vì MongoDB không có bộ tách gốc từ tiếng Việt
 * (và không bỏ "từ dừng" của tiếng Anh như "the", "a").
 */
SanPhamSchema.index(
  { 'timKiem.chuoi': 'text', moTa: 'text' },
  { name: 'tim_kiem_toan_van', weights: { 'timKiem.chuoi': 10, moTa: 1 }, default_language: 'none', partialFilterExpression: { deletedAt: null } },
);
SanPhamSchema.index({ 'timKiem.tu': 1 }, { name: 'tu_khoa_tien_to', partialFilterExpression: { deletedAt: null } });
SanPhamSchema.index({ 'timKiem.baKyTu': 1 }, { name: 'ba_ky_tu', partialFilterExpression: { deletedAt: null } });

/** Tạo mới / insertMany / save: dựng `timKiem` từ tên. */
SanPhamSchema.pre('validate', function () {
  if (this.isNew || this.isModified('tenSanPham')) this.set('timKiem', dungTruongTimKiem(this.tenSanPham));
});

/** Đổi tên bằng truy vấn cập nhật: đặt `timKiem` trong CÙNG lệnh nên tên và trường tìm kiếm không lệch nhau. */
SanPhamSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function () {
  const u = this.getUpdate() as Record<string, any> | null;
  if (!u || Array.isArray(u)) return; // update pipeline (vd. cộng điểm đánh giá) không đụng tới tên
  const ten = u.$set && 'tenSanPham' in u.$set ? u.$set.tenSanPham : 'tenSanPham' in u ? u.tenSanPham : undefined;
  if (ten !== undefined) u.$set = { ...u.$set, timKiem: dungTruongTimKiem(ten) };
});

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
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ChiTietSanPham', required: true, index: true })
  chiTiet: Types.ObjectId;

  @Prop({ type: Number }) giaCu?: number;
  @Prop({ type: Number }) giaMoi?: number;
  @Prop({ default: () => new Date() }) ngayThayDoi: Date;
  @Prop({ maxlength: 50 }) nguoiThayDoi?: string;
}
export type LichSuThayDoiGiaDocument = HydratedDocument<LichSuThayDoiGia>;
export const LichSuThayDoiGiaSchema = SchemaFactory.createForClass(LichSuThayDoiGia);

/** Bản chụp hồ sơ người chơi gắn vào đánh giá (cùng khoá với khachhangs.hoSoChoi). */
@Schema({ _id: false })
export class NguoiDanhChup {
  @Prop({ type: String, enum: TRINH_DO }) trinhDo?: string;
  @Prop({ type: [String], enum: NOI_DUNG, default: undefined }) noiDung?: string[];
  @Prop({ type: String, enum: LOI_CHOI }) loiChoi?: string;
  @Prop({ type: [String], enum: CHAN_THUONG, default: undefined }) chanThuong?: string[];
}
export const NguoiDanhChupSchema = SchemaFactory.createForClass(NguoiDanhChup);

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

  /** Phiên bản người viết dùng (3U hay 4U ảnh hưởng cảm nhận). Không bắt buộc. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ChiTietSanPham' }) bienThe?: Types.ObjectId;
  /**
   * BẢN CHỤP hồ sơ người viết LÚC VIẾT (như đơn hàng chụp giá): hồ sơ đổi về sau không làm đổi ngữ cảnh của đánh giá cũ.
   * Chỉ có khi người viết đồng ý; chanThuong cần đồng ý riêng và không bao giờ trả về ở API công khai.
   */
  @Prop({ type: NguoiDanhChupSchema, default: undefined }) nguoiDanh?: NguoiDanhChup;
  /** Thẻ cảm nhận (THE_DANH_GIA). */
  @Prop({ type: [String], enum: THE_DANH_GIA, default: undefined }) the?: string[];
  /** Khách đã bấm "hữu ích" (để mỗi người chỉ tính một lần) và bộ đếm đi kèm, cập nhật trong CÙNG một lệnh. */
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'KhachHang' }], default: undefined }) huuIch?: Types.ObjectId[];
  @Prop({ type: Number, default: 0, min: 0 }) soHuuIch: number;
  /** Người viết có đơn ĐÃ HOÀN THÀNH chứa sản phẩm này tại thời điểm viết. */
  @Prop({ type: Boolean, default: false }) daMuaHang: boolean;
  /** Cờ đánh giá mẫu. Bộ lọc công khai đọc cờ này trong common/danh-gia.ts. */
  @Prop({ type: Boolean, default: undefined }) laDuLieuMau?: boolean;
}
export type PhanHoiDocument = HydratedDocument<PhanHoi>;
export const PhanHoiSchema = SchemaFactory.createForClass(PhanHoi);
/** Index phục vụ lọc đánh giá theo sản phẩm và trình độ người viết. */
PhanHoiSchema.index({ sanPham: 1, 'nguoiDanh.trinhDo': 1, danhGia: -1 }, { name: 'danh_gia_theo_nhom' });
/**
 * Danh sách đánh giá công khai mới nhất của một sản phẩm. Index MỘT PHẦN (partial): chỉ chứa đánh giá đã xác minh. Khác sparse
 * (chỉ xét "có trường hay không"), partial lọc theo một điều kiện bất kỳ, nên đánh giá import/chưa xác minh không chiếm chỗ trong index.
 */
PhanHoiSchema.index({ sanPham: 1, ngayPhanHoi: -1 }, { name: 'cong_khai_moi_nhat', partialFilterExpression: { daXacMinh: true } });
/**
 * Mỗi khách chỉ có MỘT đánh giá (đã xác minh) cho một sản phẩm: chống gửi lặp để kéo điểm trung bình. Unique + partial: dữ liệu mẫu/import
 * (daXacMinh false, có thể không có khachHang) không bị ràng buộc. Hai request gửi song song thì request sau nhận lỗi trùng khoá (E11000).
 */
PhanHoiSchema.index(
  { khachHang: 1, sanPham: 1 },
  { name: 'mot_danh_gia_moi_khach', unique: true, partialFilterExpression: { daXacMinh: true, khachHang: { $exists: true } } },
);
