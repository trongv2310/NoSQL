import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Global, Module } from '@nestjs/common';
import request from 'supertest';
import { AdminModule } from '../src/admin/admin.module';
import { AuthModule } from '../src/auth/auth.module';
import { CatalogModule } from '../src/catalog/catalog.module';
import { CongKhaiModule } from '../src/cong-khai/cong-khai.module';
import { DonHangModule } from '../src/don-hang/don-hang.module';
import { TuVotModule } from '../src/tu-vot/tu-vot.module';
import { cauHinhApp } from '../src/app.setup';
import { ALL_MODELS } from '../src/schemas';

/** Model giả: đủ để Nest khởi tạo DI; test này chỉ kiểm tra định tuyến, guard và validation (không chạm DB). */
/** Tài khoản giả cho ParseTokenGuard (quyền lấy từ DB, không từ token): id → bản ghi. Id lạ = tài khoản đã bị xóa. */
export const TAI_KHOAN_GIA: Record<string, { tenDangNhap: string; maQuyen: number }> = {
  '64b000000000000000000001': { tenDangNhap: 'khach', maQuyen: 3 },
  '64b000000000000000000002': { tenDangNhap: 'nv', maQuyen: 2 },
  '64b000000000000000000003': { tenDangNhap: 'admin', maQuyen: 1 },
  '64b000000000000000000004': { tenDangNhap: 'bi-ha-quyen', maQuyen: 3 }, // token ghi maQuyen=1 nhưng DB đã hạ xuống khách
};
const taiKhoanGia = {
  findById: (id: string) => ({ select: () => ({ lean: () => Promise.resolve(TAI_KHOAN_GIA[id] ?? null) }) }),
};

@Global()
@Module({
  providers: [
    ...ALL_MODELS.map((m) => ({ provide: getModelToken(m.name), useValue: m.name === 'TaiKhoan' ? taiKhoanGia : {} })),
    { provide: getConnectionToken(), useValue: {} },
  ],
  exports: [...ALL_MODELS.map((m) => getModelToken(m.name)), getConnectionToken()],
})
class DatabaseGiaModule {}

