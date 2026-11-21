import 'dotenv/config';
import mongoose from 'mongoose';

/**
 * Trước khi chạy: xoá bộ đếm đăng nhập sai (gioihantansuats) để chạy lại nhiều lần không bị khoá theo IP (30 lần / 15 phút).
 * Chỉ chạm MongoDB của máy này (MONGODB_URI trỏ localhost/127.0.0.1).
 */
export default async function setup() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/shop_caulong';
  if (!/127\.0\.0\.1|localhost/.test(uri)) return;
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 3000 }).asPromise().catch(() => null);
  if (!conn) return;
  await conn.db!.collection('gioihantansuats').deleteMany({});
  await conn.close();
}
