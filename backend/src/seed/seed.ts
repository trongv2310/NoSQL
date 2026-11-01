import 'dotenv/config';
import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import { join } from 'path';
import { importLegacy, LegacyData, model, TEN_BANG_CAN_XOA } from './import-legacy';

/**
 * Nạp dữ liệu mẫu vào MongoDB.
 *   npm run seed                      # chỉ nạp khi DB còn trống
 *   npm run seed -- --reset           # xóa sạch rồi nạp lại
 *   npm run seed -- --file=duong/dan.json   # nạp từ file xuất của MySQL (cùng định dạng legacy.json)
 *   npm run seed -- --reset --don-mau # nạp thêm 24 đơn hàng mẫu cho trang thống kê
 */
async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const donMau = args.includes('--don-mau');
  const file = args.find((a) => a.startsWith('--file='))?.slice(7) ?? join(process.cwd(), 'seed-data', 'legacy.json');
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/shop_caulong';

  await mongoose.connect(uri);
  console.log(`Đã kết nối ${uri}`);
  try {
    if (reset) {
      for (const ten of TEN_BANG_CAN_XOA) {
        await model(ten).deleteMany({});
      }
      console.log('Đã xóa dữ liệu cũ.');
    } else if ((await model('SanPham').countDocuments()) > 0) {
      console.log('Database đã có dữ liệu – bỏ qua (dùng --reset để nạp lại).');
      return;
    }
    // Đồng bộ index (unique sku, unique tenDangNhap...) trước khi nạp.
    for (const ten of TEN_BANG_CAN_XOA) {
      await model(ten).syncIndexes();
    }
    const data = JSON.parse(readFileSync(file, 'utf8')) as LegacyData;
    const dem = await importLegacy(data, { donMau });
    console.table(dem);
    console.log('Hoàn tất. Tài khoản mẫu: admin / admin@123, nhanvien_banhang / nv@123, nguyenvana / vana@123, tranthib / thib@123');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
