import { tongKetDanhGia } from './danh-gia';
import { sanPhamView } from './mappers';

const goc = { _id: 'p1', tenSanPham: 'Vợt A', giaGoc: 1_000_000, khuyenMai: null, ngayTao: new Date('2026-01-01') };

describe('điểm đánh giá của sản phẩm', () => {
  it('chưa có đánh giá thì là null và 0 lượt, không tự điền 5 sao', () => {
    const v = sanPhamView(goc);
    expect(v.trungBinhDanhGia).toBeNull();
    expect(v.soDanhGia).toBe(0);
  });

  it('có đánh giá thì giữ nguyên điểm và số lượt', () => {
    expect(sanPhamView({ ...goc, trungBinhDanhGia: 4.5, soDanhGia: 12 })).toMatchObject({ trungBinhDanhGia: 4.5, soDanhGia: 12 });
  });

  it('tongKetDanhGia: rỗng là null, có dữ liệu thì làm tròn 1 chữ số', () => {
    expect(tongKetDanhGia([])).toEqual({ trungBinh: null, so: 0 });
    expect(tongKetDanhGia([{ danhGia: 5 }, { danhGia: 4 }, { danhGia: 4 }])).toEqual({ trungBinh: 4.3, so: 3 });
  });
});
