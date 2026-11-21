import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, Client, duyNhat, khachMoi, luaChonForm, nhanVienClient, taoSanPhamKiemThu } from './_client';

/** CRUD sản phẩm + biến thể ở trang quản trị (form multipart như giao diện thật). */
describe('06. Quản trị – CRUD sản phẩm và biến thể', () => {
  let admin: Client;
  let lc: any;
  const form = (sua: Record<string, string> = {}) => {
    const fd = new FormData();
    const mac = {
      tenSanPham: `SP CRUD ${duyNhat()}`, giaGoc: '250000', loai: lc.loaiSanPhams[0].id, hang: lc.hangs[0].id,
      nhaCungCap: lc.nhaCungCaps[0].id, moTa: 'Mô tả kiểm thử', coSize: 'false', coMau: 'false', ...sua,
    };
    for (const [k, v] of Object.entries(mac)) if (v !== '__bo__') fd.set(k, v);
    return fd;
  };

  beforeAll(async () => {
    admin = await adminClient();
    lc = await luaChonForm(admin);
  });

  it('CREATE sản phẩm hợp lệ → 201, có id; READ chi tiết khớp dữ liệu', async () => {
    const ten = `SP CRUD ${duyNhat()}`;
    const r = await admin.goi('POST', '/admin/san-pham', form({ tenSanPham: ten }));
    expect(r.status).toBe(201);
    const ct = await admin.get(`/admin/san-pham/${r.body.id}`);
    expect(ct.status).toBe(200);
    expect(ct.body.sanPham.tenSanPham).toBe(ten);
    expect(ct.body.sanPham.giaGoc).toBe(250000);
    expect(ct.body.bienThes).toHaveLength(0);
  });

  it.each([
    ['thiếu tên', { tenSanPham: '' }],
    ['tên > 100 ký tự', { tenSanPham: 'x'.repeat(101) }],
    ['giá âm', { giaGoc: '-1' }],
    ['giá không phải số', { giaGoc: 'abc' }],
    ['loại không hợp lệ', { loai: 'abc' }],
    ['thiếu hãng', { hang: '__bo__' }],
  ])('CREATE sản phẩm %s → 400', async (_t, sua) => {
    expect((await admin.goi('POST', '/admin/san-pham', form(sua))).status).toBe(400);
  });

  it('Checkbox coSize/coMau nhận giá trị lạ → lưu thành false (không lỗi)', async () => {
    const r = await admin.goi('POST', '/admin/san-pham', form({ coSize: 'co', coMau: 'true' }));
    expect(r.status).toBe(201);
    const sp = (await admin.get(`/admin/san-pham/${r.body.id}`)).body.sanPham;
    expect(sp.coSize).toBe(false);
    expect(sp.coMau).toBe(true);
  });

  it('CREATE với loại / hãng là ObjectId hợp lệ nhưng không tồn tại → bị từ chối (4xx)', async () => {
    const r = await admin.goi('POST', '/admin/san-pham', form({ loai: '000000000000000000000000', hang: '000000000000000000000000' }));
    if (r.status === 201) await admin.del(`/admin/san-pham/${r.body.id}`); // dọn sản phẩm "mồ côi" vừa tạo nhầm
    expect(r.status, 'Đang tạo được sản phẩm trỏ tới loại/hãng không tồn tại').toBeGreaterThanOrEqual(400);
  });

  it('UPDATE sản phẩm: đổi tên + giá → đọc lại thấy giá trị mới', async () => {
    const tao = await admin.goi('POST', '/admin/san-pham', form());
    const r = await admin.goi('PUT', `/admin/san-pham/${tao.body.id}`, form({ tenSanPham: 'Tên đã sửa ' + duyNhat(), giaGoc: '300000' }));
    expect(r.status).toBe(200);
    const ct = (await admin.get(`/admin/san-pham/${tao.body.id}`)).body.sanPham;
    expect(ct.tenSanPham).toMatch(/^Tên đã sửa/);
    expect(ct.giaGoc).toBe(300000);
  });

  it('UPDATE sản phẩm không tồn tại → 404', async () => {
    expect((await admin.goi('PUT', '/admin/san-pham/000000000000000000000000', form())).status).toBe(404);
  });

  it('Upload ảnh không phải ảnh (file .txt) → bị từ chối', async () => {
    const fd = form();
    fd.set('HinhAnhUpload', new Blob(['xin chao'], { type: 'text/plain' }), 'virus.txt');
    const r = await admin.goi('POST', '/admin/san-pham', fd);
    expect(r.status).toBe(400);
  });

  it('Upload ảnh hợp lệ (PNG) → sản phẩm có đường dẫn ảnh mới, ảnh tải được', async () => {
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    const fd = form();
    fd.set('HinhAnhUpload', new Blob([png], { type: 'image/png' }), 'anh.png');
    const r = await admin.goi('POST', '/admin/san-pham', fd);
    expect(r.status).toBe(201);
    const sp = (await admin.get(`/admin/san-pham/${r.body.id}`)).body.sanPham;
    expect(sp.hinhAnhDaiDien).not.toBe('default-product.jpg');
    const base = (process.env.API_URL ?? 'http://localhost:4000/api').replace(/\/api$/, '');
    const anh = await fetch(`${base}/uploads/${sp.hinhAnhDaiDien.replace(/^\/?(uploads\/)?/, '')}`);
    expect(anh.status).toBe(200);
  });

  describe('Biến thể', () => {
    let sp: { sanPhamId: string; bienTheId: string; sku: string };
    beforeAll(async () => {
      sp = await taoSanPhamKiemThu(admin, { ton: 10 });
    });

    it('CREATE biến thể trùng SKU → 409', async () => {
      const fd = new FormData();
      fd.set('giaBan', '100000'); fd.set('soLuongTon', '1'); fd.set('sku', sp.sku);
      expect((await admin.goi('POST', `/admin/san-pham/${sp.sanPhamId}/bien-the`, fd)).status).toBe(409);
    });

    it.each([
      ['tồn kho âm', { soLuongTon: '-1' }],
      ['tồn kho thập phân', { soLuongTon: '1.5' }],
      ['giá bán âm', { giaBan: '-5' }],
      ['thiếu SKU', { sku: '' }],
    ])('CREATE biến thể %s → 400', async (_t, sua) => {
      const fd = new FormData();
      const d = { giaBan: '100000', soLuongTon: '1', sku: duyNhat('S-'), ...sua };
      for (const [k, v] of Object.entries(d)) fd.set(k, v);
      expect((await admin.goi('POST', `/admin/san-pham/${sp.sanPhamId}/bien-the`, fd)).status).toBe(400);
    });

    it('READ biến thể: GET /admin/bien-the/:id', async () => {
      const r = await admin.get(`/admin/bien-the/${sp.bienTheId}`);
      expect(r.status).toBe(200);
      expect(r.body.bienThe.sku).toBe(sp.sku);
    });

    it('UPDATE biến thể: đổi giá → ghi lịch sử giá; đổi tồn kho khi đúng số đã tải', async () => {
      const fd = new FormData();
      fd.set('giaBan', '123000'); fd.set('soLuongTon', '12'); fd.set('soLuongTonDaTai', '10'); fd.set('sku', sp.sku);
      expect((await admin.goi('PUT', `/admin/bien-the/${sp.bienTheId}`, fd)).status).toBe(200);
      const bt = (await admin.get(`/admin/bien-the/${sp.bienTheId}`)).body.bienThe;
      expect(bt.giaBan).toBe(123000);
      expect(bt.soLuongTon).toBe(12);
    });

    it('UPDATE biến thể với tồn kho đã cũ (có đơn vừa trừ kho) → 409, không ghi đè', async () => {
      const kh = await khachMoi('bt');
      await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
      await kh.post('/don-hang/checkout', { hoTenNhan: 'A', soDienThoaiNhan: '0901234567', diaChiGiao: 'HCM' });
      const fd = new FormData();
      fd.set('giaBan', '123000'); fd.set('soLuongTon', '50'); fd.set('soLuongTonDaTai', '12'); fd.set('sku', sp.sku);
      expect((await admin.goi('PUT', `/admin/bien-the/${sp.bienTheId}`, fd)).status).toBe(409);
      expect((await admin.get(`/admin/bien-the/${sp.bienTheId}`)).body.bienThe.soLuongTon).toBe(11);
    });

    it('UPDATE biến thể sang SKU đã dùng ở biến thể khác → 409', async () => {
      const khac = await taoSanPhamKiemThu(admin, { ton: 1 });
      const fd = new FormData();
      fd.set('giaBan', '1000'); fd.set('soLuongTon', '1'); fd.set('soLuongTonDaTai', '1'); fd.set('sku', sp.sku);
      expect((await admin.goi('PUT', `/admin/bien-the/${khac.bienTheId}`, fd)).status).toBe(409);
    });

    it('DELETE biến thể (admin) → 200; GET lại → 404', async () => {
      const x = await taoSanPhamKiemThu(admin, { ton: 1 });
      expect((await admin.del(`/admin/bien-the/${x.bienTheId}`)).status).toBe(200);
      expect((await admin.get(`/admin/bien-the/${x.bienTheId}`)).status).toBe(404);
    });

    it('Nhân viên không xóa được biến thể → 403', async () => {
      const nv = await nhanVienClient();
      expect((await nv.del(`/admin/bien-the/${sp.bienTheId}`)).status).toBe(403);
    });
  });

  it('ẨN sản phẩm: biến mất khỏi trang khách, dòng giỏ bị dọn; HIỆN lại: quay lại danh sách', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5 });
    const kh = await khachMoi('an');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    expect((await admin.post(`/admin/san-pham/${sp.sanPhamId}/an`)).status).toBe(200);
    expect((await new Client().get(`/san-pham/${sp.sanPhamId}`)).status).toBe(404);
    expect((await kh.get('/gio-hang/count')).body.count).toBe(0);
    const dsAn = await admin.get('/admin/san-pham?an=1');
    expect(dsAn.body.items.some((x: any) => x.id === sp.sanPhamId)).toBe(true);
    expect((await admin.post(`/admin/san-pham/${sp.sanPhamId}/hien`)).status).toBe(200);
    expect((await new Client().get(`/san-pham/${sp.sanPhamId}`)).status).toBe(200);
  });

  it('XÓA sản phẩm (admin, xóa mềm) → khách không thấy; đơn cũ vẫn giữ tên sản phẩm', async () => {
    const sp = await taoSanPhamKiemThu(admin, { ton: 5 });
    const kh = await khachMoi('xoa');
    await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
    const so = (await kh.post('/don-hang/checkout', { hoTenNhan: 'A', soDienThoaiNhan: '0901234567', diaChiGiao: 'HCM' })).body.soDonHang;
    expect((await admin.del(`/admin/san-pham/${sp.sanPhamId}`)).status).toBe(200);
    expect((await new Client().get(`/san-pham/${sp.sanPhamId}`)).status).toBe(404);
    const don = (await kh.get(`/don-hang/${so}`)).body;
    expect(don.chiTiet[0].tenSanPham).toMatch(/SP kiểm thử/);
  });

  it('Danh sách admin hiển thị giá sau khuyến mãi giống trang khách', async () => {
    const km = (await new Client().get('/san-pham/khuyen-mai')).body;
    const khach = (km.items ?? km.sanPhams ?? []).find((x: any) => x.dangGiamGia);
    expect(khach, 'cần ít nhất 1 sản phẩm đang giảm giá trong dữ liệu mẫu').toBeTruthy();
    const ad = (await admin.get(`/admin/san-pham?keyword=${encodeURIComponent(khach.tenSanPham)}`)).body.items.find((x: any) => x.id === khach.id);
    expect(ad.giaSauKhuyenMai, 'admin/san-pham không populate khuyenMai').toBe(khach.giaSauKhuyenMai);
  });

  it('Tìm kiếm + lọc trong danh sách admin', async () => {
    const r = await admin.get(`/admin/san-pham?keyword=yonex&maHang=${lc.hangs[0].id}&page=1`);
    expect(r.status).toBe(200);
    expect((await admin.get('/admin/san-pham?maHang=khong-hop-le')).status).toBe(400);
  });
});
