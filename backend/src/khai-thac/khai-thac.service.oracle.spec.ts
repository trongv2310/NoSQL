import { Types } from 'mongoose';
import { TRANG_THAI } from '../schemas';
import { KhaiThacService } from './khai-thac.service';
import { KhaiThacCongKhaiController } from './khai-thac-cong-khai.controller';

// Bộ dữ liệu và kỳ vọng được tính tay.
const [A, B, C, BIEN_THE_A] = [1, 2, 3, 4].map((n) => new Types.ObjectId(`64b00000000000000000000${n}`));
const NOW = new Date('2026-11-19T12:00:00.000Z');
const DON = [
  { ngayDat: new Date('2026-09-10T12:00:00Z'), trangThai: TRANG_THAI.HoanThanh, chiTiet: [{ sanPham: A, thanhTien: 5 }, { sanPham: B, thanhTien: 7 }] },
  { ngayDat: new Date('2026-10-10T12:00:00Z'), trangThai: TRANG_THAI.HoanThanh, chiTiet: [{ sanPham: A, thanhTien: 11 }, { sanPham: C, thanhTien: 13 }] },
  { ngayDat: new Date('2026-11-10T12:00:00Z'), trangThai: TRANG_THAI.HoanThanh, chiTiet: [{ sanPham: A, thanhTien: 17 }, { chiTietSanPham: BIEN_THE_A, soLuong: 2, donGia: 3 }, { sanPham: B, thanhTien: 19 }] },
  { ngayDat: new Date('2026-11-11T12:00:00Z'), trangThai: TRANG_THAI.HoanThanh, chiTiet: [{ sanPham: A, thanhTien: 100 }] },
  { ngayDat: new Date('2026-11-12T12:00:00Z'), trangThai: TRANG_THAI.DaHuy, chiTiet: [{ sanPham: A, thanhTien: 1000 }, { sanPham: B, thanhTien: 1000 }] },
  { ngayDat: new Date('2026-11-13T12:00:00Z'), trangThai: TRANG_THAI.DangXuLy, chiTiet: [{ sanPham: A, thanhTien: 1000 }, { sanPham: C, thanhTien: 1000 }] },
  { ngayDat: new Date('2026-08-10T12:00:00Z'), trangThai: TRANG_THAI.HoanThanh, chiTiet: [{ sanPham: A, thanhTien: 900 }, { sanPham: B, thanhTien: 900 }] },
];

describe('KhaiThacService: oracle dữ liệu tháng cố định', () => {
  it('fixture tính tay: tháng 11 AB=42; ba tháng AB=54 và AC=24', () => {
    expect(NOW.toISOString()).toBe('2026-11-19T12:00:00.000Z');
    expect(DON).toHaveLength(7);
    expect(17 + 2 * 3 + 19).toBe(42);
    expect(5 + 7 + 42).toBe(54);
    expect(11 + 13).toBe(24);
  });

  const dungService = () => {
    const don = { find: vi.fn((filter: { trangThai: string; ngayDat: { $gte: Date; $lte: Date } }) => ({
      sort: () => ({ limit: () => ({ lean: async () => DON.filter((d) => d.trangThai === filter.trangThai && d.ngayDat >= filter.ngayDat.$gte && d.ngayDat <= filter.ngayDat.$lte)
        .sort((a, b) => b.ngayDat.getTime() - a.ngayDat.getTime()).map((d) => ({ ...d, chiTiet: d.chiTiet.map((x) => ({ soLuong: 1, ...x })) })) }) }),
    })) };
    const ct = { find: vi.fn(() => ({ lean: async () => [{ _id: BIEN_THE_A, sanPham: A }] })) };
    const sp = { find: vi.fn(() => ({ lean: async () => [{ _id: A, tenSanPham: 'A' }, { _id: B, tenSanPham: 'B' }, { _id: C, tenSanPham: 'C' }] })) };
    const goiY = { bulkWrite: vi.fn(), deleteMany: vi.fn() };
    return { service: new KhaiThacService(don as never, ct as never, sp as never, goiY as never), don, ct, goiY };
  };

  it('chay(10, 1, NOW): chỉ tháng 11, gộp biến thể A và trả AB=42', async () => {
    const { service, don, ct, goiY } = dungService();
    const result = await service.chay(10, 1, NOW);
    expect(result).toMatchObject({ k: 10, soThang: 1, soBatch: 1, soDonXet: 2, biCat: false, chayLuc: NOW.toISOString() });
    expect(result.ketQua.map((x) => ({ khoa: x.khoa, loiNhuan: x.loiNhuan, hang: x.hang }))).toEqual([{ khoa: `${A.toHexString()},${B.toHexString()}`, loiNhuan: 42, hang: 1 }]);
    expect(don.find).toHaveBeenCalledWith(expect.objectContaining({ trangThai: TRANG_THAI.HoanThanh }), expect.anything());
    expect(ct.find).toHaveBeenCalledOnce();
    expect(goiY.bulkWrite).not.toHaveBeenCalled();
    expect(goiY.deleteMany).not.toHaveBeenCalled();
  });

  it('chay(10, 3, NOW): AB=54, AC=24; bỏ đơn hủy, đang xử lý, một món và ngoài cửa sổ', async () => {
    const { service } = dungService();
    const result = await service.chay(10, 3, NOW);
    expect(result).toMatchObject({ k: 10, soThang: 3, soBatch: 3, soDonXet: 4, biCat: false });
    expect(result.ketQua.map((x) => ({ khoa: x.khoa, loiNhuan: x.loiNhuan, hang: x.hang }))).toEqual([
      { khoa: `${A.toHexString()},${B.toHexString()}`, loiNhuan: 54, hang: 1 }, { khoa: `${A.toHexString()},${C.toHexString()}`, loiNhuan: 24, hang: 2 },
    ]);
  });
});

it('API công khai không rò utility, lợi nhuận, hạng hoặc k ở bất kỳ cấp nào', async () => {
  const row = { sanPham: [A, B], khoa: `${A.toHexString()},${B.toHexString()}`, loiNhuan: 123, utility: 123, hang: 1, k: 10 };
  const chain = (data: unknown) => ({ sort() { return this; }, limit() { return this; }, populate() { return this; }, async lean() { return data; } });
  const goiY = { find: vi.fn(() => chain([row])) };
  const sp = { findOne: vi.fn(() => chain({ _id: A })), find: vi.fn(() => chain([{ _id: A, tenSanPham: 'A', giaGoc: 100 }, { _id: B, tenSanPham: 'B', giaGoc: 200 }])) };
  const ct = { find: vi.fn(() => chain([{ _id: BIEN_THE_A, sanPham: A }, { _id: new Types.ObjectId('64b000000000000000000005'), sanPham: B }])) };
  const ctrl = new KhaiThacCongKhaiController(goiY as never, sp as never, ct as never);
  const combos = await ctrl.combo();
  const related = await ctrl.sanPham(A.toHexString());
  expect(combos.combos).toHaveLength(1);
  expect(related.sanPhams.length).toBeGreaterThan(0);
  const check = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      expect(['loiNhuan', 'utility', 'hang', 'k']).not.toContain(key);
      check(child);
    }
  };
  [combos, related].forEach(check);
});
