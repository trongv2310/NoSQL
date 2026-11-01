import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Global, Module } from '@nestjs/common';
import request from 'supertest';
import { AdminModule } from '../src/admin/admin.module';
import { AuthModule } from '../src/auth/auth.module';
import { CatalogModule } from '../src/catalog/catalog.module';
import { CongKhaiModule } from '../src/cong-khai/cong-khai.module';
import { DonHangModule } from '../src/don-hang/don-hang.module';
import { cauHinhApp } from '../src/app.setup';
import { ALL_MODELS } from '../src/schemas';

/** Model giả: đủ để Nest khởi tạo DI; test này chỉ kiểm tra định tuyến, guard và validation (không chạm DB). */
@Global()
@Module({
  providers: ALL_MODELS.map((m) => ({ provide: getModelToken(m.name), useValue: {} })),
  exports: ALL_MODELS.map((m) => getModelToken(m.name)),
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
    for (const url of ['/api/admin/tai-khoan', '/api/admin/san-pham', '/api/admin/khuyen-mai', '/api/admin/logo']) {
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

  it('thêm giỏ hàng với id không phải ObjectId bị từ chối trước khi chạm DB', async () => {
    await request(app.getHttpServer())
      .post('/api/gio-hang')
      .set('Cookie', `token=${tokenKhach}`)
      .send({ chiTietId: 'abc', quantity: 1 })
      .expect(400);
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
});
