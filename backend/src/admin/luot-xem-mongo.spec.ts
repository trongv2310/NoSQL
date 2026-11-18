import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import mongoose, { Connection, Model, Types } from 'mongoose';
import { CatalogService } from '../catalog/catalog.service';
import { sinhLuotXemMau } from '../csdl/du-lieu-mau';
import { ALL_MODELS, ChiTietSanPham, Hang, KhuyenMai, LoaiSanPham, LuotXem, NGAY_GIU_LUOT_XEM, PhanHoi, SanPham } from '../schemas';
import { locMau, pipelineLuotXemTheoNgay, pipelineXemNhieu } from './bao-cao-csdl';

describe('lượt xem mẫu (không cần MongoDB)', () => {
  it('cố định theo hạt giống, gắn laDuLieuMau, không có lượt xem ở tương lai, cuối tuần đông hơn ngày thường', () => {
    const now = new Date(2026, 10, 18, 15, 0);
    const sp = Array.from({ length: 10 }, (_, i) => `sp${i}`);
    const a = sinhLuotXemMau(sp, { now });
    expect(sinhLuotXemMau(sp, { now })).toEqual(a);
    expect(a.every((d) => d.laDuLieuMau && d.luc <= now)).toBe(true);
    const tbTheo = (cuoiTuan: boolean) => {
      const ngay = new Map<string, number>();
      for (const d of a) if ([0, 6].includes(d.luc.getDay()) === cuoiTuan) ngay.set(d.luc.toDateString(), (ngay.get(d.luc.toDateString()) ?? 0) + 1);
      return [...ngay.values()].reduce((s, x) => s + x, 0) / ngay.size;
    };
    expect(tbTheo(true)).toBeGreaterThan(tbTheo(false));
  });
});

