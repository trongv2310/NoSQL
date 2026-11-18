import 'dotenv/config';
import { spawnSync } from 'child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'fs';
import mongoose from 'mongoose';
import { join, resolve } from 'path';
import { anMatKhau } from '../seed/du-lieu-mongodb';
import { coCongCu, MetaSaoLuu, motDong, TEN_META } from './sao-luu-chung';

/**
 * Sao lưu toàn bộ CSDL (dữ liệu + validator + index).
 *   npm run db:sao-luu                       # vào backend/sao-luu/<thời điểm>/
 *   npm run db:sao-luu -- --out=duong/dan
 *   npm run db:sao-luu -- --tu-viet          # bỏ qua mongodump, dùng bản tự viết
 * Chỉ đọc CSDL. Thư mục sao-luu/ đã nằm trong .gitignore (dữ liệu thật có tài khoản, đơn hàng).
 */
async function main() {
  const args = process.argv.slice(2);
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/shop_caulong';
  const luc = new Date().toISOString().replace(/[:.]/g, '-');
  const out = resolve(args.find((a) => a.startsWith('--out='))?.slice(6) ?? join(process.cwd(), 'sao-luu', luc));
  mkdirSync(out, { recursive: true });

  if (!args.includes('--tu-viet') && coCongCu('mongodump')) {
    const r = spawnSync('mongodump', [`--uri=${uri}`, `--out=${out}`], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) throw new Error('mongodump thất bại.');
    console.log(`Đã sao lưu bằng mongodump vào ${out}`);
    return;
  }

  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db!;
    const info = await db.admin().command({ buildInfo: 1 });
    const meta: MetaSaoLuu = { phienBan: 1, luc: new Date().toISOString(), csdl: db.databaseName, mongodb: String(info.version), collections: [] };
    // Collection thường và time series (tuỳ chọn timeseries + expireAfterSeconds lưu trong _meta.json để tạo lại đúng kiểu); bỏ view và system.*.
    const ds = (await db.listCollections({}, { nameOnly: false }).toArray()).filter((c: any) => ['collection', 'timeseries'].includes(c.type) && !c.name.startsWith('system.'));
    for (const c of ds.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = createWriteStream(join(out, `${c.name}.jsonl`), 'utf8');
      let so = 0;
      for await (const d of db.collection(c.name).find({}).sort({ _id: 1 })) {
        file.write(`${motDong(d)}\n`);
        so++;
      }
      await new Promise<void>((ok, loi) => file.end((e?: Error | null) => (e ? loi(e) : ok())));
      const index = (await db.collection(c.name).listIndexes().toArray()) as Record<string, unknown>[];
      meta.collections.push({ ten: c.name, soTaiLieu: so, tuyChon: ((c as any).options ?? {}) as Record<string, unknown>, index });
    }
    writeFileSync(join(out, TEN_META), JSON.stringify(meta, null, 2), 'utf8');
    console.log(`Đã sao lưu ${anMatKhau(uri)} (MongoDB ${meta.mongodb}) bằng bản tự viết vào ${out}`);
    console.table(Object.fromEntries(meta.collections.map((c) => [c.ten, { tai_lieu: c.soTaiLieu, index: c.index.length, validator: !!c.tuyChon.validator }])));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
