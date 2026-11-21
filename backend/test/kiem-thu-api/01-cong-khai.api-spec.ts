import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from './_client';

/** Các API công khai (không cần đăng nhập): đọc sản phẩm, bản tin, cấu hình site, combo, chatbot. */
describe('01. API công khai – đọc dữ liệu', () => {
  const c = new Client();
  let mot: any;

  beforeAll(async () => {
    const r = await c.get('/san-pham?page=1');
    mot = r.body.items[0];
  });

  it('GET /site trả tên site và logo', async () => {
    const r = await c.get('/site');
    expect(r.status).toBe(200);
    expect(r.body.tenSite).toBeTruthy();
    expect(r.body.logo).toBeTruthy();
  });

  it('GET /san-pham trả danh sách có phân trang', async () => {
    const r = await c.get('/san-pham?page=1');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.items)).toBe(true);
    expect(r.body.items.length).toBeGreaterThan(0);
    expect(r.body.total).toBeGreaterThanOrEqual(r.body.items.length);
    expect(r.body.page).toBe(1);
    for (const sp of r.body.items) {
      expect(sp.id).toMatch(/^[a-f0-9]{24}$/);
      expect(sp.giaSauKhuyenMai).toBeLessThanOrEqual(sp.giaGoc);
    }
  });

  it('GET /san-pham trang 2 không trùng trang 1', async () => {
    const [p1, p2] = await Promise.all([c.get('/san-pham?page=1'), c.get('/san-pham?page=2')]);
    if (p1.body.pages < 2) return;
    const ids1 = new Set(p1.body.items.map((x: any) => x.id));
    for (const x of p2.body.items) expect(ids1.has(x.id)).toBe(false);
  });

  it('GET /san-pham?page=9999 không lỗi, trả danh sách rỗng hoặc trang cuối', async () => {
    const r = await c.get('/san-pham?page=9999');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.items)).toBe(true);
  });

  it('GET /san-pham?page=abc (tham số rác) không gây lỗi 500', async () => {
    const r = await c.get('/san-pham?page=abc&sort=xyz&minPrice=-5&maxPrice=abc');
    expect(r.status).toBeLessThan(500);
  });

  it('Tìm kiếm không dấu "vot yonex" ra sản phẩm Yonex', async () => {
    const r = await c.get('/san-pham?keyword=' + encodeURIComponent('vot yonex'));
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBeGreaterThan(0);
    expect(r.body.items.some((x: any) => /yonex/i.test(x.tenSanPham))).toBe(true);
  });

  it('Tìm kiếm sai chính tả nhẹ "yonnex" vẫn ra kết quả', async () => {
    const r = await c.get('/san-pham?keyword=yonnex');
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBeGreaterThan(0);
  });

  it('Tìm kiếm ký tự đặc biệt regex không gây lỗi 500', async () => {
    for (const k of ['(', '[', '*', '\\', '$where', '{"$gt":""}']) {
      const r = await c.get('/san-pham?keyword=' + encodeURIComponent(k));
      expect(r.status, `keyword ${k}`).toBeLessThan(500);
    }
  });

  it('GET /san-pham/:id trả chi tiết + biến thể', async () => {
    const r = await c.get(`/san-pham/${mot.id}`);
    expect(r.status).toBe(200);
    expect(r.body.sanPham.id).toBe(mot.id);
    expect(Array.isArray(r.body.bienThes)).toBe(true);
  });

  it('GET /san-pham/:id với id sai định dạng → 400, id không tồn tại → 404', async () => {
    expect((await c.get('/san-pham/khong-hop-le')).status).toBe(400);
    expect((await c.get('/san-pham/000000000000000000000000')).status).toBe(404);
  });

  it('GET /san-pham/trang-chu, /cua-hang, /khuyen-mai, /goi-y trả 200', async () => {
    for (const p of ['/san-pham/trang-chu', '/san-pham/cua-hang', '/san-pham/khuyen-mai', '/san-pham/goi-y']) {
      const r = await c.get(p);
      expect(r.status, p).toBe(200);
    }
  });

  it('Trang khuyến mãi chỉ chứa sản phẩm đang giảm giá', async () => {
    const r = await c.get('/san-pham/khuyen-mai');
    const items = r.body.items ?? r.body.sanPhams ?? [];
    for (const x of items) expect(x.giaSauKhuyenMai, x.tenSanPham).toBeLessThan(x.giaGoc);
  });

  it('POST /san-pham/:id/luot-xem ghi nhận lượt xem', async () => {
    const r = await c.post(`/san-pham/${mot.id}/luot-xem`);
    expect([200, 201, 204]).toContain(r.status);
  });

  it('GET /landing và /ban-tin trả dữ liệu', async () => {
    expect((await c.get('/landing')).status).toBe(200);
    const bt = await c.get('/ban-tin');
    expect(bt.status).toBe(200);
    const ds = bt.body.items ?? bt.body.tinTucs ?? [];
    expect(ds.length).toBeGreaterThan(0);
    const ct = await c.get(`/ban-tin/${ds[0].id}`);
    expect(ct.status).toBe(200);
  });

  it('GET /ban-tin/:id không tồn tại → 404', async () => {
    expect((await c.get('/ban-tin/000000000000000000000000')).status).toBe(404);
  });

  it('GET /goi-y/combo và /goi-y/san-pham/:id trả 200', async () => {
    expect((await c.get('/goi-y/combo')).status).toBe(200);
    expect((await c.get(`/goi-y/san-pham/${mot.id}`)).status).toBe(200);
  });

  it('POST /chatbot/ask trả lời câu hỏi tư vấn', async () => {
    const r = await c.post('/chatbot/ask', { message: 'tư vấn vợt dưới 2 triệu cho người mới' });
    expect([200, 201]).toContain(r.status);
    expect(typeof r.body.reply).toBe('string');
    expect(r.body.reply.length).toBeGreaterThan(0);
  });

  it('POST /chatbot/ask với tin nhắn rỗng / quá dài trả success=false kèm lời nhắc', async () => {
    const rong = await c.post('/chatbot/ask', { message: '   ' });
    expect(rong.body.success).toBe(false);
    const dai = await c.post('/chatbot/ask', { message: 'a'.repeat(600) });
    expect(dai.body.success).toBe(false);
  });
});
