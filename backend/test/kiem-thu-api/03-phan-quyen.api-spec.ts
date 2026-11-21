import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, Client, khachMoi, nhanVienClient } from './_client';

/**
 * Ma trận phân quyền: mỗi API quản trị được gọi bằng 4 vai trò.
 * 401 = chưa đăng nhập, 403 = đăng nhập nhưng không đủ quyền, 2xx = được phép.
 */
type Vai = 'an' | 'khach' | 'nhanVien' | 'admin';
const DUOC = 'ok';

const MA_TRAN: [string, string, Record<Vai, number | typeof DUOC>][] = [
  ['GET', '/admin/dashboard', { an: 401, khach: 403, nhanVien: 403, admin: DUOC }],
  ['GET', '/admin/don-hang', { an: 401, khach: 403, nhanVien: DUOC, admin: DUOC }],
  ['GET', '/admin/san-pham', { an: 401, khach: 403, nhanVien: DUOC, admin: DUOC }],
  ['GET', '/admin/form-san-pham', { an: 401, khach: 403, nhanVien: DUOC, admin: DUOC }],
  ['GET', '/admin/tai-khoan', { an: 401, khach: 403, nhanVien: 403, admin: DUOC }],
  ['GET', '/admin/khuyen-mai', { an: 401, khach: 403, nhanVien: 403, admin: DUOC }],
  ['GET', '/admin/logo', { an: 401, khach: 403, nhanVien: 403, admin: DUOC }],
  ['GET', '/admin/tran-dau', { an: 401, khach: 403, nhanVien: DUOC, admin: DUOC }],
  ['GET', '/admin/ban-tin', { an: 401, khach: 403, nhanVien: DUOC, admin: DUOC }],
  ['GET', '/admin/thong-bao', { an: 401, khach: 403, nhanVien: 403, admin: DUOC }],
  ['GET', '/admin/bao-cao-csdl', { an: 401, khach: 403, nhanVien: 403, admin: DUOC }],
  ['GET', '/admin/khai-thac/goi-y-da-luu', { an: 401, khach: 403, nhanVien: 403, admin: DUOC }],
  ['GET', '/admin/su-kien/trang-thai', { an: 401, khach: 403, nhanVien: 403, admin: DUOC }],
  ['GET', '/admin/lich-cang', { an: 401, khach: 403, nhanVien: 403, admin: DUOC }],
  ['GET', '/gio-hang', { an: 401, khach: DUOC, nhanVien: DUOC, admin: DUOC }],
  ['GET', '/don-hang', { an: 401, khach: DUOC, nhanVien: DUOC, admin: DUOC }],
  ['GET', '/tu-vot', { an: 401, khach: DUOC, nhanVien: DUOC, admin: DUOC }],
];

describe('03. Phân quyền – ma trận vai trò × API', () => {
  const vai: Record<Vai, Client> = {} as any;
  beforeAll(async () => {
    vai.an = new Client();
    vai.khach = await khachMoi('pq');
    vai.nhanVien = await nhanVienClient();
    vai.admin = await adminClient();
  });

  for (const [method, path, mongDoi] of MA_TRAN) {
    for (const v of Object.keys(mongDoi) as Vai[]) {
      it(`${method} ${path} – ${v} → ${mongDoi[v] === DUOC ? '2xx' : mongDoi[v]}`, async () => {
        const r = await vai[v].goi(method, path);
        if (mongDoi[v] === DUOC) expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBeLessThan(300);
        else expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(mongDoi[v]);
      });
    }
  }

  it('Nhân viên không xóa được sản phẩm (chỉ admin) → 403', async () => {
    const ds = await vai.admin.get('/admin/san-pham');
    const r = await vai.nhanVien.del(`/admin/san-pham/${ds.body.items[0].id}`);
    expect(r.status).toBe(403);
  });

  it('Nhân viên không xóa được trận đấu và bản tin → 403', async () => {
    const td = (await vai.admin.get('/admin/tran-dau')).body.items[0];
    const bt = (await vai.admin.get('/admin/ban-tin')).body.items[0];
    expect((await vai.nhanVien.del(`/admin/tran-dau/${td.id}`)).status).toBe(403);
    expect((await vai.nhanVien.del(`/admin/ban-tin/${bt.id}`)).status).toBe(403);
  });

  it('Khách không xem được đơn của khách khác (404, không lộ dữ liệu)', async () => {
    const donMau = (await vai.admin.get('/admin/don-hang')).body.items[0];
    const r = await vai.khach.get(`/don-hang/${donMau.soDonHang}`);
    // Không được lộ dữ liệu; mã đúng theo REST là 404 (hiện server trả 400 "Không tìm thấy đơn hàng.")
    expect(r.body.soDonHang).toBeUndefined();
    expect(r.status).toBe(404);
  });

  it('Hạ quyền có hiệu lực ngay: tài khoản bị xóa thì token cũ hết hiệu lực', async () => {
    const kh = await khachMoi('xoa');
    const ds = await vai.admin.get(`/admin/tai-khoan?keyword=${kh.tenDangNhap}`);
    const tk = ds.body.items.find((x: any) => x.tenDangNhap === kh.tenDangNhap);
    expect(tk).toBeTruthy();
    expect((await vai.admin.del(`/admin/tai-khoan/${tk.id}`)).status).toBeLessThan(300);
    expect((await kh.get('/auth/me')).body.user).toBeNull();
    expect((await kh.get('/gio-hang')).status).toBe(401);
  });
});
