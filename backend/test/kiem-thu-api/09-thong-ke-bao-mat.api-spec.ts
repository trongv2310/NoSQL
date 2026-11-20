import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, API, Client, khachMoi, taoSanPhamKiemThu, THONG_TIN_GIAO } from './_client';

describe('09. Thống kê, khai thác combo, thông báo realtime, bảo mật cơ bản', () => {
  let admin: Client;
  beforeAll(async () => {
    admin = await adminClient();
  });

  it('Dashboard: doanh thu năm = tổng 4 quý; đơn hủy / chờ MoMo không tính', async () => {
    const d = (await admin.get('/admin/dashboard')).body;
    const tongQuy = d.doanhThuQuy.reduce((s: number, q: any) => s + q.tongDoanhThu, 0);
    expect(tongQuy).toBe(d.tongDoanhThuNam);
    const sp = await taoSanPhamKiemThu(admin, { ton: 5, gia: 777000 });
    const kh = await khachMoi('ds');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const so = (await kh.post('/don-hang/checkout', THONG_TIN_GIAO)).body.soDonHang;
    const sau = (await admin.get('/admin/dashboard')).body;
    expect(sau.tongDoanhThuNam - d.tongDoanhThuNam).toBe(777000);
    await kh.post(`/don-hang/${so}/huy`);
    expect((await admin.get('/admin/dashboard')).body.tongDoanhThuNam).toBe(d.tongDoanhThuNam);
  });

  it('Dashboard theo năm khác / năm rác không lỗi 500', async () => {
    expect((await admin.get('/admin/dashboard?nam=2020')).status).toBe(200);
    expect((await admin.get('/admin/dashboard?nam=abc')).status).toBeLessThan(500);
  });

  it('Báo cáo CSDL (7 aggregation) trả đủ các khối', async () => {
    const r = await admin.get('/admin/bao-cao-csdl');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).length).toBeGreaterThanOrEqual(5);
  });

  it('Khai thác Top-K: k hợp lệ → 200; k ngoài 1–50 → 400; lưu → khách thấy combo', async () => {
    expect((await admin.post('/admin/khai-thac/top-k', { k: 0, soThang: 3, luuGoiY: false })).status).toBe(400);
    expect((await admin.post('/admin/khai-thac/top-k', { k: 51, soThang: 3, luuGoiY: false })).status).toBe(400);
    expect((await admin.post('/admin/khai-thac/top-k', { k: 5, soThang: 13, luuGoiY: false })).status).toBe(400);
    const r = await admin.post('/admin/khai-thac/top-k', { k: 5, soThang: 12, luuGoiY: true });
    expect(r.status).toBeLessThan(300);
    expect((await admin.get('/admin/khai-thac/goi-y-da-luu')).status).toBe(200);
    expect((await new Client().get('/goi-y/combo')).status).toBe(200);
  });

  it('Trạng thái change stream: replica set → hoTro = true', async () => {
    const r = (await admin.get('/admin/su-kien/trang-thai')).body;
    expect(r.hoTro, `MongoDB chưa chạy replica set: ${r.lyDo}`).toBe(true);
  });

  it('Thông báo realtime (SSE): đặt hàng → admin nhận sự kiện "don-moi" của đúng đơn đó trong 5 giây', async () => {
    const ctrl = new AbortController();
    const res = await fetch(`${API}/admin/su-kien`, { headers: { cookie: admin.cookieHeader, accept: 'text/event-stream' }, signal: ctrl.signal });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    let buf = '';
    const doc = (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += new TextDecoder().decode(value);
        }
      } catch { /* bị huỷ */ }
    })();
    await new Promise((r) => setTimeout(r, 300));
    const sp = await taoSanPhamKiemThu(admin, { ton: 5 });
    const kh = await khachMoi('sse');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const so = (await kh.post('/don-hang/checkout', THONG_TIN_GIAO)).body.soDonHang;
    const het = Date.now() + 5000;
    while (Date.now() < het && !buf.includes(`"soDonHang":${so}`)) await new Promise((r) => setTimeout(r, 100));
    ctrl.abort();
    await doc;
    expect(buf).toContain(`"soDonHang":${so}`);
  });

  describe('Bảo mật cơ bản', () => {
    it('NoSQL injection ở đăng nhập ({"$gt": ""}) → không đăng nhập được', async () => {
      const r = await new Client().post('/auth/dang-nhap', { tenDangNhap: { $gt: '' }, matKhau: { $gt: '' } });
      expect([400, 401]).toContain(r.status);
    });

    it('Trường lạ trong body bị bỏ qua (whitelist): không tự tăng quyền / sửa giá qua giỏ hàng', async () => {
      const kh = await khachMoi('inj');
      const r = await kh.put('/auth/ho-so-choi', { trinhDo: 'moi', maQuyen: 1, $set: { maQuyen: 1 } });
      expect(r.status).toBe(200);
      expect((await kh.get('/auth/me')).body.user.maQuyen).toBe(3);
    });

    it('CORS chỉ cho phép origin của frontend', async () => {
      const ok = await fetch(`${API}/site`, { headers: { origin: 'http://localhost:3000' } });
      expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
      const la = await fetch(`${API}/site`, { headers: { origin: 'http://evil.example' } });
      expect(la.headers.get('access-control-allow-origin')).not.toBe('http://evil.example');
    });

    it('Lỗi server không lộ stack trace', async () => {
      const r = await new Client().get('/san-pham/' + 'f'.repeat(24));
      expect(JSON.stringify(r.body)).not.toMatch(/at .*\.js:\d+|node_modules/);
    });

    it('Body JSON quá lớn (> 1 MB) bị từ chối, server không treo', async () => {
      const r = await new Client().post('/chatbot/ask', { message: 'x'.repeat(2_000_000) });
      expect(r.status).toBe(413);
      expect((await new Client().get('/site')).status).toBe(200);
    });

    it('Header bảo mật cơ bản (X-Content-Type-Options, không lộ X-Powered-By)', async () => {
      const r = await fetch(`${API}/site`);
      expect(r.headers.get('x-powered-by'), 'Server lộ "X-Powered-By: Express"').toBeNull();
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    });
  });
});
