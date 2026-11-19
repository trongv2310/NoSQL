import { CongKhaiService } from './cong-khai.service';

const ID = '64b000000000000000000010';
function dungService() {
  const tran = { _id: ID, tenGiaiDau: 'Giải A', doiA: 'An', doiB: 'Bình', doiThang: 'B', ngayThiDau: new Date('2026-01-01') };
  const limit = vi.fn();
  const sort = vi.fn();
  const query = (rows: unknown[]) => {
    const chain = { populate: vi.fn(), sort: vi.fn(), limit: vi.fn(), lean: vi.fn().mockResolvedValue(rows) };
    chain.populate.mockReturnValue(chain);
    chain.sort.mockImplementation((value) => { sort(value); return chain; });
    chain.limit.mockImplementation((value) => { limit(value); return chain; });
    return chain;
  };
  const tranModel = { find: vi.fn(() => query([tran])), countDocuments: vi.fn().mockResolvedValue(7) };
  const tin = { find: vi.fn((filter: any) => query(filter.tranDau ? [{ _id: 'tin1', tieuDe: 'Tin A', tranDau: ID }] : [])), aggregate: vi.fn().mockResolvedValue([]) };
  const rong = { find: vi.fn(() => query([])), countDocuments: vi.fn().mockResolvedValue(0), aggregate: vi.fn().mockResolvedValue([]) };
  const catalog = { tatCaSanPham: vi.fn().mockResolvedValue([]), tonKhoTheoSanPham: vi.fn().mockResolvedValue(new Map()) };
  const ctrl = new CongKhaiService(tin as never, tranModel as never, rong as never, rong as never, rong as never, rong as never, rong as never, rong as never, catalog as never);
  return { ctrl, tranModel, tin, sort, limit, query };
}

describe('Trận đấu công khai', () => {
  it('trận mới lọc hienThi != false, giữ sắp xếp giảm dần và ghép bài viết đang công khai', async () => {
    const { ctrl, tranModel, tin, sort, limit } = dungService();
    const result = await (ctrl as any).tranMoi(4);
    expect(tranModel.find).toHaveBeenCalledWith({ hienThi: { $ne: false } });
    expect(sort).toHaveBeenCalledWith({ ngayThiDau: -1, _id: -1 });
    expect(limit).toHaveBeenCalledWith(4);
    expect(tin.find).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: null, hienThi: { $ne: false }, tranDau: { $in: [ID] } }), { tieuDe: 1, tranDau: 1 });
    expect(result).toEqual([expect.objectContaining({ id: ID, tenGiaiDau: 'Giải A', doiA: 'An', doiB: 'Bình', tenDoiThang: 'Bình', tinTucs: [{ id: 'tin1', tieuDe: 'Tin A' }] })]);
  });

  it('landing lấy tối đa bốn trận đang hiển thị', async () => {
    const { ctrl, tranModel, limit } = dungService();
    const result = await ctrl.landing();
    expect(tranModel.find).toHaveBeenCalledWith({ hienThi: { $ne: false } });
    expect(limit).toHaveBeenCalledWith(4);
    expect(result.tranMoi).toEqual([expect.objectContaining({ id: ID, tenDoiThang: 'Bình' })]);
  });

  it('bảng tin chỉ đếm trận đang hiển thị, giữ ticker tám trận và cột phụ năm trận', async () => {
    const { ctrl, tranModel, limit } = dungService();
    const result = await ctrl.bangTin({});
    expect(tranModel.countDocuments).toHaveBeenCalledWith({ hienThi: { $ne: false } });
    expect(tranModel.find).toHaveBeenCalledTimes(2);
    expect(tranModel.find).toHaveBeenNthCalledWith(1, { hienThi: { $ne: false } });
    expect(tranModel.find).toHaveBeenNthCalledWith(2, { hienThi: { $ne: false } });
    expect(limit).toHaveBeenCalledWith(8);
    expect(limit).toHaveBeenCalledWith(5);
    expect(result.tong.tran).toBe(7);
    expect(result.tickerTran).toEqual([expect.objectContaining({ id: ID, tenDoiThang: 'Bình' })]);
    expect(result.tranDauMoi).toEqual([expect.objectContaining({ id: ID, tenDoiThang: 'Bình' })]);
  });
});

