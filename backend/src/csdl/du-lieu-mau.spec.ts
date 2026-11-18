import { Types } from 'mongoose';
import { sinhDuLieuMau } from './du-lieu-mau';
import { indexCanTao } from './sao-luu-chung';

const PB = [
  { bienThe: new Types.ObjectId(), sanPham: new Types.ObjectId(), ten: 'A', canBangBac: 2, doCungBac: 2, trongLuongU: 4, sucCangMinLbs: 20, sucCangMaxLbs: 28 },
  { bienThe: new Types.ObjectId(), sanPham: new Types.ObjectId(), ten: 'B', canBangBac: -1, doCungBac: 1, trongLuongU: 4, sucCangMinLbs: 19, sucCangMaxLbs: 27 },
];
const HOM_NAY = new Date('2026-11-18T00:00:00Z');

describe('dữ liệu mẫu', () => {
  const dl = sinhDuLieuMau(PB, { hat: 1, soNguoi: 30, homNay: HOM_NAY });

  it('mọi tài liệu đều gắn laDuLieuMau, đánh giá ghi rõ "[Mẫu]"', () => {
    for (const ds of Object.values(dl)) expect(ds.every((d: any) => d.laDuLieuMau === true)).toBe(true);
    expect(dl.phanhois.every((p) => p.noiDung.startsWith('[Mẫu]'))).toBe(true);
    expect(dl.khachhangs.every((k) => !('taiKhoan' in k))).toBe(true); // không ai đăng nhập được bằng người chơi mẫu
  });

  it('hộ chiếu khớp sổ căng: soLanCang = số lần căng, nhúng ≤ 10 lần mới nhất, lanCangGanNhat là lần mới nhất', () => {
    for (const v of dl.votcanhans) {
      const ds = dl.lancangs.filter((l) => l.votCaNhan.equals(v._id));
      expect(v.soLanCang).toBe(ds.length);
      expect(v.lichSuCang.length).toBe(Math.min(10, ds.length));
      if (ds.length) expect(+v.lanCangGanNhat.ngay).toBe(Math.max(...ds.map((l) => +l.ngay)));
    }
  });

  it('ngày căng không ở tương lai; căng tại shop không bao giờ vượt mức NSX', () => {
    expect(dl.lancangs.every((l) => l.ngay <= HOM_NAY)).toBe(true);
    expect(dl.lancangs.filter((l) => l.noiCang === 'shop').every((l) => !l.vuotMucNSX)).toBe(true);
  });

  it('sao lưu: index cần tạo lại bỏ _id_ và các trường của máy chủ', () => {
    expect(indexCanTao([{ v: 2, key: { _id: 1 }, name: '_id_' }, { v: 2, key: { ngay: 1 }, name: 'khung_gio', unique: true }]))
      .toEqual([{ key: { ngay: 1 }, name: 'khung_gio', unique: true }]);
  });
});
