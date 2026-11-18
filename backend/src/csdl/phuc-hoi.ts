import 'dotenv/config';
import { spawnSync } from 'child_process';
import { createReadStream, existsSync, readFileSync } from 'fs';
import mongoose from 'mongoose';
import { join, resolve } from 'path';
import { createInterface } from 'readline';
import { anMatKhau, laMayLocal } from '../seed/du-lieu-mongodb';
import { coCongCu, docDong, indexCanTao, MetaSaoLuu, TEN_META } from './sao-luu-chung';

/**
 * Phục hồi từ một bản sao lưu của db:sao-luu.
 *   npm run db:phuc-hoi -- --from=sao-luu/<thời điểm>            # chỉ chạy khi các collection trong bản sao lưu còn trống/chưa có
 *   npm run db:phuc-hoi -- --from=sao-luu/<thời điểm> --drop     # xoá collection trùng tên rồi phục hồi
 * Bản tự viết tạo lại collection KÈM validator, nạp dữ liệu, rồi tạo lại index. Ghi lên MongoDB không phải máy này phải thêm --force.
 */
/** Time series: MongoDB tự suy bucketMaxSpanSeconds từ granularity; truyền cả hai (đọc từ listCollections) có thể bị từ chối. */
export function tuyChonTaoLai(tuyChon: Record<string, any>): Record<string, unknown> {
  const ts = tuyChon.timeseries;
  if (!ts?.granularity) return tuyChon;
  const { bucketMaxSpanSeconds: _a, bucketRoundingSeconds: _b, ...giu } = ts;
  return { ...tuyChon, timeseries: giu };
}

async function main() {
  const args = process.argv.slice(2);
  const tu = args.find((a) => a.startsWith('--from='))?.slice(7);
  if (!tu) throw new Error('Thiếu --from=<thư mục sao lưu>.');
  const dir = resolve(tu);
  const drop = args.includes('--drop');
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/shop_caulong';
  if (!args.includes('--force') && !laMayLocal(uri)) throw new Error(`Từ chối ghi lên ${anMatKhau(uri)}: không phải MongoDB của máy này (thêm --force).`);

  if (!existsSync(join(dir, TEN_META))) {
    // Bản của mongodump (thư mục <tên csdl>/*.bson).
    if (!coCongCu('mongorestore')) throw new Error(`${dir} không phải bản tự viết (thiếu ${TEN_META}) và máy chưa có mongorestore.`);
    const r = spawnSync('mongorestore', [`--uri=${uri}`, ...(drop ? ['--drop'] : []), dir], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0) throw new Error('mongorestore thất bại.');
    return;
  }

  const meta = JSON.parse(readFileSync(join(dir, TEN_META), 'utf8')) as MetaSaoLuu;
  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db!;
    const daCo = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    for (const c of meta.collections) {
      if (daCo.has(c.ten) && (await db.collection(c.ten).estimatedDocumentCount()) > 0 && !drop) {
        throw new Error(`Collection ${c.ten} đã có dữ liệu. Thêm --drop nếu đúng là muốn ghi đè.`);
      }
    }
    const kq: Record<string, { tai_lieu: number; index: number; validator: boolean }> = {};
    for (const c of meta.collections) {
      if (daCo.has(c.ten)) await db.collection(c.ten).drop();
      // Tạo collection kèm tuỳ chọn (validator...) TRƯỚC khi nạp: dữ liệu đi qua đúng luật như lúc sao lưu.
      await db.createCollection(c.ten, tuyChonTaoLai(c.tuyChon) as never);
      let lo: Record<string, unknown>[] = [];
      let so = 0;
      const nap = async () => {
        if (lo.length) await db.collection(c.ten).insertMany(lo as never[], { ordered: true });
        so += lo.length;
        lo = [];
      };
      const rl = createInterface({ input: createReadStream(join(dir, `${c.ten}.jsonl`), 'utf8'), crlfDelay: Infinity });
      for await (const dong of rl) {
        if (!dong.trim()) continue;
        lo.push(docDong(dong));
        if (lo.length >= 1000) await nap();
      }
      await nap();
      if (so !== c.soTaiLieu) throw new Error(`${c.ten}: nạp ${so} tài liệu, bản sao lưu ghi ${c.soTaiLieu}.`);
      const idx = indexCanTao(c.index);
      for (const { key, ...tuyChon } of idx) await db.collection(c.ten).createIndex(key, tuyChon as never);
      kq[c.ten] = { tai_lieu: so, index: idx.length + 1, validator: !!c.tuyChon.validator };
    }
    console.log(`Đã phục hồi ${meta.collections.length} collection từ bản sao lưu lúc ${meta.luc} vào ${anMatKhau(uri)}`);
    console.table(kq);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
