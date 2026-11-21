import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, Client, duyNhat, khachMoi, taoSanPhamKiemThu } from './_client';

describe('04. Giỏ hàng – thêm, sửa, xóa, giỏ khách vãng lai, đồng bộ', () => {
  let admin: Client;
  let sp: { sanPhamId: string; bienTheId: string; sku: string };

  beforeAll(async () => {
    admin = await adminClient();
    sp = await taoSanPhamKiemThu(admin, { ton: 5 });
  });

  it('Chưa đăng nhập: GET /gio-hang → 401, /gio-hang/count → 0', async () => {
    const c = new Client();
    expect((await c.get('/gio-hang')).status).toBe(401);
    expect((await c.get('/gio-hang/count')).body.count).toBe(0);
  });

  it('CREATE: thêm 2 sản phẩm → count = 2, giỏ có đúng 1 dòng', async () => {
    const kh = await khachMoi('gh');
    const r = await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 2 });
    expect(r.status).toBe(201);
    expect(r.body.cartCount).toBe(2);
    const gio = await kh.get('/gio-hang');
    expect(gio.body.items).toHaveLength(1);
    expect(gio.body.items[0].soLuong).toBe(2);
  });

  it('Thêm cùng biến thể lần nữa → cộng dồn vào dòng cũ, không tạo dòng mới', async () => {
    const kh = await khachMoi('gh');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 2 });
    const gio = await kh.get('/gio-hang');
    expect(gio.body.items).toHaveLength(1);
    expect(gio.body.items[0].soLuong).toBe(3);
  });

  it('Thêm vượt tồn kho (tồn 5, thêm 6) → 400, giỏ không đổi', async () => {
    const kh = await khachMoi('gh');
    const r = await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 6 });
    expect(r.status).toBe(400);
    expect((await kh.get('/gio-hang/count')).body.count).toBe(0);
  });

  it('Thêm nhiều lần cộng dồn vượt tồn kho (3 + 3 > 5) → lần 2 bị từ chối', async () => {
    const kh = await khachMoi('gh');
    expect((await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 3 })).status).toBe(201);
    expect((await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 3 })).status).toBe(400);
    expect((await kh.get('/gio-hang/count')).body.count).toBe(3);
  });

  it('10 yêu cầu thêm song song (mỗi lần 1) với tồn 5 → giỏ đúng 5, không vượt, không trùng dòng', async () => {
    const kh = await khachMoi('gh');
    const rs = await Promise.all(Array.from({ length: 10 }, () => kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 })));
    expect(rs.filter((r) => r.status === 201).length).toBe(5);
    const gio = await kh.get('/gio-hang');
    expect(gio.body.items).toHaveLength(1);
    expect(gio.body.items[0].soLuong).toBe(5);
  });

  it.each([
    ['chiTietId sai định dạng', { chiTietId: 'abc', quantity: 1 }, 400],
    ['số lượng 0', { quantity: 0 }, 400],
    ['số lượng âm', { quantity: -3 }, 400],
    ['số lượng thập phân', { quantity: 1.5 }, 400],
    ['số lượng > 100', { quantity: 101 }, 400],
    ['biến thể không tồn tại', { chiTietId: '000000000000000000000000', quantity: 1 }, 400],
  ])('Thêm với %s → %s', async (_t, sua, ma) => {
    const kh = await khachMoi('gh');
    const r = await kh.post('/gio-hang', Object.assign({ chiTietId: sp.bienTheId, quantity: 1 }, sua));
    expect(r.status).toBe(ma);
  });

  it('UPDATE: PATCH số lượng dòng giỏ; vượt tồn kho → 400', async () => {
    const kh = await khachMoi('gh');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const dong = (await kh.get('/gio-hang')).body.items[0];
    const ok = await kh.patch(`/gio-hang/${dong.id}`, { quantity: 4 });
    expect(ok.status).toBe(200);
    expect(ok.body.cartCount).toBe(4);
    expect((await kh.patch(`/gio-hang/${dong.id}`, { quantity: 6 })).status).toBe(400);
    expect((await kh.patch(`/gio-hang/${dong.id}`, { quantity: 0 })).status).toBe(400);
  });

  it('DELETE: xóa dòng giỏ → giỏ rỗng; xóa lại dòng đó không lỗi 500', async () => {
    const kh = await khachMoi('gh');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const dong = (await kh.get('/gio-hang')).body.items[0];
    expect((await kh.del(`/gio-hang/${dong.id}`)).status).toBe(200);
    expect((await kh.get('/gio-hang')).body.items).toHaveLength(0);
    expect((await kh.del(`/gio-hang/${dong.id}`)).status).toBeLessThan(500);
  });

  it('Không sửa / xóa được dòng giỏ của người khác', async () => {
    const a = await khachMoi('gha');
    const b = await khachMoi('ghb');
    await a.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const dongA = (await a.get('/gio-hang')).body.items[0];
    expect((await b.patch(`/gio-hang/${dongA.id}`, { quantity: 3 })).status).toBe(404);
    await b.del(`/gio-hang/${dongA.id}`);
    expect((await a.get('/gio-hang')).body.items[0].soLuong).toBe(1);
  });

  it('Giỏ khách vãng lai: /gio-hang/tinh tính lại giá từ server, bỏ qua giá client gửi', async () => {
    const c = new Client();
    const r = await c.post('/gio-hang/tinh', { dong: [{ chiTietId: sp.bienTheId, soLuong: 2, gia: 1 }] });
    expect(r.status).toBe(200);
    expect(r.body.items[0].bienThe.giaThucTe).toBe(150000);
  });

  it('Đồng bộ giỏ khách khi đăng nhập: gửi lại cùng syncId KHÔNG cộng đôi', async () => {
    const kh = await khachMoi('db');
    const syncId = duyNhat('sync').padEnd(20, 'x');
    const body = { syncId, taiKhoanId: kh.user.id, dong: [{ chiTietId: sp.bienTheId, soLuong: 2 }] };
    const r1 = await kh.post('/gio-hang/dong-bo', body);
    expect(r1.status).toBeLessThan(300);
    await kh.post('/gio-hang/dong-bo', body);
    await Promise.all([kh.post('/gio-hang/dong-bo', body), kh.post('/gio-hang/dong-bo', body)]);
    expect((await kh.get('/gio-hang/count')).body.count).toBe(2);
  });

  it('Đồng bộ giỏ khi taiKhoanDuKien khác người đang đăng nhập → 403', async () => {
    const kh = await khachMoi('db');
    const r = await kh.post('/gio-hang/dong-bo', {
      syncId: duyNhat('sync').padEnd(20, 'x'), taiKhoanId: '000000000000000000000000', dong: [{ chiTietId: sp.bienTheId, soLuong: 1 }],
    });
    expect(r.status).toBe(403);
  });

  it('Sản phẩm bị ẩn → không thêm vào giỏ được', async () => {
    const sp2 = await taoSanPhamKiemThu(admin, { ton: 3 });
    expect((await admin.post(`/admin/san-pham/${sp2.sanPhamId}/an`)).status).toBe(200);
    const kh = await khachMoi('gh');
    expect((await kh.post('/gio-hang', { chiTietId: sp2.bienTheId, quantity: 1 })).status).toBe(400);
  });
});
