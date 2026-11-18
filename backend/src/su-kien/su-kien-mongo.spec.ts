import mongoose, { Connection, Types } from 'mongoose';
import { NGUONG_TON_THAP, pipelineSuKien, SuKienAdmin, SuKienService } from './su-kien.service';

/** Change stream cần replica set: MONGO_RS_TEST_URI. MONGO_TEST_URI (standalone) chỉ kiểm việc báo "không hỗ trợ". */
const RS = process.env.MONGO_RS_TEST_URI;
const STANDALONE = process.env.MONGO_TEST_URI;

const cho = async (dk: () => boolean, ms = 8000) => {
  for (const batDau = Date.now(); Date.now() - batDau < ms; ) {
    if (dk()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Hết thời gian chờ sự kiện.');
};

describe.runIf(!!STANDALONE)('change stream — standalone', () => {
  it('báo rõ không hỗ trợ và lý do, không ném lỗi', async () => {
    const conn = await mongoose.createConnection(STANDALONE!, { dbName: `kiem_thu_su_kien_sa_${process.pid}` }).asPromise();
    try {
      const sv = new SuKienService(conn);
      expect(await sv.batDau()).toMatchObject({ hoTro: false, lyDo: expect.stringMatching(/standalone/) });
    } finally {
      await conn.close();
    }
  });
});

describe.runIf(!!RS)('change stream thông báo admin — replica set', () => {
  let conn: Connection;
  let sv: SuKienService;
  const nhan: SuKienAdmin[] = [];
  const db = () => conn.db!;

  beforeAll(async () => {
    conn = await mongoose.createConnection(RS!, { dbName: `kiem_thu_su_kien_${process.pid}` }).asPromise();
    for (const c of ['donhangs', 'chitietsanphams', 'sanphams', 'khac']) await db().createCollection(c);
    sv = new SuKienService(conn);
    expect(await sv.batDau()).toEqual({ hoTro: true, lyDo: null, docTiep: false });
    sv.suKienMoi().subscribe((x) => nhan.push(x));
  });
  afterAll(async () => {
    await sv?.dung();
    await conn?.dropDatabase();
    await conn?.close();
  });

  it('đơn mới → sự kiện "don-moi" có số đơn, tổng tiền, tên người nhận', async () => {
    await db().collection('donhangs').insertOne({ soDonHang: 101, tongTienSauGiam: 2_500_000, hoTenNhan: 'Khách A', diaChiGiaoHang: 'Số 1' });
    await cho(() => nhan.some((x) => x.loai === 'don-moi'));
    expect(nhan.find((x) => x.loai === 'don-moi')).toMatchObject({ soDonHang: 101, tongTien: 2_500_000, hoTenNhan: 'Khách A' });
  });

  it(`tồn kho xuống ≤ ${NGUONG_TON_THAP} → "ton-thap" kèm SKU và tên sản phẩm; tồn còn nhiều hay collection khác → không báo`, async () => {
    const sp = new Types.ObjectId();
    await db().collection('sanphams').insertOne({ _id: sp, tenSanPham: 'Vợt Astrox 99' });
    const { insertedId } = await db().collection('chitietsanphams').insertOne({ sanPham: sp, sku: 'AX99-4U', soLuongTon: 10 });
    nhan.length = 0;
    await db().collection('chitietsanphams').updateOne({ _id: insertedId }, { $inc: { soLuongTon: -5 } }); // còn 5: không báo
    await db().collection('khac').insertOne({ soLuongTon: 0 });
    await db().collection('chitietsanphams').updateOne({ _id: insertedId }, { $inc: { soLuongTon: -3 } }); // còn 2: báo
    await cho(() => nhan.length > 0);
    await new Promise((r) => setTimeout(r, 300));
    expect(nhan).toHaveLength(1);
    expect(nhan[0]).toMatchObject({ loai: 'ton-thap', sku: 'AX99-4U', tenSanPham: 'Vợt Astrox 99', soLuongTon: 2 });
  });

  it('pipeline $project: thông tin riêng của khách (địa chỉ) không đi ra khỏi MongoDB', async () => {
    const { operationTime } = (await db().command({ ping: 1 })) as any;
    const luong = db().watch(pipelineSuKien(), { startAtOperationTime: operationTime });
    const den = new Promise<any>((ok) => luong.once('change', ok));
    await db().collection('donhangs').insertOne({ soDonHang: 102, tongTienSauGiam: 1, hoTenNhan: 'B', diaChiGiaoHang: 'Số 2', soDienThoaiNhanHang: '0900000000' });
    const ev = await den;
    await luong.close();
    expect(Object.keys(ev.fullDocument).sort()).toEqual(['hoTenNhan', 'soDonHang', 'tongTienSauGiam']);
  }, 15_000);

  it('resume token: sự kiện xảy ra lúc dịch vụ TẮT vẫn được nhận khi bật lại (startAfter token đã lưu)', async () => {
    await cho(() => nhan.some((x) => x.loai === 'ton-thap'));
    const daLuu = await db().collection('theodoisukiens').findOne({ _id: 'admin-thong-bao' as never });
    expect(daLuu?.token?._data).toEqual(expect.any(String));
    await sv.dung();
    await db().collection('donhangs').insertOne({ soDonHang: 103, tongTienSauGiam: 990_000, hoTenNhan: 'Khách lúc tắt' });
    const sv2 = new SuKienService(conn);
    const nhan2: SuKienAdmin[] = [];
    sv2.suKienMoi().subscribe((x) => nhan2.push(x));
    expect(await sv2.batDau()).toMatchObject({ hoTro: true, docTiep: true });
    await cho(() => nhan2.some((x) => x.loai === 'don-moi' && x.soDonHang === 103));
    expect(nhan2.filter((x) => x.loai === 'don-moi').map((x) => (x as { soDonHang: number }).soDonHang)).not.toContain(101); // không đọc lại từ đầu
    await sv2.dung();
  }, 20_000);
});
