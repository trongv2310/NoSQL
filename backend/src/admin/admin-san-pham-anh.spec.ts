import type { ExecutionContext } from '@nestjs/common';
import { existsSync, unlinkSync } from 'fs';
import { Types } from 'mongoose';
import { join } from 'path';
import { defer, lastValueFrom } from 'rxjs';
import { DonAnhKhiLoi, UPLOAD_ROOT } from '../common/upload';
import { AdminSanPhamController, BienTheDto, SanPhamDto } from './admin-san-pham.controller';

vi.mock('fs', async (original) => ({
  ...await original<typeof import('fs')>(), existsSync: vi.fn(() => true), unlinkSync: vi.fn(),
}));

const ID = '64b000000000000000000010';
/** Model loại / nhà cung cấp / hãng / khuyến mãi giả: bản ghi được tham chiếu luôn tồn tại (kiemTraThamChieu chạy trước khi ghi). */
const coThat = () => ({ exists: vi.fn().mockResolvedValue({ _id: 'co' }) });
const SP_ID = new Types.ObjectId(ID);
const ANH_CU = 'uploads/sanpham/cu.jpg';
const ANH_MOI = 'uploads/sanpham/sp_moi.jpg';

function dungController(anhCu: string | null | undefined) {
  const row = { _id: SP_ID, tenSanPham: 'Vợt', hinhAnhDaiDien: anhCu };
  const sp = {
    findOne: vi.fn(() => ({ populate: () => ({ lean: async () => row }) })),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    countDocuments: vi.fn().mockResolvedValue(0),
  };
  const bt = { updateMany: vi.fn().mockResolvedValue({ matchedCount: 1 }), countDocuments: vi.fn().mockResolvedValue(0) };
  const ctrl = new AdminSanPhamController(sp as never, bt as never, coThat() as never, coThat() as never, coThat() as never, coThat() as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const input = Object.assign(new SanPhamDto(), { tenSanPham: 'Vợt mới', giaGoc: 2000, moTa: 'Mô tả mới' });
  const file = { filename: 'sp_moi.jpg', path: join(UPLOAD_ROOT, 'sanpham', 'sp_moi.jpg') } as Express.Multer.File;
  const context = { switchToHttp: () => ({ getRequest: () => ({ file }) }) } as unknown as ExecutionContext;
  const thucHien = () => lastValueFrom(new DonAnhKhiLoi().intercept(context, { handle: () => defer(() => ctrl.capNhat(ID, input, file)) }));
  return { ctrl, sp, bt, input, file, thucHien };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(unlinkSync).mockReset();
});

