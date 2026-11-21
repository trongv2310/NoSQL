import 'dotenv/config';
import mongoose from 'mongoose';
import { cungThuocTinh, KHOA_THUOC_TINH, thuocTinhTuThongSo, ThuocTinh } from '../catalog/thuoc-tinh';
import { anMatKhau, laMayLocal } from '../seed/du-lieu-mongodb';

/**
 * Tính lại `chitietsanphams.thuocTinh` từ `thongSo` cho dữ liệu đã có (biến thể cũ hoặc được cập nhật trực tiếp trong MongoDB).
 *   npm run db:chuan-hoa-thong-so -- --dry-run   # chỉ báo cáo
 *   npm run db:chuan-hoa-thong-so                # ghi phần lệch
 * Chạy lại bao nhiêu lần cũng được: bản ghi đã đúng thì không bị ghi. Ghi lên MongoDB không phải máy này phải thêm --force.
 */
async function main() {
  const args = process.argv.slice(2);
  const thu = args.includes('--dry-run');
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/shop_caulong';
  if (!thu && !args.includes('--force') && !laMayLocal(uri)) {
    throw new Error(`Từ chối ghi lên ${anMatKhau(uri)}: không phải MongoDB của máy này. Thêm --force nếu đúng là muốn chạy ở đó.`);
  }
  await mongoose.connect(uri);
  try {
    // Dùng thẳng driver (không qua model) để script tự quyết định ghi gì, không phụ thuộc hook.
    const col = mongoose.connection.db!.collection('chitietsanphams');
    const ds = await col.find({}, { projection: { sku: 1, thongSo: 1, thuocTinh: 1 } }).toArray();
    const ghi: mongoose.mongo.AnyBulkWriteOperation[] = [];
    let coThongSo = 0;
    const thieuKhoa: Record<string, string[]> = {};
    for (const d of ds) {
      const tt: ThuocTinh[] = thuocTinhTuThongSo(d.thongSo);
      if (d.thongSo) {
        coThongSo++;
        const co = new Set(tt.map((t) => t.k));
        for (const k of KHOA_THUOC_TINH) if (k !== 'loiChoi' && !co.has(k)) (thieuKhoa[k] ??= []).push(String(d.sku));
      }
      if (cungThuocTinh(d.thuocTinh, tt) && (tt.length > 0 || d.thuocTinh === undefined)) continue;
      ghi.push({ updateOne: { filter: { _id: d._id }, update: tt.length ? { $set: { thuocTinh: tt } } : { $unset: { thuocTinh: '' } } } });
    }
    console.log(`Kết nối ${anMatKhau(uri)}`);
    console.log(`Biến thể: ${ds.length} | có thông số: ${coThongSo} | cần ghi: ${ghi.length}${thu ? ' (--dry-run: chưa ghi)' : ''}`);
    for (const [k, skus] of Object.entries(thieuKhoa)) {
      console.log(`  Không đọc được ${k} ở ${skus.length} biến thể (bỏ trống, không đoán): ${skus.slice(0, 5).join(', ')}${skus.length > 5 ? '…' : ''}`);
    }
    if (!thu && ghi.length) {
      const kq = await col.bulkWrite(ghi, { ordered: false });
      console.log(`Đã cập nhật ${kq.modifiedCount} biến thể.`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
