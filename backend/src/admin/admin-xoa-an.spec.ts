import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HTTP_CODE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DonAnhKhiLoi, xoaAnhUpload } from '../common/upload';
import { AdminBanTinController } from './admin-ban-tin.controller';
import { AdminTranDauController } from './admin-danh-muc.controller';
import { AdminSanPhamController, BienTheDto, SanPhamDto } from './admin-san-pham.controller';

vi.mock('../common/upload', async (importOriginal) => ({ ...await importOriginal<typeof import('../common/upload')>(), xoaAnhUpload: vi.fn() }));
const ID = '64b000000000000000000010';
const BIEN_THE = '64b000000000000000000011';
/** Query giả của Mongoose: hỗ trợ chuỗi populate/sort/skip/limit/lean (danh sách quản trị phân trang ngay trong MongoDB). */
const list = (data: unknown[]) => {
  const q = {
    boQua: 0,
    gioiHan: Infinity,
    populate: () => q,
    sort: () => q,
    skip: (n: number) => { q.boQua = n; return q; },
    limit: (n: number) => { q.gioiHan = n; return q; },
    lean: async () => data.slice(q.boQua, q.boQua + q.gioiHan),
  };
  return q;
};

function sanPham() {
  const sp = { findOne: vi.fn(() => ({ populate: () => ({ lean: async () => ({ _id: ID, tenSanPham: 'Vợt' }) }) })), updateOne: vi.fn().mockResolvedValue({}), find: vi.fn(() => list([])), countDocuments: vi.fn().mockResolvedValue(0) };
  const bt = { find: vi.fn(() => list([{ _id: BIEN_THE }])), findById: vi.fn(), aggregate: vi.fn().mockResolvedValue([]), countDocuments: vi.fn().mockResolvedValue(0) };
  const kho = { find: vi.fn(() => list([])), exists: vi.fn().mockResolvedValue({ _id: 'co' }) };
  const gio = { deleteMany: vi.fn().mockResolvedValue({}) };
  const don = { exists: vi.fn().mockResolvedValue(false) };
  const ctrl = new AdminSanPhamController(sp as never, bt as never, kho as never, kho as never, kho as never, kho as never, {} as never, {} as never, gio as never, don as never, {} as never);
  return { ctrl, sp, bt, gio, don };
}

beforeEach(() => vi.clearAllMocks());

