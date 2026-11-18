import mongoose, { Types } from 'mongoose';
import { sinhDuLieuMau, taoNgauNhien } from '../csdl/du-lieu-mau';
import { VALIDATORS } from '../csdl/validators';
import {
  locMau, pipelineChuKyThucTe, pipelineDayTheoLoiChoi, pipelineDenHan, pipelineMucCangTheoTrinhDo, pipelinePhanBoMucCang,
  pipelineVotTheoTrinhDo, pipelineVuotMucNSX,
} from './bao-cao-csdl';

/** MongoDB thật (MONGO_TEST_URI): sinh dữ liệu mẫu cố định vào CSDL tạm, chạy từng pipeline báo cáo và so với kết quả tính bằng JS. */
const URI = process.env.MONGO_TEST_URI;
const lamTron = (x: number) => Math.round(x * 1000) / 1000;

describe.skipIf(!URI)('báo cáo aggregation trên MongoDB thật', () => {
  let conn: mongoose.Connection;
  let db: mongoose.mongo.Db;
  const sanPham = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
  const phienBan = [
    { bienThe: new Types.ObjectId(), sanPham: sanPham[0], ten: 'Vợt nặng đầu', canBangBac: 2, doCungBac: 2, trongLuongU: 4, sucCangMinLbs: 20, sucCangMaxLbs: 28 },
    { bienThe: new Types.ObjectId(), sanPham: sanPham[1], ten: 'Vợt nhẹ đầu', canBangBac: -1, doCungBac: 1, trongLuongU: 4, sucCangMinLbs: 19, sucCangMaxLbs: 27 },
    { bienThe: new Types.ObjectId(), sanPham: sanPham[2], ten: 'Vợt cân bằng', canBangBac: 0, doCungBac: 1, trongLuongU: 3, sucCangMinLbs: 21, sucCangMaxLbs: 29 },
  ];
  const dl = sinhDuLieuMau(phienBan, { hat: 7, soNguoi: 60, homNay: new Date('2026-11-18T00:00:00Z') });
  // Thêm một lần căng KHÔNG phải mẫu để kiểm bộ lọc dữ liệu mẫu.
  const { laDuLieuMau: _bo, ...goc } = dl.lancangs[0];
  void _bo;
  const that = { ...goc, _id: new Types.ObjectId(), mucCangLbs: 30, vuotMucNSX: false };

  beforeAll(async () => {
    conn = await mongoose.createConnection(URI!, { dbName: `kiem_thu_bao_cao_${process.pid}` }).asPromise();
    db = conn.db!;
    for (const ten of ['khachhangs', 'votcanhans', 'lancangs', 'phanhois']) {
      await db.createCollection(ten, { validator: VALIDATORS[ten].validator, validationLevel: 'strict', validationAction: 'error' });
    }
    await db.collection('sanphams').insertMany(sanPham.map((_id, i) => ({ _id, tenSanPham: phienBan[i].ten })));
    // Đi qua validator thật: dữ liệu mẫu phải hợp lệ như dữ liệu người dùng.
    await db.collection('khachhangs').insertMany(dl.khachhangs);
    await db.collection('votcanhans').insertMany(dl.votcanhans);
    await db.collection('lancangs').insertMany([...dl.lancangs, that]);
    await db.collection('phanhois').insertMany(dl.phanhois);
  }, 30_000);

  afterAll(async () => {
    await conn?.dropDatabase();
    await conn?.close();
  });

  it('bộ sinh cố định: cùng hạt → cùng số liệu', () => {
    const a = sinhDuLieuMau(phienBan, { hat: 7, soNguoi: 60, homNay: new Date('2026-11-18T00:00:00Z') });
    expect(a.lancangs.map((l) => l.mucCangLbs)).toEqual(dl.lancangs.map((l) => l.mucCangLbs));
    expect(taoNgauNhien(1).r()).toBe(taoNgauNhien(1).r());
  });

  it('mức căng theo trình độ ($group) khớp tính tay; bỏ dữ liệu mẫu thì chỉ còn bản ghi thật', async () => {
    const r = await db.collection('lancangs').aggregate(pipelineMucCangTheoTrinhDo(locMau(true))).toArray();
    for (const nhom of r) {
      const ds = dl.lancangs.filter((l) => l.nguoiDanhChup.trinhDo === nhom._id).map((l) => l.mucCangLbs);
      if (nhom._id === that.nguoiDanhChup.trinhDo) ds.push(that.mucCangLbs);
      expect(nhom.so).toBe(ds.length);
      expect(lamTron(nhom.tb)).toBe(lamTron(ds.reduce((t, x) => t + x, 0) / ds.length));
      expect(nhom.caoNhat).toBe(Math.max(...ds));
    }
    // Quy tắc sinh: thi đấu căng cao hơn chơi đều, chơi đều cao hơn mới chơi.
    const tb = Object.fromEntries(r.map((x) => [x._id, x.tb]));
    expect(tb.thi).toBeGreaterThan(tb.deu);
    expect(tb.deu).toBeGreaterThan(tb.moi);
    const chiThat = await db.collection('lancangs').aggregate(pipelineMucCangTheoTrinhDo(locMau(false))).toArray();
    expect(chiThat).toEqual([expect.objectContaining({ _id: that.nguoiDanhChup.trinhDo, so: 1, tb: 30 })]);
  });

  it('$bucket phân bố đủ mọi lần căng; $group hai tầng ra tối đa 3 dây cho mỗi lối chơi', async () => {
    const pb = await db.collection('lancangs').aggregate(pipelinePhanBoMucCang(locMau(true))).toArray();
    expect(pb.reduce((t, x) => t + x.so, 0)).toBe(dl.lancangs.length + 1);
    const day = await db.collection('lancangs').aggregate(pipelineDayTheoLoiChoi(locMau(true))).toArray();
    expect(day.map((x) => x._id)).toEqual(['cong', 'toan', 'toc']);
    for (const x of day) {
      expect(x.day.length).toBeLessThanOrEqual(3);
      expect(x.day[0].so).toBeGreaterThanOrEqual(x.day[x.day.length - 1].so);
    }
  });

  it('chu kỳ thực tế ($setWindowFields + $shift + $dateDiff) khớp tính tay theo từng cây vợt', async () => {
    const r = await db.collection('lancangs').aggregate(pipelineChuKyThucTe(locMau(false) /* chỉ bản ghi thật: 1 lần → không có khoảng */)).toArray();
    expect(r).toEqual([]);
    const coMau = await db.collection('lancangs').aggregate(pipelineChuKyThucTe({ laDuLieuMau: true })).toArray();
    const khoang: Record<string, number[]> = {};
    const theoVot = new Map<string, any[]>();
    for (const l of dl.lancangs) theoVot.set(String(l.votCaNhan), [...(theoVot.get(String(l.votCaNhan)) ?? []), l]);
    for (const ds of theoVot.values()) {
      ds.sort((a, b) => a.ngay - b.ngay);
      for (let i = 1; i < ds.length; i++) (khoang[ds[i].nguoiDanhChup.trinhDo] ??= []).push(Math.round((ds[i].ngay - ds[i - 1].ngay) / 86_400_000));
    }
    for (const x of coMau) {
      expect(x.so).toBe(khoang[x._id].length);
      expect(lamTron(x.tb)).toBe(lamTron(khoang[x._id].reduce((t, n) => t + n, 0) / khoang[x._id].length));
    }
  });

  it('tỉ lệ vượt mức NSX khớp số cờ vuotMucNSX; vượt chỉ xảy ra khi căng ở ngoài', async () => {
    const r = await db.collection('lancangs').aggregate(pipelineVuotMucNSX({ laDuLieuMau: true })).toArray();
    const vuot = Object.fromEntries(r.map((x) => [x._id, x.vuot]));
    expect(vuot.shop ?? 0).toBe(0);
    expect(vuot.ngoai).toBe(dl.lancangs.filter((l) => l.vuotMucNSX).length);
  });

  it('vợt được chấm cao theo trình độ: ≥ 3 đánh giá, tối đa 3 vợt mỗi trình độ, có tên qua $lookup', async () => {
    const r = await db.collection('phanhois').aggregate(pipelineVotTheoTrinhDo(locMau(true))).toArray();
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) {
      expect(x.so).toBeGreaterThanOrEqual(3);
      expect(phienBan.map((p) => p.ten)).toContain(x.ten);
      const ds = dl.phanhois.filter((p) => p.nguoiDanh.trinhDo === x.trinhDo && p.sanPham.equals(x.sanPham)).map((p) => p.danhGia);
      expect(x.tb).toBe(Math.round((ds.reduce((t, n) => t + n, 0) / ds.length) * 100) / 100);
    }
  });

  it('đếm vợt đến hạn căng lại khớp hanNhacLuc', async () => {
    const now = new Date('2026-11-18T00:00:00Z');
    const r = await db.collection('votcanhans').aggregate(pipelineDenHan(locMau(true), now)).toArray();
    const den = dl.votcanhans.filter((v) => v.hanNhacLuc && v.hanNhacLuc <= now).length;
    expect(r.find((x) => x._id === 'daDenHan')?.so ?? 0).toBe(den);
  });
});
