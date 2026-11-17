import { lenhCapNhatHoSo } from './ho-so-choi';

describe('lenhCapNhatHoSo', () => {
  const luc = new Date('2026-11-18T03:00:00Z');

  it('trường có giá trị → $set bằng ký pháp chấm, trường trống → $unset trường con', () => {
    expect(lenhCapNhatHoSo({ trinhDo: 'deu', noiDung: ['doi'], loiChoi: null, soBuoiMoiTuan: 3 }, luc)).toEqual({
      $set: { 'hoSoChoi.trinhDo': 'deu', 'hoSoChoi.soBuoiMoiTuan': 3, 'hoSoChoi.noiDung': ['doi'], 'hoSoChoi.capNhatLuc': luc },
      $unset: { 'hoSoChoi.loiChoi': '', 'hoSoChoi.tayThuan': '', 'hoSoChoi.chanThuong': '' },
    });
  });

  it('mảng được khử trùng và sắp theo thứ tự cố định', () => {
    const u = lenhCapNhatHoSo({ noiDung: ['doi', 'don', 'doi'], chanThuong: ['vai', 'co-tay', 'vai'] }, luc);
    expect(u.$set?.['hoSoChoi.noiDung']).toEqual(['don', 'doi']);
    expect(u.$set?.['hoSoChoi.chanThuong']).toEqual(['co-tay', 'vai']);
  });

  it('không còn trường nào → xoá cả hoSoChoi, không để object rỗng', () => {
    expect(lenhCapNhatHoSo({}, luc)).toEqual({ $unset: { hoSoChoi: '' } });
    expect(lenhCapNhatHoSo({ noiDung: [], chanThuong: [], trinhDo: null }, luc)).toEqual({ $unset: { hoSoChoi: '' } });
  });

  it('khai đủ mọi trường thì không sinh $unset rỗng (MongoDB từ chối toán tử rỗng)', () => {
    const u = lenhCapNhatHoSo({ trinhDo: 'thi', noiDung: ['don'], loiChoi: 'toc', tayThuan: 'trai', chanThuong: ['co-tay'], soBuoiMoiTuan: 0 }, luc);
    expect(u.$unset).toBeUndefined();
    expect(u.$set?.['hoSoChoi.soBuoiMoiTuan']).toBe(0);
  });
});
