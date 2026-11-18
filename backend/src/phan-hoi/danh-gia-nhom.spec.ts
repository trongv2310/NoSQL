import { Types } from 'mongoose';
import { chupNguoiDanh, dieuKienNhom, ketQuaDanhGia, NGUONG_TOI_THIEU, nguoiDanhCongKhai, nhomTuQuery, pipelineDanhGia } from './danh-gia-nhom';

describe('bản chụp người viết', () => {
  const hoSo = { trinhDo: 'deu', noiDung: ['doi'], loiChoi: 'toc', chanThuong: ['co-tay'] };

  it('mặc định không kèm chấn thương; đồng ý riêng mới kèm', () => {
    expect(chupNguoiDanh(hoSo, { chiaSeHoSo: true, chiaSeChanThuong: false })).toEqual({ trinhDo: 'deu', noiDung: ['doi'], loiChoi: 'toc' });
    expect(chupNguoiDanh(hoSo, { chiaSeHoSo: true, chiaSeChanThuong: true })?.chanThuong).toEqual(['co-tay']);
  });

  it('không đồng ý chia sẻ hồ sơ hoặc chưa có hồ sơ → không chụp gì', () => {
    expect(chupNguoiDanh(hoSo, { chiaSeHoSo: false, chiaSeChanThuong: true })).toBeUndefined();
    expect(chupNguoiDanh(null, { chiaSeHoSo: true, chiaSeChanThuong: true })).toBeUndefined();
    expect(chupNguoiDanh({ chanThuong: ['vai'] }, { chiaSeHoSo: true, chiaSeChanThuong: false })).toBeUndefined();
  });

  it('bản chụp là bản sao: sửa hồ sơ sau đó không đổi bản chụp', () => {
    const hs = { trinhDo: 'moi', noiDung: ['don'] };
    const chup = chupNguoiDanh(hs, { chiaSeHoSo: true, chiaSeChanThuong: false })!;
    hs.noiDung.push('doi');
    expect(chup.noiDung).toEqual(['don']);
  });

  it('API công khai không bao giờ trả chấn thương', () => {
    expect(nguoiDanhCongKhai(hoSo)).toEqual({ trinhDo: 'deu', noiDung: ['doi'], loiChoi: 'toc' });
    expect(nguoiDanhCongKhai({ chanThuong: ['vai'] })).toBeNull();
    expect(nguoiDanhCongKhai(undefined)).toBeNull();
  });
});

describe('nhóm người chơi từ query', () => {
  it('đọc trình độ + nội dung, bỏ giá trị lạ và trùng', () => {
    expect(nhomTuQuery({ trinhDo: 'thi', noiDung: 'doi,don,doi,ba' })).toEqual({ trinhDo: 'thi', noiDung: ['doi', 'don'] });
    expect(nhomTuQuery({ trinhDo: 'sieu-cap', noiDung: 'doi' })).toBeNull();
    expect(nhomTuQuery({})).toBeNull();
  });

  it('điều kiện: cùng trình độ, có chung ít nhất một nội dung', () => {
    expect(dieuKienNhom({ trinhDo: 'deu', noiDung: ['doi'] })).toEqual({ 'nguoiDanh.trinhDo': 'deu', 'nguoiDanh.noiDung': { $in: ['doi'] } });
    expect(dieuKienNhom({ trinhDo: 'deu', noiDung: [] })).toEqual({ 'nguoiDanh.trinhDo': 'deu' });
  });

  it('pipeline: $match công khai rồi một $facet; chỉ có nhánh giống bạn khi có nhóm', () => {
    const sp = new Types.ObjectId();
    const p: any[] = pipelineDanhGia(sp, null, { daXacMinh: true });
    expect(p[0]).toEqual({ $match: { sanPham: sp, daXacMinh: true } });
    expect(Object.keys(p[1].$facet)).not.toContain('giongBan');
    const p2: any[] = pipelineDanhGia(sp, { trinhDo: 'deu', noiDung: [] }, {});
    expect(Object.keys(p2[1].$facet)).toEqual(expect.arrayContaining(['giongBan', 'theGiongBan']));
  });
});

describe('ketQuaDanhGia', () => {
  const nhom = { trinhDo: 'deu', noiDung: ['doi'] };

  it(`nhóm giống bạn dưới ${NGUONG_TOI_THIEU} đánh giá → chưa đủ dữ liệu, không đưa điểm`, () => {
    const r = ketQuaDanhGia({ tatCa: [{ tb: 4.25, so: 4 }], giongBan: [{ tb: 5, so: 2 }] }, nhom);
    expect(r.giongBan).toEqual({ nhom, chuaDuDuLieu: true, so: 2, canToiThieu: NGUONG_TOI_THIEU });
    expect(r.tatCa).toEqual({ trungBinh: 4.3, so: 4 });
  });

  it('đủ dữ liệu → điểm làm tròn 1 chữ số + thẻ nổi bật của nhóm', () => {
    const r = ketQuaDanhGia({ giongBan: [{ tb: 3.666, so: 3 }], theGiongBan: [{ _id: 'nang-tay', so: 2 }] }, nhom);
    expect(r.giongBan).toEqual({ nhom, chuaDuDuLieu: false, trungBinh: 3.7, so: 3, theNoiBat: [{ the: 'nang-tay', so: 2 }] });
  });

  it('chưa có đánh giá: trung bình null (không mặc định 5 sao), phân bố đủ 5 mức', () => {
    const r = ketQuaDanhGia({}, null);
    expect(r.tatCa).toEqual({ trungBinh: null, so: 0 });
    expect(r.phanBoSao).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    expect(r.giongBan).toBeNull();
    expect(r.coDuLieuMau).toBe(false);
  });

  it('theo trình độ sắp Mới chơi → Chơi đều → Thi đấu', () => {
    const r = ketQuaDanhGia({ theoTrinhDo: [{ _id: 'thi', tb: 4, so: 1 }, { _id: 'moi', tb: 3, so: 2 }] }, null);
    expect(r.theoTrinhDo.map((x) => x.trinhDo)).toEqual(['moi', 'thi']);
  });
});
