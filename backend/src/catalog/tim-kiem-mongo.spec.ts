import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import mongoose, { Connection, Model } from 'mongoose';
import { VALIDATORS } from '../csdl/validators';
import { ALL_MODELS, ChiTietSanPham, Hang, KhuyenMai, LoaiSanPham, PhanHoi, SanPham } from '../schemas';
import { CatalogService } from './catalog.service';
import { baKyTuCuaTu, goiYKhiGo, khongDau, locTienTo, pipelineGanDung, tachTu, timKiemSanPham } from './tim-kiem';

describe('chuẩn hoá từ khoá (không cần MongoDB)', () => {
  it('bỏ dấu, đ → d, chữ thường, bỏ ký tự đặc biệt, tách từ không trùng', () => {
    expect(khongDau('  Đai quấn CÁN — Yonex AC102! ')).toBe('dai quan can yonex ac102');
    expect(tachTu('Vợt vợt  ĐỎ')).toEqual(['vot', 'do']);
    expect(baKyTuCuaTu('astrox')).toEqual(['^as', 'ast', 'str', 'tro', 'rox']);
    expect(baKyTuCuaTu('ac')).toEqual(['ac']);
  });
});

const BASE = (process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017').replace(/\/+$/, '');
function mongoSanSang(): boolean {
  const ma = `require("mongoose").createConnection(${JSON.stringify(`${BASE}/admin`)},{serverSelectionTimeoutMS:1500}).asPromise().then(c=>c.close()).then(()=>process.exit(0),()=>process.exit(1))`;
  return spawnSync(process.execPath, ['-e', ma], { timeout: 10_000 }).status === 0;
}

describe.runIf(mongoSanSang())('tìm kiếm sản phẩm (MongoDB thật)', () => {
  const tenDb = `test_tim_kiem_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  let conn: Connection;
  let SP: Model<any>;
  let catalog: CatalogService;
  const id: Record<string, string> = {};
  const ten = (ids: unknown[]) => ids.map((x) => Object.keys(id).find((k) => id[k] === String(x)) ?? String(x));

  beforeAll(async () => {
    expect(tenDb).toMatch(/^test_tim_kiem_[0-9a-f]{12}$/);
    conn = await mongoose.createConnection(`${BASE}/${tenDb}`).asPromise();
    for (const m of ALL_MODELS) conn.model(m.name, m.schema);
    await Promise.all(Object.values(conn.models).map((m) => m.init()));
    const M = (c: { name: string }) => conn.model(c.name) as any;
    SP = M(SanPham);
    catalog = new CatalogService(SP, M(ChiTietSanPham), M(PhanHoi), M(Hang), M(LoaiSanPham), M(KhuyenMai));
    const ngay = (n: number) => new Date(Date.UTC(2026, 0, n));
    const ds: [string, Record<string, unknown>][] = [
      ['astrox', { tenSanPham: 'Vợt Cầu Lông Yonex Astrox 99 Pro', giaGoc: 4_190_000, ngayTao: ngay(5) }],
      ['nanoflare', { tenSanPham: 'Vợt Cầu Lông Yonex Nanoflare 800', giaGoc: 3_900_000, ngayTao: ngay(4) }],
      ['thruster', { tenSanPham: 'Vợt Cầu Lông Victor Thruster F', giaGoc: 2_150_000, ngayTao: ngay(3) }],
      ['dai', { tenSanPham: 'Đai quấn cán Yonex AC102', giaGoc: 60_000, ngayTao: ngay(2) }],
      ['ong', { tenSanPham: 'Ống cầu Victor Master', giaGoc: 290_000, moTa: 'Cầu bền, hợp tập luyện với mọi loại vợt.', ngayTao: ngay(6) }],
      ['daXoa', { tenSanPham: 'Vợt Yonex Astrox 100 ZZ', giaGoc: 5_000_000, deletedAt: new Date(), ngayTao: ngay(7) }],
    ];
    for (const [k, d] of ds) id[k] = String((await SP.create(d))._id);
  });

  afterAll(async () => {
    if (conn && tenDb.startsWith('test_tim_kiem_')) await conn.dropDatabase();
    await conn?.close();
  });

  it('hook dựng timKiem khi tạo và khi đổi tên bằng updateOne / findOneAndUpdate; update pipeline không đụng tới', async () => {
    expect((await SP.findById(id.dai).lean<any>()).timKiem).toMatchObject({ chuoi: 'dai quan can yonex ac102', tu: ['dai', 'quan', 'can', 'yonex', 'ac102'] });
    const { _id } = await SP.create({ tenSanPham: 'Tạm thời', giaGoc: 1 });
    await SP.updateOne({ _id }, { $set: { tenSanPham: 'Băng chặn mồ hôi' } });
    expect((await SP.findById(_id).lean<any>()).timKiem.chuoi).toBe('bang chan mo hoi');
    await SP.findOneAndUpdate({ _id }, { tenSanPham: 'Tất thể thao' });
    expect((await SP.findById(_id).lean<any>()).timKiem.chuoi).toBe('tat the thao');
    await SP.updateOne({ _id }, [{ $set: { giaGoc: 2 } }], { updatePipeline: true });
    expect((await SP.findById(_id).lean<any>()).timKiem.chuoi).toBe('tat the thao');
    await SP.deleteOne({ _id });
  });

  it('$text: gõ không dấu vẫn ra, phải có ĐỦ mọi từ, sản phẩm đã xoá không ra', async () => {
    const kq = await timKiemSanPham(SP, 'vot yonex');
    expect(kq.cheDo).toBe('van-ban');
    expect(ten(kq.ids).sort()).toEqual(['astrox', 'nanoflare']);
  });

  it('"đ" được đổi thành "d" (text index tự bỏ dấu nhưng không đổi đ): "dai" ra Đai quấn cán', async () => {
    expect(ten((await timKiemSanPham(SP, 'dai')).ids)).toEqual(['dai']);
    expect(ten((await timKiemSanPham(SP, 'ĐAI QUẤN')).ids)).toEqual(['dai']);
  });

  it('xếp theo textScore: khớp ở tên (trọng số 10) đứng trước khớp ở mô tả (trọng số 1)', async () => {
    const kq = ten((await timKiemSanPham(SP, 'vợt')).ids);
    expect(kq).toHaveLength(4);
    expect(kq.at(-1)).toBe('ong'); // "vợt" chỉ có trong mô tả của ống cầu
  });

  it('tiền tố khi gõ dở: "astr" ra Astrox; "vot nano" ra Nanoflare', async () => {
    expect(await timKiemSanPham(SP, 'astr')).toMatchObject({ cheDo: 'tien-to' });
    expect(ten((await timKiemSanPham(SP, 'astr')).ids)).toEqual(['astrox']);
    expect(ten((await goiYKhiGo(SP, 'vot nano')).ids)).toEqual(['nanoflare']);
  });

  it('gõ sai chính tả: "yonx astrok" vẫn ra Astrox đầu tiên, kèm gợi ý đã sửa', async () => {
    const kq = await timKiemSanPham(SP, 'yonx astrok');
    expect(kq.cheDo).toBe('gan-dung');
    expect(ten(kq.ids)[0]).toBe('astrox');
    expect(kq.goiY).toBe('yonex astrox');
    expect(await timKiemSanPham(SP, 'qwerty zzz')).toEqual({ ids: [], cheDo: 'trong' });
    // Một từ khớp, một từ không có trong kho: vẫn ra gần đúng nhưng không "gợi ý" lại đúng từ khoá đã gõ.
    const motNua = await timKiemSanPham(SP, 'nanoflare zzzz');
    expect(ten(motNua.ids)).toEqual(['nanoflare']);
    expect(motNua.goiY).toBeUndefined();
  });

  it('cả ba tầng đều dùng index một phần riêng (explain)', async () => {
    const tenIndex = (p: any): string[] => [p?.indexName, ...(p?.inputStage ? tenIndex(p.inputStage) : []), ...(p?.inputStages ?? []).flatMap(tenIndex)].filter(Boolean);
    const plan = async (c: any) => tenIndex((await c.explain('queryPlanner')).queryPlanner.winningPlan);
    expect(await plan(SP.find({ deletedAt: null, $text: { $search: '"vot"' } }))).toContain('tim_kiem_toan_van');
    expect(await plan(SP.find(locTienTo(['astr'])))).toContain('tu_khoa_tien_to');
    const ag = await SP.aggregate(pipelineGanDung(['astrok'], 5)).explain('queryPlanner');
    expect(JSON.stringify(ag)).toContain('ba_ky_tu');
  });

  it('trang danh sách dùng kết quả tìm kiếm: giữ thứ tự độ khớp, vẫn sắp xếp / lọc được, báo chế độ tìm', async () => {
    const r = await catalog.danhSach({ keyword: 'yonx astrok' });
    expect(r.items[0].tenSanPham).toBe('Vợt Cầu Lông Yonex Astrox 99 Pro');
    expect(r.timKiem).toEqual({ cheDo: 'gan-dung', goiY: 'yonex astrox' });
    const tang = await catalog.danhSach({ keyword: 'vot yonex', sap_xep: 'gia_tang' });
    expect(tang.items.map((i) => i.tenSanPham)).toEqual(['Vợt Cầu Lông Yonex Nanoflare 800', 'Vợt Cầu Lông Yonex Astrox 99 Pro']);
    expect((await catalog.danhSach({ keyword: 'vot yonex', gia_den: '4000000' })).total).toBe(1);
    expect((await catalog.goiY('astr')).items.map((i) => i.tenSanPham)).toEqual(['Vợt Cầu Lông Yonex Astrox 99 Pro']);
  });

  it('validator $jsonSchema chặn trường tìm kiếm còn dấu (ghi thẳng bằng driver, bỏ qua hook)', async () => {
    const c = await conn.db!.createCollection('thu_validator_sp', { validator: VALIDATORS.sanphams.validator, validationAction: 'error' });
    await expect(c.insertOne({ tenSanPham: 'Vợt', giaGoc: 1, timKiem: { chuoi: 'Vợt' } })).rejects.toThrow(/validation/i);
    await expect(c.insertOne({ tenSanPham: 'Vợt', giaGoc: 1, timKiem: { chuoi: 'vot', tu: ['vot'], baKyTu: ['vot'] } })).resolves.toBeTruthy();
  });
});
