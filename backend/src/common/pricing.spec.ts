import { dangGiamGia, giaBienThe, giaSauKhuyenMai, khuyenMaiConHieuLuc } from './pricing';

const homNay = new Date('2026-06-15T10:00:00');

describe('pricing', () => {
  it('khuyến mãi hết hạn thì không áp dụng', () => {
    const km = { ngayBatDau: '2026-01-01', ngayKetThuc: '2026-03-01', phanTramGiam: 20 };
    expect(khuyenMaiConHieuLuc(km, homNay)).toBe(false);
    expect(giaSauKhuyenMai(1_000_000, km, homNay)).toBe(1_000_000);
  });

  it('khuyến mãi chưa bắt đầu thì không áp dụng', () => {
    expect(khuyenMaiConHieuLuc({ ngayBatDau: '2026-07-01' }, homNay)).toBe(false);
  });

  it('ngày kết thúc là hôm nay vẫn còn hiệu lực', () => {
    expect(khuyenMaiConHieuLuc({ ngayKetThuc: '2026-06-15' }, homNay)).toBe(true);
  });

  it('giảm theo phần trăm', () => {
    const km = { phanTramGiam: 10 };
    expect(giaSauKhuyenMai(2_000_000, km, homNay)).toBe(1_800_000);
  });

  it('mức giảm bị chặn bởi giamToiDa', () => {
    const km = { phanTramGiam: 50, giamToiDa: 100_000 };
    expect(giaSauKhuyenMai(1_000_000, km, homNay)).toBe(900_000);
  });

  it('giá gốc <= 0 trả về 0', () => {
    expect(giaSauKhuyenMai(0, { phanTramGiam: 10 }, homNay)).toBe(0);
  });

  it('biến thể dùng giaBan riêng, thiếu thì dùng giá gốc sản phẩm', () => {
    const sp = { giaGoc: 1_000_000, khuyenMai: { phanTramGiam: 10 } };
    expect(giaBienThe({ giaBan: 2_000_000 }, sp, homNay)).toBe(1_800_000);
    expect(giaBienThe({}, sp, homNay)).toBe(900_000);
  });

  it('dangGiamGia yêu cầu phần trăm > 0', () => {
    expect(dangGiamGia({ phanTramGiam: 0 })).toBe(false);
    expect(dangGiamGia({ phanTramGiam: 5 })).toBe(true);
    expect(dangGiamGia(null)).toBe(false);
  });
});
