import mongoose, { Model } from 'mongoose';
import { VALIDATORS } from '../csdl/validators';
import { KhachHangSchema } from '../schemas';
import { lenhCapNhatHoSo } from './ho-so-choi';

/** Chạy trên MongoDB THẬT (CSDL tạm, xoá sau khi xong) khi có MONGO_TEST_URI, như catalog/bo-loc-mongo.spec.ts. */
const URI = process.env.MONGO_TEST_URI;

describe.skipIf(!URI)('hồ sơ người chơi trên MongoDB thật', () => {
  let conn: mongoose.Connection;
  let M: Model<any>;

  beforeAll(async () => {
    conn = await mongoose.createConnection(URI!, { dbName: `kiem_thu_ho_so_${process.pid}`, autoCreate: false, autoIndex: false }).asPromise();
    M = conn.model('KhachHang', KhachHangSchema) as unknown as Model<any>;
    await conn.createCollection('khachhangs', { validator: VALIDATORS.khachhangs.validator, validationLevel: 'strict', validationAction: 'error' });
    await M.syncIndexes();
  });

  afterAll(async () => {
    await conn?.dropDatabase();
    await conn?.close();
  });

  const capNhat = (taiKhoan: unknown, body: Parameters<typeof lenhCapNhatHoSo>[0]) =>
    M.findOneAndUpdate({ taiKhoan }, lenhCapNhatHoSo(body, new Date()), { returnDocument: 'after', runValidators: true }).lean<any>();

  it('khai, sửa từng phần rồi xoá hết: chỉ đụng tới trường con, các trường khác của khách hàng giữ nguyên', async () => {
    const taiKhoan = new mongoose.Types.ObjectId();
    await M.create({ hoTen: 'Khách thử', diaChi: 'TP.HCM', taiKhoan });

    let kh = await capNhat(taiKhoan, { trinhDo: 'deu', noiDung: ['doi', 'don'], chanThuong: ['co-tay'], soBuoiMoiTuan: 3 });
    expect(kh.hoSoChoi).toMatchObject({ trinhDo: 'deu', noiDung: ['don', 'doi'], chanThuong: ['co-tay'], soBuoiMoiTuan: 3 });
    expect(kh.hoSoChoi.capNhatLuc).toBeInstanceOf(Date);

    kh = await capNhat(taiKhoan, { trinhDo: 'thi', noiDung: ['doi'], loiChoi: 'toc' });
    expect(kh.hoSoChoi.trinhDo).toBe('thi');
    expect(kh.hoSoChoi.loiChoi).toBe('toc');
    expect(kh.hoSoChoi.chanThuong).toBeUndefined(); // bỏ chọn chấn thương → xoá hẳn trường
    expect(kh.diaChi).toBe('TP.HCM');

    kh = await capNhat(taiKhoan, {});
    expect(kh.hoSoChoi).toBeUndefined();
  });

  it('index ho_so_choi là sparse: khách chưa khai hồ sơ không nằm trong index', async () => {
    const idx = (await M.collection.indexes()).find((i) => i.name === 'ho_so_choi');
    expect(idx).toMatchObject({ key: { 'hoSoChoi.trinhDo': 1, 'hoSoChoi.noiDung': 1 }, sparse: true });
  });

  it('validator chặn dữ liệu sai khi ghi thẳng bằng driver (bỏ qua Mongoose và DTO)', async () => {
    const col = conn.db!.collection('khachhangs');
    for (const hoSoChoi of [
      { trinhDo: 'sieu-cap' },
      { noiDung: ['doi', 'doi'] }, // trùng phần tử (uniqueItems)
      { noiDung: [] }, // mảng rỗng phải được xoá chứ không lưu
      { chanThuong: ['dau-goi'] },
      { soBuoiMoiTuan: 2.5 },
      { ghiChuBacSi: 'không được thêm trường lạ' },
    ]) {
      await expect(col.insertOne({ hoTen: 'Sai', hoSoChoi } as never), JSON.stringify(hoSoChoi)).rejects.toThrow(/validation/i);
    }
  });
});
