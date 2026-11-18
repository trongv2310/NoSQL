import { ghepTrangChu } from './trang-chu';

const sp = (id: string, tenLoai: string) => ({
  _id: id, tenSanPham: `SP ${id}`, giaGoc: 1000000, loai: { _id: 'L1', tenLoai }, hang: { _id: 'H1', tenHang: 'Yonex' },
  hinhAnhDaiDien: 'a.jpg', khuyenMai: null, trungBinhDanhGia: 5, ngayTao: new Date('2026-01-01'),
});

describe('ghepTrangChu', () => {
  it('gắn tồn kho (mặc định 0) và gộp thông số mọi biến thể: trường khác nhau không lấy bừa biến thể đầu', () => {
    const kq = ghepTrangChu(
      [sp('a', 'Vợt cầu lông'), sp('b', 'Giày cầu lông')],
      new Map([['a', 12]]),
      [
        { sanPham: 'a' },
        { sanPham: 'a', thongSo: { doCanBang: 'Nặng đầu', doCung: 'Cứng' } },
        { sanPham: 'a', thongSo: { doCanBang: 'Nhẹ đầu' } },
      ],
    );
    expect(kq[0]).toMatchObject({ id: 'a', tongTonKho: 12, thongSoVot: { doCung: 'Cứng' }, thongSoKhacNhau: { doCanBang: ['Nặng đầu', 'Nhẹ đầu'] } });
    expect((kq[0].thongSoVot as Record<string, unknown>).doCanBang).toBeUndefined();
    expect(kq[1]).toMatchObject({ id: 'b', tongTonKho: 0, thongSoVot: null });
  });
});