describe('Xóa sản phẩm và biến thể', () => {
  it('HIỆN TẠI: xóa mềm sản phẩm, dọn giỏ, không xóa ảnh', async () => {
    const { ctrl, sp, bt, gio } = sanPham();
    await expect(ctrl.xoa(ID)).resolves.toEqual({ message: 'Đã xóa sản phẩm "Vợt" thành công!' });
    expect(bt.find).toHaveBeenCalledWith({ sanPham: ID }, { _id: 1 });
    expect(gio.deleteMany).toHaveBeenCalledWith({ chiTietSanPham: { $in: [BIEN_THE] } });
    expect(sp.updateOne).toHaveBeenCalledWith({ _id: ID }, { $set: { deletedAt: expect.any(Date) } });
    expect(xoaAnhUpload).not.toHaveBeenCalled();
  });

  it('HIỆN TẠI: sản phẩm không tồn tại trả 404 không dọn giỏ', async () => {
    const { ctrl, sp, gio } = sanPham();
    sp.findOne.mockReturnValueOnce({ populate: () => ({ lean: async () => null as never }) });
    await expect(ctrl.xoa(ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(gio.deleteMany).not.toHaveBeenCalled();
  });

  it('HIỆN TẠI: biến thể có đơn bị chặn và không xóa dữ liệu', async () => {
    const { ctrl, bt, gio, don } = sanPham();
    const row = { _id: BIEN_THE, sku: 'SKU', deleteOne: vi.fn() };
    bt.findById.mockResolvedValue(row);
    don.exists.mockResolvedValueOnce(true);
    await expect(ctrl.xoaBienThe(BIEN_THE)).rejects.toBeInstanceOf(BadRequestException);
    expect(gio.deleteMany).not.toHaveBeenCalled();
    expect(row.deleteOne).not.toHaveBeenCalled();
    expect(xoaAnhUpload).not.toHaveBeenCalled();
  });

  it('HIỆN TẠI: biến thể không tồn tại trả 404', async () => {
    const { ctrl, bt, gio } = sanPham();
    bt.findById.mockResolvedValueOnce(null);
    await expect(ctrl.xoaBienThe(BIEN_THE)).rejects.toBeInstanceOf(NotFoundException);
    expect(gio.deleteMany).not.toHaveBeenCalled();
  });

  it('HIỆN TẠI: xóa biến thể chưa có đơn cùng giỏ và ảnh', async () => {
    const { ctrl, bt, gio } = sanPham();
    const row = { _id: BIEN_THE, sku: 'SKU', sanPham: ID, hinhAnh: 'uploads/sanpham/a.jpg', deleteOne: vi.fn().mockResolvedValue({}) };
    bt.findById.mockResolvedValue(row);
    await expect(ctrl.xoaBienThe(BIEN_THE)).resolves.toEqual({ sanPhamId: ID, message: 'Đã xóa biến thể SKU "SKU".' });
    expect(gio.deleteMany).toHaveBeenCalledWith({ chiTietSanPham: BIEN_THE });
    expect(row.deleteOne).toHaveBeenCalledOnce();
    expect(xoaAnhUpload).toHaveBeenCalledWith(row.hinhAnh);
  });

  it('HIỆN TẠI: danh sách quản trị chỉ truy vấn sản phẩm chưa xóa', async () => {
    const { ctrl, sp } = sanPham();
    const result = await ctrl.danhSach({});
    expect(sp.countDocuments).toHaveBeenCalledWith({ deletedAt: null });
    expect(result.items).toEqual([]);
  });
});

describe('Xóa và đổi trạng thái bài viết', () => {
  it('HIỆN TẠI: xóa bài viết bằng deletedAt', async () => {
    const model = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
    const ctrl = new AdminBanTinController(model as never, {} as never, {} as never, {} as never);
    await expect(ctrl.xoa(ID)).resolves.toEqual({ message: 'Đã xóa bài viết khỏi bảng tin.' });
    expect(model.updateOne).toHaveBeenCalledWith({ _id: expect.anything(), deletedAt: null }, { $set: { deletedAt: expect.any(Date) } });
    expect(String(model.updateOne.mock.calls[0][0]._id)).toBe(ID);
  });

  it.each(['hienThi', 'noiBat'] as const)('HIỆN TẠI: toggle %s, lưu và trả giá trị mới', async (field) => {
    const tin = { hienThi: true, noiBat: true, save: vi.fn().mockResolvedValue({}) };
    const model = { findOne: vi.fn().mockResolvedValue(tin) };
    const ctrl = new AdminBanTinController(model as never, {} as never, {} as never, {} as never);
    await expect(ctrl.doiTrangThai(ID, { field })).resolves.toMatchObject({ success: true, field, value: false });
    expect(model.findOne).toHaveBeenCalledWith({ _id: expect.anything(), deletedAt: null });
    expect(tin.save).toHaveBeenCalledOnce();
  });

  it('HIỆN TẠI: toggle nhận giá trị rõ ràng thay vì đảo trạng thái', async () => {
    const tin = { hienThi: true, save: vi.fn().mockResolvedValue({}) };
    const ctrl = new AdminBanTinController({ findOne: vi.fn().mockResolvedValue(tin) } as never, {} as never, {} as never, {} as never);
    await expect(ctrl.doiTrangThai(ID, { field: 'hienThi', value: true })).resolves.toMatchObject({ value: true });
    expect(tin.hienThi).toBe(true);
    expect(tin.save).toHaveBeenCalledOnce();
  });

  it('HIỆN TẠI: xóa bài viết không tồn tại trả 404', async () => {
    const ctrl = new AdminBanTinController({ updateOne: vi.fn().mockResolvedValue({ matchedCount: 0 }) } as never, {} as never, {} as never, {} as never);
    await expect(ctrl.xoa(ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('HIỆN TẠI: bài đã xóa không đổi được trạng thái', async () => {
    const model = { findOne: vi.fn().mockResolvedValue(null) };
    const ctrl = new AdminBanTinController(model as never, {} as never, {} as never, {} as never);
    await expect(ctrl.doiTrangThai(ID, { field: 'hienThi' })).rejects.toBeInstanceOf(NotFoundException);
    expect(model.findOne).toHaveBeenCalledWith({ _id: expect.anything(), deletedAt: null });
  });
});

describe('Xóa trận đấu', () => {
  it('HIỆN TẠI: xóa trận rồi bỏ liên kết khỏi bài viết', async () => {
    const model = { deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }) };
    const tin = { updateMany: vi.fn().mockResolvedValue({}) };
    const ctrl = new AdminTranDauController(model as never, tin as never);
    await expect(ctrl.xoa(ID)).resolves.toEqual({ message: 'Đã xóa trận đấu.' });
    expect(String(model.deleteOne.mock.calls[0][0]._id)).toBe(ID);
    expect(tin.updateMany).toHaveBeenCalledWith({ tranDau: expect.anything() }, { $set: { tranDau: null } });
    expect(model.deleteOne.mock.invocationCallOrder[0]).toBeLessThan(tin.updateMany.mock.invocationCallOrder[0]);
  });

  it('HIỆN TẠI: trận không tồn tại trả 404, không sửa bài viết', async () => {
    const model = { deleteOne: vi.fn().mockResolvedValue({ deletedCount: 0 }) };
    const tin = { updateMany: vi.fn() };
    const ctrl = new AdminTranDauController(model as never, tin as never);
    await expect(ctrl.xoa(ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(tin.updateMany).not.toHaveBeenCalled();
  });
});

describe('Ẩn và hiện sản phẩm', () => {
  const coTrangThai = (deletedAt?: Date | null) => {
    const mocks = sanPham();
    mocks.sp.findOne.mockReturnValueOnce({ lean: async () => ({ _id: ID, tenSanPham: 'Vợt', deletedAt }) } as never);
    return mocks;
  };

  it.each(['an', 'hien'] as const)('%s: đúng đường dẫn và trả HTTP 200', (method) => {
    const handler = AdminSanPhamController.prototype[method];
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(`san-pham/:id/${method}`);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
  });

  it.each([null, undefined])('ẩn sản phẩm đang hiện (%s): dọn giỏ trước, đặt deletedAt, không xóa ảnh', async (deletedAt) => {
    const { ctrl, sp, bt, gio } = coTrangThai(deletedAt);
    await expect(ctrl.an(ID)).resolves.toEqual({ message: 'Đã ẩn sản phẩm "Vợt" thành công!' });
    expect(sp.findOne).toHaveBeenCalledWith({ _id: expect.anything() });
    expect(bt.find).toHaveBeenCalledWith({ sanPham: ID }, { _id: 1 });
    expect(gio.deleteMany).toHaveBeenCalledWith({ chiTietSanPham: { $in: [BIEN_THE] } });
    expect(sp.updateOne).toHaveBeenCalledWith({ _id: ID }, { $set: { deletedAt: expect.any(Date) } });
    expect(gio.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(sp.updateOne.mock.invocationCallOrder[0]);
    expect(xoaAnhUpload).not.toHaveBeenCalled();
  });

  it('ẩn sản phẩm đã ẩn: thành công, không ghi hoặc dọn giỏ lần nữa', async () => {
    const { ctrl, sp, bt, gio } = coTrangThai(new Date());
    await expect(ctrl.an(ID)).resolves.toEqual({ message: 'Đã ẩn sản phẩm "Vợt" thành công!' });
    expect(sp.updateOne).not.toHaveBeenCalled();
    expect(bt.find).not.toHaveBeenCalled();
    expect(gio.deleteMany).not.toHaveBeenCalled();
    expect(xoaAnhUpload).not.toHaveBeenCalled();
  });

  it('hiện sản phẩm đã ẩn: đặt deletedAt = null, không sửa giỏ hoặc ảnh', async () => {
    const { ctrl, sp, gio } = coTrangThai(new Date());
    await expect(ctrl.hien(ID)).resolves.toEqual({ message: 'Đã hiện sản phẩm "Vợt" thành công!' });
    expect(sp.updateOne).toHaveBeenCalledWith({ _id: ID }, { $set: { deletedAt: null } });
    expect(gio.deleteMany).not.toHaveBeenCalled();
    expect(xoaAnhUpload).not.toHaveBeenCalled();
  });

  it.each([null, undefined])('hiện sản phẩm đang hiện (%s): thành công, không ghi', async (deletedAt) => {
    const { ctrl, sp, gio } = coTrangThai(deletedAt);
    await expect(ctrl.hien(ID)).resolves.toEqual({ message: 'Đã hiện sản phẩm "Vợt" thành công!' });
    expect(sp.updateOne).not.toHaveBeenCalled();
    expect(gio.deleteMany).not.toHaveBeenCalled();
    expect(xoaAnhUpload).not.toHaveBeenCalled();
  });

  it.each(['an', 'hien'] as const)('%s: không tồn tại trả 404, không ghi/xóa dữ liệu', async (method) => {
    const { ctrl, sp, bt, gio } = sanPham();
    sp.findOne.mockReturnValueOnce({ lean: async () => null } as never);
    await expect(ctrl[method](ID)).rejects.toMatchObject({ status: 404, message: 'Không tìm thấy sản phẩm.' });
    expect(sp.updateOne).not.toHaveBeenCalled();
    expect(bt.find).not.toHaveBeenCalled();
    expect(gio.deleteMany).not.toHaveBeenCalled();
    expect(xoaAnhUpload).not.toHaveBeenCalled();
  });

  it.each(['an', 'hien'] as const)('%s: id sai trả 400 trước khi truy vấn', async (method) => {
    const { ctrl, sp, gio } = sanPham();
    await expect(ctrl[method]('sai-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(sp.findOne).not.toHaveBeenCalled();
    expect(sp.updateOne).not.toHaveBeenCalled();
    expect(gio.deleteMany).not.toHaveBeenCalled();
  });

  it('dọn giỏ thất bại khi ẩn: giữ lỗi và không ghi deletedAt', async () => {
    const { ctrl, sp, gio } = coTrangThai(null);
    gio.deleteMany.mockRejectedValueOnce(new Error('lỗi dọn giỏ'));
    await expect(ctrl.an(ID)).rejects.toThrow('lỗi dọn giỏ');
    expect(sp.updateOne).not.toHaveBeenCalled();
  });
});

describe('Danh sách sản phẩm ẩn và daAn', () => {
  it.each(['1', 'true'])('an=%s: lọc sản phẩm ẩn và trả daAn=true', async (an) => {
    const { ctrl, sp } = sanPham();
    sp.find.mockReturnValueOnce(list([{ _id: ID, tenSanPham: 'Vợt', deletedAt: new Date() }]));
    sp.countDocuments.mockResolvedValueOnce(1);
    const result = await ctrl.danhSach({ an });
    expect(sp.find).toHaveBeenCalledWith({ deletedAt: { $ne: null } });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: ID, daAn: true });
  });

  it.each([undefined, '', '0', 'false', 'TRUE', '2', true, 1, ['1'], { $ne: null }])('an không bật hợp lệ (%j): giữ lọc mặc định và daAn=false', async (an) => {
    const { ctrl, sp } = sanPham();
    sp.find.mockReturnValueOnce(list([{ _id: ID, tenSanPham: 'Vợt' }]));
    sp.countDocuments.mockResolvedValueOnce(1);
    const result = await ctrl.danhSach({ an });
    expect(sp.find).toHaveBeenCalledWith({ deletedAt: null });
    expect(result.items[0]).toMatchObject({ id: ID, daAn: false });
  });

  it('an=1 vẫn giữ bộ lọc loại/hãng, escape từ khóa, phân trang và tồn kho', async () => {
    const { ctrl, sp, bt } = sanPham();
    sp.find.mockReturnValueOnce(list(Array.from({ length: 12 }, () => ({ _id: ID, tenSanPham: 'Vợt', deletedAt: new Date() }))));
    sp.countDocuments.mockResolvedValueOnce(12);
    bt.aggregate.mockResolvedValueOnce([{ _id: ID, t: 7 }]);
    const result = await ctrl.danhSach({ an: '1', maLoai: ID, maHang: BIEN_THE, keyword: 'Vợt.*', page: '2' });
    expect(sp.find).toHaveBeenCalledWith({
      deletedAt: { $ne: null }, loai: expect.anything(), hang: expect.anything(),
      $or: [{ tenSanPham: /Vợt\.\*/i }, { hang: { $in: [] } }, { loai: { $in: [] } }],
    });
    expect(result).toMatchObject({ total: 12, page: 2, perPage: 10, pages: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.daAn && item.tongTonKho === 7)).toBe(true);
  });
});

it('ẩn rồi hiện: chỉ thay deletedAt, giữ nguyên dữ liệu sản phẩm và không xóa ảnh', async () => {
  const { ctrl, sp } = sanPham();
  const row = { _id: ID, tenSanPham: 'Vợt', giaGoc: 123, hinhAnhDaiDien: 'uploads/sanpham/a.jpg', deletedAt: null as Date | null };
  sp.findOne.mockReturnValue({ lean: async () => row } as never);
  sp.updateOne.mockImplementation(async (_filter, update: any) => { Object.assign(row, update.$set); return {}; });
  await ctrl.an(ID);
  expect(row.deletedAt).toBeInstanceOf(Date);
  await ctrl.hien(ID);
  expect(row).toEqual({ _id: ID, tenSanPham: 'Vợt', giaGoc: 123, hinhAnhDaiDien: 'uploads/sanpham/a.jpg', deletedAt: null });
  expect(xoaAnhUpload).not.toHaveBeenCalled();
});

describe('C-5: giữ ảnh đã lưu và ảnh cũ khi không upload', () => {
  it('sửa sản phẩm không chọn file: không ghi đè hoặc xóa ảnh cũ', async () => {
    const { ctrl, sp } = sanPham();
    const input = Object.assign(new SanPhamDto(), { tenSanPham: 'Vợt mới' });
    await expect(ctrl.capNhat(ID, input)).resolves.toEqual({ message: 'Cập nhật sản phẩm thành công!' });
    expect(sp.updateOne.mock.calls[0][1].$set).not.toHaveProperty('hinhAnhDaiDien');
    expect(xoaAnhUpload).not.toHaveBeenCalled();
  });

  function suaAnh() {
    const row = { _id: BIEN_THE, sanPham: ID, giaBan: 1000, hinhAnh: 'uploads/sanpham/cu.jpg' };
    const bt = { findById: vi.fn().mockResolvedValue(row), exists: vi.fn().mockResolvedValue(false), updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }), countDocuments: vi.fn().mockResolvedValue(0) };
    const lichSu = { create: vi.fn().mockResolvedValue({}) };
    const ctrl = new AdminSanPhamController({ countDocuments: vi.fn().mockResolvedValue(0) } as never, bt as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, lichSu as never);
    const input = Object.assign(new BienTheDto(), { sku: 'SKU', giaBan: 2000, soLuongTon: 5, soLuongTonDaTai: 5 });
    const file = { filename: 'moi.jpg' } as Express.Multer.File;
    return { ctrl, bt, lichSu, input, file };
  }

  it('sửa biến thể: ghi DB rồi mới xóa ảnh cũ, đánh dấu giữ ảnh mới trước lỗi lịch sử', async () => {
    const { ctrl, bt, lichSu, input, file } = suaAnh();
    const error = new Error('ghi lịch sử lỗi');
    lichSu.create.mockRejectedValueOnce(error);
    await expect(ctrl.capNhatBienThe({ id: ID, tenDangNhap: 'admin', maQuyen: 1 }, BIEN_THE, input, file)).rejects.toBe(error);
    expect(bt.updateOne).toHaveBeenCalledWith(expect.anything(), { $set: expect.objectContaining({ hinhAnh: 'uploads/sanpham/moi.jpg' }) });
    expect(DonAnhKhiLoi.daLuu.has(file)).toBe(true);
    expect(xoaAnhUpload).toHaveBeenCalledWith('uploads/sanpham/cu.jpg');
    expect(bt.updateOne.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(xoaAnhUpload).mock.invocationCallOrder[0]);
  });

  it('ghi biến thể thất bại: ảnh mới chưa được giữ, ảnh cũ không bị xóa', async () => {
    const { ctrl, bt, input, file } = suaAnh();
    const error = new Error('ghi DB lỗi');
    bt.updateOne.mockRejectedValueOnce(error);
    await expect(ctrl.capNhatBienThe({ id: ID, tenDangNhap: 'admin', maQuyen: 1 }, BIEN_THE, input, file)).rejects.toBe(error);
    expect(DonAnhKhiLoi.daLuu.has(file)).toBe(false);
    expect(xoaAnhUpload).not.toHaveBeenCalled();
  });
});
