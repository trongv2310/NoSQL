import { Types } from 'mongoose';
import { KhaiThacCongKhaiController } from './khai-thac-cong-khai.controller';

const id = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
const query = (rows: unknown[]) => {
  const chain = { populate: vi.fn(), sort: vi.fn(), limit: vi.fn(), lean: vi.fn().mockResolvedValue(rows) };
  chain.populate.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
};

function dungController(taps = [[1, 7], [1, 2, 7, 8], [2, 3], [3, 4], [4, 5], [1, 2, 3, 4, 5, 6]]) {
  const products = Array.from({ length: 8 }, (_, index) => ({ _id: id(index + 1), tenSanPham: `SP${index + 1}`, giaGoc: 100,
    hinhAnhDaiDien: 'a.jpg', deletedAt: index === 6 ? new Date() : null, loai: id(100), khuyenMai: { phanTramGiam: 20 } }));
  const variants = products.map((sp, index) => ({ _id: id(200 + index), sanPham: sp._id, soLuongTon: index === 7 ? 0 : 1 }));
  const rows = taps.map((nums, index) => ({
    khoa: nums.join(','), sanPham: nums.map(id), hang: index + 1, loiNhuan: 999, k: 10, soThang: 3, taoLuc: new Date(),
  }));
  const goiYModel = { find: vi.fn((filter?: { sanPham: Types.ObjectId }) => query(rows.filter((r) => !filter || r.sanPham.some((s) => s.equals(filter.sanPham))))) };
  const spModel = {
    find: vi.fn((filter: { _id: { $in?: string[]; $ne?: Types.ObjectId }; deletedAt: null; loai?: Types.ObjectId }) => query(products.filter((sp) =>
      sp.deletedAt === filter.deletedAt && (!filter._id.$in || filter._id.$in.includes(sp._id.toHexString())) && !sp._id.equals(filter._id.$ne) && (!filter.loai || sp.loai.equals(filter.loai))))),
    findOne: vi.fn((filter: { _id: Types.ObjectId }) => ({ lean: async () => products.find((sp) => sp._id.equals(filter._id) && !sp.deletedAt) ?? null })),
  };
  const ctModel = { find: vi.fn((filter: { sanPham: { $in: string[] }; soLuongTon: { $gt: number } }) => query(variants.filter((bt) => filter.sanPham.$in.includes(bt.sanPham.toHexString()) && bt.soLuongTon > filter.soLuongTon.$gt))) };
  const ctrl = new KhaiThacCongKhaiController(goiYModel as never, spModel as never, ctModel as never);
  return { ctrl, goiYModel, spModel, ctModel, products, variants, rows };
}

