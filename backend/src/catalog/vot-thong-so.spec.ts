import { bacCanBang, bienTheKhopBoLoc, gopThongSoBienThe, loiChoiCuaVot, nhomCanBang, nhomDoCung, nhomTrongLuong } from './vot-thong-so';

const ts = (doCanBang: string, doCung = 'Cứng', trongLuong = '3U (85-89g)') => ({ doCanBang, doCung, trongLuong, chieuDai: '675mm', sucCang: '21-29 lbs' });
const rong = { loiChoi: [], canBang: [], trongLuong: [], doCung: [] };

describe('phân loại thông số vợt (giá trị thật trong kho)', () => {
  it('nhóm cân bằng, độ cứng, trọng lượng theo đúng chuỗi trong kho', () => {
    expect(['Rất nặng đầu', 'Hơi nặng đầu', 'Nặng đầu', 'Cân bằng', 'Nhẹ đầu'].map((x) => nhomCanBang(ts(x)))).toEqual(['nang', 'nang', 'nang', 'can-bang', 'nhe']);
    expect(['Rất cứng', 'Cứng', 'Trung bình', 'Mềm'].map((x) => nhomDoCung(ts('Cân bằng', x)))).toEqual(['cung', 'cung', 'vua', 'mem']);
    expect(['3U (85-89g)', '4U (80-84g)', '5U (75-79g)', 'không rõ'].map((x) => nhomTrongLuong(ts('Cân bằng', 'Cứng', x)))).toEqual(['3u', '4u', '5u', null]);
    expect(bacCanBang(ts('Hơi nặng đầu'))).toBe(1);
    expect(nhomCanBang({})).toBeNull();
  });

  it('lối chơi khớp quy tắc của bộ gợi ý: Uy lực = từ hơi nặng đầu, Tốc độ = nhẹ đầu, Kiểm soát = cân bằng/hơi nặng; thiếu độ cứng thì không thuộc lối nào', () => {
    expect(loiChoiCuaVot(ts('Nặng đầu'))).toEqual(['cong']);
    expect(loiChoiCuaVot(ts('Hơi nặng đầu'))).toEqual(['cong', 'toan']);
    expect(loiChoiCuaVot(ts('Cân bằng'))).toEqual(['toan']);
    expect(loiChoiCuaVot(ts('Nhẹ đầu'))).toEqual(['toc']);
    expect(loiChoiCuaVot({ doCanBang: 'Nặng đầu' })).toEqual([]);
  });

  it('gộp thông số các phiên bản: trường khác nhau KHÔNG lấy bừa giá trị phiên bản đầu mà được liệt kê ở khacNhau', () => {
    const g = gopThongSoBienThe([ts('Nặng đầu', 'Cứng', '3U (85-89g)'), ts('Nặng đầu', 'Trung bình', '4U (80-84g)')]);
    expect(g.thongSoVot).toEqual({ doCanBang: 'Nặng đầu', chieuDai: '675mm', sucCang: '21-29 lbs' });
    expect(g.khacNhau).toEqual({ trongLuong: ['3U (85-89g)', '4U (80-84g)'], doCung: ['Cứng', 'Trung bình'] });
    expect(gopThongSoBienThe([null, undefined])).toEqual({ thongSoVot: null, khacNhau: {} });
  });

  it('một phiên bản thỏa MỌI nhóm đã chọn; trong nhóm khớp một trong các giá trị; không có thông số thì không khớp', () => {
    const b = { ...rong, loiChoi: ['cong'], doCung: ['cung', 'vua'] };
    expect(bienTheKhopBoLoc(ts('Nặng đầu', 'Cứng'), b)).toBe(true);
    expect(bienTheKhopBoLoc(ts('Nặng đầu', 'Mềm'), b)).toBe(false);
    expect(bienTheKhopBoLoc(ts('Nhẹ đầu', 'Cứng'), b)).toBe(false);
    expect(bienTheKhopBoLoc(null, b)).toBe(false);
    expect(bienTheKhopBoLoc(ts('Nhẹ đầu'), rong)).toBe(true);
  });
});
