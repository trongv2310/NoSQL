import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, Client, khachMoi, taoSanPhamKiemThu, THONG_TIN_GIAO } from './_client';

async function tonKho(admin: Client, sanPhamId: string, bienTheId: string) {
  const ct = (await admin.get(`/admin/san-pham/${sanPhamId}`)).body;
  return ct.bienThes.find((b: any) => b.id === bienTheId).soLuongTon as number;
}

describe('05. Đơn hàng – đặt, xem, hủy, đổi trạng thái, MoMo', () => {
  let admin: Client;
  beforeAll(async () => {
    admin = await adminClient();
  });

  it('Giỏ rỗng → đặt hàng bị từ chối 400', async () => {
    const kh = await khachMoi('dh');
    expect((await kh.post('/don-hang/checkout', THONG_TIN_GIAO)).status).toBe(400);
  });

  it.each([
    ['thiếu họ tên', { hoTenNhan: '' }],
    ['họ tên toàn khoảng trắng', { hoTenNhan: '    ' }],
    ['SĐT sai', { soDienThoaiNhan: '123' }],
    ['thiếu địa chỉ', { diaChiGiao: '' }],
    ['ghi chú quá dài', { ghiChu: 'x'.repeat(401) }],
  ])('Đặt hàng %s → 400, tồn kho không đổi', async (_t, sua) => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5 });
    const kh = await khachMoi('dh');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    expect((await kh.post('/don-hang/checkout', { ...THONG_TIN_GIAO, ...sua })).status).toBe(400);
    expect(await tonKho(admin, sp.sanPhamId, sp.bienTheId)).toBe(5);
  });

  it('CREATE đơn COD: trừ kho, dọn giỏ, đơn có bản chụp giá, tổng tiền đúng', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5, gia: 200000 });
    const kh = await khachMoi('dh');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 2 });
    const r = await kh.post('/don-hang/checkout', THONG_TIN_GIAO);
    expect(r.status).toBe(201);
    const so = r.body.soDonHang;
    expect(so).toBeGreaterThan(0);
    expect(await tonKho(admin, sp.sanPhamId, sp.bienTheId)).toBe(3);
    expect((await kh.get('/gio-hang/count')).body.count).toBe(0);
    const don = (await kh.get(`/don-hang/${so}`)).body;
    expect(don.trangThai).toBe('Đang xử lý');
    expect(don.tongTien).toBe(400000);
    expect(don.chiTiet[0].sku).toBe(sp.sku);
    expect(don.chiTiet[0].donGia).toBe(200000);
    expect(don.chiTiet[0].thanhTien).toBe(400000);
  });

  it('READ: danh sách đơn của tôi chỉ chứa đơn của mình, mới nhất trước', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5 });
    const kh = await khachMoi('dh');
    for (let i = 0; i < 2; i++) {
      await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
      await kh.post('/don-hang/checkout', THONG_TIN_GIAO);
    }
    const ds = (await kh.get('/don-hang')).body;
    const items = Array.isArray(ds) ? ds : ds.items;
    expect(items).toHaveLength(2);
    expect(items[0].soDonHang).toBeGreaterThan(items[1].soDonHang);
  });

  it('Sửa giá sản phẩm sau khi đặt → đơn cũ giữ nguyên giá (bản chụp)', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5, gia: 100000 });
    const kh = await khachMoi('dh');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const so = (await kh.post('/don-hang/checkout', THONG_TIN_GIAO)).body.soDonHang;
    const fd = new FormData();
    fd.set('giaBan', '999000'); fd.set('soLuongTon', '4'); fd.set('soLuongTonDaTai', '4'); fd.set('sku', sp.sku);
    expect((await admin.goi('PUT', `/admin/bien-the/${sp.bienTheId}`, fd)).status).toBe(200);
    const don = (await kh.get(`/don-hang/${so}`)).body;
    expect(don.chiTiet[0].donGia).toBe(100000);
  });

  it('CHỐNG BÁN VƯỢT KHO: 6 khách cùng đặt món chỉ còn 2 → đúng 2 đơn thành công, tồn = 0', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 2 });
    const khs = await Promise.all(Array.from({ length: 6 }, () => khachMoi('ds')));
    for (const k of khs) await k.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    // Khách 3–6 thêm được vào giỏ vì lúc thêm kho còn 2; chỉ bước đặt mới trừ kho.
    const rs = await Promise.all(khs.map((k) => k.post('/don-hang/checkout', THONG_TIN_GIAO)));
    const ok = rs.filter((r) => r.status === 201);
    expect(ok.length).toBe(2);
    for (const r of rs.filter((x) => x.status !== 201)) expect(r.status).toBe(400);
    expect(await tonKho(admin, sp.sanPhamId, sp.bienTheId)).toBe(0);
  });

  it('ROLLBACK: dòng 2 hết hàng → dòng 1 không bị trừ, không tạo đơn', async () => {
    const a = await taoSanPhamKiemThu(admin, { ton: 10 });
    const b = await taoSanPhamKiemThu(admin, { ton: 2 });
    const kh = await khachMoi('rb');
    await kh.post('/gio-hang', { chiTietId: a.bienTheId, quantity: 3 });
    await kh.post('/gio-hang', { chiTietId: b.bienTheId, quantity: 2 });
    // Người khác mua mất 1 món B
    const khac = await khachMoi('rb2');
    await khac.post('/gio-hang', { chiTietId: b.bienTheId, quantity: 1 });
    expect((await khac.post('/don-hang/checkout', THONG_TIN_GIAO)).status).toBe(201);
    const truoc = (await kh.get('/don-hang')).body;
    const r = await kh.post('/don-hang/checkout', THONG_TIN_GIAO);
    expect(r.status).toBe(400);
    expect(await tonKho(admin, a.sanPhamId, a.bienTheId)).toBe(10);
    expect(await tonKho(admin, b.sanPhamId, b.bienTheId)).toBe(1);
    expect((await kh.get('/don-hang')).body).toHaveLength(Array.isArray(truoc) ? truoc.length : truoc.items.length);
    expect((await kh.get('/gio-hang/count')).body.count).toBe(5);
  });

  it('Khách tự hủy đơn "Đang xử lý" → hoàn kho; hủy lần 2 → 400, kho không cộng thêm', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5 });
    const kh = await khachMoi('huy');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 2 });
    const so = (await kh.post('/don-hang/checkout', THONG_TIN_GIAO)).body.soDonHang;
    expect(await tonKho(admin, sp.sanPhamId, sp.bienTheId)).toBe(3);
    expect((await kh.post(`/don-hang/${so}/huy`)).status).toBe(200);
    expect(await tonKho(admin, sp.sanPhamId, sp.bienTheId)).toBe(5);
    expect((await kh.post(`/don-hang/${so}/huy`)).status).toBe(400);
    expect(await tonKho(admin, sp.sanPhamId, sp.bienTheId)).toBe(5);
  });

  it('Hủy đồng thời 5 lần cùng một đơn → kho chỉ hoàn đúng 1 lần', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5 });
    const kh = await khachMoi('huy');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 2 });
    const so = (await kh.post('/don-hang/checkout', THONG_TIN_GIAO)).body.soDonHang;
    const rs = await Promise.all([
      ...Array.from({ length: 3 }, () => kh.post(`/don-hang/${so}/huy`)),
      ...Array.from({ length: 2 }, () => admin.post(`/admin/don-hang/${so}/trang-thai`, { trangThaiMoi: 'Đã hủy' })),
    ]);
    expect(rs.filter((r) => r.status < 300).length).toBe(1);
    expect(await tonKho(admin, sp.sanPhamId, sp.bienTheId)).toBe(5);
  });

  it('Khách không hủy được đơn của người khác', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5 });
    const a = await khachMoi('ha');
    const b = await khachMoi('hb');
    await a.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const so = (await a.post('/don-hang/checkout', THONG_TIN_GIAO)).body.soDonHang;
    expect((await b.post(`/don-hang/${so}/huy`)).status).toBeGreaterThanOrEqual(400);
    expect((await a.get(`/don-hang/${so}`)).body.trangThai).toBe('Đang xử lý');
  });

  it('Admin đổi trạng thái theo luồng hợp lệ: Đang xử lý → Đang giao → Đã hoàn thành', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5, tenLoai: 'Vợt cầu lông' });
    const kh = await khachMoi('tt');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const so = (await kh.post('/don-hang/checkout', THONG_TIN_GIAO)).body.soDonHang;
    expect((await admin.post(`/admin/don-hang/${so}/trang-thai`, { trangThaiMoi: 'Đang giao hàng' })).status).toBeLessThan(300);
    expect((await admin.post(`/admin/don-hang/${so}/trang-thai`, { trangThaiMoi: 'Đã hoàn thành' })).status).toBeLessThan(300);
    expect((await kh.get(`/don-hang/${so}`)).body.trangThai).toBe('Đã hoàn thành');
    // Đơn có vợt hoàn thành → tự tạo hộ chiếu vợt trong tủ của khách
    const tu = (await kh.get('/tu-vot')).body.vot;
    expect(tu.length).toBe(1);
  });

  it.each([
    ['Đang xử lý → Đã hoàn thành (bỏ qua bước giao)', ['Đã hoàn thành']],
    ['Đã hoàn thành → Đang xử lý (đi lùi)', ['Đang giao hàng', 'Đã hoàn thành', 'Đang xử lý']],
    ['Đã hủy → Đang giao hàng', ['Đã hủy', 'Đang giao hàng']],
    ['trạng thái không tồn tại', ['Lung tung']],
  ])('Admin chuyển trạng thái sai: %s → 400', async (_t, chuoi) => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5 });
    const kh = await khachMoi('tt');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const so = (await kh.post('/don-hang/checkout', THONG_TIN_GIAO)).body.soDonHang;
    let cuoi: any;
    for (const t of chuoi) cuoi = await admin.post(`/admin/don-hang/${so}/trang-thai`, { trangThaiMoi: t });
    expect(cuoi.status).toBe(400);
  });

  it('Khách không tự hủy được đơn "Đang giao hàng"', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5 });
    const kh = await khachMoi('tt');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const so = (await kh.post('/don-hang/checkout', THONG_TIN_GIAO)).body.soDonHang;
    await admin.post(`/admin/don-hang/${so}/trang-thai`, { trangThaiMoi: 'Đang giao hàng' });
    expect((await kh.post(`/don-hang/${so}/huy`)).status).toBe(400);
  });

  it('Số đơn tăng liên tục, không trùng (10 đơn song song)', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 20 });
    const khs = await Promise.all(Array.from({ length: 10 }, () => khachMoi('so')));
    for (const k of khs) await k.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const rs = await Promise.all(khs.map((k) => k.post('/don-hang/checkout', THONG_TIN_GIAO)));
    const so = rs.map((r) => r.body.soDonHang).sort((a, b) => a - b);
    expect(new Set(so).size).toBe(10);
    expect(so[9] - so[0]).toBe(9);
  });

  describe('Thanh toán MoMo (chế độ giả lập MOMO_MOCK=true)', () => {
    async function donMomo(ton = 5, sl = 2) {
      const sp = await taoSanPhamKiemThu(admin, { ton });
      const kh = await khachMoi('mm');
      await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: sl });
      const r = await kh.post('/don-hang/momo', THONG_TIN_GIAO);
      return { sp, kh, r, so: r.body.soDonHang as number };
    }

    it('Tạo đơn MoMo: trạng thái "Chờ thanh toán MoMo", kho đã trừ, giỏ CHƯA dọn, có payUrl', async () => {
      const { sp, kh, r, so } = await donMomo();
      expect(r.status).toBe(201);
      expect(r.body.payUrl).toBeTruthy();
      expect((await kh.get(`/don-hang/${so}`)).body.trangThai).toBe('Chờ thanh toán MoMo');
      expect(await tonKho(admin, sp.sanPhamId, sp.bienTheId)).toBe(3);
      expect((await kh.get('/gio-hang/count')).body.count).toBe(2);
    });

    it('Thanh toán thành công (chữ ký hợp lệ) → "Đã thanh toán bằng MoMo", giỏ được dọn', async () => {
      const { kh, so } = await donMomo();
      const kq = await kh.post('/don-hang/momo/mock/xu-ly', { orderId: so, action: 'success' });
      expect(kq.status).toBe(200);
      const qs = new URLSearchParams(kq.body).toString();
      const r = await kh.get(`/don-hang/momo/ket-qua?${qs}`);
      expect(r.body.isSuccess).toBe(true);
      expect((await kh.get(`/don-hang/${so}`)).body.trangThai).toBe('Đã thanh toán bằng MoMo');
      expect((await kh.get('/gio-hang/count')).body.count).toBe(0);
    });

    it('Thanh toán thất bại → "Đã hủy (Thanh toán thất bại)", hoàn kho, giỏ còn nguyên', async () => {
      const { sp, kh, so } = await donMomo();
      const kq = await kh.post('/don-hang/momo/mock/xu-ly', { orderId: so, action: 'cancel' });
      await kh.get(`/don-hang/momo/ket-qua?${new URLSearchParams(kq.body).toString()}`);
      expect((await kh.get(`/don-hang/${so}`)).body.trangThai).toBe('Đã hủy (Thanh toán thất bại)');
      expect(await tonKho(admin, sp.sanPhamId, sp.bienTheId)).toBe(5);
      expect((await kh.get('/gio-hang/count')).body.count).toBe(2);
    });

    it('Giả mạo kết quả (sửa amount / resultCode) → bị từ chối vì sai chữ ký, đơn không đổi', async () => {
      const { kh, so } = await donMomo();
      const kq = await kh.post('/don-hang/momo/mock/xu-ly', { orderId: so, action: 'cancel' });
      const gia = { ...kq.body, resultCode: '0' };
      const r = await kh.get(`/don-hang/momo/ket-qua?${new URLSearchParams(gia).toString()}`);
      expect(r.body.isSuccess).toBe(false);
      expect((await kh.get(`/don-hang/${so}`)).body.trangThai).toBe('Chờ thanh toán MoMo');
    });

    it('IPN gọi lặp lại / gọi song song với trang kết quả → chỉ xử lý 1 lần, kho không hoàn đôi', async () => {
      const { sp, kh, so } = await donMomo();
      const kq = await kh.post('/don-hang/momo/mock/xu-ly', { orderId: so, action: 'cancel' });
      const qs = new URLSearchParams(kq.body).toString();
      const ipn = new Client();
      await Promise.all([kh.get(`/don-hang/momo/ket-qua?${qs}`), ipn.post('/don-hang/momo/ipn', kq.body), ipn.post('/don-hang/momo/ipn', kq.body)]);
      expect(await tonKho(admin, sp.sanPhamId, sp.bienTheId)).toBe(5);
    });

    it('Người khác không mở / xử lý được cổng giả lập của đơn không phải của mình → 403', async () => {
      const { so } = await donMomo();
      const khac = await khachMoi('mmk');
      expect((await khac.post('/don-hang/momo/mock/xu-ly', { orderId: so, action: 'success' })).status).toBe(403);
    });
  });
});