const BASE = (process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017').replace(/\/+$/, '');
function mongoSanSang(): boolean {
  const ma = `require("mongoose").createConnection(${JSON.stringify(`${BASE}/admin`)},{serverSelectionTimeoutMS:1500}).asPromise().then(c=>c.close()).then(()=>process.exit(0),()=>process.exit(1))`;
  return spawnSync(process.execPath, ['-e', ma], { timeout: 10_000 }).status === 0;
}

describe.runIf(mongoSanSang())('lượt xem: time series collection (MongoDB thật)', () => {
  const tenDb = `test_luot_xem_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  let conn: Connection;
  let LX: Model<any>, SP: Model<any>;
  let catalog: CatalogService;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  const luc = (soNgayTruoc: number, gio = 10) => { const d = new Date(now); d.setDate(d.getDate() - soNgayTruoc); d.setHours(gio, 0, 0, 0); return d; };

  beforeAll(async () => {
    expect(tenDb).toMatch(/^test_luot_xem_[0-9a-f]{12}$/);
    conn = await mongoose.createConnection(`${BASE}/${tenDb}`).asPromise();
    for (const m of ALL_MODELS) conn.model(m.name, m.schema);
    await Promise.all(Object.values(conn.models).map((m) => m.init())); // Mongoose tự tạo time series theo tuỳ chọn schema
    const M = (c: { name: string }) => conn.model(c.name) as any;
    LX = M(LuotXem);
    SP = M(SanPham);
    catalog = new CatalogService(SP, M(ChiTietSanPham), M(PhanHoi), M(Hang), M(LoaiSanPham), M(KhuyenMai), LX);
  });

  afterAll(async () => {
    if (conn && tenDb.startsWith('test_luot_xem_')) await conn.dropDatabase();
    await conn?.close();
  });

  it('được tạo đúng là time series: timeField/metaField/granularity, tự xoá sau 180 ngày, index sanPham + luc', async () => {
    const [c] = await conn.db!.listCollections({ name: 'luotxems' }).toArray();
    expect(c.type).toBe('timeseries');
    expect((c as any).options.timeseries).toMatchObject({ timeField: 'luc', metaField: 'sanPham', granularity: 'hours' });
    expect(Number((c as any).options.expireAfterSeconds)).toBe(NGAY_GIU_LUOT_XEM * 86_400);
    expect((await LX.collection.indexes()).map((i) => i.name)).toContain('sanPham_1_luc_1');
  });

  it('chỉ ghi lượt xem cho sản phẩm đang bán', async () => {
    const dang = await SP.create({ tenSanPham: 'Vợt đang bán', giaGoc: 1 });
    const xoa = await SP.create({ tenSanPham: 'Vợt đã xoá', giaGoc: 1, deletedAt: new Date() });
    expect(await catalog.ghiLuotXem(String(dang._id))).toBe(true);
    expect(await catalog.ghiLuotXem(String(xoa._id))).toBe(false);
    expect(await catalog.ghiLuotXem(String(new Types.ObjectId()))).toBe(false);
    expect(await LX.countDocuments({ sanPham: dang._id })).toBe(1);
    expect(await LX.countDocuments({ sanPham: xoa._id })).toBe(0);
    await LX.deleteMany({});
  });

  it('theo ngày: đủ 30 ngày (ngày trống = 0 nhờ $densify + $fill), trung bình trượt 7 ngày đúng; dữ liệu mẫu bị loại mặc định', async () => {
    const sp = new Types.ObjectId();
    // hôm nay 3 lượt, hôm qua 0, 2 ngày trước 4 lượt; 40 ngày trước (ngoài cửa sổ) 9 lượt; một lượt mẫu hôm nay
    await LX.insertMany([
      ...Array.from({ length: 3 }, (_, i) => ({ luc: new Date(Math.max(+luc(0, 0), +now - i * 1000)), sanPham: sp })), // trong hôm nay, không ở tương lai
      ...Array.from({ length: 4 }, () => ({ luc: luc(2), sanPham: sp })),
      ...Array.from({ length: 9 }, () => ({ luc: luc(40), sanPham: sp })),
      { luc: now, sanPham: sp, laDuLieuMau: true },
    ]);
    const r = await LX.aggregate(pipelineLuotXemTheoNgay(locMau(false), now, tz));
    expect(r).toHaveLength(30);
    expect(r.map((x) => x.so).slice(-3)).toEqual([4, 0, 3]);
    expect(r.reduce((s, x) => s + x.so, 0)).toBe(7);
    expect(r.at(-1).tb7).toBe(1); // (4 + 0 + 3) / 7
    expect(new Date(r.at(-1).ngay).getDate()).toBe(now.getDate());
    expect((await LX.aggregate(pipelineLuotXemTheoNgay(locMau(true), now, tz))).at(-1).so).toBe(4);
    await LX.deleteMany({});
  });

  it('xem nhiều nhất 7 ngày qua: sắp theo số lượt, kèm tên (lookup) và số ngày có người xem', async () => {
    const [a, b] = await SP.create([{ tenSanPham: 'Vợt A', giaGoc: 1 }, { tenSanPham: 'Vợt B', giaGoc: 1 }]);
    await LX.insertMany([
      ...[0, 1, 2].map((d) => ({ luc: luc(d, 9), sanPham: a._id })),
      ...Array.from({ length: 5 }, () => ({ luc: luc(1, 9), sanPham: b._id })),
      ...Array.from({ length: 50 }, () => ({ luc: luc(20, 9), sanPham: a._id })), // ngoài 7 ngày
    ]);
    const top = await LX.aggregate(pipelineXemNhieu(locMau(false), now, tz));
    expect(top.map((x) => [x.tenSanPham, x.so, x.soNgayCoXem])).toEqual([['Vợt B', 5, 1], ['Vợt A', 3, 3]]);
    await LX.deleteMany({});
  });

  it('nén theo bucket: 6.000 lượt xem của 3 sản phẩm chỉ chiếm vài chục bucket ($collStats)', async () => {
    // 6.000 lượt cách nhau 5 phút ≈ 21 ngày; granularity hours cho bucket dài tới 30 ngày.
    const sp = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
    await LX.insertMany(Array.from({ length: 6000 }, (_, i) => ({ luc: new Date(now.getTime() - i * 5 * 60_000), sanPham: sp[i % 3] })));
    const [s] = await LX.aggregate([{ $collStats: { storageStats: {} } }]);
    expect(await LX.countDocuments()).toBe(6000);
    expect(s.storageStats.timeseries.bucketCount).toBeLessThan(30);
    await LX.deleteMany({});
  });
});