it.each([false, true])('công khai bỏ trận ẩn, giữ dữ liệu cũ thiếu field (tất cả ẩn: %s)', async (tatCaAn) => {
  const { ctrl, tranModel, query } = dungService();
  const rows: { _id: string; tenGiaiDau: string; hienThi?: boolean }[] = [
    { _id: 'cu', tenGiaiDau: 'Trận cũ' },
    { _id: 'hien', tenGiaiDau: 'Trận hiện', hienThi: true },
    { _id: 'an', tenGiaiDau: 'Trận ẩn', hienThi: false },
  ];
  if (tatCaAn) for (const row of rows) row.hienThi = false;
  const loc = (filter: { hienThi: { $ne: boolean } }) => rows.filter((row) => row.hienThi !== filter.hienThi.$ne);
  Object.assign(tranModel, {
    find: vi.fn((filter) => query(loc(filter))),
    countDocuments: vi.fn(async (filter) => loc(filter).length),
  });
  const ids = tatCaAn ? [] : ['cu', 'hien'];
  const landing = await ctrl.landing();
  const bangTin = await ctrl.bangTin({});
  for (const result of [landing.tranMoi, bangTin.tickerTran, bangTin.tranDauMoi]) {
    expect(result.map((row) => row.id)).toEqual(ids);
    expect(result.every((row) => !('hienThi' in row))).toBe(true);
  }
  expect(bangTin.tong.tran).toBe(ids.length);
  expect(tranModel.find).toHaveBeenCalledWith({ hienThi: { $ne: false } });
  expect(tranModel.countDocuments).toHaveBeenCalledWith({ hienThi: { $ne: false } });
});

it.each([false, true, undefined])('bài viết công khai chỉ đính trận không bị ẩn (hienThi: %s)', async (hienThi) => {
  const { ctrl, tin, query } = dungService();
  const tran = { _id: ID, tenGiaiDau: 'Giải đính kèm', ...(hienThi === undefined ? {} : { hienThi }) };
  const queries: ReturnType<typeof query>[] = [];
  const tinQuery = (chiTiet = false, noiBat = false) => {
    const chain = query([]);
    let locTranAn = false;
    chain.populate.mockImplementation((options: string | { path: string; match?: { hienThi: { $ne: boolean } } }) => {
      if (typeof options === 'object' && options.path === 'tranDau') locTranAn = options.match?.hienThi.$ne === false;
      return chain;
    });
    chain.lean.mockImplementation(async () => {
      const row = {
        _id: chiTiet ? ID : noiBat ? '64b000000000000000000011' : '64b000000000000000000012',
        tieuDe: 'Bài viết vẫn công khai',
        loaiTin: 'giai-dau',
        noiBat,
        tranDau: locTranAn && hienThi === false ? null : tran,
      };
      return chiTiet ? row : [row];
    });
    queries.push(chain);
    return chain;
  };
  const findOne = vi.fn(() => tinQuery(true));
  Object.assign(tin, {
    find: vi.fn((filter: Record<string, unknown>) => filter.tranDau ? query([]) : tinQuery(false, filter.noiBat === true)),
    findOne,
  });

  const bangTin = await ctrl.bangTin({});
  const landing = await ctrl.landing();
  const chiTiet = await ctrl.chiTietTin(ID, true);
  for (const rows of [bangTin.items, bangTin.dsNoiBat, [bangTin.noiBat], landing.dsNoiBat, landing.tinMoi, [chiTiet.tin], chiTiet.lienQuan]) {
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tieuDe: 'Bài viết vẫn công khai',
      tranDau: hienThi === false ? null : expect.objectContaining({ id: ID, tenGiaiDau: 'Giải đính kèm' }),
    });
  }
  expect(queries).toHaveLength(6);
  for (const chain of queries) {
    expect(chain.populate).toHaveBeenCalledWith({ path: 'tranDau', match: { hienThi: { $ne: false } } });
    expect(chain.populate).not.toHaveBeenCalledWith('tranDau');
  }
  const daDang = { deletedAt: null, hienThi: { $ne: false }, ngayDang: { $lte: expect.any(Date) } };
  for (const [filter] of tin.find.mock.calls) expect(filter).toMatchObject(daDang);
  expect(findOne).toHaveBeenCalledWith(expect.objectContaining(daDang));
});
