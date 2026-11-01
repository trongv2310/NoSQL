import { khoMau, timSp } from '../../../test/chatbot-mau';
import { dsHangTrongKho, timTheoTen, tuKhoaTrongKho } from './kho';
import { chuanHoa } from './nlu';
import { cacCoU, loaiCanBang, loaiDoCung, xepHang } from './xep-hang';

const kho = khoMau();
const ten = (kq: ReturnType<typeof xepHang>) => kq.muc.map((m) => m.sp.ten);

describe('dungKho', () => {
  it('tính giá sau khuyến mãi còn hiệu lực, bỏ qua khuyến mãi hết hạn', () => {
    const km = timSp(kho, 'thruster');
    expect(km.giaGoc).toBe(2_150_000);
    expect(km.gia).toBe(1_935_000);
    expect(km.phanTramGiam).toBe(10);
    expect(km.tenKhuyenMai).toBe('Giảm 10%');
    const hetHan = timSp(kho, 'ayas012');
    expect(hetHan.gia).toBe(2_400_000);
    expect(hetHan.phanTramGiam).toBe(0);
  });

  it('gom tồn kho, thông số và danh sách hãng', () => {
    const a99 = timSp(kho, 'astrox 99');
    expect(a99.tonKho).toBe(9);
    expect(a99.loai).toBe('vot');
    expect(loaiCanBang(a99)).toBe('nang');
    expect(loaiDoCung(a99)).toBe('cung');
    expect(cacCoU(a99)).toEqual(['3U', '4U']);
    expect(dsHangTrongKho(kho).sort()).toEqual(['Lining', 'Victor', 'Yonex']);
    expect(timSp(kho, 'long vit').nhom).toBe('cau');
  });

  it('từ khóa tên không chứa từ chung hay tên hãng', () => {
    const tk = tuKhoaTrongKho(kho);
    expect(tk.has('astrox')).toBe(true);
    expect(tk.has('99')).toBe(true);
    expect(tk.has('yonex')).toBe(false);
    expect(tk.has('vot')).toBe(false);
  });
});

describe('timTheoTen', () => {
  it('khớp theo mã model', () => {
    expect(timTheoTen(kho, chuanHoa('Astrox 99 Pro giá bao nhiêu')).map((x) => x.sp.ten)).toEqual(['Vợt Cầu Lông Yonex Astrox 99 Pro']);
    expect(timTheoTen(kho, chuanHoa('tectonic 7 còn không')).length).toBe(1);
  });

  it('chỉ nhắc hãng hoặc dòng chung chung thì không coi là một mẫu', () => {
    expect(timTheoTen(kho, chuanHoa('vợt yonex'))).toEqual([]);
    expect(timTheoTen(kho, chuanHoa('astrox'))).toEqual([]);
  });
});

describe('xepHang – vợt', () => {
  it('người mới ưu tiên thân vợt mềm vừa, cân bằng, dễ chơi', () => {
    const kq = xepHang(kho, { loai: 'vot', trinhDo: 'moi' });
    expect(kq.muc[0].sp.ten).toContain('Tectonic 7');
    expect(kq.muc[0].lyDo.length).toBeGreaterThan(0);
    const viTriA99 = ten(kq).findIndex((t) => t.includes('Astrox 99'));
    expect(viTriA99 === -1 || viTriA99 > 1).toBe(true);
  });

  it('lối chơi tấn công trong ngân sách chọn nặng đầu, loại mẫu vượt giá', () => {
    const kq = xepHang(kho, { loai: 'vot', loiChoi: 'cong', giaMax: 3_500_000 });
    expect(kq.muc[0].sp.ten).toContain('Thruster');
    expect(kq.muc.every((m) => m.sp.gia <= 3_500_000)).toBe(true);
    expect(kq.ghiChu).toEqual([]);
  });

  it('lối chơi tốc độ/phòng thủ chọn nhẹ đầu', () => {
    const kq = xepHang(kho, { loai: 'vot', loiChoi: 'thu' });
    expect(kq.muc[0].sp.ten).toContain('Nanoflare');
    expect(kq.muc[0].lyDo.join(' ')).toMatch(/Nhẹ đầu/);
  });

  it('người tay yếu tránh vợt nặng đầu thân cứng', () => {
    const kq = xepHang(kho, { loai: 'vot', nheTay: true });
    expect(kq.muc[0].sp.ten).not.toContain('Astrox 99');
    expect(['Nanoflare', 'Tectonic']).toContain(/(Nanoflare|Tectonic)/.exec(kq.muc[0].sp.ten)?.[1]);
  });

  it('người chơi nâng cao ưu tiên thân cứng', () => {
    const kq = xepHang(kho, { loai: 'vot', trinhDo: 'nang_cao' });
    expect(loaiDoCung(kq.muc[0].sp)).toMatch(/cung/);
  });

  it('lọc theo hãng và khi hãng không có thì ghi chú và gợi ý hãng khác', () => {
    expect(xepHang(kho, { loai: 'vot', hang: 'Yonex' }).muc.every((m) => m.sp.hang === 'Yonex')).toBe(true);
    const kq = xepHang(kho, { loai: 'aoquan', hang: 'Lining' });
    expect(kq.ghiChu).toContain('khong_co_hang');
    expect(kq.muc.length).toBeGreaterThan(0);
  });
});

