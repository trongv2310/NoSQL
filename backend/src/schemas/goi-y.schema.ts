import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ collection: 'goiysanphams' })
export class GoiYSanPham {
  @Prop({ required: true, unique: true }) khoa: string;
  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'SanPham', required: true, validate: (ids: Types.ObjectId[]) => ids.length >= 2 })
  sanPham: Types.ObjectId[];
  @Prop({ required: true, min: 0 }) loiNhuan: number;
  @Prop({ required: true, min: 1 }) hang: number;
  @Prop({ required: true, min: 1, max: 50 }) k: number;
  @Prop({ required: true, min: 1, max: 12 }) soThang: number;
  @Prop({ required: true }) taoLuc: Date;
}
export const GoiYSanPhamSchema = SchemaFactory.createForClass(GoiYSanPham);
