import { chuanHoa, gopNguCanh, nhanKichCo, nhanLoai, nhanSoDonHang, nhanTrinhDo, phanTich, phanTichNganSach, TuDienPhanTich } from './nlu';

const tuDien: TuDienPhanTich = {
  hang: ['Yonex', 'Lining', 'Victor', 'Mizuno'],
  tuKhoaTen: new Set(['astrox', '99', '88d', 'aerus', 'tectonic', 'vit', 'ngong']),
};
const hoi = (s: string, khop = 0, truoc = false) => phanTich(s, tuDien, khop, truoc);

describe('chuanHoa', () => {
  it('bỏ dấu, chữ thường, gộp li-ning', () => {
    expect(chuanHoa('  Vợt  Đánh Đôi Li-Ning ')).toBe('vot danh doi lining');
  });
});

describe('phanTichNganSach', () => {
  it.each([
    ['vợt dưới 3 triệu', { giaMax: 3_000_000 }],
    ['không quá 2tr5', { giaMax: 2_500_000 }],
    ['tối đa 500k', { giaMax: 500_000 }],
    ['ngân sách 3 củ', { giaMax: 3_000_000 }],
    ['trên 4 triệu', { giaMin: 4_000_000 }],
    ['từ 2 triệu trở lên', { giaMin: 2_000_000 }],
    ['từ 2 đến 4 triệu', { giaMin: 2_000_000, giaMax: 4_000_000 }],
    ['2-4tr', { giaMin: 2_000_000, giaMax: 4_000_000 }],
    ['giày 1.500.000 đồng trở xuống', { giaMax: 1_500_000 }],
    ['dưới 3', { giaMax: 3_000_000 }],
    ['dưới 2 triệu rưỡi', { giaMax: 2_500_000 }],
  ])('"%s"', (cau, mong) => {
    expect(phanTichNganSach(cau)).toMatchObject(mong);
  });

  it('"tầm 3tr5" cho khoảng quanh 3,5 triệu', () => {
    const r = phanTichNganSach('tầm 3tr5');
    expect(r.giaTam).toBe(3_500_000);
    expect(r.giaMin).toBeLessThan(3_500_000);
    expect(r.giaMax).toBeGreaterThan(3_500_000);
  });

  it.each(['size 42', 'Astrox 100ZZ', 'vợt 3U', 'đơn #12', 'tư vấn vợt tấn công', 'dưới 4U', 'đánh đôi 2 người'])('không nhầm "%s" là tiền', (cau) => {
    expect(phanTichNganSach(cau)).toEqual({});
  });

  it('nhận ý muốn rẻ nhất / cao cấp nhất', () => {
    expect(phanTichNganSach('vợt rẻ nhất').sapXep).toBe('re');
    expect(phanTichNganSach('vợt cao cấp nhất').sapXep).toBe('cao');
  });
});

describe('nhận diện thuộc tính', () => {
  it('loại hàng', () => {
    expect(nhanLoai(chuanHoa('tư vấn vợt'))).toBe('vot');
    expect(nhanLoai(chuanHoa('giày size 42'))).toBe('giay');
    expect(nhanLoai(chuanHoa('áo thun nam'))).toBe('aoquan');
    expect(nhanLoai(chuanHoa('quần short'))).toBe('aoquan');
    expect(nhanLoai(chuanHoa('mua quấn cán vợt'))).toBe('phukien');
    expect(nhanLoai(chuanHoa('tôi quan tâm đến vợt'))).toBe('vot');
  });

  it('trình độ, kích cỡ, mã đơn', () => {
    expect(nhanTrinhDo(chuanHoa('mới chơi được 1 tháng'))).toBe('moi');
    expect(nhanTrinhDo(chuanHoa('chơi phong trào'))).toBe('trung_binh');
    expect(nhanTrinhDo(chuanHoa('mình đánh giải chuyên nghiệp'))).toBe('nang_cao');
    expect(nhanTrinhDo(chuanHoa('vợt mới nhất'))).toBeUndefined();
    expect(nhanKichCo(chuanHoa('giày size 42'))).toBe('42');
    expect(nhanKichCo(chuanHoa('áo size M'))).toBe('M');
    expect(nhanKichCo(chuanHoa('vợt 4U'))).toBe('4U');
    expect(nhanSoDonHang(chuanHoa('đơn hàng #12 đến đâu rồi'))).toBe(12);
    expect(nhanSoDonHang(chuanHoa('mã đơn 345'))).toBe(345);
    expect(nhanSoDonHang(chuanHoa('mình hay đánh đơn 3 set'))).toBeUndefined();
  });
});