describe('xepHang – kho và ngân sách', () => {
  it('không gợi ý hàng hết kho khi còn lựa chọn khác', () => {
    const kq = xepHang(kho, { loai: 'vot' }, 10);
    expect(ten(kq).some((t) => t.includes('Calibar'))).toBe(false);
  });

  it('chỉ còn hàng hết kho thì vẫn trả về và ghi chú', () => {
    const kq = xepHang(kho, { loai: 'vot', tuKhoa: ['calibar'] });
    expect(kq.ghiChu).toContain('het_hang');
    expect(kq.muc[0].sp.tonKho).toBe(0);
  });

  it('không có mẫu trong ngân sách thì đưa mẫu gần nhất và đánh dấu', () => {
    const kq = xepHang(kho, { loai: 'vot', giaMax: 1_000_000 });
    expect(kq.ghiChu).toContain('ngoai_ngan_sach');
    expect(kq.muc[0].ngoaiNganSach).toBe(true);
    expect(kq.muc[0].sp.ten).toContain('Thruster');
  });

  it('khoảng giá có cả cận dưới', () => {
    const kq = xepHang(kho, { loai: 'vot', giaMin: 3_900_000, giaMax: 4_500_000 }, 10);
    expect(kq.muc.map((m) => m.sp.gia).every((g) => g >= 3_900_000 && g <= 4_500_000)).toBe(true);
    expect(kq.muc.length).toBe(2);
  });

  it('rẻ nhất / cao cấp nhất sắp theo giá', () => {
    expect(xepHang(kho, { loai: 'vot', sapXep: 're' }).muc[0].sp.ten).toContain('Thruster');
    expect(xepHang(kho, { loai: 'vot', sapXep: 'cao' }).muc[0].sp.ten).toContain('Astrox 99');
  });

  it('"mẫu khác" loại các mẫu đã gợi ý', () => {
    const dau = xepHang(kho, { loai: 'vot' }, 2);
    const loaiTru = new Set(dau.muc.map((m) => m.sp.id));
    const khac = xepHang(kho, { loai: 'vot', loaiTru }, 2);
    expect(khac.muc.every((m) => !loaiTru.has(m.sp.id))).toBe(true);
  });

  it('"mẫu khác" không đẩy hàng hết kho lên khi các mẫu còn hàng đã gợi ý hết', () => {
    const conHang = xepHang(kho, { loai: 'vot' }, 20).muc.map((m) => m.sp.id);
    const kq = xepHang(kho, { loai: 'vot', loaiTru: new Set(conHang) }, 4);
    expect(kq.ghiChu).toContain('het_mau_khac');
    expect(kq.muc.every((m) => m.sp.tonKho > 0)).toBe(true);
  });

  it('hết mẫu mới trong tầm giá thì báo "het_mau_trong_tam_gia"', () => {
    const trong = xepHang(kho, { loai: 'vot', giaMax: 3_300_000 }, 10);
    const kq = xepHang(kho, { loai: 'vot', giaMax: 3_300_000, loaiTru: new Set(trong.muc.map((m) => m.sp.id)) });
    expect(kq.ghiChu).toContain('het_mau_trong_tam_gia');
  });
});

describe('xepHang – giày, áo, phụ kiện, khuyến mãi', () => {
  it('lọc theo size còn hàng', () => {
    const kq = xepHang(kho, { loai: 'giay', kichCo: '42' });
    expect(ten(kq)).toEqual(['Giày Cầu Lông Lining AYAS012']);
    const khongCo = xepHang(kho, { loai: 'giay', kichCo: '45' });
    expect(khongCo.ghiChu).toContain('khong_co_size');
    expect(khongCo.muc.length).toBe(2);
  });

  it('chỉ lấy sản phẩm đang khuyến mãi', () => {
    const kq = xepHang(kho, { chiKhuyenMai: true }, 10);
    expect(ten(kq).sort()).toEqual(['Vợt Cầu Lông Victor Thruster F Claw', 'Áo Cầu Lông Yonex TRM3089'].sort());
  });

  it('nhóm phụ kiện: quả cầu; nhóm không có hàng thì rỗng', () => {
    expect(ten(xepHang(kho, { loai: 'phukien', nhom: 'cau' }))).toEqual(['Cầu Lông Lông Vịt Thi Đấu (Ống 12 Quả)']);
    expect(xepHang(kho, { loai: 'phukien', nhom: 'tui' }).muc).toEqual([]);
  });

  it('từ khóa tên dòng sản phẩm', () => {
    expect(ten(xepHang(kho, { loai: 'vot', tuKhoa: ['astrox'] }))).toEqual(['Vợt Cầu Lông Yonex Astrox 99 Pro']);
    expect(xepHang(kho, { loai: 'vot', tuKhoa: ['khongco'] }).ghiChu).toContain('bo_tu_khoa');
  });
});
