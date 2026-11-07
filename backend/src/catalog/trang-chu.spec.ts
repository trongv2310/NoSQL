import { ghepTrangChu } from './trang-chu';

const sp = (id: string, tenLoai: string) => ({
  _id: id, tenSanPham: `SP ${id}`, giaGoc: 1000000, loai: { _id: 'L1', tenLoai }, hang: { _id: 'H1', tenHang: 'Yonex' },
  hinhAnhDaiDien: 'a.jpg', khuyenMai: null, trungBinhDanhGia: 5, ngayTao: new Date('2026-01-01'),
});

describe('ghepTrangChu', () => {
  it('gắn tồn kho (mặc định 0) và thông số của biến thể đầu tiên có thông số', () => {
    const kq = ghepTrangChu(
      [sp('a', 'Vợt cầu lông'), sp('b', 'Giày cầu lông')],
      new Map([['a', 12]]),
      [
        { sanPham: 'a' },
        { sanPham: 'a', thongSo: { doCanBang: 'Nặng đầu', doCung: 'Cứng' } },
        { sanPham: 'a', thongSo: { doCanBang: 'Nhẹ đầu' } },
      ],
    );
    expect(kq[0]).toMatchObject({ id: 'a', tongTonKho: 12, thongSoVot: { doCanBang: 'Nặng đầu', doCung: 'Cứng' } });
    expect(kq[1]).toMatchObject({ id: 'b', tongTonKho: 0, thongSoVot: null });
  });
});
