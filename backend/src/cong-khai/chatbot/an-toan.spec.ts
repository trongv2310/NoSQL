import { CauDao, giaHopLe, GioiHanTanSuat, lamSachLichSu, lamSachNguCanh, lamSachTinNhan, trichSoTien } from './an-toan';

describe('lamSachNguCanh', () => {
  it('chỉ giữ trường hợp lệ, bỏ giá trị lạ và id sai định dạng', () => {
    const id = 'a'.repeat(24);
    const r = lamSachNguCanh({
      loai: 'vot', hang: 'Yonex', giaMax: 3_000_000, giaMin: -5, trinhDo: 'sieu_hang', loiChoi: 'cong',
      sanPhamIds: [id, 'khong-hop-le', 123], tuKhoa: ['astrox', '<script>'], isAdmin: true, kichCo: '4U',
    });
    expect(r).toEqual({ loai: 'vot', hang: 'Yonex', giaMax: 3_000_000, loiChoi: 'cong', sanPhamIds: [id], tuKhoa: ['astrox'], kichCo: '4U' });
  });

  it('đầu vào rác trả về object rỗng', () => {
    expect(lamSachNguCanh(null)).toEqual({});
    expect(lamSachNguCanh('x')).toEqual({});
    expect(lamSachNguCanh({ giaMax: 'abc' })).toEqual({});
  });
});

describe('lamSachLichSu / lamSachTinNhan', () => {
  it('giữ tối đa 10 lượt hợp lệ và cắt độ dài', () => {
    const ds = Array.from({ length: 15 }, (_, i) => ({ vai: i % 2 ? 'bot' : 'user', text: `lượt ${i}` }));
    ds.push({ vai: 'admin', text: 'không hợp lệ' }, { vai: 'user', text: 'x'.repeat(2000) });
    const r = lamSachLichSu(ds);
    expect(r.length).toBeLessThanOrEqual(10);
    expect(r.every((l) => l.vai === 'user' || l.vai === 'bot')).toBe(true);
    expect(Math.max(...r.map((l) => l.text.length))).toBeLessThanOrEqual(600);
    expect(lamSachLichSu('x')).toEqual([]);
  });

  it('bỏ ký tự điều khiển, gom khoảng trắng', () => {
    expect(lamSachTinNhan('  xin\u0000   chào \u0007\n\n\n\nshop ')).toBe('xin chào\n\nshop');
    expect(lamSachTinNhan({ a: 1 })).toBe('');
  });
});

describe('GioiHanTanSuat', () => {
  it('chặn khi vượt số lượt trong cửa sổ và cho dùng lại sau khi hết cửa sổ', () => {
    let t = 1_000_000;
    const gh = new GioiHanTanSuat([{ cua: 60_000, toiDa: 3 }], () => t);
    expect(gh.thu('a').duoc).toBe(true);
    expect(gh.thu('a').duoc).toBe(true);
    expect(gh.thu('a').duoc).toBe(true);
    const bi = gh.thu('a');
    expect(bi.duoc).toBe(false);
    expect(bi.duoc === false && bi.thuLaiSau).toBeGreaterThan(0);
    expect(gh.thu('b').duoc).toBe(true);
    t += 61_000;
    expect(gh.thu('a').duoc).toBe(true);
  });

  it('nhiều luật: luật dài hạn cũng chặn', () => {
    let t = 0;
    const gh = new GioiHanTanSuat([{ cua: 1_000, toiDa: 5 }, { cua: 10_000, toiDa: 6 }], () => t);
    for (let i = 0; i < 6; i++) {
      expect(gh.thu('k').duoc).toBe(true);
      t += 1_100;
    }
    expect(gh.thu('k').duoc).toBe(false);
  });
});

describe('CauDao', () => {
  it('mở sau N lỗi liên tiếp và đóng lại sau thời gian nghỉ; thành công xóa bộ đếm', () => {
    let t = 0;
    const cd = new CauDao(3, 60_000, () => t);
    cd.loi();
    cd.loi();
    cd.thanhCong();
    cd.loi();
    cd.loi();
    expect(cd.choPhep()).toBe(true);
    cd.loi();
    expect(cd.choPhep()).toBe(false);
    t += 61_000;
    expect(cd.choPhep()).toBe(true);
  });
});

describe('giaHopLe – chặn AI bịa giá', () => {
  it('trích số tiền ở nhiều dạng', () => {
    expect(trichSoTien('giá 3.771.000đ, hoặc 4,5 triệu, thêm 500k').map((x) => Math.round(x.v))).toEqual([4_500_000, 500_000, 3_771_000]);
    expect(trichSoTien('Astrox 100ZZ nặng 85g, năm 2024, 4U').length).toBe(0);
  });

  it('chấp nhận giá có trong dữ liệu, kể cả làm tròn theo triệu', () => {
    const ds = [3_771_000, 4_190_000];
    expect(giaHopLe('Mẫu **Astrox 99** giá 3.771.000đ rất ổn.', ds)).toBe(true);
    expect(giaHopLe('Khoảng 3,8 triệu thôi bạn.', ds)).toBe(true);
    expect(giaHopLe('Giá 4.190.000 đ, giảm còn 3.771.000 đồng.', ds)).toBe(true);
  });

  it('từ chối giá không có trong dữ liệu', () => {
    const ds = [3_771_000];
    expect(giaHopLe('Chỉ 2.999.000đ thôi!', ds)).toBe(false);
    expect(giaHopLe('Khoảng 2 triệu đấy.', ds)).toBe(false);
    expect(giaHopLe('Giá 3.771.000đ cộng phí 50k', ds)).toBe(false);
  });

  it('câu không nhắc tiền luôn hợp lệ', () => {
    expect(giaHopLe('Mẫu này nặng đầu, hợp lối chơi tấn công.', [])).toBe(true);
  });
});