describe('gợi ý công khai', () => {
  it('combo tối đa 3, bỏ tập dưới hai món sau lọc ẩn/hết hàng; giá dùng helper khuyến mãi', async () => {
    const { ctrl, spModel, ctModel } = dungController();
    const result = await ctrl.combo();
    expect(result.combos).toHaveLength(3);
    expect(result.combos.map((r) => r.sanPhams.map((s) => s.id))).toEqual([[1, 2], [2, 3], [3, 4]].map((nums) => nums.map((n) => id(n).toHexString())));
    for (const combo of result.combos) {
      expect(Object.keys(combo).sort()).toEqual(['khoa', 'sanPhams', 'tongGia']);
      expect(combo.tongGia).toBe(160);
      for (const sp of combo.sanPhams) expect(Object.keys(sp).sort()).toEqual(['chiTietMacDinh', 'gia', 'hinhAnhDaiDien', 'id', 'tenSanPham']);
    }
    expect(spModel.find.mock.calls[0][0].deletedAt).toBeNull();
    expect(ctModel.find.mock.calls[0][0].soLuongTon).toEqual({ $gt: 0 });
  });

  it('chi tiết lấy tối đa 4, đúng thứ tự hạng, bỏ trùng/chính nó/ẩn/hết hàng', async () => {
    const { ctrl } = dungController();
    const result = await ctrl.sanPham(id(1).toHexString());
    expect(result.sanPhams.map((sp) => sp.id)).toEqual([2, 3, 4, 5].map((n) => id(n).toHexString()));
    expect(result.sanPhams.every((sp) => sp.gia === 80)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/loiNhuan|utility|"hang"|"k"|soThang|taoLuc/);
  });

  it('không có gợi ý hiển thị được thì fallback cùng loại theo _id, vẫn lọc tồn/ẩn', async () => {
    const { ctrl, goiYModel, spModel } = dungController();
    goiYModel.find.mockReturnValue(query([]));
    const result = await ctrl.sanPham(id(1).toHexString());
    expect(result.sanPhams.map((sp) => sp.id)).toEqual([2, 3, 4, 5].map((n) => id(n).toHexString()));
    expect(spModel.find.mock.calls[0][0]).toEqual({ loai: id(100), _id: { $ne: id(1) }, deletedAt: null });
  });

  it('biến thể mặc định là _id nhỏ nhất còn hàng', async () => {
    const { ctrl, ctModel } = dungController();
    const sorted = query([{ _id: id(199), sanPham: id(1) }, { _id: id(300), sanPham: id(1) }, { _id: id(201), sanPham: id(2) }]);
    ctModel.find.mockReturnValue(sorted);
    const result = await ctrl.combo();
    expect(sorted.sort).toHaveBeenCalledWith({ _id: 1 });
    expect(result.combos[0].sanPhams.find((sp) => sp.id === id(1).toHexString())?.chiTietMacDinh).toBe(id(199).toHexString());
  });

  it('ID sai 400 trước truy vấn; không tồn tại/đã ẩn trả rỗng', async () => {
    const { ctrl, spModel } = dungController();
    await expect(ctrl.sanPham('sai')).rejects.toMatchObject({ status: 400 });
    expect(spModel.findOne).not.toHaveBeenCalled();
    expect(await ctrl.sanPham(id(99).toHexString())).toEqual({ sanPhams: [] });
    expect(await ctrl.sanPham(id(7).toHexString())).toEqual({ sanPhams: [] });
  });

  it('chưa lưu gợi ý: combo rỗng, không đọc sản phẩm/biến thể', async () => {
    const { ctrl, goiYModel, spModel, ctModel } = dungController();
    goiYModel.find.mockReturnValue(query([]));
    expect(await ctrl.combo()).toEqual({ combos: [] });
    expect(spModel.find).not.toHaveBeenCalled();
    expect(ctModel.find).not.toHaveBeenCalled();
  });

  it('ẩn B trong [ABC, AC, ACD]: chỉ giữ [AC, ACD], giữ combo hạng cao nhất dù thứ tự ID khác nhau', async () => {
    const { ctrl, products } = dungController([[1, 2, 3], [3, 1], [1, 3, 4]]);
    products[1].deletedAt = new Date();
    const { combos } = await ctrl.combo();
    expect(combos.map((c) => c.sanPhams.map((sp) => sp.id))).toEqual([[1, 3], [1, 3, 4]].map((nums) => nums.map((n) => id(n).toHexString())));
    expect(combos.map((c) => c.tongGia)).toEqual([160, 240]);
    expect(new Set(combos.map((c) => c.khoa)).size).toBe(2);
  });

  it('ẩn nhiều món và hết hàng: bỏ tập dưới hai món, bỏ trùng sau lọc, giữ các tập khác nhau', async () => {
    const { ctrl, products } = dungController([[2, 4, 6], [1, 2, 3, 4], [4, 3, 2, 1], [1, 3, 7, 8], [1, 3, 5], [1, 5]]);
    products[1].deletedAt = new Date();
    products[3].deletedAt = new Date();
    const { combos } = await ctrl.combo();
    expect(combos.map((c) => c.sanPhams.map((sp) => sp.id))).toEqual([[1, 3], [1, 3, 5], [1, 5]].map((nums) => nums.map((n) => id(n).toHexString())));
  });

  it('đọc dư và bỏ trùng trước khi lấy 3, vẫn lấy đủ 3 nếu các dòng đầu co về cùng tập', async () => {
    const { ctrl, products, goiYModel } = dungController([[1, 2, 3], [1, 3], [3, 1], [1, 2, 4], [4, 1], [1, 2, 5], [1, 6]]);
    products[1].deletedAt = new Date();
    const { combos } = await ctrl.combo();
    expect(combos.map((c) => c.sanPhams.map((sp) => sp.id))).toEqual([[1, 3], [1, 4], [1, 5]].map((nums) => nums.map((n) => id(n).toHexString())));
    expect(goiYModel.find.mock.results[0].value.sort).toHaveBeenCalledWith({ hang: 1, khoa: 1 });
    expect(goiYModel.find.mock.results[0].value.limit).toHaveBeenCalledWith(50);
  });

  it('gợi ý chi tiết sau ẩn B vẫn chỉ có C/D mỗi món một lần, không lộ trường admin', async () => {
    const { ctrl, products } = dungController([[1, 2, 3], [1, 3], [3, 1], [1, 3, 4]]);
    products[1].deletedAt = new Date();
    const result = await ctrl.sanPham(id(1).toHexString());
    expect(result.sanPhams.map((sp) => sp.id)).toEqual([3, 4].map((n) => id(n).toHexString()));
    expect(JSON.stringify(result)).not.toMatch(/loiNhuan|utility|"hang"|"k"|soThang|taoLuc/);
  });
});
