import { locKhuyenMaiDangChay } from './khuyen-mai';

const ngay = (soNgay: number) => new Date(Date.now() + soNgay * 864e5);
const km = (id: string, o: Record<string, unknown> = {}) => ({
  _id: id, tenChuongTrinh: `CT ${id}`, phanTramGiam: 10, ngayBatDau: ngay(-5), ngayKetThuc: ngay(5), ...o,
});
const sp = (id: string, khuyenMai: unknown) => ({
  _id: id, tenSanPham: `SP ${id}`, giaGoc: 1_000_000, khuyenMai, loai: null, hang: null, hinhAnhDaiDien: 'a.jpg', ngayTao: new Date(),
});

describe('locKhuyenMaiDangChay', () => {
  it('giữ chương trình còn hiệu lực có sản phẩm, và chỉ trả về các sản phẩm của chương trình đó', () => {
    const dangChay = km('k1');
    const r = locKhuyenMaiDangChay([dangChay], [sp('a', dangChay), sp('b', null)]);
    expect(r.khuyenMais.map((k) => k?.id)).toEqual(['k1']);
    expect(r.sanPhams.map((s) => s.id)).toEqual(['a']);
  });

  it('ẩn chương trình đã hết hạn (ví dụ đại lễ 30/4 còn sót lại)', () => {
    const het = km('k2', { ngayBatDau: new Date('2026-04-25'), ngayKetThuc: new Date('2026-05-02') });
    const r = locKhuyenMaiDangChay([het], [sp('a', het)]);
    expect(r).toEqual({ khuyenMais: [], sanPhams: [] });
  });

  it('ẩn chương trình chưa bắt đầu, mức giảm 0 và chương trình không có sản phẩm nào', () => {
    const chuaBatDau = km('k3', { ngayBatDau: ngay(2), ngayKetThuc: ngay(9) });
    const giam0 = km('k4', { phanTramGiam: 0 });
    const trong = km('k5');
    const r = locKhuyenMaiDangChay([chuaBatDau, giam0, trong], [sp('a', chuaBatDau), sp('b', giam0)]);
    expect(r.khuyenMais).toEqual([]);
    expect(r.sanPhams).toEqual([]);
  });

  it('chương trình chỉ gắn với sản phẩm đã ngừng kinh doanh (không có trong danh sách) cũng không hiện', () => {
    const k = km('k6');
    expect(locKhuyenMaiDangChay([k], []).khuyenMais).toEqual([]);
  });
});
