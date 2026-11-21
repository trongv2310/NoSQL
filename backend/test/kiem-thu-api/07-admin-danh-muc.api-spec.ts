import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, Client, duyNhat, nhanVienClient, sdt, taoSanPhamKiemThu } from './_client';

const ngay = (soNgay: number) => new Date(Date.now() + soNgay * 86_400_000).toISOString().slice(0, 10);

describe('07. Quản trị – CRUD khuyến mãi, trận đấu, tài khoản, bản tin, logo', () => {
  let admin: Client;
  beforeAll(async () => {
    admin = await adminClient();
  });

  describe('Khuyến mãi', () => {
    const km = (sua: Record<string, unknown> = {}) => ({
      tenChuongTrinh: `KM kiểm thử ${duyNhat()}`, moTa: 'kiểm thử', phanTramGiam: 20, giamToiDa: 50000, soLuongSuDung: 10,
      ngayBatDau: ngay(-1), ngayKetThuc: ngay(30), ...sua,
    });
    const timTheoTen = async (ten: string) => (await admin.get(`/admin/khuyen-mai?keyword=${encodeURIComponent(ten)}`)).body.items.find((x: any) => x.tenChuongTrinh === ten);

    it('CREATE → READ (danh sách + chi tiết) → UPDATE → DELETE', async () => {
      const d = km();
      expect((await admin.post('/admin/khuyen-mai', d)).status).toBe(201);
      const tao = await timTheoTen(d.tenChuongTrinh);
      expect(tao).toBeTruthy();
      expect((await admin.get(`/admin/khuyen-mai/${tao.id}`)).body.phanTramGiam).toBe(20);
      expect((await admin.put(`/admin/khuyen-mai/${tao.id}`, { ...d, phanTramGiam: 35 })).status).toBe(200);
      expect((await admin.get(`/admin/khuyen-mai/${tao.id}`)).body.phanTramGiam).toBe(35);
      expect((await admin.del(`/admin/khuyen-mai/${tao.id}`)).status).toBe(200);
      expect((await admin.get(`/admin/khuyen-mai/${tao.id}`)).status).toBe(404);
    });

    it.each([
      ['phần trăm > 100', { phanTramGiam: 150 }],
      ['phần trăm âm', { phanTramGiam: -5 }],
      ['ngày kết thúc trước ngày bắt đầu', { ngayBatDau: ngay(10), ngayKetThuc: ngay(1) }],
      ['ngày sai định dạng', { ngayBatDau: '31/12/2026' }],
      ['thiếu tên', { tenChuongTrinh: '' }],
    ])('CREATE khuyến mãi %s → 400', async (_t, sua) => {
      expect((await admin.post('/admin/khuyen-mai', km(sua))).status).toBe(400);
    });

    it('Gán khuyến mãi cho sản phẩm → giá khách thấy giảm đúng (có trần giảm tối đa)', async () => {
      const d = km({ phanTramGiam: 50, giamToiDa: 30000 });
      await admin.post('/admin/khuyen-mai', d);
      const k = await timTheoTen(d.tenChuongTrinh);
      const sp = await taoSanPhamKiemThu(admin, { ton: 3, gia: 200000 });
      const lc = (await admin.get('/admin/form-san-pham')).body;
      const fd = new FormData();
      const cu = (await admin.get(`/admin/san-pham/${sp.sanPhamId}`)).body.sanPham;
      fd.set('tenSanPham', cu.tenSanPham); fd.set('giaGoc', '200000'); fd.set('loai', cu.loai.id); fd.set('hang', cu.hang.id);
      fd.set('nhaCungCap', cu.nhaCungCap?.id ?? lc.nhaCungCaps[0].id); fd.set('coSize', 'false'); fd.set('coMau', 'false'); fd.set('khuyenMai', k.id);
      expect((await admin.goi('PUT', `/admin/san-pham/${sp.sanPhamId}`, fd)).status).toBe(200);
      const pub = (await new Client().get(`/san-pham/${sp.sanPhamId}`)).body;
      // 50% của 200.000 = 100.000 nhưng trần 30.000 → còn 170.000
      expect(pub.bienThes[0].giaThucTe).toBe(170000);
      // Xóa khuyến mãi → sản phẩm về giá gốc
      await admin.del(`/admin/khuyen-mai/${k.id}`);
      expect((await new Client().get(`/san-pham/${sp.sanPhamId}`)).body.bienThes[0].giaThucTe).toBe(200000);
    });

    it('Khuyến mãi đã hết hạn không còn giảm giá', async () => {
      const d = km({ ngayBatDau: ngay(-30), ngayKetThuc: ngay(-1), phanTramGiam: 40 });
      await admin.post('/admin/khuyen-mai', d);
      const k = await timTheoTen(d.tenChuongTrinh);
      const sp = await taoSanPhamKiemThu(admin, { ton: 3, gia: 100000 });
      const cu = (await admin.get(`/admin/san-pham/${sp.sanPhamId}`)).body.sanPham;
      const fd = new FormData();
      fd.set('tenSanPham', cu.tenSanPham); fd.set('giaGoc', '100000'); fd.set('loai', cu.loai.id); fd.set('hang', cu.hang.id);
      fd.set('nhaCungCap', cu.nhaCungCap.id); fd.set('coSize', 'false'); fd.set('coMau', 'false'); fd.set('khuyenMai', k.id);
      await admin.goi('PUT', `/admin/san-pham/${sp.sanPhamId}`, fd);
      expect((await new Client().get(`/san-pham/${sp.sanPhamId}`)).body.bienThes[0].giaThucTe).toBe(100000);
      await admin.del(`/admin/khuyen-mai/${k.id}`);
    });
  });

  describe('Trận đấu', () => {
    const td = (sua: Record<string, unknown> = {}) => ({
      tenGiaiDau: `Giải kiểm thử ${duyNhat()}`, vong: 'Chung kết', noiDung: 'Đơn nam', doiA: 'VĐV A', doiB: 'VĐV B',
      tiSo: '21-15, 21-18', doiThang: 'A', ngayThiDau: ngay(-2), diaDiem: 'TP.HCM', ...sua,
    });

    it('CREATE → READ → UPDATE → ẨN/HIỆN → DELETE', async () => {
      const d = td();
      expect((await admin.post('/admin/tran-dau', d)).status).toBe(201);
      const t = (await admin.get(`/admin/tran-dau?keyword=${encodeURIComponent(d.tenGiaiDau)}`)).body.items.find((x: any) => x.tenGiaiDau === d.tenGiaiDau);
      expect(t).toBeTruthy();
      expect((await admin.get(`/admin/tran-dau/${t.id}`)).body.tiSo).toBe('21-15, 21-18');
      expect((await admin.put(`/admin/tran-dau/${t.id}`, { ...d, doiThang: 'B', tiSo: '15-21, 18-21' })).status).toBe(200);
      expect((await admin.get(`/admin/tran-dau/${t.id}`)).body.doiThang).toBe('B');
      expect((await admin.post(`/admin/tran-dau/${t.id}/toggle-status`, { value: false })).status).toBeLessThan(300);
      expect((await admin.del(`/admin/tran-dau/${t.id}`)).status).toBe(200);
      expect((await admin.get(`/admin/tran-dau/${t.id}`)).status).toBe(404);
    });

    it.each([
      ['tỉ số sai định dạng', { tiSo: '21:15' }],
      ['quá 3 ván', { tiSo: '21-1, 21-2, 21-3, 21-4' }],
      ['đội thắng không phải A/B', { doiThang: 'C' }],
      ['hai đội trùng nhau', { doiA: 'Cùng tên', doiB: 'Cùng tên' }],
      ['liên kết nguồn không phải URL', { lienKetNguon: 'javascript:alert(1)' }],
    ])('CREATE trận đấu %s → 400', async (_t, sua) => {
      expect((await admin.post('/admin/tran-dau', td(sua))).status).toBe(400);
    });

    it('Đội thắng phải khớp tỉ số (A thắng nhưng tỉ số B thắng) → nên bị từ chối', async () => {
      const r = await admin.post('/admin/tran-dau', td({ doiThang: 'A', tiSo: '10-21, 12-21' }));
      if (r.status === 201) {
        const t = (await admin.get('/admin/tran-dau?keyword=' + encodeURIComponent('Giải kiểm thử'))).body.items[0];
        if (t) await admin.del(`/admin/tran-dau/${t.id}`);
      }
      expect(r.status, 'Tạo được trận "A thắng" với tỉ số B thắng cả 2 ván').toBe(400);
    });
  });

  describe('Tài khoản', () => {
    const tk = (sua: Record<string, unknown> = {}) => {
      const t = duyNhat('nv');
      return { tenDangNhap: t, matKhau: 'matkhau1', email: `${t}@kiemthu.local`, maQuyen: 2, hoTen: 'Nhân viên kiểm thử', soDienThoai: sdt(), diaChi: 'HCM', ...sua };
    };
    const tim = async (ten: string) => (await admin.get(`/admin/tai-khoan?keyword=${ten}`)).body.items.find((x: any) => x.tenDangNhap === ten);

    it('CREATE nhân viên → đăng nhập được ở cổng quản trị → UPDATE → DELETE', async () => {
      const d = tk();
      expect((await admin.post('/admin/tai-khoan', d)).status).toBe(201);
      const nv = new Client();
      await nv.dangNhap(d.tenDangNhap, d.matKhau, true);
      const t = await tim(d.tenDangNhap);
      expect(t.maQuyen).toBe(2);
      expect((await admin.put(`/admin/tai-khoan/${t.id}`, { ...d, tenDangNhap: undefined, matKhau: '', hoTen: 'Đã đổi tên' })).status).toBe(200);
      expect((await admin.get(`/admin/tai-khoan/${t.id}`)).body.hoTen).toBe('Đã đổi tên');
      expect((await admin.del(`/admin/tai-khoan/${t.id}`)).status).toBe(200);
      expect((await nv.get('/admin/don-hang')).status).toBe(401);
    });

    it('Không tạo được tài khoản quản trị mới → 400', async () => {
      expect((await admin.post('/admin/tai-khoan', tk({ maQuyen: 1 }))).status).toBe(400);
    });

    it('Trùng tên đăng nhập / email → 409', async () => {
      const d = tk();
      await admin.post('/admin/tai-khoan', d);
      expect((await admin.post('/admin/tai-khoan', { ...tk(), tenDangNhap: d.tenDangNhap })).status).toBe(409);
      expect((await admin.post('/admin/tai-khoan', { ...tk(), email: d.email })).status).toBe(409);
    });

    it.each([
      ['email sai', { email: 'abc' }],
      ['mật khẩu ngắn', { matKhau: '123' }],
      ['tên đăng nhập có dấu cách', { tenDangNhap: 'a b c' }],
      ['quyền không hợp lệ', { maQuyen: 9 }],
    ])('CREATE tài khoản %s → 400', async (_t, sua) => {
      expect((await admin.post('/admin/tai-khoan', tk(sua))).status).toBe(400);
    });

    it('Không xóa được chính mình và tài khoản quản trị', async () => {
      const ds = (await admin.get('/admin/tai-khoan?keyword=admin')).body.items;
      const toi = ds.find((x: any) => x.tenDangNhap === 'admin');
      expect((await admin.del(`/admin/tai-khoan/${toi.id}`)).status).toBe(403);
    });

    it('Không đổi được tên đăng nhập / vai trò khi cập nhật', async () => {
      const d = tk();
      await admin.post('/admin/tai-khoan', d);
      const t = await tim(d.tenDangNhap);
      expect((await admin.put(`/admin/tai-khoan/${t.id}`, { ...d, tenDangNhap: d.tenDangNhap + 'x' })).status).toBe(400);
      expect((await admin.put(`/admin/tai-khoan/${t.id}`, { ...d, tenDangNhap: undefined, maQuyen: 3 })).status).toBe(400);
    });
  });

  describe('Bản tin', () => {
    const tin = (sua: Record<string, unknown> = {}) => ({
      tieuDe: `Tin kiểm thử ${duyNhat()}`, tomTat: 'Tóm tắt', noiDung: '<p>Nội dung bản tin kiểm thử đủ dài hơn hai mươi ký tự.</p>',
      loaiTin: 'tin-tuc', noiBat: false, hienThi: true, ...sua,
    });
    let loaiTin = 'tin-tuc';
    beforeAll(async () => {
      const f = (await admin.get('/admin/ban-tin/form')).body;
      const l = f.loaiTins ?? f.loaiTin ?? f.LOAI_TIN;
      loaiTin = Array.isArray(l) ? (l[0].khoa ?? l[0].id ?? l[0].value ?? l[0]) : Object.keys(l ?? { 'tin-tuc': 1 })[0];
    });

    it('CREATE → READ (admin + công khai) → UPDATE → ẨN → DELETE', async () => {
      const d = tin({ loaiTin });
      const tao = await admin.post('/admin/ban-tin', d);
      expect(tao.status, JSON.stringify(tao.body)).toBe(201);
      const t = (await admin.get(`/admin/ban-tin?keyword=${encodeURIComponent(d.tieuDe)}`)).body.items.find((x: any) => x.tieuDe === d.tieuDe);
      expect(t).toBeTruthy();
      expect((await new Client().get(`/ban-tin/${t.id}`)).status).toBe(200);
      expect((await admin.put(`/admin/ban-tin/${t.id}`, { ...d, tieuDe: d.tieuDe + ' (sửa)' })).status).toBe(200);
      expect((await admin.post(`/admin/ban-tin/${t.id}/toggle-status`, { field: 'hienThi', value: false })).status).toBeLessThan(300);
      expect((await new Client().get(`/ban-tin/${t.id}`)).status, 'tin đã ẩn vẫn xem được ở trang khách').toBe(404);
      expect((await admin.del(`/admin/ban-tin/${t.id}`)).status).toBe(200);
    });

    it('Nội dung chứa <script> / onerror bị làm sạch khi lưu', async () => {
      const d = tin({ loaiTin, noiDung: '<p>Nội dung an toàn đủ dài để qua kiểm tra</p><script>alert(1)</script><img src=x onerror="alert(2)">' });
      await admin.post('/admin/ban-tin', d);
      const t = (await admin.get(`/admin/ban-tin?keyword=${encodeURIComponent(d.tieuDe)}`)).body.items.find((x: any) => x.tieuDe === d.tieuDe);
      const pub = (await new Client().get(`/ban-tin/${t.id}`)).body;
      const html = JSON.stringify(pub);
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/onerror/i);
      await admin.del(`/admin/ban-tin/${t.id}`);
    });

    it.each([
      ['nội dung < 20 ký tự', { noiDung: 'ngắn' }],
      ['loại tin sai', { loaiTin: 'khong-co' }],
      ['thiếu tiêu đề', { tieuDe: '' }],
    ])('CREATE bản tin %s → 400', async (_t, sua) => {
      expect((await admin.post('/admin/ban-tin', tin({ loaiTin, ...sua }))).status).toBe(400);
    });
  });

  it('Logo: GET trả cấu hình; nhân viên không đổi được logo', async () => {
    expect((await admin.get('/admin/logo')).status).toBe(200);
    const nv = await nhanVienClient();
    expect((await nv.goi('POST', '/admin/logo', new FormData())).status).toBe(403);
  });
});
