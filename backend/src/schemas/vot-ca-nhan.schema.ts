import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { LOI_CHOI, TRINH_DO } from '../common/ho-so-choi';

/**
 * Hộ chiếu cây vợt (M4): MỘT cây vợt cụ thể của một khách hàng, kèm sổ căng cước.
 *
 * Thiết kế:
 * - Subset pattern: chỉ NHÚNG 10 lần căng gần nhất (`lichSuCang`) để mở tủ vợt là có ngay, không phải đọc thêm collection.
 *   Toàn bộ lịch sử nằm ở `lancangs` (tham chiếu), vì số lần căng tăng không giới hạn (document có trần 16 MB).
 * - Computed pattern: `lanCangGanNhat`, `hanNhacLuc`, `soLanCang` được tính sẵn lúc ghi để đọc và đánh index nhanh
 *   ("vợt nào đến hạn căng lại" là một truy vấn khoảng trên `hanNhacLuc`).
 * - `thongSoChup`: chụp mức căng tối đa/tối thiểu của phiên bản lúc tạo hộ chiếu (dữ liệu sản phẩm đổi về sau không ảnh hưởng).
 */
export const NGUON_VOT = ['mua-tai-shop', 'tu-nhap', 'chuyen-tu-trinh-duyet'] as const;
export const NOI_CANG = ['shop', 'ngoai'] as const;
export const DON_VI_CANG = ['kg', 'lbs'] as const;
export const LOAI_SU_KIEN = ['bao-hanh', 'sua-khung', 'thay-cuoc-dut', 'ghi-chu'] as const;
export const TOI_DA_LICH_SU_NHUNG = 10;
export const TOI_DA_CHU_KY_NGAY = 365;

@Schema({ _id: false })
export class ThongSoChup {
  @Prop({ type: Number }) sucCangMinLbs?: number;
  @Prop({ type: Number }) sucCangMaxLbs?: number;
  @Prop({ type: Number }) trongLuongU?: number;
}
export const ThongSoChupSchema = SchemaFactory.createForClass(ThongSoChup);

/** Một lần căng nhúng trong hộ chiếu (bản sao gọn của tài liệu trong `lancangs`, cùng `_id`). */
@Schema({ _id: false })
export class LanCangNhung {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true }) _id: Types.ObjectId;
  @Prop({ type: Date, required: true }) ngay: Date;
  @Prop({ type: Number, required: true }) mucCangLbs: number;
  @Prop({ type: Number, required: true }) giaTriNhap: number;
  @Prop({ type: String, enum: DON_VI_CANG, required: true }) donViNhap: string;
  @Prop({ type: String, maxlength: 60 }) tenDay?: string;
  @Prop({ type: String, enum: NOI_CANG, required: true }) noiCang: string;
  @Prop({ type: Boolean, default: false }) vuotMucNSX: boolean;
}
export const LanCangNhungSchema = SchemaFactory.createForClass(LanCangNhung);

@Schema({ _id: false })
export class SuKienVot {
  @Prop({ type: String, enum: LOAI_SU_KIEN, required: true }) loai: string;
  @Prop({ type: Date, required: true }) ngay: Date;
  @Prop({ type: String, maxlength: 200 }) ghiChu?: string;
}
export const SuKienVotSchema = SchemaFactory.createForClass(SuKienVot);