describe('phanTich – ý định và thông tin', () => {
  it('tư vấn vợt theo trình độ, lối chơi, hãng, ngân sách', () => {
    const r = hoi('Tư vấn vợt Yonex cho người mới chơi, thiên tấn công, dưới 3 triệu');
    expect(r.yDinh).toBe('tu_van');
    expect(r.slot).toMatchObject({ loai: 'vot', hang: 'Yonex', trinhDo: 'moi', loiChoi: 'cong', giaMax: 3_000_000 });
  });

  it('suy ra vợt từ lối chơi, phụ kiện từ quả cầu', () => {
    expect(hoi('mình hay đập cầu, hay mỏi tay').slot.loai).toBe('vot');
    expect(hoi('mua quả cầu lông ngỗng').slot).toMatchObject({ loai: 'phukien', nhom: 'cau' });
  });

  it('các ý định chính', () => {
    expect(hoi('xin chào shop').yDinh).toBe('chao_hoi');
    expect(hoi('cảm ơn shop nhé').yDinh).toBe('cam_on');
    expect(hoi('đơn hàng #12 đến đâu rồi').yDinh).toBe('don_hang');
    expect(hoi('kiểm tra đơn của tôi').yDinh).toBe('don_hang');
    expect(hoi('shop có bảo hành không').chuDeChinhSach).toBe('bao_hanh');
    expect(hoi('thanh toán bằng MoMo được không').chuDeChinhSach).toBe('thanh_toan');
    expect(hoi('làm sao hủy đơn').chuDeChinhSach).toBe('huy_don');
    expect(hoi('địa chỉ cửa hàng ở đâu').chuDeChinhSach).toBe('cua_hang');
    expect(hoi('đang có khuyến mãi gì').yDinh).toBe('khuyen_mai');
    expect(hoi('vợt yonex còn hàng không').yDinh).toBe('ton_kho');
    expect(hoi('3U là gì').chuDeHuongDan).toBe('trong_luong');
    expect(hoi('chọn vợt như thế nào').yDinh).toBe('huong_dan');
    expect(hoi('so sánh 88d và 99').yDinh).toBe('so_sanh');
  });

  it('hỏi giá cần có sản phẩm cụ thể, nếu không thì tư vấn', () => {
    expect(hoi('Astrox 99 giá bao nhiêu', 1).yDinh).toBe('hoi_gia');
    expect(hoi('cái này giá bao nhiêu').yDinh).toBe('hoi_gia');
    expect(hoi('giá bao nhiêu', 0, true).yDinh).toBe('hoi_gia');
    expect(hoi('giá vợt yonex bao nhiêu').yDinh).toBe('tu_van');
  });

  it('"đánh đơn" không bị hiểu là đơn hàng', () => {
    expect(hoi('mình chơi đánh đơn, tư vấn vợt').yDinh).toBe('tu_van');
  });

  it('tham chiếu đến mẫu đã gợi ý', () => {
    expect(hoi('cái thứ 2 còn hàng không').thuTu).toBe(2);
    expect(hoi('mẫu cuối giá sao').thuTu).toBe('cuoi');
    expect(hoi('mẫu này còn hàng không').daiTu).toBe(true);
    expect(hoi('cho xem mẫu khác').xemThem).toBe(true);
    expect(hoi('có cái nào rẻ hơn không').tuongDoi).toBe('re_hon');
  });

  it('câu lạ rơi vào "khac"', () => {
    expect(hoi('hôm nay trời đẹp quá').yDinh).toBe('khac');
  });
});

describe('gopNguCanh', () => {
  it('giữ thông tin cũ và thêm thông tin mới', () => {
    const cu = { loai: 'vot' as const, giaMax: 3_000_000, trinhDo: 'moi' as const };
    const m = gopNguCanh(cu, hoi('thiên tấn công'));
    expect(m).toMatchObject({ loai: 'vot', giaMax: 3_000_000, trinhDo: 'moi', loiChoi: 'cong' });
  });

  it('khoảng giá mới thay thế hẳn khoảng cũ', () => {
    const cu = { loai: 'vot' as const, giaMin: 2_000_000, giaMax: 4_000_000, giaTam: 3_000_000 };
    const m = gopNguCanh(cu, hoi('dưới 2 triệu'));
    expect(m.giaMax).toBe(2_000_000);
    expect(m.giaMin).toBeUndefined();
    expect(m.giaTam).toBeUndefined();
  });

  it('đổi loại hàng thì bỏ ngân sách/hãng/lối chơi cũ', () => {
    const cu = { loai: 'vot' as const, hang: 'Yonex', giaMax: 3_000_000, loiChoi: 'cong' as const, sanPhamIds: ['a'.repeat(24)] };
    const m = gopNguCanh(cu, hoi('còn giày thì sao'));
    expect(m).toEqual({ loai: 'giay' });
  });

  it('"bắt đầu lại" xóa ngữ cảnh', () => {
    const m = gopNguCanh({ loai: 'vot', giaMax: 1 }, hoi('bắt đầu lại, tìm giày'));
    expect(m).toEqual({ loai: 'giay' });
  });
});
