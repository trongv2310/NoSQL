import mongoose, { Model } from 'mongoose';
import { CUA_SO_DANG_NHAP_MS, quyTacDangNhap } from '../auth/auth.service';
import { VALIDATORS } from '../csdl/validators';
import { GioiHanTanSuatSchema } from '../schemas';
import { batDauCuaSo, GioiHanMongo } from './gioi-han-tan-suat';

describe('cửa sổ cố định', () => {
  it('làm tròn xuống theo độ dài cửa sổ', () => {
    const t = Date.UTC(2026, 10, 18, 10, 7, 30);
    expect(batDauCuaSo(t, CUA_SO_DANG_NHAP_MS).toISOString()).toBe('2026-11-18T10:00:00.000Z');
  });
  it('khoá tài khoản không phân biệt hoa thường, có thêm khoá theo IP', () => {
    expect(quyTacDangNhap('  NguyenVanA ', '1.2.3.4').map((q) => q.khoa)).toEqual(['dang-nhap:tk:nguyenvana', 'dang-nhap:ip:1.2.3.4']);
  });
});

/** MongoDB thật (MONGO_TEST_URI): bộ đếm đăng nhập sai, TTL index. */
const URI = process.env.MONGO_TEST_URI;
describe.skipIf(!URI)('giới hạn tần suất lưu trong MongoDB thật', () => {
  let conn: mongoose.Connection;
  let M: Model<any>;
  let gh: GioiHanMongo;
  beforeAll(async () => {
    conn = await mongoose.createConnection(URI!, { dbName: `kiem_thu_gioi_han_${process.pid}`, autoCreate: false, autoIndex: false }).asPromise();
    M = conn.model('GioiHanTanSuat', GioiHanTanSuatSchema) as unknown as Model<any>;
    await conn.createCollection('gioihantansuats', { validator: VALIDATORS.gioihantansuats.validator, validationLevel: 'strict', validationAction: 'error' });
    await M.syncIndexes();
    gh = new GioiHanMongo(M);
  });
  afterAll(async () => {
    await conn?.dropDatabase();
    await conn?.close();
  });

  it('5 lần sai thì lần thứ 6 bị chặn, kèm số giây phải chờ', async () => {
    const qt = quyTacDangNhap('khach-thu', '10.0.0.1');
    for (let i = 0; i < 5; i++) {
      expect(await gh.daVuot(qt)).toBeNull();
      await gh.ghiNhan(qt);
    }
    const cho = await gh.daVuot(qt);
    expect(cho).toBeGreaterThan(0);
    expect(cho).toBeLessThanOrEqual(15 * 60);
  });

  it('20 lần sai gửi CÙNG LÚC được đếm đủ 20 (upsert + $inc nguyên tử, không mất lượt)', async () => {
    const qt = quyTacDangNhap('song-song', '10.0.0.2');
    await Promise.all(Array.from({ length: 20 }, () => gh.ghiNhan(qt)));
    const d = await M.findOne({ khoa: 'dang-nhap:tk:song-song' }).lean<any>();
    expect(d.so).toBe(20);
    expect(await M.countDocuments({ khoa: 'dang-nhap:tk:song-song' })).toBe(1);
  });

  it('đăng nhập đúng xoá bộ đếm của tài khoản nhưng giữ bộ đếm theo IP', async () => {
    const qt = quyTacDangNhap('dung-roi', '10.0.0.3');
    await gh.ghiNhan(qt);
    await gh.xoa(qt[0].khoa);
    expect(await M.countDocuments({ khoa: qt[0].khoa })).toBe(0);
    expect(await M.countDocuments({ khoa: qt[1].khoa })).toBe(1);
  });

  it('có TTL index trên hetHan (expireAfterSeconds: 0) và validator chặn bộ đếm sai', async () => {
    const idx = (await M.collection.indexes()).find((i) => i.name === 'tu_xoa_khi_het_han');
    expect(idx).toMatchObject({ key: { hetHan: 1 }, expireAfterSeconds: 0 });
    await expect(M.collection.insertOne({ khoa: 'x', cuaSo: new Date(), so: -1, hetHan: new Date(Date.now() + 1000) } as never)).rejects.toThrow(/validation/i);
    await expect(M.collection.insertOne({ khoa: 'x', cuaSo: new Date(), so: 1, hetHan: new Date(Date.now() - 1000) } as never)).rejects.toThrow(/validation/i);
  });
});
