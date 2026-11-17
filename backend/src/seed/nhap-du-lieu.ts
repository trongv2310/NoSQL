import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import mongoose from 'mongoose';
import { join } from 'path';
import { anMatKhau, docChuoi, laMayLocal, Manifest, TEN_MANIFEST, thuMucMacDinh } from './du-lieu-mongodb';
import { model, TEN_BANG_CAN_XOA } from './import-legacy';

/**
 * Nhập bộ dữ liệu dùng chung (seed-data/mongodb) vào MongoDB, giữ nguyên ObjectId nên cả team có cùng id sản phẩm/đơn hàng.
 *   npm run data:import                 # chỉ nhập khi CSDL còn trống
 *   npm run data:import:reset           # xóa sạch dữ liệu của hệ thống rồi nhập lại
 *   npm run data:import -- --dir=duong/dan --force
 * `--reset` chỉ chạy trên MongoDB của máy này; muốn chạy trên máy chủ khác phải thêm `--force`.
 */
async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const force = args.includes('--force');
  const dir = args.find((a) => a.startsWith('--dir='))?.slice(6) ?? thuMucMacDinh();
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/shop_caulong';

  const duongManifest = join(dir, TEN_MANIFEST);
  if (!existsSync(duongManifest)) {
    throw new Error(`Không thấy ${duongManifest}. Chạy từ thư mục backend hoặc truyền --dir=...`);
  }
  const manifest = JSON.parse(readFileSync(duongManifest, 'utf8')) as Manifest;

  if (reset && !force && !laMayLocal(uri)) {
    throw new Error(`Từ chối --reset trên ${anMatKhau(uri)}: không phải MongoDB của máy này. Thêm --force nếu đúng là muốn xóa dữ liệu ở đó.`);
  }

  await mongoose.connect(uri);
  console.log(`Đã kết nối ${anMatKhau(uri)}`);
  try {
    const db = mongoose.connection.db!;
    if (reset) {
      for (const ten of TEN_BANG_CAN_XOA) await model(ten).deleteMany({});
      console.log('Đã xóa dữ liệu cũ của hệ thống.');
    } else if ((await model('SanPham').countDocuments()) > 0) {
      console.log('CSDL đã có dữ liệu – bỏ qua (dùng data:import:reset để xóa và nhập lại).');
      return;
    }
    // Tạo index (unique sku, unique tenDangNhap…) trước khi nhập để dữ liệu trùng bị báo lỗi sớm.
    for (const ten of TEN_BANG_CAN_XOA) await model(ten).syncIndexes();

    const dem: Record<string, number> = {};
    for (const [t, soLuongDuKien] of Object.entries(manifest.collections)) {
      const docs = docChuoi(readFileSync(join(dir, `${t}.json`), 'utf8'));
      if (docs.length !== soLuongDuKien) throw new Error(`${t}.json có ${docs.length} tài liệu, manifest ghi ${soLuongDuKien}.`);
      // Chèn thẳng bằng driver: giữ nguyên tài liệu gốc, không để Mongoose ép kiểu hay thêm trường.
      await db.collection(t).insertMany(docs as never[]);
      dem[t] = docs.length;
    }
    console.table(dem);
    console.log('Hoàn tất. Tài khoản mẫu: admin / admin@123, nhanvien_banhang / nv@123, nguyenvana / vana@123, tranthib / thib@123');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
