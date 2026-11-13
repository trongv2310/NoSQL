import { coLienHe, docLienHe } from './lien-he';

describe('docLienHe', () => {
  it('chưa cấu hình thì mọi mục là null', () => {
    const l = docLienHe({});
    expect(l).toEqual({ dienThoai: null, email: null, diaChi: null, gioMoCua: null });
    expect(coLienHe(l)).toBe(false);
  });

  it('nhận giá trị hợp lệ, gọn khoảng trắng', () => {
    const l = docLienHe({ SHOP_HOTLINE: ' 0901  234 567 ', SHOP_EMAIL: 'shop@example.vn', SHOP_DIA_CHI: '12 Đường A,  Quận B', SHOP_GIO_MO_CUA: '8:00 – 20:00' });
    expect(l).toEqual({ dienThoai: '0901 234 567', email: 'shop@example.vn', diaChi: '12 Đường A, Quận B', gioMoCua: '8:00 – 20:00' });
    expect(coLienHe(l)).toBe(true);
  });

  it('từ chối số điện thoại/email sai định dạng và các giá trị mẫu cũ dù bị cấu hình nhầm', () => {
    const l = docLienHe({ SHOP_HOTLINE: '0123456789', SHOP_EMAIL: 'HUIT@gmail.com' });
    expect(l.dienThoai).toBeNull();
    expect(l.email).toBeNull();
    expect(docLienHe({ SHOP_HOTLINE: 'gọi cho tôi', SHOP_EMAIL: 'khong-phai-email' })).toMatchObject({ dienThoai: null, email: null });
    expect(docLienHe({ SHOP_DIA_CHI: 'x'.repeat(201) }).diaChi).toBeNull();
  });
});
