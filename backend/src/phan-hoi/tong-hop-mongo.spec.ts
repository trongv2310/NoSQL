import mongoose, { Model, Types } from 'mongoose';
import { GiaoDich } from '../csdl/giao-dich';
import { VALIDATORS } from '../csdl/validators';
import { PhanHoiSchema, SanPhamSchema } from '../schemas';
import { docTongHop, pipelineCongDanhGia, pipelineTinhLaiTongHop } from './tong-hop-danh-gia';

/** MongoDB thật: MONGO_TEST_URI (standalone) và/hoặc MONGO_RS_TEST_URI (replica set). Mỗi chế độ một CSDL tạm. */
const CHE_DO = [
  ['standalone', process.env.MONGO_TEST_URI],
  ['replica set', process.env.MONGO_RS_TEST_URI],
].filter((x): x is [string, string] => !!x[1]);

describe.skipIf(!CHE_DO.length).each(CHE_DO.length ? CHE_DO : [['bỏ qua', '']])('tổng hợp đánh giá lưu sẵn (computed pattern) — %s', (cheDo, uri) => {
  let conn: mongoose.Connection;
  let SP: Model<any>, PH: Model<any>;
  beforeAll(async () => {
    conn = await mongoose.createConnection(uri, { dbName: `kiem_thu_tong_hop_${process.pid}_${cheDo.length}`, autoCreate: false, autoIndex: false }).asPromise();
    SP = conn.model('SanPham', SanPhamSchema) as unknown as Model<any>;
    PH = conn.model('PhanHoi', PhanHoiSchema) as unknown as Model<any>;
    for (const ten of ['sanphams', 'phanhois']) await conn.createCollection(ten, { validator: VALIDATORS[ten].validator, validationLevel: 'strict', validationAction: 'error' });
  });
  afterAll(async () => {
    await conn?.dropDatabase();
    await conn?.close();
  });

  it('20 đánh giá cộng CÙNG LÚC: số lượt, tổng điểm và trung bình đều đúng (mỗi lần cộng là một lệnh update pipeline nguyên tử)', async () => {
    const { _id } = await SP.create({ tenSanPham: 'Vợt song song', giaGoc: 1 });
    const sao = Array.from({ length: 20 }, (_, i) => (i % 5) + 1); // 4 lần mỗi mức 1..5 → TB 3
    await Promise.all(sao.map((s) => SP.updateOne({ _id }, pipelineCongDanhGia(s), { updatePipeline: true })));
    const sp = await SP.findById(_id).lean<any>();
    expect(sp.danhGiaTongHop).toEqual({ so: 20, tong: 60, trungBinh: 3 });
    expect(docTongHop(sp)).toEqual({ trungBinhDanhGia: 3, soDanhGia: 20 });
  });

  it('$merge đối soát: sửa tổng hợp sai và đặt { so: 0, trungBinh: null } cho sản phẩm chưa có đánh giá thật', async () => {
    const a = await SP.create({ tenSanPham: 'Vợt A', giaGoc: 1, danhGiaTongHop: { so: 9, tong: 9, trungBinh: 1 } });
    const b = await SP.create({ tenSanPham: 'Vợt B', giaGoc: 1 });
    await PH.create([
      { sanPham: a._id, danhGia: 5, daXacMinh: true },
      { sanPham: a._id, danhGia: 4, daXacMinh: true },
      { sanPham: a._id, danhGia: 1, daXacMinh: false }, // chưa xác minh: không tính
      { sanPham: a._id, danhGia: 1, daXacMinh: true, laDuLieuMau: true }, // dữ liệu mẫu: không tính
    ]);
    await SP.aggregate(pipelineTinhLaiTongHop());
    expect((await SP.findById(a._id).lean<any>()).danhGiaTongHop).toEqual({ so: 2, tong: 9, trungBinh: 4.5 });
    expect((await SP.findById(b._id).lean<any>()).danhGiaTongHop).toEqual({ so: 0, tong: 0, trungBinh: null });
    expect((await SP.findById(a._id).lean<any>()).tenSanPham).toBe('Vợt A'); // $merge "merge": giữ nguyên các trường khác
  });

  it('validator $expr chặn tổng điểm vô lý (lớn hơn 5 × số lượt)', async () => {
    const { _id } = await SP.create({ tenSanPham: 'Vợt C', giaGoc: 1 });
    await expect(SP.collection.updateOne({ _id }, { $set: { danhGiaTongHop: { so: 1, tong: 9, trungBinh: 5 } } })).rejects.toThrow(/validation/i);
  });

  it(`thêm đánh giá + cộng tổng hợp: ${cheDo === 'replica set' ? 'transaction huỷ cả hai khi bước sau lỗi' : 'không có transaction, hai lệnh nối tiếp'}`, async () => {
    const { _id } = await SP.create({ tenSanPham: 'Vợt D', giaGoc: 1 });
    const gd = new GiaoDich(conn);
    expect(await gd.hoTro()).toBe(cheDo === 'replica set');
    const lam = () => gd.chay(async (session) => {
      await PH.create([{ sanPham: _id, danhGia: 5, daXacMinh: true }], { session });
      await SP.updateOne({ _id: new Types.ObjectId() /* không khớp */ }, { $set: { x: 1 } }, { session });
      throw new Error('lỗi giả lập sau khi đã thêm đánh giá');
    });
    await expect(lam()).rejects.toThrow('lỗi giả lập');
    // Có transaction: đánh giá vừa thêm bị huỷ. Không có: đánh giá còn đó (vì vậy cần script đối soát).
    expect(await PH.countDocuments({ sanPham: _id })).toBe(cheDo === 'replica set' ? 0 : 1);
  });
});
