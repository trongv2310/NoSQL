import 'dotenv/config';
import mongoose from 'mongoose';
import { anMatKhau, laMayLocal } from '../seed/du-lieu-mongodb';
import { PhienBanVot, sinhDuLieuMau, sinhLuotXemMau } from './du-lieu-mau';

/**
 * Nạp / xoá dữ liệu mẫu cho thống kê (xem du-lieu-mau.ts).
 *   npm run db:du-lieu-mau            # xoá dữ liệu mẫu cũ (nếu có) rồi sinh lại
 *   npm run db:du-lieu-mau -- --xoa   # chỉ xoá
 * Chỉ đụng tới tài liệu có laDuLieuMau: true. Ghi lên MongoDB không phải máy này phải thêm --force.
 * Muốn trang công khai hiện dữ liệu mẫu (máy demo) thì đặt HIEN_DU_LIEU_MAU=true cho API.
 */
const BANG = ['phanhois', 'lancangs', 'votcanhans', 'khachhangs'] as const;

async function main() {
  const args = process.argv.slice(2);
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/shop_caulong';
  if (!args.includes('--force') && !laMayLocal(uri)) throw new Error(`Từ chối ghi lên ${anMatKhau(uri)}: không phải MongoDB của máy này (thêm --force).`);
  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db!;
    for (const b of BANG) {
      const n = (await db.collection(b).deleteMany({ laDuLieuMau: true })).deletedCount;
      if (n) console.log(`Đã xoá ${n} tài liệu mẫu cũ trong ${b}.`);
    }
    // Time series: deleteMany theo trường đo (laDuLieuMau) được hỗ trợ từ MongoDB 7.0.
    const nXem = await db.collection('luotxems').deleteMany({ laDuLieuMau: true }).then((x) => x.deletedCount).catch(() => 0);
    if (nXem) console.log(`Đã xoá ${nXem} lượt xem mẫu cũ trong luotxems.`);
    if (args.includes('--xoa')) return;

    // Phiên bản vợt có thông số dạng số (thuocTinh, M1) + tên sản phẩm còn kinh doanh.
    const ds = await db.collection('chitietsanphams').aggregate([
      { $match: { 'thuocTinh.k': 'sucCangMaxLbs' } },
      { $lookup: { from: 'sanphams', localField: 'sanPham', foreignField: '_id', as: 'sp' } },
      { $unwind: '$sp' },
      { $match: { 'sp.deletedAt': null } },
      { $project: { sanPham: 1, ten: { $concat: ['$sp.tenSanPham', ' (', '$sku', ')'] }, tt: { $arrayToObject: { $map: { input: { $filter: { input: '$thuocTinh', cond: { $ne: ['$$this.k', 'loiChoi'] } } }, in: ['$$this.k', '$$this.v'] } } } } },
    ]).toArray();
    const phienBan: PhienBanVot[] = ds.map((d: any) => ({
      bienThe: d._id, sanPham: d.sanPham, ten: String(d.ten).slice(0, 80),
      canBangBac: d.tt.canBangBac, doCungBac: d.tt.doCungBac, trongLuongU: d.tt.trongLuongU, sucCangMinLbs: d.tt.sucCangMinLbs, sucCangMaxLbs: d.tt.sucCangMaxLbs,
    }));
    if (!phienBan.length) throw new Error('Chưa có phiên bản vợt nào có thuocTinh. Chạy npm run db:chuan-hoa-thong-so trước.');
    const dl = sinhDuLieuMau(phienBan);
    for (const b of [...BANG].reverse()) {
      // insertMany qua driver: validator $jsonSchema của từng collection vẫn kiểm từng tài liệu.
      await db.collection(b).insertMany(dl[b] as never[], { ordered: true });
    }
    const luotXem = sinhLuotXemMau((await db.collection('sanphams').find({ deletedAt: null }, { projection: { _id: 1 } }).toArray()).map((d) => d._id));
    if ((await db.listCollections({ name: 'luotxems', type: 'timeseries' }).toArray()).length) {
      await db.collection('luotxems').insertMany(luotXem as never[], { ordered: false });
      console.log(`Đã sinh ${luotXem.length} lượt xem mẫu (60 ngày) vào time series luotxems.`);
    } else console.warn('Bỏ qua lượt xem mẫu: luotxems chưa là time series collection (chạy npm run db:setup trước).');
    console.log(`Kết nối ${anMatKhau(uri)}: đã sinh ${dl.khachhangs.length} người chơi, ${dl.votcanhans.length} hộ chiếu, ${dl.lancangs.length} lần căng, ${dl.phanhois.length} đánh giá (đều gắn laDuLieuMau: true).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
