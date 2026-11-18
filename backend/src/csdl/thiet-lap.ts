import 'dotenv/config';
import mongoose from 'mongoose';
import { ALL_MODELS } from '../schemas';
import { anMatKhau, laMayLocal } from '../seed/du-lieu-mongodb';
import { CANH_BAO_STANDALONE, docMoiTruong } from './moi-truong';
import { IndexKhaiBao, IndexThucTe, soSanhIndex } from './so-sanh-index';
import { VALIDATORS } from './validators';

/**
 * Áp validator ($jsonSchema) và index đã khai báo trong code lên MongoDB. Chạy lại bao nhiêu lần cũng được.
 *   npm run db:setup:dry                       # chỉ kiểm tra và in báo cáo, không ghi gì
 *   npm run db:setup                           # áp validator + tạo index còn thiếu
 *   npm run db:setup -- --xoa-index-thua       # xoá thêm index có trong CSDL mà code không khai báo
 * Ghi lên MongoDB không phải của máy này thì phải thêm --force.
 *
 * Validator chỉ được áp khi KHÔNG có tài liệu nào đang vi phạm: nếu có, script in ra vài _id để sửa dữ liệu trước,
 * bỏ qua collection đó và kết thúc với mã lỗi 1. Không bao giờ tự sửa hay xoá dữ liệu.
 */

// Script tự quyết định tạo index lúc nào: tắt việc Mongoose tự tạo index/collection khi khai báo model (nếu không, --dry-run vẫn ghi).
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

const MUC_KIEM_TRA = { validationLevel: 'strict', validationAction: 'error' } as const;

async function main() {
  const args = process.argv.slice(2);
  const thu = args.includes('--dry-run');
  const force = args.includes('--force');
  const xoaThua = args.includes('--xoa-index-thua');
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/shop_caulong';
  if (!thu && !force && !laMayLocal(uri)) {
    throw new Error(`Từ chối ghi lên ${anMatKhau(uri)}: không phải MongoDB của máy này. Thêm --force nếu đúng là muốn thiết lập ở đó.`);
  }

  await mongoose.connect(uri);
  let coLoi = false;
  try {
    const db = mongoose.connection.db!;
    const mt = await docMoiTruong(db);
    console.log(`Kết nối ${anMatKhau(uri)} | MongoDB ${mt.phienBan} | ${mt.replicaSet ? `replica set "${mt.replicaSet}"` : 'standalone'}`);
    if (!mt.coTransaction) console.warn(`CẢNH BÁO: ${CANH_BAO_STANDALONE}`);
    if (thu) console.log('Chế độ --dry-run: chỉ kiểm tra, không ghi gì.\n');

    // 1. Validator
    console.log('== Validator ($jsonSchema) ==');
    const thongTin = new Map((await db.listCollections({}, { nameOnly: false }).toArray()).map((c: any) => [c.name, c]));
    for (const [ten, def] of Object.entries(VALIDATORS)) {
      const hienCo = thongTin.get(ten);
      const daGiong =
        hienCo &&
        JSON.stringify(hienCo.options?.validator ?? null) === JSON.stringify(def.validator) &&
        hienCo.options?.validationLevel === MUC_KIEM_TRA.validationLevel &&
        hienCo.options?.validationAction === MUC_KIEM_TRA.validationAction;
      if (daGiong) {
        console.log(`  ${ten}: đã áp, không đổi.`);
        continue;
      }
      if (!hienCo) {
        console.log(`  ${ten}: chưa có collection → ${thu ? 'sẽ tạo' : 'tạo'} kèm validator.`);
        if (!thu) await db.createCollection(ten, { validator: def.validator, ...MUC_KIEM_TRA });
        continue;
      }
      // Tìm tài liệu KHÔNG thoả validator: $nor phủ định đúng biểu thức sẽ dùng làm validator.
      const locViPham = { $nor: [def.validator] };
      const soViPham = await db.collection(ten).countDocuments(locViPham);
      if (soViPham > 0) {
        coLoi = true;
        const mau = await db.collection(ten).find(locViPham, { projection: { _id: 1 } }).limit(5).toArray();
        console.error(`  ${ten}: ${soViPham} tài liệu vi phạm, KHÔNG áp. Ví dụ _id: ${mau.map((d) => String(d._id)).join(', ')}`);
        console.error(`    Xem lý do: db.${ten}.validate() sau khi áp với validationAction "warn", hoặc chạy db/truy-van-mau/01-validator.mongodb.js`);
        continue;
      }
      console.log(`  ${ten}: 0 vi phạm → ${thu ? 'sẽ áp' : 'áp'}. ${def.moTa}`);
      if (!thu) await db.command({ collMod: ten, validator: def.validator, ...MUC_KIEM_TRA });
    }

    // 2. Index: khai báo trong schema Mongoose là nguồn duy nhất; ở đây chỉ so với CSDL rồi tạo phần thiếu.
    console.log('\n== Index ==');
    for (const { name } of ALL_MODELS) {
      const m = mongoose.models[name] ?? mongoose.model(name, ALL_MODELS.find((x) => x.name === name)!.schema);
      const ten = m.collection.collectionName;
      const khaiBao = m.schema.indexes() as IndexKhaiBao[];
      const thucTe = thongTin.has(ten) ? ((await db.collection(ten).listIndexes().toArray()) as unknown as IndexThucTe[]) : [];
      const ss = soSanhIndex(khaiBao, thucTe);
      if (!ss.thieu.length && !ss.thua.length && !ss.lech.length) continue;
      for (const kb of ss.thieu) {
        console.log(`  ${ten}: thiếu ${JSON.stringify(kb[0])}${kb[1]?.name ? ` (${kb[1].name})` : ''} → ${thu ? 'sẽ tạo' : 'tạo'}`);
        // Tạo từng index còn thiếu (không gọi createIndexes của model: nó sẽ lỗi nếu collection còn một index "lệch" chưa xử lý).
        if (!thu) await db.collection(ten).createIndex(kb[0] as never, (kb[1] ?? {}) as never);
      }
      for (const l of ss.lech) {
        coLoi = true;
        console.error(`  ${ten}: index ${l.thucTe.name} khác tuỳ chọn ở ${l.khac.join(', ')}. Xoá tay rồi chạy lại: db.${ten}.dropIndex("${l.thucTe.name}")`);
      }
      for (const t of ss.thua) {
        console.log(`  ${ten}: thừa ${t.name} ${JSON.stringify(t.key)} (code không khai báo) → ${xoaThua ? (thu ? 'sẽ xoá' : 'xoá') : 'giữ; thêm --xoa-index-thua để xoá'}`);
        if (xoaThua && !thu) await db.collection(ten).dropIndex(t.name);
      }
    }
    console.log(coLoi ? '\nKết thúc CÓ lỗi: xem các dòng ở trên.' : `\nXong${thu ? ' (chưa ghi gì)' : ''}.`);
  } finally {
    await mongoose.disconnect();
  }
  if (coLoi) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
