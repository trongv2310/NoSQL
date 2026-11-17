import { readFileSync } from 'fs';
import mongoose, { Model } from 'mongoose';
import { join } from 'path';
import { VALIDATORS } from '../csdl/validators';
import { ChiTietSanPhamSchema } from '../schemas';
import { docChuoi } from '../seed/du-lieu-mongodb';
import { dieuKienThuocTinh, thuocTinhTuThongSo } from './thuoc-tinh';
import { BoLocThongSo, bienTheKhopBoLoc, LOI_CHOI_KHOA, NHOM_CAN_BANG, NHOM_DO_CUNG } from './vot-thong-so';

/**
 * Chạy trên MongoDB THẬT (CSDL tạm, xoá sau khi xong). Bỏ qua khi không đặt MONGO_TEST_URI, ví dụ:
 *   MONGO_TEST_URI=mongodb://127.0.0.1:27017 npx vitest run src/catalog/bo-loc-mongo.spec.ts
 */
const URI = process.env.MONGO_TEST_URI;
const TEN_DB = `kiem_thu_bo_loc_${process.pid}`;
const tapCon = <T,>(ds: readonly T[]): T[][] => ds.reduce<T[][]>((acc, x) => [...acc, ...acc.map((a) => [...a, x])], [[]]);

describe.skipIf(!URI)('bộ lọc thông số trên MongoDB thật', () => {
  let conn: mongoose.Connection;
  let M: Model<any>;
  const seed = docChuoi(readFileSync(join(__dirname, '../../seed-data/mongodb/chitietsanphams.json'), 'utf8'));

  beforeAll(async () => {
    // Tắt tự tạo collection/index để collection được tạo kèm validator ngay dưới đây.
    conn = await mongoose.createConnection(URI!, { dbName: TEN_DB, autoCreate: false, autoIndex: false }).asPromise();
    M = conn.model('ChiTietSanPham', ChiTietSanPhamSchema);
    await conn.createCollection('chitietsanphams', { validator: VALIDATORS.chitietsanphams.validator, validationLevel: 'strict', validationAction: 'error' });
    await M.syncIndexes();
    // Nhập qua model để hook tính thuocTinh, đúng như đường ghi của ứng dụng.
    await M.insertMany(seed.map(({ _id, sanPham, sku, soLuongTon, thongSo }) => ({ _id, sanPham, sku, soLuongTon, thongSo })));
  }, 30_000);

  afterAll(async () => {
    await conn?.dropDatabase();
    await conn?.close();
  });

  it('hook insertMany đã ghi thuocTinh cho mọi biến thể có thông số, và không ghi cho biến thể không có', async () => {
    expect(await M.countDocuments({ thongSo: { $ne: null }, thuocTinh: { $exists: false } })).toBe(0);
    expect(await M.countDocuments({ thongSo: null, thuocTinh: { $exists: true } })).toBe(0);
  });

  it('mọi tổ hợp bộ lọc: tập sản phẩm từ MongoDB trùng tập sản phẩm của bộ lọc cũ (JS)', async () => {
    const lech: string[] = [];
    let soToHop = 0;
    for (const canBang of tapCon(NHOM_CAN_BANG))
      for (const doCung of tapCon(NHOM_DO_CUNG))
        for (const trongLuong of tapCon(['3u', '4u', '5u']))
          for (const loiChoi of tapCon(LOI_CHOI_KHOA)) {
            const b: BoLocThongSo = { canBang, doCung, trongLuong, loiChoi };
            const dk = dieuKienThuocTinh(b);
            if (!dk) continue;
            soToHop++;
            const cu = new Set(seed.filter((d) => bienTheKhopBoLoc(d.thongSo as never, b)).map((d) => String(d.sanPham)));
            const moi = new Set((await M.aggregate([{ $match: dk }, { $group: { _id: '$sanPham' } }])).map((x) => String(x._id)));
            if ([...cu].sort().join() !== [...moi].sort().join()) lech.push(`${JSON.stringify(b)}: cũ ${cu.size}, mới ${moi.size}`);
          }
    expect(soToHop).toBe(8 ** 4 - 1);
    expect(lech.slice(0, 5)).toEqual([]);
  }, 60_000);

  it('truy vấn lọc dùng index thuoc_tinh (IXSCAN, không quét cả collection)', async () => {
    const dk = dieuKienThuocTinh({ canBang: ['nang'], doCung: [], trongLuong: ['4u'], loiChoi: [] })!;
    const e: any = await M.find(dk).explain('queryPlanner');
    const s = JSON.stringify(e.queryPlanner.winningPlan);
    expect(s).toContain('thuoc_tinh');
    expect(s).not.toContain('COLLSCAN');
  });

  it('hook cập nhật: đặt, sửa, xoá thongSo kéo theo thuocTinh trong cùng lệnh', async () => {
    const { _id } = await M.create({ sanPham: new mongoose.Types.ObjectId(), sku: 'KT-HOOK', soLuongTon: 1 });
    expect((await M.findById(_id).lean<any>()).thuocTinh).toBeUndefined();

    await M.updateOne({ _id }, { $set: { thongSo: { doCanBang: 'Nhẹ đầu', doCung: 'Cứng', trongLuong: '5U (75-79g)' } } });
    let d = await M.findById(_id).lean<any>();
    expect(d.thuocTinh).toEqual(thuocTinhTuThongSo(d.thongSo));
    expect(d.thuocTinh).toContainEqual({ k: 'trongLuongU', v: 5 });

    await M.findOneAndUpdate({ _id }, { thongSo: { doCanBang: 'Nặng đầu', doCung: 'Cứng' } });
    d = await M.findById(_id).lean<any>();
    expect(d.thuocTinh).toContainEqual({ k: 'canBangBac', v: 2 });
    expect(d.thuocTinh.some((t: any) => t.k === 'trongLuongU')).toBe(false);

    await M.updateOne({ _id }, { $unset: { thongSo: '' } });
    d = await M.findById(_id).lean<any>();
    expect(d.thongSo).toBeUndefined();
    expect(d.thuocTinh).toBeUndefined();

    await expect(M.updateOne({ _id }, { $set: { 'thongSo.doCung': 'Mềm' } })).rejects.toThrow(/thongSo/);
  });

  it('validator chặn thuộc tính lạ khi ghi thẳng bằng driver (bỏ qua Mongoose)', async () => {
    const col = conn.db!.collection('chitietsanphams');
    await expect(
      col.insertOne({ sanPham: new mongoose.Types.ObjectId(), sku: 'KT-LA', soLuongTon: 0, thuocTinh: [{ k: 'mauYeuThich', v: 'đỏ' }] } as never),
    ).rejects.toThrow(/validation/i);
    await expect(
      col.insertOne({ sanPham: new mongoose.Types.ObjectId(), sku: 'KT-LA2', soLuongTon: 0, thuocTinh: [{ k: 'trongLuongU', v: true }] } as never),
    ).rejects.toThrow(/validation/i);
  });
});
