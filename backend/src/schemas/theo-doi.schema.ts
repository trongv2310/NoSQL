import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

/**
 * Vị trí đã đọc tới của một change stream (resume token). Lưu trong MongoDB nên API khởi động lại vẫn đọc tiếp từ đúng chỗ cũ
 * (`startAfter`): sự kiện xảy ra lúc API tắt không bị mất, miễn là còn trong oplog.
 */
@Schema({ collection: 'theodoisukiens', versionKey: false })
export class TheoDoiSuKien {
  @Prop({ type: String, required: true }) _id: string;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) token: Record<string, unknown>;
  @Prop({ type: Date, required: true }) luc: Date;
}
export const TheoDoiSuKienSchema = SchemaFactory.createForClass(TheoDoiSuKien);
