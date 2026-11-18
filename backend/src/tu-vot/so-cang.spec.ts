import { Types } from 'mongoose';
import { doiSangLbs, kiemTraLanCang, ngayTuChuoi, pipelineDoiChuKy, pipelineGhiLanCang, thongSoChupTuThuocTinh, vuotMucNSX } from './so-cang';

const HOM_NAY = new Date('2026-11-18T00:00:00Z');

describe('sổ căng cước: luật thuần', () => {
  it('đổi kg → lbs bằng hằng số, làm tròn 2 chữ số', () => {
    expect(doiSangLbs(11, 'kg')).toBe(24.25);
    expect(doiSangLbs(26, 'lbs')).toBe(26);
  });

  it('ngày lịch → 00:00 UTC; ngày không có thật bị từ chối', () => {
    expect(ngayTuChuoi('2026-02-28')?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(ngayTuChuoi('2026-02-30')).toBeNull();
    expect(ngayTuChuoi('18/11/2026')).toBeNull();
  });

  it('kiểm lần căng hợp lệ → mucCangLbs + giữ nguyên số và đơn vị khách nhập', () => {
    const r = kiemTraLanCang({ ngay: '2026-11-10', giaTri: 11.5, donVi: 'kg', tenDay: '  BG  65 ', noiCang: 'ngoai' }, HOM_NAY);
    expect(r).toEqual({
      ok: true,
      lan: { ngay: new Date('2026-11-10T00:00:00Z'), mucCangLbs: 25.35, giaTriNhap: 11.5, donViNhap: 'kg', tenDay: 'BG 65', noiCang: 'ngoai' },
    });
  });

  it('từ chối: ngày tương lai, số âm, vượt trần nhập, quá nhỏ (nhầm đơn vị), nơi căng lạ', () => {
    const loi = (n: any) => (kiemTraLanCang({ ngay: '2026-11-10', giaTri: 25, donVi: 'lbs', noiCang: 'ngoai', ...n }, HOM_NAY) as any).loi;
    expect(loi({ ngay: '2026-11-25' }).ngay).toMatch(/tương lai/);
    expect(loi({ ngay: '2026-11-19' })).toBeUndefined(); // lệch +1 ngày múi giờ được chấp nhận
    expect(loi({ giaTri: -3 }).giaTri).toMatch(/lớn hơn 0/);
    expect(loi({ giaTri: 95 }).giaTri).toMatch(/tối đa 90 lbs/);
    expect(loi({ giaTri: 2, donVi: 'kg' }).giaTri).toMatch(/quá nhỏ/);
    expect(loi({ noiCang: 'nha-hang-xom' }).noiCang).toBeTruthy();
  });

  it('vượt mức nhà sản xuất chỉ khi có số tối đa', () => {
    expect(vuotMucNSX(29, 28)).toBe(true);
    expect(vuotMucNSX(28, 28)).toBe(false);
    expect(vuotMucNSX(35, undefined)).toBe(false);
  });

  it('chụp khoảng căng từ thuocTinh của phiên bản', () => {
    expect(thongSoChupTuThuocTinh([{ k: 'sucCangMinLbs', v: 20 }, { k: 'sucCangMaxLbs', v: 28 }, { k: 'trongLuongU', v: 4 }, { k: 'loiChoi', v: 'cong' }]))
      .toEqual({ sucCangMinLbs: 20, sucCangMaxLbs: 28, trongLuongU: 4 });
    expect(thongSoChupTuThuocTinh(undefined)).toBeUndefined();
  });

  it('pipeline ghi lần căng: một lệnh, giữ 10 lần mới nhất, giá trị nhập bọc $literal', () => {
    const p: any[] = pipelineGhiLanCang({ _id: new Types.ObjectId(), ngay: new Date(), mucCangLbs: 25, giaTriNhap: 25, donViNhap: 'lbs', tenDay: '$lichSuCang', noiCang: 'ngoai', vuotMucNSX: false });
    expect(p).toHaveLength(3);
    expect(JSON.stringify(p[0])).toContain('"$slice"');
    expect(JSON.stringify(p[0])).toContain('"$literal"');
    expect(p[0].$set.lichSuCang.$slice[1]).toBe(10);
  });

  it('pipeline đổi chu kỳ: null thì xoá trường; giá trị lạ bị từ chối', () => {
    expect((pipelineDoiChuKy(null)[0] as any).$set.chuKyNhacNgay).toBe('$$REMOVE');
    expect((pipelineDoiChuKy(30)[0] as any).$set.chuKyNhacNgay).toEqual({ $literal: 30 });
    expect(() => pipelineDoiChuKy(0)).toThrow();
    expect(() => pipelineDoiChuKy(400)).toThrow();
  });
});