@Schema({ collection: 'votcanhans' })
export class VotCaNhan {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'KhachHang', required: true }) khachHang: Types.ObjectId;
  @Prop({ type: String, enum: NGUON_VOT, required: true }) nguon: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SanPham' }) sanPham?: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ChiTietSanPham' }) bienThe?: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'DonHang' }) donHang?: Types.ObjectId;
  @Prop({ type: String, required: true, trim: true, minlength: 1, maxlength: 80 }) ten: string;
  /** Số serial in trên khung (nếu khách nhập): duy nhất toàn hệ thống. */
  @Prop({ type: String, trim: true, maxlength: 40 }) soSerial?: string;
  /**
   * Khoá nguồn để ghi lặp lại không nhân đôi: "cb:<id localStorage>" khi chuyển từ trình duyệt, "dh:<id dòng đơn>:<thứ tự>" khi tạo từ đơn hàng.
   * Unique theo khách hàng (index một phần, chỉ khi có khoá).
   */
  @Prop({ type: String, maxlength: 120 }) maNguon?: string;
  @Prop({ type: ThongSoChupSchema, default: undefined }) thongSoChup?: ThongSoChup;
  @Prop({ type: Date }) ngayMua?: Date;
  @Prop({ type: Number, min: 1, max: TOI_DA_CHU_KY_NGAY }) chuKyNhacNgay?: number;
  @Prop({ type: LanCangNhungSchema, default: undefined }) lanCangGanNhat?: LanCangNhung;
  /** = lanCangGanNhat.ngay + chuKyNhacNgay. Không có chu kỳ hoặc chưa căng lần nào thì không có trường này (index sparse). */
  @Prop({ type: Date }) hanNhacLuc?: Date;
  @Prop({ type: Number, default: 0, min: 0 }) soLanCang: number;
  @Prop({ type: [LanCangNhungSchema], default: [] }) lichSuCang: LanCangNhung[];
  @Prop({ type: [SuKienVotSchema], default: undefined }) suKien?: SuKienVot[];
  @Prop({ type: String, maxlength: 200, default: '' }) ghiChu?: string;
  @Prop({ type: Date, default: () => new Date() }) taoLuc: Date;
  @Prop({ type: Date, default: null }) deletedAt?: Date | null;
}
export type VotCaNhanDocument = HydratedDocument<VotCaNhan>;
export const VotCaNhanSchema = SchemaFactory.createForClass(VotCaNhan);
/** Tủ vợt của tôi. */
VotCaNhanSchema.index({ khachHang: 1, deletedAt: 1, taoLuc: -1 }, { name: 'tu_vot_cua_khach' });
/** "Vợt đến hạn căng lại": truy vấn khoảng trên hanNhacLuc; sparse vì vợt không đặt nhắc thì không có trường này. */
VotCaNhanSchema.index({ hanNhacLuc: 1 }, { name: 'han_nhac', sparse: true });
/** Serial duy nhất toàn hệ thống, chỉ xét tài liệu CÓ serial (slide 96: unique + sparse; ở đây dùng partial cho chặt kiểu). */
VotCaNhanSchema.index({ soSerial: 1 }, { name: 'so_serial', unique: true, partialFilterExpression: { soSerial: { $type: 'string' } } });
/** Ghi lặp lại (chuyển từ trình duyệt, tạo từ đơn) không nhân đôi. */
VotCaNhanSchema.index({ khachHang: 1, maNguon: 1 }, { name: 'ma_nguon', unique: true, partialFilterExpression: { maNguon: { $type: 'string' } } });

/** Một lần căng trong toàn bộ lịch sử (tham chiếu tới hộ chiếu). */
@Schema({ _id: false })
export class NguoiDanhCang {
  @Prop({ type: String, enum: TRINH_DO }) trinhDo?: string;
  @Prop({ type: String, enum: LOI_CHOI }) loiChoi?: string;
}
export const NguoiDanhCangSchema = SchemaFactory.createForClass(NguoiDanhCang);

@Schema({ collection: 'lancangs' })
export class LanCang {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'VotCaNhan', required: true }) votCaNhan: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'KhachHang', required: true }) khachHang: Types.ObjectId;
  @Prop({ type: Date, required: true }) ngay: Date;
  @Prop({ type: Number, required: true }) mucCangLbs: number;
  @Prop({ type: Number, required: true }) giaTriNhap: number;
  @Prop({ type: String, enum: DON_VI_CANG, required: true }) donViNhap: string;
  @Prop({ type: String, maxlength: 60 }) tenDay?: string;
  @Prop({ type: String, enum: NOI_CANG, required: true }) noiCang: string;
  /** Chụp trình độ/lối chơi lúc căng để thống kê "mức căng theo trình độ" không cần $lookup sang khachhangs. */
  @Prop({ type: NguoiDanhCangSchema, default: undefined }) nguoiDanhChup?: NguoiDanhCang;
  @Prop({ type: Boolean, default: false }) vuotMucNSX: boolean;
  @Prop({ type: Boolean, default: undefined }) laDuLieuMau?: boolean;
  @Prop({ type: Date, default: () => new Date() }) taoLuc: Date;
}
export type LanCangDocument = HydratedDocument<LanCang>;
export const LanCangSchema = SchemaFactory.createForClass(LanCang);
LanCangSchema.index({ votCaNhan: 1, ngay: -1 }, { name: 'lich_su_cua_vot' });
LanCangSchema.index({ 'nguoiDanhChup.trinhDo': 1, mucCangLbs: 1 }, { name: 'muc_cang_theo_trinh_do' });
