import { BadRequestException } from '@nestjs/common';
import { phanTrangDb } from '../common/helpers';
import { AdminSanPhamController, SanPhamDto } from './admin-san-pham.controller';

/** Các lỗi tìm được ở đợt kiểm thử 20/11/2026 (test.md): mục 1, 3 và 14. */

describe('phanTrangDb (mục 14: phân trang trong MongoDB)', () => {
  it('chỉ đọc đúng một trang bằng skip/limit và kéo trang vượt quá về trang cuối', async () => {
    const docTrang = vi.fn(async (skip: number, limit: number) => Array.from({ length: Math.min(limit, 23 - skip) }, (_, i) => skip + i));
    const r = await phanTrangDb(async () => 23, docTrang, 9, 10);
    expect(docTrang).toHaveBeenCalledWith(20, 10);
    expect(r).toEqual({ items: [20, 21, 22], total: 23, page: 3, perPage: 10, pages: 3 });
  });

  it('không có dữ liệu: không đọc trang nào, trả trang 1', async () => {
    const docTrang = vi.fn();
    expect(await phanTrangDb(async () => 0, docTrang, 4, 10)).toEqual({ items: [], total: 0, page: 1, perPage: 10, pages: 1 });
    expect(docTrang).not.toHaveBeenCalled();
  });
});

describe('Sản phẩm trong trang quản trị', () => {
  const ID = '64b000000000000000000010';
  const tonTai = (co: boolean) => ({ exists: vi.fn().mockResolvedValue(co ? { _id: 'co' } : null) });
  const dto = () => Object.assign(new SanPhamDto(), {
    tenSanPham: 'Vợt', giaGoc: 1000, loai: ID, hang: ID, nhaCungCap: ID, coSize: false, coMau: false,
  });

  it.each([
    ['loai', 2, 'Loại sản phẩm không tồn tại.'],
    ['nhaCungCap', 3, 'Nhà cung cấp không tồn tại.'],
    ['hang', 4, 'Hãng sản xuất không tồn tại.'],
  ])('mục 3: %s không tồn tại → 400, không tạo sản phẩm', async (_ten, viTri, thongBao) => {
    const sp = { create: vi.fn() };
    const models: unknown[] = [sp, {}, tonTai(true), tonTai(true), tonTai(true), tonTai(true), {}, {}, {}, {}, {}];
    models[viTri] = tonTai(false);
    const ctrl = new (AdminSanPhamController as unknown as new (...a: unknown[]) => AdminSanPhamController)(...models);
    await expect(ctrl.tao(dto())).rejects.toThrow(new BadRequestException(thongBao));
    expect(sp.create).not.toHaveBeenCalled();
  });

  it('mục 3: khuyến mãi được chọn nhưng không tồn tại → 400', async () => {
    const sp = { create: vi.fn() };
    const ctrl = new AdminSanPhamController(sp as never, {} as never, tonTai(true) as never, tonTai(true) as never, tonTai(true) as never, tonTai(false) as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    await expect(ctrl.tao(Object.assign(dto(), { khuyenMai: ID }))).rejects.toThrow('Chương trình khuyến mãi không tồn tại.');
    expect(sp.create).not.toHaveBeenCalled();
  });

  it('mục 1: danh sách populate cả khuyenMai để giá admin giống giá khách thấy', async () => {
    const populate = vi.fn();
    const q = { populate: populate.mockImplementation(() => q), sort: () => q, skip: () => q, limit: () => q, lean: async () => [] };
    const sp = { find: vi.fn(() => q), countDocuments: vi.fn().mockResolvedValue(1) };
    const kho = { find: () => ({ sort: () => ({ lean: async () => [] }) }) };
    const ctrl = new AdminSanPhamController(sp as never, { aggregate: vi.fn().mockResolvedValue([]) } as never, kho as never, kho as never, kho as never, kho as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    await ctrl.danhSach({});
    expect(populate).toHaveBeenCalledWith('loai hang khuyenMai');
  });
});
