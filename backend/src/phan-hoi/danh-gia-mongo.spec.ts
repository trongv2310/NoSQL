import mongoose, { Model, Types } from 'mongoose';
import { VALIDATORS } from '../csdl/validators';
import { PhanHoiSchema } from '../schemas';
import { ketQuaDanhGia, pipelineDanhGia } from './danh-gia-nhom';

/** Chạy trên MongoDB THẬT (CSDL tạm, xoá sau khi xong) khi có MONGO_TEST_URI. */
const URI = process.env.MONGO_TEST_URI;

describe.skipIf(!URI)('đánh giá theo nhóm người chơi trên MongoDB thật', () => {
  let conn: mongoose.Connection;
  let M: Model<any>;
  const sp = new Types.ObjectId();
  const spKhac = new Types.ObjectId();

  // 8 đánh giá có kiểm soát để tự tính đáp án bằng tay.
  const DS = [
    { danhGia: 5, nguoiDanh: { trinhDo: 'deu', noiDung: ['doi'] }, the: ['phan-tat-nhanh', 'de-dieu-khien'] },
    { danhGia: 4, nguoiDanh: { trinhDo: 'deu', noiDung: ['don', 'doi'] }, the: ['phan-tat-nhanh'] },
    { danhGia: 3, nguoiDanh: { trinhDo: 'deu', noiDung: ['doi'] }, the: ['nang-tay'] },
    { danhGia: 2, nguoiDanh: { trinhDo: 'deu', noiDung: ['don'] }, the: ['nang-tay', 'rung-tay'] }, // khác nội dung với người xem "đôi"
    { danhGia: 5, nguoiDanh: { trinhDo: 'thi', noiDung: ['doi'] }, the: ['dap-uy-luc'] },
    { danhGia: 1 }, // không chia sẻ hồ sơ
    { danhGia: 5, nguoiDanh: { trinhDo: 'deu', noiDung: ['doi'] }, daXacMinh: false }, // chưa xác minh: không công khai
    { danhGia: 1, nguoiDanh: { trinhDo: 'deu', noiDung: ['doi'] }, laDuLieuMau: true }, // dữ liệu mẫu: không công khai
  ];

  beforeAll(async () => {
    conn = await mongoose.createConnection(URI!, { dbName: `kiem_thu_danh_gia_${process.pid}`, autoCreate: false, autoIndex: false }).asPromise();
    M = conn.model('PhanHoi', PhanHoiSchema) as unknown as Model<any>;
    await conn.createCollection('phanhois', { validator: VALIDATORS.phanhois.validator, validationLevel: 'strict', validationAction: 'error' });
    await M.syncIndexes();
    await M.insertMany([
      ...DS.map((d) => ({ sanPham: sp, khachHang: new Types.ObjectId(), daXacMinh: true, ...d })),
      { sanPham: spKhac, danhGia: 5, daXacMinh: true, nguoiDanh: { trinhDo: 'deu', noiDung: ['doi'] } },
    ]);
  });

  afterAll(async () => {
    await conn?.dropDatabase();
    await conn?.close();
  });

  const LOC = { daXacMinh: true, laDuLieuMau: { $ne: true } };

  it('$facet ra đúng số liệu tính tay; bỏ đánh giá chưa xác minh và dữ liệu mẫu', async () => {
    const [f] = await M.aggregate(pipelineDanhGia(sp, { trinhDo: 'deu', noiDung: ['doi'] }, LOC));
    const r = ketQuaDanhGia(f, { trinhDo: 'deu', noiDung: ['doi'] });
    expect(r.tatCa).toEqual({ trungBinh: 3.3, so: 6 }); // (5+4+3+2+5+1)/6
    expect(r.phanBoSao).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 2 });
    expect(r.giongBan).toMatchObject({ chuaDuDuLieu: false, trungBinh: 4, so: 3 }); // 5,4,3 (người đánh "đơn" bị loại)
    expect(r.theNoiBat.slice(0, 2)).toEqual([{ the: 'nang-tay', so: 2 }, { the: 'phan-tat-nhanh', so: 2 }]);
    expect(r.theoTrinhDo).toEqual([{ trinhDo: 'deu', trungBinh: 3.5, so: 4 }, { trinhDo: 'thi', trungBinh: 5, so: 1 }]);
    expect(r.coDuLieuMau).toBe(false);
  });

  it('nhóm ít người → chưa đủ dữ liệu', async () => {
    const [f] = await M.aggregate(pipelineDanhGia(sp, { trinhDo: 'thi', noiDung: [] }, LOC));
    expect(ketQuaDanhGia(f, { trinhDo: 'thi', noiDung: [] }).giongBan).toMatchObject({ chuaDuDuLieu: true, so: 1 });
  });

  it('truy vấn nhóm dùng index danh_gia_theo_nhom', async () => {
    const e: any = await M.find({ sanPham: sp, 'nguoiDanh.trinhDo': 'deu' }).sort({ danhGia: -1 }).explain('queryPlanner');
    expect(JSON.stringify(e.queryPlanner.winningPlan)).toContain('danh_gia_theo_nhom');
  });

  it('hữu ích: bấm song song 5 lần cùng một người chỉ cộng 1; bỏ bấm trừ đúng 1', async () => {
    const { _id } = await M.findOne({ sanPham: sp, danhGia: 4 }).lean<any>();
    const toi = new Types.ObjectId();
    const bam = () => M.updateOne({ _id, huuIch: { $ne: toi } }, { $addToSet: { huuIch: toi }, $inc: { soHuuIch: 1 } });
    const kq = await Promise.all([bam(), bam(), bam(), bam(), bam()]);
    expect(kq.reduce((t, x) => t + x.modifiedCount, 0)).toBe(1);
    expect((await M.findById(_id).lean<any>()).soHuuIch).toBe(1);
    await M.updateOne({ _id, huuIch: toi }, { $pull: { huuIch: toi }, $inc: { soHuuIch: -1 } });
    const d = await M.findById(_id).lean<any>();
    expect(d.soHuuIch).toBe(0);
    expect(d.huuIch).toEqual([]);
  });

  it('validator ($expr) chặn bộ đếm hữu ích lệch với danh sách người bấm', async () => {
    const { _id } = await M.findOne({ sanPham: sp, danhGia: 3 }).lean<any>();
    await expect(M.collection.updateOne({ _id }, { $inc: { soHuuIch: 1 } })).rejects.toThrow(/validation/i);
    await expect(M.collection.updateOne({ _id }, { $set: { the: ['nang-tay', 'nang-tay'] } })).rejects.toThrow(/validation/i);
    await expect(M.collection.updateOne({ _id }, { $set: { 'nguoiDanh.trinhDo': 'sieu-cap' } })).rejects.toThrow(/validation/i);
  });
});
