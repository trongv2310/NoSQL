import 'dotenv/config';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import mongoose from 'mongoose';
import { join } from 'path';
import { anMatKhau, BO_QUA_KHI_XUAT, chuoiHoaCollection, Manifest, TEN_MANIFEST, thuMucMacDinh } from './du-lieu-mongodb';

/**
 * Xuất toàn bộ CSDL hiện tại thành các file dữ liệu dùng chung (xem du-lieu-mongodb.ts).
 *   npm run data:export                 # ghi vào seed-data/mongodb
 *   npm run data:export -- --dir=duong/dan
 * CHỈ xuất từ CSDL sạch (vd. vừa chạy `npm run seed:reset`): mọi thứ đang có trong CSDL sẽ đi vào file và lên git,
 * kể cả dữ liệu thử (đơn hàng, tài khoản tự tạo…).
 */
async function main() {
  const dir = process.argv.slice(2).find((a) => a.startsWith('--dir='))?.slice(6) ?? thuMucMacDinh();
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/shop_caulong';
  await mongoose.connect(uri);
  console.log(`Đã kết nối ${anMatKhau(uri)}`);
  try {
    const db = mongoose.connection.db!;
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.json')) rmSync(join(dir, f)); // xóa file cũ để collection đã bỏ không còn sót lại
    }
    const collections: Record<string, number> = {};
    const ten = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.')).sort();
    for (const t of ten) {
      if (BO_QUA_KHI_XUAT.includes(t)) continue;
      const docs = await db.collection(t).find({}).toArray();
      if (!docs.length) continue;
      writeFileSync(join(dir, `${t}.json`), chuoiHoaCollection(docs as Record<string, unknown>[]), 'utf8');
      collections[t] = docs.length;
    }
    const manifest: Manifest = {
      taoLuc: new Date().toISOString(),
      ghiChu: 'Dữ liệu mẫu dùng chung cho team. Nhập bằng `npm run data:import` (xem README.md cùng thư mục).',
      collections,
    };
    writeFileSync(join(dir, TEN_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.table(collections);
    console.log(`Đã xuất ${Object.keys(collections).length} collection vào ${dir}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
