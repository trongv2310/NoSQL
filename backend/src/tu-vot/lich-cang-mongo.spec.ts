import mongoose, { Model, Types } from 'mongoose';
import { VALIDATORS } from '../csdl/validators';
import { ChiTietSanPhamSchema, KhachHangSchema, LanCangSchema, LichCangSchema, SanPhamSchema, VotCaNhanSchema } from '../schemas';
import { khungGioSapToi, LichCangService } from './lich-cang.service';
import { TuVotService } from './tu-vot.service';

/** MongoDB thật: MONGO_TEST_URI (standalone) và/hoặc MONGO_RS_TEST_URI (replica set). Mỗi chế độ một CSDL tạm, xoá sau khi xong. */
const CHE_DO = [
  ['standalone', process.env.MONGO_TEST_URI],
  ['replica set', process.env.MONGO_RS_TEST_URI],
].filter((x): x is [string, string] => !!x[1]);

describe.skipIf(!CHE_DO.length).each(CHE_DO.length ? CHE_DO : [['bỏ qua', '']])('lịch căng tại shop trên MongoDB thật (%s)', (cheDo, uri) => {
  let conn: mongoose.Connection;
  let lich: LichCangService;
  let tuVot: TuVotService;
  let Lich: Model<any>, Vot: Model<any>, Lan: Model<any>, KH: Model<any>;
  const khach: Types.ObjectId[] = [];
  const vot: Types.ObjectId[] = [];
  const khung = khungGioSapToi(new Date(), 7);

  beforeAll(async () => {
    conn = await mongoose.createConnection(uri, { dbName: `kiem_thu_lich_${process.pid}_${cheDo.length}`, autoCreate: false, autoIndex: false }).asPromise();
    const m = (ten: string, schema: any) => conn.model(ten, schema) as unknown as Model<any>;
    Lich = m('LichCang', LichCangSchema); Vot = m('VotCaNhan', VotCaNhanSchema); Lan = m('LanCang', LanCangSchema); KH = m('KhachHang', KhachHangSchema);
    const CT = m('ChiTietSanPham', ChiTietSanPhamSchema); const SP = m('SanPham', SanPhamSchema);
    for (const ten of ['lichcangs', 'votcanhans', 'lancangs']) await conn.createCollection(ten, { validator: VALIDATORS[ten].validator, validationLevel: 'strict', validationAction: 'error' });
    for (const ten of ['khachhangs', 'chitietsanphams', 'sanphams']) await conn.createCollection(ten);
    await Lich.syncIndexes(); await Vot.syncIndexes(); await Lan.syncIndexes();
    tuVot = new TuVotService(conn as never, Vot as never, Lan as never, KH as never, CT as never, SP as never);
    lich = new LichCangService(Lich as never, Vot as never, KH as never, tuVot);
    for (let i = 0; i < 5; i++) {
      khach.push((await KH.create({ hoTen: `Khách ${i}` }))._id);
      vot.push((await Vot.create({ khachHang: khach[i], nguon: 'tu-nhap', ten: `Vợt ${i}`, thongSoChup: { sucCangMaxLbs: 28 }, soLanCang: 0, lichSuCang: [] }))._id);
    }
  }, 30_000);

  afterAll(async () => {
    await conn?.dropDatabase();
    await conn?.close();
  });

  const dat = (i: number, ngay: Date, giaTri = 25) => lich.datCho(khach[i], { ngay: ngay.toISOString(), votCaNhanId: String(vot[i]), giaTri, donVi: 'lbs' });

  it('5 người đặt CÙNG LÚC vào khung 2 chỗ → đúng 2 thành công, không bao giờ vượt sức chứa', async () => {
    const kq = await Promise.allSettled([0, 1, 2, 3, 4].map((i) => dat(i, khung[3])));
    expect(kq.filter((x) => x.status === 'fulfilled')).toHaveLength(2);
    expect(kq.filter((x) => x.status === 'rejected').every((x: any) => /kín chỗ/.test(x.reason.message))).toBe(true);
    const doc = await Lich.findOne({ ngay: khung[3] }).lean<any>();
    expect(doc).toMatchObject({ sucChua: 2, soDaDat: 2 });
    expect(doc.datCho).toHaveLength(2);
    expect(await Lich.countDocuments({ ngay: khung[3] })).toBe(1);
  });

  it('một cây vợt chỉ có một lịch đang chờ; vượt mức NSX bị chặn khi đặt', async () => {
    const daDat = (await Lich.findOne({ ngay: khung[3] }).lean<any>()).datCho.map((d: any) => String(d.khachHang));
    const i = khach.findIndex((k) => daDat.includes(String(k)));
    await expect(dat(i, khung[5])).rejects.toThrow(/đang chờ/);
    const j = khach.findIndex((k) => !daDat.includes(String(k)));
    await expect(dat(j, khung[5], 30)).rejects.toThrow(/vượt mức tối đa/);
    await expect(lich.datCho(khach[j], { ngay: new Date(khung[5].getTime() + 30 * 60_000).toISOString(), votCaNhanId: String(vot[j]), giaTri: 25, donVi: 'lbs' })).rejects.toThrow(/không có trong lịch/);
  });

  it('huỷ (toán tử vị trí $) trả lại chỗ; người khác đặt được vào chỗ vừa trống', async () => {
    const doc = await Lich.findOne({ ngay: khung[3] }).lean<any>();
    const cho = doc.datCho[0];
    await expect(lich.huyCho(khach.find((k) => !k.equals(cho.khachHang))!, String(doc._id), String(cho._id))).rejects.toThrow(); // không phải chỗ của mình
    await lich.huyCho(cho.khachHang, String(doc._id), String(cho._id));
    const sau = await Lich.findById(doc._id).lean<any>();
    expect(sau.soDaDat).toBe(1);
    expect(sau.datCho.find((d: any) => d._id.equals(cho._id)).trangThai).toBe('huy');
    const daDat = sau.datCho.filter((d: any) => d.trangThai === 'cho').map((d: any) => String(d.khachHang));
    const k = khach.findIndex((x) => !daDat.includes(String(x)) && !x.equals(cho.khachHang));
    await dat(k, khung[3]);
    expect((await Lich.findById(doc._id).lean<any>()).soDaDat).toBe(2);
  });

  it(`hoàn tất ghi lần căng "tại shop" vào sổ; bấm lần hai bị từ chối (${cheDo})`, async () => {
    const doc = await Lich.findOne({ ngay: khung[3] }).lean<any>();
    const cho = doc.datCho.find((d: any) => d.trangThai === 'cho');
    const r = await lich.hoanTat(String(doc._id), String(cho._id));
    expect(r.coTransaction).toBe(cheDo === 'replica set');
    const v = await Vot.findById(cho.votCaNhan).lean<any>();
    expect(v.soLanCang).toBe(1);
    expect(v.lanCangGanNhat).toMatchObject({ noiCang: 'shop', mucCangLbs: 25 });
    expect(String((await Lan.findById(r.lanCangId).lean<any>()).votCaNhan)).toBe(String(cho.votCaNhan));
    const sau = (await Lich.findById(doc._id).lean<any>()).datCho.find((d: any) => d._id.equals(cho._id));
    expect(sau).toMatchObject({ trangThai: 'xong' });
    expect(String(sau.lanCang)).toBe(String(r.lanCangId));
    await expect(lich.hoanTat(String(doc._id), String(cho._id))).rejects.toThrow(/đang chờ/);
  });

  it(`ghi sổ lỗi giữa chừng → chỗ vẫn "chờ", không có lần căng mồ côi (${cheDo === 'replica set' ? 'transaction huỷ' : 'trả trạng thái'})`, async () => {
    const doc = await Lich.findOne({ ngay: khung[3] }).lean<any>();
    const cho = doc.datCho.find((d: any) => d.trangThai === 'cho');
    const truoc = await Lan.countDocuments();
    const goc = Vot.updateOne.bind(Vot);
    (Vot as any).updateOne = () => { throw new Error('lỗi giả lập'); };
    try {
      await expect(lich.hoanTat(String(doc._id), String(cho._id))).rejects.toThrow('lỗi giả lập');
    } finally {
      (Vot as any).updateOne = goc;
    }
    expect((await Lich.findById(doc._id).lean<any>()).datCho.find((d: any) => d._id.equals(cho._id)).trangThai).toBe('cho');
    expect(await Lan.countDocuments()).toBe(truoc);
  });

  it('validator chặn ghi thẳng làm lệch bộ đếm hoặc vượt sức chứa', async () => {
    const col = conn.db!.collection('lichcangs');
    const doc = await Lich.findOne({ ngay: khung[3] }).lean<any>();
    await expect(col.updateOne({ _id: doc._id }, { $inc: { soDaDat: 1 } })).rejects.toThrow(/validation/i);
    await expect(col.updateOne({ _id: doc._id }, { $set: { sucChua: 1 } })).rejects.toThrow(/validation/i);
  });
});
