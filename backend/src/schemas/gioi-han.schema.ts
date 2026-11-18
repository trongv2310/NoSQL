import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Bộ đếm giới hạn tần suất (vd. số lần đăng nhập SAI) lưu trong MongoDB thay vì bộ nhớ tiến trình: khởi động lại API hay chạy nhiều tiến
 * trình vẫn dùng chung một bộ đếm.
 *
 * Mỗi (khoá, cửa sổ thời gian) là MỘT document, tăng bằng upsert + $inc (nguyên tử). TTL index trên `hetHan` (expireAfterSeconds: 0)
 * để MongoDB TỰ XOÁ bộ đếm khi cửa sổ kết thúc: không cần job dọn dẹp, collection không phình theo thời gian.
 */
@Schema({ collection: 'gioihantansuats' })
export class GioiHanTanSuat {
  /** Ví dụ "dang-nhap:tk:nguyenvana", "dang-nhap:ip:203.0.113.5". */
  @Prop({ type: String, required: true, maxlength: 200 }) khoa: string;
  /** Mốc bắt đầu cửa sổ (làm tròn xuống theo độ dài cửa sổ). */
  @Prop({ type: Date, required: true }) cuaSo: Date;
  @Prop({ type: Number, required: true, min: 0 }) so: number;
  /** Hết cửa sổ thì TTL monitor xoá tài liệu (chạy khoảng 60 giây một lần). */
  @Prop({ type: Date, required: true }) hetHan: Date;
}
export type GioiHanTanSuatDocument = HydratedDocument<GioiHanTanSuat>;
export const GioiHanTanSuatSchema = SchemaFactory.createForClass(GioiHanTanSuat);
GioiHanTanSuatSchema.index({ khoa: 1, cuaSo: 1 }, { name: 'khoa_cua_so', unique: true });
GioiHanTanSuatSchema.index({ hetHan: 1 }, { name: 'tu_xoa_khi_het_han', expireAfterSeconds: 0 });
