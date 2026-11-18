import 'dotenv/config';
import mongoose from 'mongoose';
import { LOC_DANH_GIA_THAT, pipelineTinhLaiTongHop } from '../phan-hoi/tong-hop-danh-gia';
import { anMatKhau, laMayLocal } from '../seed/du-lieu-mongodb';

/**
 * Đối soát computed pattern: tính lại sanphams.danhGiaTongHop từ phanhois ($lookup) và ghi đè bằng $merge.
 *   npm run db:tinh-lai-danh-gia -- --dry-run   # chỉ đếm sản phẩm đang lệch
 *   npm run db:tinh-lai-danh-gia                # ghi
 */
async function main() {
  const args = process.argv.slice(2);
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/shop_caulong';
  if (!args.includes('--dry-run') && !args.includes('--force') && !laMayLocal(uri)) throw new Error(`Từ chối ghi lên ${anMatKhau(uri)} (thêm --force).`);
  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db!;
    // Sản phẩm lệch: so tổng hợp đang lưu với kết quả gom lại từ phanhois.
    const lech = await db.collection('sanphams').aggregate([
      { $lookup: { from: 'phanhois', localField: '_id', foreignField: 'sanPham', as: 'dg', pipeline: [{ $match: LOC_DANH_GIA_THAT }, { $group: { _id: null, so: { $sum: 1 }, tong: { $sum: '$danhGia' } } }] } },
      { $project: { tenSanPham: 1, luu: { so: { $ifNull: ['$danhGiaTongHop.so', -1] }, tong: { $ifNull: ['$danhGiaTongHop.tong', -1] } }, that: { so: { $ifNull: [{ $first: '$dg.so' }, 0] }, tong: { $ifNull: [{ $first: '$dg.tong' }, 0] } } } },
      { $match: { $expr: { $ne: ['$luu', '$that'] } } },
    ]).toArray();
    console.log(`Kết nối ${anMatKhau(uri)}: ${lech.length} sản phẩm có tổng hợp đánh giá lệch hoặc chưa có.`);
    for (const x of lech.slice(0, 5)) console.log(`  ${x.tenSanPham}: đang lưu ${JSON.stringify(x.luu)}, đúng là ${JSON.stringify(x.that)}`);
    if (args.includes('--dry-run') || !lech.length) return;
    await db.collection('sanphams').aggregate(pipelineTinhLaiTongHop()).toArray();
    console.log('Đã tính lại và ghi bằng $merge.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
