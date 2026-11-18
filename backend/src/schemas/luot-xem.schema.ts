import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export const NGAY_GIU_LUOT_XEM = 180;

/**
 * Lượt xem trang chi tiết sản phẩm: TIME SERIES COLLECTION. Mỗi lượt xem là một "phép đo" { luc, sanPham }; MongoDB tự gom các phép
 * đo cùng sanPham (metaField) và gần nhau về thời gian vào chung một bucket (system.buckets.luotxems), nén theo cột, nên hàng chục
 * nghìn lượt xem chỉ chiếm vài chục bucket. Tự xoá sau 180 ngày (expireAfterSeconds, không cần TTL index riêng).
 * granularity 'hours': mỗi sản phẩm chỉ có vài lượt xem mỗi giờ, nên bucket được phép kéo dài tới 30 ngày. Với 'minutes' (bucket tối đa
 * 1 ngày) 8.518 lượt xem mẫu chiếm 2.062 bucket, tức chỉ ~4 lượt/bucket: gần như không được nén.
 * Không gắn được validator $jsonSchema cho time series ("'timeseries' is not allowed with 'validator'"): kiểm ở schema Mongoose.
 */
@Schema({
  collection: 'luotxems',
  versionKey: false,
  timeseries: { timeField: 'luc', metaField: 'sanPham', granularity: 'hours' },
  expireAfterSeconds: NGAY_GIU_LUOT_XEM * 86_400,
})
export class LuotXem {
  @Prop({ type: Date, required: true })
  luc: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SanPham', required: true })
  sanPham: Types.ObjectId;

  /** Dữ liệu mẫu (npm run db:du-lieu-mau) để báo cáo có số; báo cáo mặc định bỏ qua. */
  @Prop({ type: Boolean })
  laDuLieuMau?: boolean;
}
export const LuotXemSchema = SchemaFactory.createForClass(LuotXem);
/** MongoDB tự tạo index này (metaField + timeField) khi tạo time series collection; khai báo lại để db:setup không coi là "thừa". */
LuotXemSchema.index({ sanPham: 1, luc: 1 }, { name: 'sanPham_1_luc_1' });
