import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminSanPhamController, BienTheDto } from './admin-san-pham.controller';

/**
 * Sửa biến thể (M5A-07/10, Q2-NEW01): tồn kho và metadata đi trong MỘT lệnh cập nhật nguyên tử, có điều kiện theo số tồn lúc mở form;
 * không có baseline thì từ chối; không đổi tồn thì không đặt trường tồn.
 */
function dungController(tonHienTai: number) {
  const bt: any = { _id: '64b000000000000000000010', sku: 'SKU1', giaBan: 1000, soLuongTon: tonHienTai, hinhAnh: null, sanPham: 'sp1' };
  const ct: any = {
    findById: vi.fn(() => Object.assign(Promise.resolve(bt), { select: () => ({ lean: () => Promise.resolve({ soLuongTon: tonHienTai }) }) })),
    exists: vi.fn(() => Promise.resolve(null)),
    // matchedCount: có điều kiện tồn thì chỉ khớp khi tồn hiện tại đúng số lúc mở form
    updateOne: vi.fn((loc: any) => Promise.resolve({ matchedCount: loc.soLuongTon === undefined || loc.soLuongTon === tonHienTai ? 1 : 0 })),
  };
  const lichSu = { create: vi.fn(() => Promise.resolve()) };
  const ctrl = new AdminSanPhamController({} as never, ct, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, lichSu as never);
  return { ctrl, ct };
}

const dto = (o: Partial<BienTheDto>): BienTheDto => Object.assign(new BienTheDto(), { giaBan: 1000, soLuongTon: 5, sku: 'SKU1', ...o });
const user: any = { id: 'u', tenDangNhap: 'admin', maQuyen: 1 };
const ID = '64b000000000000000000010';

describe('AdminSanPhamController.capNhatBienThe – tồn kho và thông số', () => {
  it('thiếu soLuongTonDaTai: từ chối, không ghi gì', async () => {
    const { ctrl, ct } = dungController(5);
    await expect(ctrl.capNhatBienThe(user, ID, dto({}))).rejects.toBeInstanceOf(BadRequestException);
    expect(ct.updateOne).not.toHaveBeenCalled();
  });

  it('không sửa tồn (khớp số lúc mở form): không có điều kiện tồn và KHÔNG đặt trường tồn, kể cả khi tồn thật đã đổi do bán hàng', async () => {
    const { ctrl, ct } = dungController(3); // đã bán bớt: 5 → 3
    await ctrl.capNhatBienThe(user, ID, dto({ soLuongTon: 5, soLuongTonDaTai: 5 }));
    expect(ct.updateOne).toHaveBeenCalledTimes(1);
    const [loc, cap] = ct.updateOne.mock.calls[0];
    expect(loc).not.toHaveProperty('soLuongTon');
    expect(cap.$set).not.toHaveProperty('soLuongTon');
    expect(cap.$set).toMatchObject({ giaBan: 1000, sku: 'SKU1' });
  });

  it('sửa tồn khi tồn chưa đổi: MỘT lệnh duy nhất vừa đặt tồn mới vừa lưu metadata, có điều kiện theo số lúc mở form', async () => {
    const { ctrl, ct } = dungController(5);
    await ctrl.capNhatBienThe(user, ID, dto({ soLuongTon: 9, soLuongTonDaTai: 5, giaBan: 2000 }));
    expect(ct.updateOne).toHaveBeenCalledTimes(1);
    const [loc, cap] = ct.updateOne.mock.calls[0];
    expect(loc.soLuongTon).toBe(5);
    expect(cap.$set).toMatchObject({ soLuongTon: 9, giaBan: 2000, sku: 'SKU1' });
  });

  it('sửa tồn nhưng tồn đã đổi sau khi mở form: 409 (lệnh không khớp nên không lưu gì)', async () => {
    const { ctrl } = dungController(2);
    await expect(ctrl.capNhatBienThe(user, ID, dto({ soLuongTon: 9, soLuongTonDaTai: 5 }))).rejects.toBeInstanceOf(ConflictException);
  });

  it('xóa hết ô thông số (gửi chuỗi rỗng) thì $unset cả bộ; không gửi ô nào thì không đụng thông số', async () => {
    const a = dungController(5);
    await a.ctrl.capNhatBienThe(user, ID, dto({ soLuongTonDaTai: 5, soLuongTon: 5, doCanBang: '', trongLuong: '', doCung: '', chieuDai: '', sucCang: '' }));
    expect(a.ct.updateOne.mock.calls[0][1].$unset).toEqual({ thongSo: '' });
    const b = dungController(5);
    await b.ctrl.capNhatBienThe(user, ID, dto({ soLuongTonDaTai: 5, soLuongTon: 5 }));
    const cap = b.ct.updateOne.mock.calls[0][1];
    expect(cap.$unset).toBeUndefined();
    expect(cap.$set).not.toHaveProperty('thongSo');
  });

  it('có nhập thông số: đặt cả bộ trong cùng lệnh', async () => {
    const { ctrl, ct } = dungController(5);
    await ctrl.capNhatBienThe(user, ID, dto({ soLuongTonDaTai: 5, soLuongTon: 5, doCung: 'Cứng' }));
    expect(ct.updateOne.mock.calls[0][1].$set.thongSo).toMatchObject({ doCung: 'Cứng' });
  });
});
