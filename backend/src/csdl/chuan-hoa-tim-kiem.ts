import 'dotenv/config';
import mongoose from 'mongoose';
import { cungTruongTimKiem, dungTruongTimKiem } from '../catalog/tim-kiem';
import { anMatKhau, laMayLocal } from '../seed/du-lieu-mongodb';

/**
 * Dựng lại `sanphams.timKiem` từ tên sản phẩm cho dữ liệu nhập thẳng bằng driver (không qua hook) hoặc sửa tay trong mongosh.
 *   npm run db:chuan-hoa-tim-kiem -- --dry-run   # chỉ báo cáo
 *   npm run db:chuan-hoa-tim-kiem                # ghi phần lệch
 * Chạy lại bao nhiêu lần cũng được: bản ghi đã đúng thì không bị ghi.
 */
export async function chuanHoaTimKiem(db: mongoose.mongo.Db, thu = false): Promise<{ tong: number; canGhi: number; daGhi: number }> {
  const col = db.collection('sanphams');
  const ds = await col.find({}, { projection: { tenSanPham: 1, timKiem: 1 } }).toArray();
  const ghi: mongoose.mongo.AnyBulkWriteOperation[] = [];
  for (const d of ds) {
    const moi = dungTruongTimKiem(d.tenSanPham);
    if (!cungTruongTimKiem(d.timKiem, moi)) ghi.push({ updateOne: { filter: { _id: d._id }, update: { $set: { timKiem: moi } } } });
  }
  const daGhi = !thu && ghi.length ? (await col.bulkWrite(ghi, { ordered: false })).modifiedCount : 0;
  return { tong: ds.length, canGhi: ghi.length, daGhi };
}

async function main() {
  const args = process.argv.slice(2);
  const thu = args.includes('--dry-run');
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/shop_caulong';
  if (!thu && !args.includes('--force') && !laMayLocal(uri)) {
    throw new Error(`Từ chối ghi lên ${anMatKhau(uri)}: không phải MongoDB của máy này. Thêm --force nếu đúng là muốn chạy ở đó.`);
  }
  await mongoose.connect(uri);
  try {
    const kq = await chuanHoaTimKiem(mongoose.connection.db!, thu);
    console.log(`Kết nối ${anMatKhau(uri)}`);
    console.log(`Sản phẩm: ${kq.tong} | cần ghi: ${kq.canGhi}${thu ? ' (--dry-run: chưa ghi)' : ` | đã ghi: ${kq.daGhi}`}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
