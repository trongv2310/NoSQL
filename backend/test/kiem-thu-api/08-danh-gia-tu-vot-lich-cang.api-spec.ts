import { beforeAll, describe, expect, it } from 'vitest';
import { adminClient, Client, khachMoi, nhanVienClient, taoSanPhamKiemThu, THONG_TIN_GIAO } from './_client';

const homNay = () => new Date().toISOString().slice(0, 10);

describe('08. Đánh giá, tủ vợt (hộ chiếu + sổ căng), lịch căng tại shop', () => {
  let admin: Client;
  let sp: { sanPhamId: string; bienTheId: string; sku: string };
  beforeAll(async () => {
    admin = await adminClient();
    sp = await taoSanPhamKiemThu(admin, { ton: 20, tenLoai: 'Vợt cầu lông' });
  });

  describe('Đánh giá sản phẩm', () => {
    it('Chưa đăng nhập → 401', async () => {
      expect((await new Client().post('/phan-hoi', { sanPhamId: sp.sanPhamId, danhGia: 5, noiDung: 'Rất tốt' })).status).toBe(401);
    });

    it('CREATE đánh giá → thống kê sản phẩm cập nhật (computed pattern)', async () => {
      const kh = await khachMoi('dg');
      await kh.put('/auth/ho-so-choi', { trinhDo: 'deu', noiDung: ['don'] });
      const truoc = (await new Client().get(`/phan-hoi/san-pham/${sp.sanPhamId}`)).body.tatCa.so;
      const r = await kh.post('/phan-hoi', { sanPhamId: sp.sanPhamId, danhGia: 4, noiDung: 'Vợt đánh ổn, hơi nặng đầu', the: ['dap-uy-luc'] });
      expect(r.status).toBe(201);
      expect(r.body.daMuaHang).toBe(false);
      const sau = (await new Client().get(`/phan-hoi/san-pham/${sp.sanPhamId}`)).body;
      expect(sau.tatCa.so).toBe(truoc + 1);
      const chiTiet = (await new Client().get(`/san-pham/${sp.sanPhamId}`)).body;
      expect(chiTiet.soDanhGia).toBeGreaterThanOrEqual(1);
    });

    it('Đánh giá sau khi mua (đơn hoàn thành) → daMuaHang = true', async () => {
      const kh = await khachMoi('dg');
      await kh.post('/gio-hang', { chiTietId: sp.bienTheId, quantity: 1 });
      const so = (await kh.post('/don-hang/checkout', THONG_TIN_GIAO)).body.soDonHang;
      await admin.post(`/admin/don-hang/${so}/trang-thai`, { trangThaiMoi: 'Đang giao hàng' });
      await admin.post(`/admin/don-hang/${so}/trang-thai`, { trangThaiMoi: 'Đã hoàn thành' });
      const r = await kh.post('/phan-hoi', { sanPhamId: sp.sanPhamId, danhGia: 5, noiDung: 'Đã mua và dùng rất thích' });
      expect(r.body.daMuaHang).toBe(true);
    });

    it.each([
      ['0 sao', { danhGia: 0 }],
      ['6 sao', { danhGia: 6 }],
      ['nội dung < 5 ký tự', { noiDung: 'ok' }],
      ['nội dung > 255 ký tự', { noiDung: 'x'.repeat(256) }],
      ['thẻ không hợp lệ', { the: ['hack'] }],
      ['sản phẩm sai định dạng', { sanPhamId: 'abc' }],
    ])('CREATE đánh giá %s → 400', async (_t, sua) => {
      const kh = await khachMoi('dg');
      expect((await kh.post('/phan-hoi', { sanPhamId: sp.sanPhamId, danhGia: 5, noiDung: 'Nội dung hợp lệ', ...sua })).status).toBe(400);
    });

    it('Đánh giá sản phẩm không tồn tại → 404', async () => {
      const kh = await khachMoi('dg');
      expect((await kh.post('/phan-hoi', { sanPhamId: '000000000000000000000000', danhGia: 5, noiDung: 'Nội dung hợp lệ' })).status).toBe(404);
    });

    it('Một khách đánh giá cùng sản phẩm nhiều lần → nên bị giới hạn (chống spam điểm)', async () => {
      const kh = await khachMoi('spam');
      const rs = [];
      for (let i = 0; i < 3; i++) rs.push(await kh.post('/phan-hoi', { sanPhamId: sp.sanPhamId, danhGia: 1, noiDung: `Đánh giá lặp lần ${i}` }));
      expect(rs.filter((r) => r.status === 201).length, 'Một tài khoản gửi được nhiều đánh giá cho cùng sản phẩm').toBe(1);
    });

    it('Nút "hữu ích": bấm lần 1 tăng, lần 2 bỏ; không âm', async () => {
      const kh = await khachMoi('hi');
      await kh.post('/phan-hoi', { sanPhamId: sp.sanPhamId, danhGia: 5, noiDung: 'Để người khác bấm hữu ích' });
      const ds = (await new Client().get(`/san-pham/${sp.sanPhamId}`)).body.danhGias;
      const dg = ds[0];
      const nguoi = await khachMoi('hi2');
      const a = await nguoi.post(`/phan-hoi/${dg.id}/huu-ich`);
      expect(a.body.daBam).toBe(true);
      const b = await nguoi.post(`/phan-hoi/${dg.id}/huu-ich`);
      expect(b.body.daBam).toBe(false);
      expect(b.body.soHuuIch).toBe(a.body.soHuuIch - 1);
    });
  });

  describe('Tủ vợt (hộ chiếu cây vợt + sổ căng)', () => {
    it('CREATE vợt → READ → UPDATE → ghi lần căng → lịch sử → sự kiện → DELETE', async () => {
      const kh = await khachMoi('tv');
      const tao = await kh.post('/tu-vot', { ten: 'Vợt chính', sanPhamId: sp.sanPhamId, chuKyNhacNgay: 30, ghiChu: 'kiểm thử' });
      expect(tao.status).toBe(201);
      const vot = (await kh.get('/tu-vot')).body.vot[0];
      expect(vot.ten).toBe('Vợt chính');
      expect((await kh.patch(`/tu-vot/${vot._id ?? vot.id}`, { ten: 'Vợt đã đổi tên', chuKyNhacNgay: null })).status).toBe(200);
      expect((await kh.get('/tu-vot')).body.vot[0].ten).toBe('Vợt đã đổi tên');
      const lc = await kh.post(`/tu-vot/${vot._id ?? vot.id}/lan-cang`, { ngay: homNay(), giaTri: 11, donVi: 'kg', tenDay: 'BG66', noiCang: 'ngoai' });
      expect(lc.status).toBeLessThan(300);
      const ls = (await kh.get(`/tu-vot/${vot._id ?? vot.id}/lan-cang`)).body;
      expect(JSON.stringify(ls)).toContain('BG66');
      expect((await kh.post(`/tu-vot/${vot._id ?? vot.id}/su-kien`, { loai: 'ghi-chu', ngay: homNay(), ghiChu: 'Thay quấn cán' })).status).toBeLessThan(300);
      expect((await kh.del(`/tu-vot/${vot._id ?? vot.id}`)).status).toBeLessThan(300);
      expect((await kh.get('/tu-vot')).body.vot).toHaveLength(0);
    });

    it.each([
      ['tên rỗng', { ten: '' }],
      ['tên > 80 ký tự', { ten: 'x'.repeat(81) }],
      ['chu kỳ nhắc 0 ngày', { ten: 'A', chuKyNhacNgay: 0 }],
      ['chu kỳ nhắc 400 ngày', { ten: 'A', chuKyNhacNgay: 400 }],
    ])('CREATE vợt %s → 400', async (_t, body) => {
      const kh = await khachMoi('tv');
      expect((await kh.post('/tu-vot', body)).status).toBe(400);
    });

    it.each([
      ['mức căng 200 lbs', { giaTri: 200, donVi: 'lbs' }],
      ['mức căng 1 kg', { giaTri: 1, donVi: 'kg' }],
      ['đơn vị lạ', { giaTri: 11, donVi: 'N' }],
      ['ngày sai định dạng', { ngay: '20/11/2026' }],
      ['ngày trong tương lai', { ngay: '2099-01-01' }],
    ])('Ghi lần căng %s → 400', async (_t, sua) => {
      const kh = await khachMoi('tv');
      await kh.post('/tu-vot', { ten: 'Vợt A' });
      const vot = (await kh.get('/tu-vot')).body.vot[0];
      expect((await kh.post(`/tu-vot/${vot._id ?? vot.id}/lan-cang`, { ngay: homNay(), giaTri: 11, donVi: 'kg', noiCang: 'ngoai', ...sua })).status).toBe(400);
    });

    it('Không sửa / xóa / ghi lần căng vào vợt của người khác', async () => {
      const a = await khachMoi('tva');
      const b = await khachMoi('tvb');
      await a.post('/tu-vot', { ten: 'Vợt của A' });
      const vot = (await a.get('/tu-vot')).body.vot[0];
      expect((await b.patch(`/tu-vot/${vot._id ?? vot.id}`, { ten: 'Chiếm' })).status).toBe(404);
      expect((await b.del(`/tu-vot/${vot._id ?? vot.id}`)).status).toBe(404);
      expect((await b.post(`/tu-vot/${vot._id ?? vot.id}/lan-cang`, { ngay: homNay(), giaTri: 11, donVi: 'kg', noiCang: 'ngoai' })).status).toBe(404);
      expect((await a.get('/tu-vot')).body.vot[0].ten).toBe('Vợt của A');
    });
  });

  describe('Lịch căng tại shop', () => {
    it('Đặt chỗ → "lịch của tôi" có chỗ → admin thấy → hủy → chỗ được trả lại', async () => {
      const kh = await khachMoi('lc');
      await kh.post('/tu-vot', { ten: 'Vợt đặt lịch' });
      const vot = (await kh.get('/tu-vot')).body.vot[0];
      const khung = (await kh.get('/lich-cang/khung')).body.find((k: any) => k.conTrong > 0);
      const dat = await kh.post('/lich-cang', { ngay: khung.ngay, votCaNhanId: vot._id ?? vot.id, giaTri: 11, donVi: 'kg' });
      expect(dat.status, JSON.stringify(dat.body)).toBeLessThan(300);
      const cuaToi = (await kh.get('/lich-cang/cua-toi')).body.lich;
      expect(cuaToi.length).toBe(1);
      const sau = (await kh.get('/lich-cang/khung')).body.find((k: any) => k.ngay === khung.ngay);
      expect(sau.conTrong).toBe(khung.conTrong - 1);
      const c = cuaToi[0];
      const huy = await kh.post(`/lich-cang/${c._id}/${c.datCho._id}/huy`);
      expect(huy.status, JSON.stringify(c)).toBeLessThan(300);
      expect((await kh.get('/lich-cang/khung')).body.find((k: any) => k.ngay === khung.ngay).conTrong).toBe(khung.conTrong);
    });

    it('Khung đã kín: nhiều khách đặt song song không vượt sức chứa', async () => {
      const dsKhung = (await admin.get('/lich-cang/khung')).body;
      const khung = dsKhung.find((k: any) => k.conTrong === k.sucChua) ?? dsKhung.at(-1);
      const khs = await Promise.all(Array.from({ length: khung.sucChua + 3 }, () => khachMoi('lk')));
      for (const k of khs) await k.post('/tu-vot', { ten: 'Vợt' });
      const vots = await Promise.all(khs.map(async (k) => (await k.get('/tu-vot')).body.vot[0]._id));
      const rs = await Promise.all(khs.map((k, i) => k.post('/lich-cang', { ngay: khung.ngay, votCaNhanId: vots[i], giaTri: 11, donVi: 'kg' })));
      expect(rs.filter((r) => r.status < 300).length).toBe(khung.conTrong);
      expect((await admin.get('/lich-cang/khung')).body.find((k: any) => k.ngay === khung.ngay).conTrong).toBe(0);
    });

    it('Đặt chỗ cho vợt của người khác / khung giờ quá khứ → 4xx', async () => {
      const a = await khachMoi('lca');
      const b = await khachMoi('lcb');
      await a.post('/tu-vot', { ten: 'Vợt A' });
      const vot = (await a.get('/tu-vot')).body.vot[0];
      const khung = (await b.get('/lich-cang/khung')).body.find((k: any) => k.conTrong > 0);
      expect((await b.post('/lich-cang', { ngay: khung.ngay, votCaNhanId: vot._id ?? vot.id, giaTri: 11, donVi: 'kg' })).status).toBeGreaterThanOrEqual(400);
      expect((await a.post('/lich-cang', { ngay: '2020-01-01T02:00:00.000Z', votCaNhanId: vot._id ?? vot.id, giaTri: 11, donVi: 'kg' })).status).toBeGreaterThanOrEqual(400);
    });

    it('Admin xem lịch theo khoảng ngày; khoảng > 62 ngày → 400', async () => {
      expect((await admin.get('/admin/lich-cang')).status).toBe(200);
      const tu = new Date().toISOString();
      const den = new Date(Date.now() + 100 * 86_400_000).toISOString();
      expect((await admin.get(`/admin/lich-cang?tu=${tu}&den=${den}`)).status).toBe(400);
      const nv = await nhanVienClient();
      expect((await nv.get('/admin/lich-cang')).status).toBe(403);
    });
  });
});
