import { describe, expect, it } from 'vitest';
import { Client, duyNhat, khachMoi, sdt, TAI_KHOAN_MAU } from './_client';

const dangKyHopLe = () => {
  const t = duyNhat('dk');
  return { hoTen: 'Nguyễn Kiểm Thử', tenDangNhap: t, email: `${t}@kiemthu.local`, soDienThoai: sdt(), diaChi: 'TP.HCM', matKhau: 'abc123', xacNhanMatKhau: 'abc123' };
};

describe('02. Xác thực – đăng ký, đăng nhập, hồ sơ, đổi mật khẩu', () => {
  it('Đăng ký hợp lệ → 201, có cookie, /auth/me trả đúng người', async () => {
    const c = new Client();
    const d = dangKyHopLe();
    const r = await c.post('/auth/dang-ky', d);
    expect(r.status).toBe(201);
    expect(r.body.user.tenDangNhap).toBe(d.tenDangNhap);
    expect(r.body.user.maQuyen).toBe(3);
    expect(c.cookieHeader).toContain('token=');
    const me = await c.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.tenDangNhap).toBe(d.tenDangNhap);
  });

  it('Cookie đăng nhập có HttpOnly và SameSite', async () => {
    const res = await fetch((process.env.API_URL ?? 'http://localhost:4000/api') + '/auth/dang-nhap', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenDangNhap: TAI_KHOAN_MAU.khach[0], matKhau: TAI_KHOAN_MAU.khach[1] }),
    });
    const sc = res.headers.getSetCookie().join(';');
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Lax/i);
  });

  it('Đăng ký trùng tên đăng nhập → 409', async () => {
    const d = dangKyHopLe();
    await new Client().post('/auth/dang-ky', d);
    const r = await new Client().post('/auth/dang-ky', { ...d, email: `khac-${d.email}` });
    expect(r.status).toBe(409);
  });

  it('Đăng ký trùng email → 409', async () => {
    const d = dangKyHopLe();
    await new Client().post('/auth/dang-ky', d);
    const r = await new Client().post('/auth/dang-ky', { ...d, tenDangNhap: duyNhat('dk2') });
    expect(r.status).toBe(409);
  });

  it.each([
    ['xác nhận mật khẩu không khớp', { xacNhanMatKhau: 'khac123' }],
    ['email sai định dạng', { email: 'khong-phai-email' }],
    ['mật khẩu dưới 6 ký tự', { matKhau: '123', xacNhanMatKhau: '123' }],
    ['tên đăng nhập có ký tự lạ', { tenDangNhap: 'ab cd!' }],
    ['tên đăng nhập quá ngắn', { tenDangNhap: 'ab' }],
    ['số điện thoại sai', { soDienThoai: '12345' }],
    ['thiếu họ tên', { hoTen: '' }],
  ])('Đăng ký %s → 400', async (_t, sua) => {
    const r = await new Client().post('/auth/dang-ky', { ...dangKyHopLe(), ...sua });
    expect(r.status).toBe(400);
  });

  it('Đăng ký không thể tự gán quyền admin (maQuyen bị bỏ qua)', async () => {
    const c = new Client();
    const r = await c.post('/auth/dang-ky', { ...dangKyHopLe(), maQuyen: 1 });
    expect(r.status).toBe(201);
    expect(r.body.user.maQuyen).toBe(3);
  });

  it('Đăng nhập sai mật khẩu → 401; đúng → 200', async () => {
    const kh = await khachMoi('dn');
    const c = new Client();
    expect((await c.post('/auth/dang-nhap', { tenDangNhap: kh.tenDangNhap, matKhau: 'sai-mat-khau' })).status).toBe(401);
    expect((await c.post('/auth/dang-nhap', { tenDangNhap: kh.tenDangNhap, matKhau: kh.matKhau })).status).toBe(200);
  });

  it('Đăng nhập tên không tồn tại → 401 cùng thông báo (không lộ tài khoản có tồn tại hay không)', async () => {
    const kh = await khachMoi('dn2');
    const a = await new Client().post('/auth/dang-nhap', { tenDangNhap: 'khong_ton_tai_' + duyNhat(), matKhau: 'x123456' });
    const b = await new Client().post('/auth/dang-nhap', { tenDangNhap: kh.tenDangNhap, matKhau: 'sai123456' });
    expect(a.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('Đăng nhập thiếu trường → 400', async () => {
    expect((await new Client().post('/auth/dang-nhap', {})).status).toBe(400);
  });

  it('Sai 5 lần → lần 6 bị chặn 429 kể cả đúng mật khẩu', async () => {
    const kh = await khachMoi('khoa');
    const c = new Client();
    for (let i = 0; i < 5; i++) await c.post('/auth/dang-nhap', { tenDangNhap: kh.tenDangNhap, matKhau: 'sai' + i + 'xxx' });
    const r = await c.post('/auth/dang-nhap', { tenDangNhap: kh.tenDangNhap, matKhau: kh.matKhau });
    expect(r.status).toBe(429);
    expect(r.body.thuLaiSau).toBeGreaterThan(0);
  });

  it('Khách không đăng nhập được ở cổng quản trị; admin không đăng nhập ở cổng khách', async () => {
    const kh = await khachMoi('cong');
    expect((await new Client().post('/auth/admin/dang-nhap', { tenDangNhap: kh.tenDangNhap, matKhau: kh.matKhau })).status).toBe(401);
    expect((await new Client().post('/auth/dang-nhap', { tenDangNhap: TAI_KHOAN_MAU.admin[0], matKhau: TAI_KHOAN_MAU.admin[1] })).status).toBe(401);
  });

  it('Đăng xuất xóa phiên: /auth/me sau đó trả user null, API cần đăng nhập → 401', async () => {
    const kh = await khachMoi('dx');
    expect((await kh.get('/auth/me')).body.user).not.toBeNull();
    const r = await kh.post('/auth/dang-xuat');
    expect([200, 201, 204]).toContain(r.status);
    expect((await kh.get('/auth/me')).body.user).toBeNull();
    expect((await kh.get('/gio-hang')).status).toBe(401);
  });

  it('Token giả mạo bị bỏ qua: /auth/me trả user null, API cần đăng nhập → 401', async () => {
    const gia = 'token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sai';
    const base = process.env.API_URL ?? 'http://localhost:4000/api';
    const me = await fetch(base + '/auth/me', { headers: { cookie: gia } });
    expect((await me.json()).user).toBeNull();
    expect((await fetch(base + '/gio-hang', { headers: { cookie: gia } })).status).toBe(401);
  });

  it('GET /auth/thong-tin trả hồ sơ khách hàng', async () => {
    const kh = await khachMoi('tt');
    const r = await kh.get('/auth/thong-tin');
    expect(r.status).toBe(200);
    expect(r.body.hoTen).toContain('Khách kiểm thử');
  });

  it('Đổi mật khẩu: sai mật khẩu cũ → 400; đúng → đăng nhập được bằng mật khẩu mới', async () => {
    const kh = await khachMoi('dmk');
    expect((await kh.post('/auth/doi-mat-khau', { matKhauCu: 'sai-cu', matKhauMoi: 'moi12345', xacNhanMoi: 'moi12345' })).status).toBe(400);
    expect((await kh.post('/auth/doi-mat-khau', { matKhauCu: kh.matKhau, matKhauMoi: 'moi12345', xacNhanMoi: 'khac999' })).status).toBe(400);
    const ok = await kh.post('/auth/doi-mat-khau', { matKhauCu: kh.matKhau, matKhauMoi: 'moi12345', xacNhanMoi: 'moi12345' });
    expect([200, 201]).toContain(ok.status);
    expect((await new Client().post('/auth/dang-nhap', { tenDangNhap: kh.tenDangNhap, matKhau: 'moi12345' })).status).toBe(200);
    expect((await new Client().post('/auth/dang-nhap', { tenDangNhap: kh.tenDangNhap, matKhau: kh.matKhau })).status).toBe(401);
  });

  it('Hồ sơ người chơi: tạo, đọc, sửa (bỏ trường), xóa', async () => {
    const kh = await khachMoi('hs');
    expect((await kh.get('/auth/ho-so-choi')).body.hoSoChoi).toBeNull();
    const tao = await kh.put('/auth/ho-so-choi', { trinhDo: 'deu', noiDung: ['don'], loiChoi: 'cong', soBuoiMoiTuan: 3 });
    expect(tao.status).toBe(200);
    expect(tao.body.hoSoChoi.trinhDo).toBe('deu');
    const sua = await kh.put('/auth/ho-so-choi', { trinhDo: 'thi', noiDung: ['doi'] });
    expect(sua.body.hoSoChoi.trinhDo).toBe('thi');
    expect(sua.body.hoSoChoi.loiChoi).toBeUndefined();
    expect((await kh.put('/auth/ho-so-choi', { trinhDo: 'sieu-sao' })).status).toBe(400);
    expect((await kh.put('/auth/ho-so-choi', { soBuoiMoiTuan: 99 })).status).toBe(400);
    expect([200, 204]).toContain((await kh.del('/auth/ho-so-choi')).status);
    expect((await kh.get('/auth/ho-so-choi')).body.hoSoChoi).toBeNull();
  });
});