describe('Đổi ảnh đại diện sản phẩm và ảnh biến thể', () => {
  it('chỉ đồng bộ biến thể cùng sản phẩm có đúng ảnh cũ; ghi cả hai trước khi xóa ảnh', async () => {
    const { sp, bt, input, file, thucHien } = dungController(ANH_CU);
    await expect(thucHien()).resolves.toEqual({ message: 'Cập nhật sản phẩm thành công!' });
    expect(sp.updateOne).toHaveBeenCalledWith({ _id: SP_ID }, {
      $set: { tenSanPham: input.tenSanPham, giaGoc: input.giaGoc, moTa: input.moTa, khuyenMai: null, hinhAnhDaiDien: ANH_MOI },
    });
    // Filter bằng chính xác ảnh cũ loại trừ ảnh riêng, chuỗi rỗng/null và sản phẩm khác.
    expect(bt.updateMany).toHaveBeenCalledWith({ sanPham: SP_ID, hinhAnh: ANH_CU }, { $set: { hinhAnh: ANH_MOI } });
    expect(unlinkSync).toHaveBeenCalledWith(join(UPLOAD_ROOT, 'sanpham', 'cu.jpg'));
    expect(sp.updateOne.mock.invocationCallOrder[0]).toBeLessThan(bt.updateMany.mock.invocationCallOrder[0]);
    expect(bt.updateMany.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(unlinkSync).mock.invocationCallOrder[0]);
    expect(DonAnhKhiLoi.daLuu.has(file)).toBe(true);
  });

  it('ảnh cũ tĩnh: vẫn đồng bộ biến thể nhưng không xóa file', async () => {
    const { bt, thucHien } = dungController('astrox100zz.jpg');
    await expect(thucHien()).resolves.toEqual({ message: 'Cập nhật sản phẩm thành công!' });
    expect(bt.updateMany).toHaveBeenCalledWith({ sanPham: SP_ID, hinhAnh: 'astrox100zz.jpg' }, { $set: { hinhAnh: ANH_MOI } });
    expect(existsSync).not.toHaveBeenCalled();
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it('không chọn file: giữ nguyên ảnh và các cập nhật khác, không đụng biến thể', async () => {
    const { ctrl, sp, bt, input } = dungController(ANH_CU);
    await expect(ctrl.capNhat(ID, input)).resolves.toEqual({ message: 'Cập nhật sản phẩm thành công!' });
    expect(sp.updateOne).toHaveBeenCalledWith({ _id: SP_ID }, {
      $set: { tenSanPham: input.tenSanPham, giaGoc: input.giaGoc, moTa: input.moTa, khuyenMai: null },
    });
    expect(bt.updateMany).not.toHaveBeenCalled();
    expect(existsSync).not.toHaveBeenCalled();
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it.each(['', null, undefined])('ảnh cũ rỗng/thiếu (%s): lưu ảnh mới nhưng không cập nhật biến thể', async (anhCu) => {
    const { sp, bt, file, thucHien } = dungController(anhCu);
    await expect(thucHien()).resolves.toEqual({ message: 'Cập nhật sản phẩm thành công!' });
    expect(sp.updateOne).toHaveBeenCalledWith({ _id: SP_ID }, { $set: expect.objectContaining({ hinhAnhDaiDien: ANH_MOI }) });
    expect(bt.updateMany).not.toHaveBeenCalled();
    expect(unlinkSync).not.toHaveBeenCalled();
    expect(DonAnhKhiLoi.daLuu.has(file)).toBe(true);
  });

  it('đồng bộ biến thể lỗi: giữ cả ảnh cũ và mới, phát lại lỗi gốc qua interceptor', async () => {
    const { sp, bt, file, thucHien } = dungController(ANH_CU);
    const error = new Error('lỗi cập nhật biến thể');
    sp.updateOne.mockImplementationOnce(async () => {
      expect(DonAnhKhiLoi.daLuu.has(file)).toBe(false);
      return { matchedCount: 1 };
    });
    bt.updateMany.mockImplementationOnce(async () => {
      expect(DonAnhKhiLoi.daLuu.has(file)).toBe(true);
      throw error;
    });
    await expect(thucHien()).rejects.toBe(error);
    expect(sp.updateOne).toHaveBeenCalledWith({ _id: SP_ID }, { $set: expect.objectContaining({ hinhAnhDaiDien: ANH_MOI }) });
    expect(bt.updateMany).toHaveBeenCalledOnce();
    expect(existsSync).not.toHaveBeenCalled();
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it('ghi sản phẩm lỗi: không đồng bộ biến thể, interceptor chỉ dọn ảnh mới', async () => {
    const { sp, bt, file, thucHien } = dungController(ANH_CU);
    const error = new Error('lỗi cập nhật sản phẩm');
    sp.updateOne.mockRejectedValueOnce(error);
    await expect(thucHien()).rejects.toBe(error);
    expect(bt.updateMany).not.toHaveBeenCalled();
    expect(DonAnhKhiLoi.daLuu.has(file)).toBe(false);
    expect(unlinkSync).toHaveBeenCalledOnce();
    expect(unlinkSync).toHaveBeenCalledWith(file.path);
  });
});

it('T-407: đổi ảnh hai lần chỉ cập nhật biến thể cùng sản phẩm và cùng ảnh trước đó', async () => {
  const anhRieng = 'uploads/sanpham/bt_rieng.jpg';
  const khac = new Types.ObjectId('64b000000000000000000012');
  const row = { _id: SP_ID, tenSanPham: 'Vợt', hinhAnhDaiDien: 'a.jpg' };
  const bienThes = [
    { sanPham: SP_ID, hinhAnh: 'a.jpg' }, { sanPham: SP_ID, hinhAnh: 'a.jpg' },
    { sanPham: SP_ID, hinhAnh: anhRieng }, { sanPham: khac, hinhAnh: 'a.jpg' },
  ];
  const sp = {
    findOne: vi.fn(() => ({ populate: () => ({ lean: async () => ({ ...row }) }) })),
    updateOne: vi.fn(async (_filter, update: { $set: { hinhAnhDaiDien: string } }) => { row.hinhAnhDaiDien = update.$set.hinhAnhDaiDien; }),
    countDocuments: vi.fn().mockResolvedValue(0),
  };
  const bt = { countDocuments: vi.fn().mockResolvedValue(0), updateMany: vi.fn(async (filter: { sanPham: Types.ObjectId; hinhAnh: string }, update: { $set: { hinhAnh: string } }) => {
    for (const b of bienThes) if (b.sanPham.equals(filter.sanPham) && b.hinhAnh === filter.hinhAnh) b.hinhAnh = update.$set.hinhAnh;
  }) };
  const ctrl = new AdminSanPhamController(sp as never, bt as never, coThat() as never, coThat() as never, coThat() as never, coThat() as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const input = Object.assign(new SanPhamDto(), { tenSanPham: 'Vợt' });
  await ctrl.capNhat(ID, input, { filename: 'moi1.jpg' } as Express.Multer.File);
  expect(bienThes.map((b) => b.hinhAnh)).toEqual(['uploads/sanpham/moi1.jpg', 'uploads/sanpham/moi1.jpg', anhRieng, 'a.jpg']);
  await ctrl.capNhat(ID, input, { filename: 'moi2.jpg' } as Express.Multer.File);
  expect(bt.updateMany).toHaveBeenNthCalledWith(1, { sanPham: SP_ID, hinhAnh: 'a.jpg' }, { $set: { hinhAnh: 'uploads/sanpham/moi1.jpg' } });
  expect(bt.updateMany).toHaveBeenNthCalledWith(2, { sanPham: SP_ID, hinhAnh: 'uploads/sanpham/moi1.jpg' }, { $set: { hinhAnh: 'uploads/sanpham/moi2.jpg' } });
  expect(bienThes.map((b) => b.hinhAnh)).toEqual(['uploads/sanpham/moi2.jpg', 'uploads/sanpham/moi2.jpg', anhRieng, 'a.jpg']);
});

function anhDungChung() {
  const sanPhams = [{ _id: SP_ID, tenSanPham: 'Quần Q21', hinhAnhDaiDien: ANH_CU, deletedAt: null as Date | null }];
  const bienThes = ['L', 'M', 'XL'].map((sku) => ({ _id: new Types.ObjectId(), sanPham: SP_ID, sku, giaBan: 1000, hinhAnh: ANH_CU }));
  const row = bienThes[0];
  const deleteOne = vi.fn(async () => { bienThes.splice(bienThes.indexOf(row), 1); });
  const sp = {
    findOne: vi.fn(() => ({ populate: () => ({ lean: async () => ({ ...sanPhams[0] }) }) })),
    updateOne: vi.fn(async (_filter, update: { $set: { hinhAnhDaiDien: string } }) => { Object.assign(sanPhams[0], update.$set); }),
    countDocuments: vi.fn(async (filter: { hinhAnhDaiDien: string; _id?: { $ne: Types.ObjectId } }) =>
      sanPhams.filter((s) => s.hinhAnhDaiDien === filter.hinhAnhDaiDien && !s._id.equals(filter._id?.$ne)).length),
  };
  const bt = {
    findById: vi.fn(async () => ({ ...row, deleteOne })),
    exists: vi.fn().mockResolvedValue(false),
    updateOne: vi.fn(async (_filter, update: { $set: { hinhAnh?: string } }) => { Object.assign(row, update.$set); return { matchedCount: 1 }; }),
    updateMany: vi.fn(async (filter: { sanPham: Types.ObjectId; hinhAnh: string }, update: { $set: { hinhAnh: string } }) => {
      for (const b of bienThes) if (b.sanPham.equals(filter.sanPham) && b.hinhAnh === filter.hinhAnh) b.hinhAnh = update.$set.hinhAnh;
    }),
    countDocuments: vi.fn(async (filter: { hinhAnh: string; _id?: { $ne: Types.ObjectId } }) =>
      bienThes.filter((b) => b.hinhAnh === filter.hinhAnh && !b._id.equals(filter._id?.$ne)).length),
  };
  const gio = { deleteMany: vi.fn().mockResolvedValue({}) };
  const don = { exists: vi.fn().mockResolvedValue(false) };
  const ctrl = new AdminSanPhamController(sp as never, bt as never, coThat() as never, coThat() as never, coThat() as never, coThat() as never, {} as never, {} as never, gio as never, don as never, {} as never);
  const input = Object.assign(new BienTheDto(), { sku: 'L', giaBan: 1000, soLuongTon: 5, soLuongTonDaTai: 5 });
  const file = { filename: 'bt_moi.jpg' } as Express.Multer.File;
  const sua = () => ctrl.capNhatBienThe({ id: ID, tenDangNhap: 'admin', maQuyen: 1 }, row._id.toHexString(), input, file);
  const xoa = () => ctrl.xoaBienThe(row._id.toHexString());
  return { ctrl, sp, bt, gio, don, sanPhams, bienThes, row, deleteOne, file, sua, xoa };
}

describe('T-603: chỉ xóa ảnh upload không còn tham chiếu', () => {
  it.each(['sua', 'xoa'] as const)('%s biến thể: giữ ảnh khi còn sản phẩm hoặc biến thể khác dùng chung', async (action) => {
    for (const nguon of ['sanPham', 'bienThe'] as const) {
      const state = anhDungChung();
      if (nguon === 'sanPham') state.bienThes.splice(1);
      else state.sanPhams[0].hinhAnhDaiDien = 'anh-khac.jpg';
      await expect(state[action]()).resolves.toMatchObject({ sanPhamId: ID });
      expect(state.sp.countDocuments).toHaveBeenCalledWith({ hinhAnhDaiDien: ANH_CU });
      expect(state.bt.countDocuments).toHaveBeenCalledWith({ hinhAnh: ANH_CU, _id: { $ne: state.row._id } });
      expect(unlinkSync).not.toHaveBeenCalled();
    }
  });

  it.each(['sua', 'xoa'] as const)('%s biến thể: xóa ảnh riêng sau khi ghi/xóa DB và đếm cả hai loại tham chiếu', async (action) => {
    const state = anhDungChung();
    state.sanPhams[0].hinhAnhDaiDien = 'anh-khac.jpg';
    state.bienThes.splice(1);
    await expect(state[action]()).resolves.toMatchObject({ sanPhamId: ID });
    expect(unlinkSync).toHaveBeenCalledExactlyOnceWith(join(UPLOAD_ROOT, 'sanpham', 'cu.jpg'));
    const ghiDB = action === 'sua' ? state.bt.updateOne : state.deleteOne;
    for (const count of [state.sp.countDocuments, state.bt.countDocuments]) {
      expect(ghiDB.mock.invocationCallOrder[0]).toBeLessThan(count.mock.invocationCallOrder[0]);
      expect(count.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(unlinkSync).mock.invocationCallOrder[0]);
    }
    if (action === 'sua') expect(DonAnhKhiLoi.daLuu.has(state.file)).toBe(true);
    else expect(state.bienThes).toHaveLength(0);
  });

  it.each(['sp', 'bt'] as const)('đổi ảnh sản phẩm: giữ ảnh cũ khi %s khác còn dùng, kiểm tra sau đồng bộ', async (model) => {
    const { sp, bt, thucHien } = dungController(ANH_CU);
    (model === 'sp' ? sp : bt).countDocuments.mockResolvedValueOnce(1);
    await expect(thucHien()).resolves.toEqual({ message: 'Cập nhật sản phẩm thành công!' });
    expect(sp.countDocuments).toHaveBeenCalledWith({ hinhAnhDaiDien: ANH_CU, _id: { $ne: SP_ID } });
    expect(bt.countDocuments).toHaveBeenCalledWith({ hinhAnh: ANH_CU });
    for (const count of [sp.countDocuments, bt.countDocuments]) expect(bt.updateMany.mock.invocationCallOrder[0]).toBeLessThan(count.mock.invocationCallOrder[0]);
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it.each(['sua', 'xoa', 'sanPham'] as const)('%s: lỗi đếm từ một trong hai model không xóa file hoặc làm hỏng request đã ghi DB', async (action) => {
    for (const model of ['sp', 'bt'] as const) {
      const state = action === 'sanPham' ? dungController(ANH_CU) : anhDungChung();
      state[model].countDocuments.mockRejectedValueOnce(new Error('lỗi đếm tham chiếu'));
      const request = 'thucHien' in state ? state.thucHien : action === 'sua' ? state.sua : state.xoa;
      await expect(request()).resolves.toHaveProperty('message');
      expect(DonAnhKhiLoi.daLuu.has(state.file)).toBe(action !== 'xoa');
      expect(unlinkSync).not.toHaveBeenCalled();
    }
  });

  it.each(['sua', 'xoa'] as const)('%s biến thể dùng ảnh tĩnh: không đếm hoặc xóa file', async (action) => {
    const state = anhDungChung();
    state.row.hinhAnh = 'lining_q21.jpg';
    await expect(state[action]()).resolves.toHaveProperty('message');
    expect(state.sp.countDocuments).not.toHaveBeenCalled();
    expect(state.bt.countDocuments).not.toHaveBeenCalled();
    expect(existsSync).not.toHaveBeenCalled();
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it('sản phẩm đang ẩn vẫn giữ ảnh mà nó tham chiếu', async () => {
    const state = anhDungChung();
    state.sanPhams[0].deletedAt = new Date();
    state.bienThes.splice(1);
    await state.xoa();
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it('lỗi xóa file sau đếm không làm hỏng cập nhật đã ghi DB', async () => {
    const { file, thucHien } = dungController(ANH_CU);
    vi.mocked(unlinkSync).mockImplementationOnce(() => { throw new Error('không xóa được file'); });
    await expect(thucHien()).resolves.toEqual({ message: 'Cập nhật sản phẩm thành công!' });
    expect(DonAnhKhiLoi.daLuu.has(file)).toBe(true);
  });

  it('kịch bản L-1: đổi ảnh sản phẩm rồi sửa ảnh L vẫn giữ file chung cho sản phẩm, M và XL', async () => {
    const state = anhDungChung();
    const files = new Set([ANH_CU, ANH_MOI, 'uploads/sanpham/bt_moi.jpg'].map((path) => join(UPLOAD_ROOT, path.slice('uploads/'.length))));
    vi.mocked(existsSync).mockImplementation((path) => files.has(String(path)));
    vi.mocked(unlinkSync).mockImplementation((path) => { files.delete(String(path)); });
    await state.ctrl.capNhat(ID, Object.assign(new SanPhamDto(), { tenSanPham: 'Quần Q21' }), { filename: 'sp_moi.jpg' } as Express.Multer.File);
    expect(state.bienThes.map((b) => b.hinhAnh)).toEqual([ANH_MOI, ANH_MOI, ANH_MOI]);
    await state.sua();
    expect(state.sanPhams[0].hinhAnhDaiDien).toBe(ANH_MOI);
    expect(state.bienThes.map((b) => b.hinhAnh)).toEqual(['uploads/sanpham/bt_moi.jpg', ANH_MOI, ANH_MOI]);
    for (const path of [state.sanPhams[0].hinhAnhDaiDien, ...state.bienThes.map((b) => b.hinhAnh)]) {
      expect(files.has(join(UPLOAD_ROOT, path.slice('uploads/'.length)))).toBe(true);
    }
    expect(unlinkSync).toHaveBeenCalledExactlyOnceWith(join(UPLOAD_ROOT, 'sanpham', 'cu.jpg'));
  });
});

it('T-606: đổi lần lượt L, M, XL giữ ảnh chung đến khi tham chiếu cuối cùng rời đi', async () => {
  const ids = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
  const bienThes = ids.map((_id, i) => ({ _id, sanPham: SP_ID, sku: ['L', 'M', 'XL'][i], giaBan: 1000, hinhAnh: ANH_CU }));
  const spRow = { _id: SP_ID, hinhAnhDaiDien: ANH_CU };
  const sp = { countDocuments: vi.fn(async (f: { hinhAnhDaiDien: string }) => Number(spRow.hinhAnhDaiDien === f.hinhAnhDaiDien)) };
  const bt = {
    findById: vi.fn(async (id: Types.ObjectId) => ({ ...bienThes.find((b) => b._id.equals(id)) })),
    exists: vi.fn().mockResolvedValue(false),
    updateOne: vi.fn(async (f: { _id: Types.ObjectId }, u: { $set: { hinhAnh: string } }) => {
      const row = bienThes.find((b) => b._id.equals(f._id))!;
      row.hinhAnh = u.$set.hinhAnh;
      return { matchedCount: 1 };
    }),
    countDocuments: vi.fn(async (f: { hinhAnh: string; _id: { $ne: Types.ObjectId } }) =>
      bienThes.filter((b) => b.hinhAnh === f.hinhAnh && !b._id.equals(f._id.$ne)).length),
  };
  const ctrl = new AdminSanPhamController(sp as never, bt as never, coThat() as never, coThat() as never, coThat() as never, coThat() as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  for (let i = 0; i < ids.length; i++) {
    if (i === 2) spRow.hinhAnhDaiDien = 'uploads/sanpham/anh-khac.jpg';
    const input = Object.assign(new BienTheDto(), { sku: bienThes[i].sku, giaBan: 1000, soLuongTon: 5, soLuongTonDaTai: 5 });
    await expect(ctrl.capNhatBienThe({ id: ID, tenDangNhap: 'admin', maQuyen: 1 }, ids[i].toHexString(), input, { filename: `anh-${i}.jpg` } as Express.Multer.File)).resolves.toHaveProperty('message');
    if (i < 2) expect(unlinkSync).not.toHaveBeenCalled();
  }
  expect(sp.countDocuments).toHaveBeenCalledWith({ hinhAnhDaiDien: ANH_CU });
  for (const id of ids) expect(bt.countDocuments).toHaveBeenCalledWith({ hinhAnh: ANH_CU, _id: { $ne: id } });
  expect(unlinkSync).toHaveBeenCalledExactlyOnceWith(join(UPLOAD_ROOT, 'sanpham', 'cu.jpg'));
});