describe('Định tuyến, phân quyền và validation (không cần MongoDB)', () => {
  let app: INestApplication;
  let tokenKhach: string;
  let tokenNhanVien: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseGiaModule,
        AuthModule,
        CatalogModule,
        CongKhaiModule,
        DonHangModule,
        TuVotModule,
        AdminModule,
      ],
    }).compile();
    app = mod.createNestApplication();
    cauHinhApp(app);
    await app.init();
    const jwt = app.get(JwtService);
    tokenKhach = jwt.sign({ sub: '64b000000000000000000001', tenDangNhap: 'khach', maQuyen: 3 });
    tokenNhanVien = jwt.sign({ sub: '64b000000000000000000002', tenDangNhap: 'nv', maQuyen: 2 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/auth/me trả null khi chưa đăng nhập', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me').expect(200);
    expect(res.body).toEqual({ user: null });
  });

  it('GET /api/gio-hang/count của khách chưa đăng nhập là 0', async () => {
    const res = await request(app.getHttpServer()).get('/api/gio-hang/count').expect(200);
    expect(res.body).toEqual({ count: 0 });
  });

  it('các API cần đăng nhập trả 401 khi không có token', async () => {
    for (const url of ['/api/gio-hang', '/api/don-hang', '/api/admin/dashboard', '/api/admin/san-pham']) {
      await request(app.getHttpServer()).get(url).expect(401);
    }
  });

  it('khách hàng (quyền 3) bị chặn khỏi khu quản trị với 403', async () => {
    for (const url of ['/api/admin/dashboard', '/api/admin/tai-khoan', '/api/admin/don-hang']) {
      await request(app.getHttpServer()).get(url).set('Cookie', `token=${tokenKhach}`).expect(403);
    }
  });

  it('nhân viên (quyền 2) không vào được chức năng chỉ dành cho admin', async () => {
    // /api/admin/san-pham đã mở quyền xem cho nhân viên (commit 9486011) nên không còn trong danh sách này.
    for (const url of ['/api/admin/tai-khoan', '/api/admin/dashboard', '/api/admin/khuyen-mai', '/api/admin/logo']) {
      const res = await request(app.getHttpServer()).get(url).set('Cookie', `token=${tokenNhanVien}`).expect(403);
      expect(String(res.body.message)).toContain('Quản trị viên');
    }
  });

  it('token sai chữ ký bị coi như chưa đăng nhập', async () => {
    await request(app.getHttpServer()).get('/api/gio-hang').set('Cookie', 'token=khong.hop.le').expect(401);
  });

  it('đăng nhập thiếu dữ liệu trả 400 kèm thông báo tiếng Việt', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/dang-nhap').send({}).expect(400);
    expect(JSON.stringify(res.body.message)).toContain('Vui lòng nhập tên đăng nhập.');
  });

  it('đăng ký với số điện thoại sai định dạng bị từ chối', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/dang-ky')
      .send({ hoTen: 'A', tenDangNhap: 'abc', email: 'a@b.vn', soDienThoai: '123', matKhau: '123456', xacNhanMatKhau: '123456' })
      .expect(400);
    expect(JSON.stringify(res.body.message)).toContain('Số điện thoại phải bắt đầu bằng 0');
  });

  it('hồ sơ người chơi: cần đăng nhập (401) và từ chối giá trị ngoài danh sách (400) trước khi chạm DB', async () => {
    const http = app.getHttpServer();
    await request(http).get('/api/auth/ho-so-choi').expect(401);
    await request(http).put('/api/auth/ho-so-choi').send({ trinhDo: 'deu' }).expect(401);
    await request(http).delete('/api/auth/ho-so-choi').expect(401);
    const sai = [
      { trinhDo: 'sieu-cap' },
      { trinhDo: 'phong-trao' },
      { noiDung: ['don', 'doi-nam-nu'] },
      { noiDung: 'don' },
      { chanThuong: ['dau-goi'] },
      { soBuoiMoiTuan: 15 },
      { soBuoiMoiTuan: 2.5 },
      { loiChoi: 'phong-thu' },
    ];
    for (const body of sai) {
      await request(http).put('/api/auth/ho-so-choi').set('Cookie', `token=${tokenKhach}`).send(body).expect(400);
    }
  });

  it('tủ vợt: cần đăng nhập (401) và từ chối dữ liệu sai (400) trước khi chạm DB', async () => {
    const http = app.getHttpServer();
    await request(http).get('/api/tu-vot').expect(401);
    await request(http).post('/api/tu-vot/64b000000000000000000001/lan-cang').send({}).expect(401);
    const sai: [string, object][] = [
      ['/api/tu-vot', { ten: '' }],
      ['/api/tu-vot', { ten: 'Vợt', chuKyNhacNgay: 400 }],
      ['/api/tu-vot', { ten: 'Vợt', bienTheId: 'khong-phai-id' }],
      ['/api/tu-vot/64b000000000000000000001/lan-cang', { ngay: '18/11/2026', giaTri: 25, donVi: 'lbs', noiCang: 'ngoai' }],
      ['/api/tu-vot/64b000000000000000000001/lan-cang', { ngay: '2026-11-18', giaTri: 25, donVi: 'pound', noiCang: 'ngoai' }],
      ['/api/tu-vot/64b000000000000000000001/lan-cang', { ngay: '2026-11-18', giaTri: 25, donVi: 'lbs', noiCang: 'nha-ban' }],
      ['/api/tu-vot/chuyen-tu-trinh-duyet', { vot: Array.from({ length: 31 }, (_, i) => ({ id: `v-${i}`, ten: 'x' })) }],
    ];
    for (const [url, body] of sai) {
      await request(http).post(url).set('Cookie', `token=${tokenKhach}`).send(body).expect(400);
    }
  });

  it('thêm giỏ hàng với id không phải ObjectId bị từ chối trước khi chạm DB', async () => {
    await request(app.getHttpServer())
      .post('/api/gio-hang')
      .set('Cookie', `token=${tokenKhach}`)
      .send({ chiTietId: 'abc', quantity: 1 })
      .expect(400);
  });

  it('thêm giỏ hàng cho tài khoản dự kiến khác với phiên đăng nhập bị 403 sai_tai_khoan trước khi chạm DB (M3-QA1-02)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/gio-hang')
      .set('Cookie', `token=${tokenKhach}`)
      .send({ chiTietId: 'a'.repeat(24), quantity: 1, taiKhoanDuKien: '64b0000000000000000000ff' })
      .expect(403);
    expect(res.body).toMatchObject({ maLoi: 'sai_tai_khoan' });
    // taiKhoanDuKien sai định dạng bị từ chối ở bước kiểm tra body, không bao giờ được dùng để chọn giỏ
    await request(app.getHttpServer())
      .post('/api/gio-hang')
      .set('Cookie', `token=${tokenKhach}`)
      .send({ chiTietId: 'a'.repeat(24), taiKhoanDuKien: 'khong-phai-id' })
      .expect(400);
  });

  describe('giỏ hàng khách chưa đăng nhập', () => {
    const ID = 'a'.repeat(24);
    const SYNC = 'sync-aaaaaaaaaaaaaaaa';

    it('báo giá là API công khai nhưng từ chối body sai trước khi chạm DB', async () => {
      const gui = (body: unknown) => request(app.getHttpServer()).post('/api/gio-hang/tinh').send(body as object);
      await gui({}).expect(400);
      await gui({ dong: [{ chiTietId: 'abc', soLuong: 1 }] }).expect(400);
      await gui({ dong: [{ chiTietId: ID, soLuong: 0 }] }).expect(400);
      await gui({ dong: [{ chiTietId: ID, soLuong: 101 }] }).expect(400);
      await gui({ dong: [{ chiTietId: ID, soLuong: '2' }] }).expect(400);
      await gui({ dong: Array.from({ length: 101 }, () => ({ chiTietId: ID, soLuong: 1 })) }).expect(400);
    });

    it('báo giá giỏ rỗng không cần đăng nhập và không cần DB', async () => {
      const res = await request(app.getHttpServer()).post('/api/gio-hang/tinh').send({ dong: [] }).expect(200);
      expect(res.body).toEqual({ items: [], tongTien: 0, tongSoLuong: 0 });
    });

    it('đồng bộ giỏ cần đăng nhập (401) và kiểm tra syncId/dòng (400)', async () => {
      await request(app.getHttpServer()).post('/api/gio-hang/dong-bo').send({ syncId: SYNC, dong: [] }).expect(401);
      const dangNhap = (body: unknown) =>
        request(app.getHttpServer()).post('/api/gio-hang/dong-bo').set('Cookie', `token=${tokenKhach}`).send(body as object);
      const TK = '64b000000000000000000001'; // trùng với sub của tokenKhach
      await dangNhap({ taiKhoanId: TK, dong: [{ chiTietId: ID, soLuong: 1 }] }).expect(400);
      await dangNhap({ taiKhoanId: TK, syncId: 'ngan', dong: [{ chiTietId: ID, soLuong: 1 }] }).expect(400);
      await dangNhap({ taiKhoanId: TK, syncId: SYNC, dong: [{ chiTietId: 'abc', soLuong: 1 }] }).expect(400);
      await dangNhap({ syncId: SYNC, dong: [{ chiTietId: ID, soLuong: 1 }] }).expect(400); // thiếu taiKhoanId
    });

    it('đồng bộ cho tài khoản khác với phiên đăng nhập bị 403 kèm maLoi trước khi chạm DB (M1-R1-03)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/gio-hang/dong-bo')
        .set('Cookie', `token=${tokenKhach}`)
        .send({ taiKhoanId: '64b0000000000000000000ff', syncId: SYNC, dong: [{ chiTietId: ID, soLuong: 1 }] })
        .expect(403);
      expect(res.body).toMatchObject({ maLoi: 'sai_tai_khoan' });
    });
  });

  it('thanh toán với số điện thoại sai bị từ chối', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/don-hang/checkout')
      .set('Cookie', `token=${tokenKhach}`)
      .send({ hoTenNhan: 'A', soDienThoaiNhan: 'abc', diaChiGiao: 'HCM' })
      .expect(400);
    expect(JSON.stringify(res.body.message)).toContain('Số điện thoại');
  });

  it('chatbot từ chối câu hỏi rỗng và quá dài', async () => {
    const r1 = await request(app.getHttpServer()).post('/api/chatbot/ask').send({ message: '   ' }).expect(201);
    expect(r1.body).toEqual({ success: false, reply: 'Vui lòng nhập câu hỏi của bạn.' });
    const r2 = await request(app.getHttpServer()).post('/api/chatbot/ask').send({ message: 'a'.repeat(501) }).expect(201);
    expect(r2.body.success).toBe(false);
  });

  it('chatbot không sập khi không truy cập được dữ liệu kho: trả success=false kèm lời xin lỗi', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/chatbot/ask')
      .set('x-forwarded-for', '10.0.0.1')
      .send({ message: 'Tư vấn vợt cho người mới', history: [{ vai: 'user', text: 'xin chào' }], context: { loai: 'vot', giaMax: 'rác' } })
      .expect(201);
    expect(r.body.success).toBe(false);
    expect(r.body.reply).toMatch(/bận/);
    expect(r.body.products).toEqual([]);
  });

  it('chatbot giới hạn tần suất theo địa chỉ: vượt 15 lượt/phút trả 429 kèm Retry-After', async () => {
    const gui = () => request(app.getHttpServer()).post('/api/chatbot/ask').set('x-forwarded-for', '10.0.0.2').send({ message: 'xin chào' });
    for (let i = 0; i < 15; i++) {
      await gui().expect(201);
    }
    const bi = await gui().expect(429);
    expect(bi.headers['retry-after']).toBeDefined();
    expect(JSON.stringify(bi.body.message)).toMatch(/thử lại sau/);
    await request(app.getHttpServer()).post('/api/chatbot/ask').set('x-forwarded-for', '10.0.0.3').send({ message: 'xin chào' }).expect(201);
  });

  it('đổi trạng thái đơn với giá trị ngoài danh sách bị từ chối (nhân viên)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/don-hang/1/trang-thai')
      .set('Cookie', `token=${tokenNhanVien}`)
      .send({ trangThaiMoi: 'Đã thanh toán bằng MoMo' })
      .expect(400);
    expect(JSON.stringify(res.body.message)).toContain('Trạng thái đơn hàng không hợp lệ.');
  });

  it('tạo trận đấu: hai bên trùng nhau bị từ chối (admin)', async () => {
    const jwt = app.get(JwtService);
    const tokenAdmin = jwt.sign({ sub: '64b000000000000000000003', tenDangNhap: 'admin', maQuyen: 1 });
    const res = await request(app.getHttpServer())
      .post('/api/admin/tran-dau')
      .set('Cookie', `token=${tokenAdmin}`)
      .send({ tenGiaiDau: 'G', vong: 'V', noiDung: 'N', doiA: 'X', doiB: 'X', ngayThiDau: '2026-06-01' })
      .expect(400);
    expect(JSON.stringify(res.body.message)).toContain('Hai bên thi đấu phải khác nhau.');
  });

  it('quyền lấy từ DB, không tin token: token ghi admin nhưng tài khoản đã bị hạ quyền → 403 (M5A-03)', async () => {
    const jwt = app.get(JwtService);
    const tokenCu = jwt.sign({ sub: '64b000000000000000000004', tenDangNhap: 'bi-ha-quyen', maQuyen: 1 });
    await request(app.getHttpServer()).post('/api/admin/tran-dau').set('Cookie', `token=${tokenCu}`).send({}).expect(403);
  });

  it('token của tài khoản đã bị xóa không còn đăng nhập được: /auth/me trả null, API admin 401 (M5A-03)', async () => {
    const jwt = app.get(JwtService);
    const tokenXoa = jwt.sign({ sub: '64b0000000000000000000ff', tenDangNhap: 'da-xoa', maQuyen: 1 });
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', `token=${tokenXoa}`).expect(200);
    expect(me.body).toEqual({ user: null });
    await request(app.getHttpServer()).post('/api/admin/tran-dau').set('Cookie', `token=${tokenXoa}`).send({}).expect(401);
  });

  it('cổng MoMo giả lập yêu cầu đăng nhập: khách chưa đăng nhập bị 401 ở cả hai route (M5A-01)', async () => {
    await request(app.getHttpServer()).get('/api/don-hang/momo/mock/1').expect(401);
    await request(app.getHttpServer()).post('/api/don-hang/momo/mock/xu-ly').send({ orderId: 1 }).expect(401);
  });

  it('thanh toán: họ tên người nhận toàn khoảng trắng bị từ chối 400 trước khi chạm DB (M5R1-N03)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/don-hang/checkout')
      .set('Cookie', `token=${tokenKhach}`)
      .send({ hoTenNhan: '    ', soDienThoaiNhan: '0912345678', diaChiGiao: '1 Đường A' })
      .expect(400);
    expect(JSON.stringify(res.body.message)).toContain('Vui lòng nhập họ tên người nhận.');
  });
});
