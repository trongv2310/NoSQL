import mongoose, { Connection, Model, Types } from 'mongoose';
import { GiaoDich } from '../csdl/giao-dich';
import { VALIDATORS } from '../csdl/validators';
import { ALL_MODELS, ChiTietSanPham, Counter, DonHang, GioHang, SanPham, TRANG_THAI } from '../schemas';
import { OrderService } from './order.service';

/**
 * Đặt hàng / huỷ đơn trên MongoDB thật, chạy ở CẢ HAI chế độ:
 *   MONGO_TEST_URI     (standalone: không có transaction, bù trừ bằng tay)
 *   MONGO_RS_TEST_URI  (replica set: một transaction, lỗi thì MongoDB huỷ hết)
 */
const CHE_DO = [
  ['standalone', process.env.MONGO_TEST_URI],
  ['replica set', process.env.MONGO_RS_TEST_URI],
].filter((x): x is [string, string] => !!x[1]);

describe.skipIf(!CHE_DO.length).each(CHE_DO.length ? CHE_DO : [['bỏ qua', '']])('đặt hàng và huỷ đơn — %s', (cheDo, uri) => {
  const coTransaction = cheDo === 'replica set';
  let conn: Connection;
  let CT: Model<any>, DH: Model<any>, DEM: Model<any>, SP: Model<any>;
  let don: OrderService;
  const khach = new Types.ObjectId();
  let seq = 0;

  beforeAll(async () => {
    conn = await mongoose.createConnection(uri, { dbName: `kiem_thu_dat_hang_${process.pid}_${cheDo.length}`, autoCreate: false, autoIndex: false }).asPromise();
    for (const m of ALL_MODELS) conn.model(m.name, m.schema);
    // Collection tạo TRƯỚC (kèm validator thật) để transaction không phải tạo collection giữa chừng.
    for (const ten of ['donhangs', 'chitietsanphams', 'sanphams']) await conn.createCollection(ten, { validator: VALIDATORS[ten].validator });
    await Promise.all(Object.values(conn.models).map((m) => m.createIndexes())); // unique soDonHang, sku...
    const M = (c: { name: string }) => conn.model(c.name) as any;
    [CT, DH, DEM, SP] = [M(ChiTietSanPham), M(DonHang), M(Counter), M(SanPham)];
    don = new OrderService(DH, CT, M(GioHang), DEM, undefined, conn);
    expect(await new GiaoDich(conn).hoTro()).toBe(coTransaction);
  });
  afterAll(async () => {
    await conn?.dropDatabase();
    await conn?.close();
  });
  beforeEach(async () => {
    await Promise.all([DH.deleteMany({}), DEM.deleteMany({})]);
  });

  const bienThe = async (ton: number) => {
    const sp = await SP.create({ tenSanPham: `Vợt thử ${++seq}`, giaGoc: 1_000_000 });
    return CT.create({ sanPham: sp._id, sku: `DH-${cheDo.length}-${seq}`, soLuongTon: ton });
  };
  const ton = async (id: Types.ObjectId) => (await CT.findById(id).lean<any>()).soLuongTon;
  const soDem = async () => (await DEM.findById('donhang').lean<any>())?.seq ?? 0;
  const dat = (dong: { chiTietSanPham: unknown; soLuong: number }[], ghiChu = '') => don.createOrder(khach, { hoTenNhan: 'Khách thử', ghiChu }, dong, TRANG_THAI.DangXuLy, false);

  it('20 người cùng mua món còn 5 cái: đúng 5 đơn thành công, kho về 0 (không âm), số đơn liền mạch 1..5', async () => {
    const ct = await bienThe(5);
    const kq = await Promise.allSettled(Array.from({ length: 20 }, () => dat([{ chiTietSanPham: ct._id, soLuong: 1 }])));
    expect(kq.filter((x) => x.status === 'fulfilled')).toHaveLength(5);
    expect(kq.filter((x) => x.status === 'rejected').every((x: any) => /hết hàng|không đủ/.test(x.reason.message))).toBe(true);
    expect(await ton(ct._id)).toBe(0);
    expect((await DH.find().lean<any[]>()).map((d) => d.soDonHang).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('dòng thứ hai hết hàng: dòng thứ nhất đã trừ được trả lại, không có đơn nào', async () => {
    const [a, b] = [await bienThe(3), await bienThe(1)];
    await expect(dat([{ chiTietSanPham: a._id, soLuong: 2 }, { chiTietSanPham: b._id, soLuong: 2 }])).rejects.toThrow(/không đủ/);
    expect([await ton(a._id), await ton(b._id)]).toEqual([3, 1]);
    expect(await DH.countDocuments()).toBe(0);
  });

  it(`lỗi SAU KHI đã trừ kho và lấy số đơn (đơn sai validator): kho trả lại; bộ đếm ${coTransaction ? 'cũng được huỷ (không nhảy số)' : 'đã tăng (nhảy số) vì không có transaction'}`, async () => {
    const [a, b] = [await bienThe(3), await bienThe(3)];
    await expect(dat([{ chiTietSanPham: a._id, soLuong: 1 }, { chiTietSanPham: b._id, soLuong: 2 }], 'x'.repeat(600))).rejects.toThrow();
    expect([await ton(a._id), await ton(b._id)]).toEqual([3, 3]);
    expect(await DH.countDocuments()).toBe(0);
    expect(await soDem()).toBe(coTransaction ? 0 : 1);
    const ok = await dat([{ chiTietSanPham: a._id, soLuong: 1 }]);
    expect(ok.soDonHang).toBe(coTransaction ? 1 : 2);
  });

  it('huỷ đơn hoàn kho đúng một lần dù bấm huỷ hai lần cùng lúc', async () => {
    const ct = await bienThe(4);
    const d = await dat([{ chiTietSanPham: ct._id, soLuong: 3 }]);
    expect(await ton(ct._id)).toBe(1);
    const kq = await Promise.allSettled([don.cancelOrder(d.soDonHang, khach), don.cancelOrder(d.soDonHang, khach)]);
    expect(kq.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await ton(ct._id)).toBe(4);
    expect((await DH.findOne({ soDonHang: d.soDonHang }).lean<any>()).trangThai).toBe(TRANG_THAI.DaHuy);
  });
});
