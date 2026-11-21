import mongoose, { Model, Types } from 'mongoose';
import { VALIDATORS } from '../csdl/validators';
import { ChiTietSanPhamSchema, KhachHangSchema, LanCangSchema, LoaiSanPhamSchema, SanPhamSchema, VotCaNhanSchema } from '../schemas';
import { TuVotService } from './tu-vot.service';

/**
 * Chạy trên MongoDB THẬT, mỗi chế độ một CSDL tạm (xoá sau khi xong):
 * - MONGO_TEST_URI: standalone (không transaction → đường bù trừ);
 * - MONGO_RS_TEST_URI: replica set (có transaction), ví dụ mongod --replSet ... cổng 27018.
 */
const CHE_DO = [
  ['standalone', process.env.MONGO_TEST_URI],
  ['replica set', process.env.MONGO_RS_TEST_URI],
].filter((x): x is [string, string] => !!x[1]);

describe.skipIf(!CHE_DO.length).each(CHE_DO.length ? CHE_DO : [['bỏ qua', '']])('hộ chiếu cây vợt trên MongoDB thật (%s)', (cheDo, uri) => {
  let conn: mongoose.Connection;
  let svc: TuVotService;
  let Vot: Model<any>, Lan: Model<any>, KH: Model<any>, CT: Model<any>, SP: Model<any>, Loai: Model<any>;
  let kh: Types.ObjectId;
  let bienThe: Types.ObjectId;
  let sanPham: Types.ObjectId;

  beforeAll(async () => {
    conn = await mongoose.createConnection(uri, { dbName: `kiem_thu_tu_vot_${process.pid}_${cheDo.length}`, autoCreate: false, autoIndex: false }).asPromise();
    const m = (ten: string, schema: any) => conn.model(ten, schema) as unknown as Model<any>;
    Vot = m('VotCaNhan', VotCaNhanSchema); Lan = m('LanCang', LanCangSchema); KH = m('KhachHang', KhachHangSchema);
    CT = m('ChiTietSanPham', ChiTietSanPhamSchema); SP = m('SanPham', SanPhamSchema); Loai = m('LoaiSanPham', LoaiSanPhamSchema);
    for (const ten of ['votcanhans', 'lancangs']) await conn.createCollection(ten, { validator: VALIDATORS[ten].validator, validationLevel: 'strict', validationAction: 'error' });
    for (const ten of ['khachhangs', 'chitietsanphams', 'sanphams', 'loaisanphams', 'donhangs']) await conn.createCollection(ten);
    await Vot.syncIndexes(); await Lan.syncIndexes();
    const loaiVot = await Loai.create({ tenLoai: 'Vợt cầu lông' });
    const loaiGiay = await Loai.create({ tenLoai: 'Giày cầu lông' });
    sanPham = (await SP.create({ tenSanPham: 'Vợt thử', giaGoc: 1, loai: loaiVot._id }))._id;
    (globalThis as any).__spGiay = (await SP.create({ tenSanPham: 'Giày thử', giaGoc: 1, loai: loaiGiay._id }))._id;
    bienThe = (await CT.create({ sanPham, sku: `VT-${cheDo}`, soLuongTon: 5, thongSo: { trongLuong: '4U (80-84g)', sucCang: '20-28 lbs' } }))._id;
    kh = (await KH.create({ hoTen: 'Khách thử', hoSoChoi: { trinhDo: 'deu', loiChoi: 'toc' } }))._id;
    svc = new TuVotService(conn as never, Vot as never, Lan as never, KH as never, CT as never, SP as never);
  }, 30_000);

  afterAll(async () => {
    await conn?.dropDatabase();
    await conn?.close();
  });

  it(`phát hiện đúng chế độ transaction (${cheDo})`, async () => {
    expect(await svc.dungTransaction()).toBe(cheDo === 'replica set');
  });

  it('tạo hộ chiếu chụp khoảng căng của phiên bản; 12 lần căng (ngày lộn xộn) → nhúng 10 lần mới nhất, đếm đủ 12', async () => {
    const vot = await svc.tao(kh, { ten: 'Vợt của tôi', bienTheId: String(bienThe), chuKyNhacNgay: 30 });
    expect(vot.thongSoChup).toEqual({ sucCangMinLbs: 20, sucCangMaxLbs: 28, trongLuongU: 4 });
    const ngays = [5, 1, 12, 3, 9, 2, 11, 7, 4, 10, 6, 8].map((d) => `2026-10-${String(d).padStart(2, '0')}`);
    for (const ngay of ngays) await svc.ghiLanCang(kh, String(vot._id), { ngay, giaTri: 24, donVi: 'lbs', noiCang: 'ngoai' });
    const d = await Vot.findById(vot._id).lean<any>();
    expect(d.soLanCang).toBe(12);
    expect(d.lichSuCang).toHaveLength(10);
    expect(d.lichSuCang.map((x: any) => x.ngay.toISOString().slice(8, 10))).toEqual(['12', '11', '10', '09', '08', '07', '06', '05', '04', '03']);
    expect(d.lanCangGanNhat.ngay.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(d.hanNhacLuc.toISOString()).toBe('2026-11-11T00:00:00.000Z'); // 12/10 + 30 ngày ($dateAdd)
    expect(await Lan.countDocuments({ votCaNhan: vot._id })).toBe(12);
    expect((await Lan.findOne({ votCaNhan: vot._id }).lean<any>()).nguoiDanhChup).toEqual({ trinhDo: 'deu', loiChoi: 'toc' });

    // Ghi một lần căng CŨ: lanCangGanNhat không lùi, lần cũ không lọt vào 10 lần nhúng.
    await svc.ghiLanCang(kh, String(vot._id), { ngay: '2026-01-01', giaTri: 11, donVi: 'kg', noiCang: 'ngoai' });
    const d2 = await Vot.findById(vot._id).lean<any>();
    expect(d2.soLanCang).toBe(13);
    expect(d2.lanCangGanNhat.ngay.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(d2.lichSuCang).toHaveLength(10);
  });

  it('đổi chu kỳ tính lại hạn nhắc trong cùng lệnh; tắt nhắc thì bỏ trường (index sparse)', async () => {
    const vot = await svc.tao(kh, { ten: 'Vợt chu kỳ' });
    await svc.ghiLanCang(kh, String(vot._id), { ngay: '2026-11-01', giaTri: 25, donVi: 'lbs', noiCang: 'ngoai' });
    expect((await Vot.findById(vot._id).lean<any>()).hanNhacLuc).toBeUndefined();
    await svc.sua(kh, String(vot._id), { chuKyNhacNgay: 14 });
    expect((await Vot.findById(vot._id).lean<any>()).hanNhacLuc.toISOString()).toBe('2026-11-15T00:00:00.000Z');
    await svc.sua(kh, String(vot._id), { chuKyNhacNgay: null });
    const d = await Vot.findById(vot._id).lean<any>();
    expect(d.hanNhacLuc).toBeUndefined();
    expect(d.chuKyNhacNgay).toBeUndefined();
  });

  it('vượt mức nhà sản xuất: căng tại shop bị từ chối; căng ở ngoài vẫn ghi nhưng gắn cờ', async () => {
    const vot = await svc.tao(kh, { ten: 'Vợt vượt mức', bienTheId: String(bienThe) });
    await expect(svc.ghiLanCang(kh, String(vot._id), { ngay: '2026-11-01', giaTri: 30, donVi: 'lbs', noiCang: 'shop' })).rejects.toThrow(/vượt mức tối đa/);
    expect(await Lan.countDocuments({ votCaNhan: vot._id })).toBe(0);
    const r = await svc.ghiLanCang(kh, String(vot._id), { ngay: '2026-11-01', giaTri: 30, donVi: 'lbs', noiCang: 'ngoai' });
    expect(r.vuotMucNSX).toBe(true);
    expect((await Lan.findOne({ votCaNhan: vot._id }).lean<any>()).vuotMucNSX).toBe(true);
  });

  it(`bước cập nhật hộ chiếu lỗi → không còn lần căng mồ côi (${cheDo === 'replica set' ? 'transaction huỷ' : 'bù trừ xoá'})`, async () => {
    const vot = await svc.tao(kh, { ten: 'Vợt lỗi giữa chừng' });
    const goc = Vot.updateOne.bind(Vot);
    (Vot as any).updateOne = () => { throw new Error('lỗi giả lập'); };
    try {
      await expect(svc.ghiLanCang(kh, String(vot._id), { ngay: '2026-11-01', giaTri: 25, donVi: 'lbs', noiCang: 'ngoai' })).rejects.toThrow('lỗi giả lập');
    } finally {
      (Vot as any).updateOne = goc;
    }
    expect(await Lan.countDocuments({ votCaNhan: vot._id })).toBe(0);
    expect((await Vot.findById(vot._id).lean<any>()).soLanCang).toBe(0);
  });

  it('chuyển tủ vợt từ trình duyệt: gửi lại lần hai không nhân đôi vợt lẫn lần căng', async () => {
    const ds = [
      { id: 'v-aaa', ten: 'Vợt trong trình duyệt', ngayCang: '2026-11-02', cang: { giaTri: 11, donVi: 'kg' as const }, chuKyNgay: 45 },
      { id: 'v-bbb', ten: 'Vợt chưa căng' },
    ];
    expect(await svc.chuyenTuTrinhDuyet(kh, ds)).toEqual({ them: 2, daCo: 0, loi: [] });
    expect(await svc.chuyenTuTrinhDuyet(kh, ds)).toEqual({ them: 0, daCo: 2, loi: [] });
    const v = await Vot.findOne({ khachHang: kh, maNguon: 'cb:v-aaa' }).lean<any>();
    expect(v.soLanCang).toBe(1);
    expect(v.hanNhacLuc.toISOString()).toBe('2026-12-17T00:00:00.000Z');
    expect(await Lan.countDocuments({ votCaNhan: v._id })).toBe(1);
  });

  it('đơn hoàn thành tạo hộ chiếu cho từng cây vợt (theo số lượng), bỏ qua giày; chạy lại không trùng', async () => {
    const don = {
      _id: new Types.ObjectId(), khachHang: kh, ngayDat: new Date('2026-11-05T03:00:00Z'),
      chiTiet: [
        { _id: new Types.ObjectId(), sanPham, chiTietSanPham: bienThe, tenSanPham: 'Vợt thử', tenSize: '4U', soLuong: 2 },
        { _id: new Types.ObjectId(), sanPham: (globalThis as any).__spGiay, tenSanPham: 'Giày thử', soLuong: 1 },
      ],
    };
    expect(await svc.taoHoChieuTuDon(don)).toBe(2);
    expect(await svc.taoHoChieuTuDon(don)).toBe(0);
    const ds = await Vot.find({ donHang: don._id }).lean<any[]>();
    expect(ds.map((x) => x.nguon)).toEqual(['mua-tai-shop', 'mua-tai-shop']);
    expect(ds[0]).toMatchObject({ ten: 'Vợt thử 4U', thongSoChup: { sucCangMaxLbs: 28 } });
  });

  it('danh sách tủ vợt kèm ảnh đại diện của sản phẩm gốc; vợt tự thêm không có ảnh', async () => {
    await SP.updateOne({ _id: sanPham }, { $set: { hinhAnhDaiDien: 'vot-thu.jpg' } });
    const ds = await svc.danhSach(kh);
    const muaTaiShop = ds.filter((v: any) => String(v.sanPham) === String(sanPham));
    expect(muaTaiShop.length).toBeGreaterThan(0);
    expect(muaTaiShop.every((v: any) => v.anh === 'vot-thu.jpg')).toBe(true);
    expect(ds.filter((v: any) => !v.sanPham).every((v: any) => v.anh === undefined)).toBe(true);
  });

  it('serial trùng → 409; validator chặn ghi thẳng sai luật', async () => {
    await svc.tao(kh, { ten: 'Có serial', soSerial: `SN-${cheDo}` });
    await expect(svc.tao(kh, { ten: 'Trùng serial', soSerial: `SN-${cheDo}` })).rejects.toThrow(/serial/);
    const col = conn.db!.collection('votcanhans');
    const lan = (i: number) => ({ _id: new Types.ObjectId(), ngay: new Date(2026, 0, i + 1), mucCangLbs: 24, giaTriNhap: 24, donViNhap: 'lbs', noiCang: 'ngoai' });
    const goc = { khachHang: kh, nguon: 'tu-nhap', ten: 'Ghi thẳng' };
    await expect(col.insertOne({ ...goc, soLanCang: 11, lichSuCang: Array.from({ length: 11 }, (_, i) => lan(i)) } as never)).rejects.toThrow(/validation/i);
    await expect(col.insertOne({ ...goc, soLanCang: 0, lichSuCang: [lan(0)] } as never)).rejects.toThrow(/validation/i); // soLanCang < số lần nhúng
    await expect(col.insertOne({ ...goc, soLanCang: 0, lichSuCang: [], thongSoChup: { sucCangMinLbs: 30, sucCangMaxLbs: 20 } } as never)).rejects.toThrow(/validation/i);
    await expect(conn.db!.collection('lancangs').insertOne({ votCaNhan: new Types.ObjectId(), khachHang: kh, ngay: new Date(), mucCangLbs: 250, giaTriNhap: 250, donViNhap: 'lbs', noiCang: 'ngoai' } as never)).rejects.toThrow(/validation/i);
  });
});
