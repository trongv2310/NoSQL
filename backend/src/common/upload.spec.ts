import { BadRequestException, CallHandler, ExecutionContext, ValidationPipe } from '@nestjs/common';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { defer, lastValueFrom, of, throwError } from 'rxjs';
import { anhInterceptor, DonAnhKhiLoi, duongDanTuongDoi, UPLOAD_ROOT, xoaAnhUpload } from './upload';

const mocks = vi.hoisted(() => ({ interceptor: vi.fn(), storage: vi.fn(), exists: vi.fn(), unlink: vi.fn(), mkdir: vi.fn() }));
vi.mock('@nestjs/platform-express', async (original) => ({ ...await original<typeof import('@nestjs/platform-express')>(), FileInterceptor: mocks.interceptor }));
vi.mock('multer', async (original) => ({ ...await original<typeof import('multer')>(), diskStorage: mocks.storage }));
vi.mock('fs', async (original) => ({ ...await original<typeof import('fs')>(), existsSync: mocks.exists, unlinkSync: mocks.unlink, mkdirSync: mocks.mkdir }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.storage.mockImplementation((options) => options);
});

describe('HIỆN TẠI: upload ảnh', () => {
  function options() {
    anhInterceptor('anh', 'sanpham', 'sp');
    return mocks.interceptor.mock.calls[0][1];
  }

  it.each(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.JPG', '.PnG'])('HIỆN TẠI: chấp nhận đuôi %s khi MIME là ảnh', (duoi) => {
    const cb = vi.fn();
    options().fileFilter({}, { originalname: `anh${duoi}`, mimetype: 'image/png' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it.each([['anh.exe', 'image/png'], ['anh.jpg', 'application/pdf'], ['anh', 'image/jpeg']])('HIỆN TẠI: từ chối %s với MIME %s', (originalname, mimetype) => {
    const cb = vi.fn();
    options().fileFilter({}, { originalname, mimetype }, cb);
    expect(cb).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    expect(cb.mock.calls[0][0].message).toBe('Hình ảnh phải có định dạng jpg, jpeg, png, webp hoặc gif.');
  });

  it('HIỆN TẠI: giới hạn 5MB, tên lưu và đường dẫn tương đối', () => {
    const o = options();
    expect(o.limits.fileSize).toBe(5 * 1024 * 1024);
    const cb = vi.fn();
    o.storage.filename({}, { originalname: 'Anh.JPEG' }, cb);
    const filename = cb.mock.calls[0][1] as string;
    expect(filename).toMatch(/^sp_\d+_[0-9a-f]{8}\.jpeg$/);
    expect(duongDanTuongDoi('sanpham', { filename } as Express.Multer.File)).toBe(`uploads/sanpham/${filename}`);
    expect(duongDanTuongDoi('sanpham')).toBeUndefined();
  });

  it.each([undefined, null, '', 'default-product.jpg', 'uploads/../anh.jpg'])('HIỆN TẠI: bỏ qua đường dẫn không hợp lệ %s', (path) => {
    xoaAnhUpload(path);
    expect(existsSync).not.toHaveBeenCalled();
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it('HIỆN TẠI: xóa đường dẫn uploads hợp lệ khi file tồn tại (fs giả)', () => {
    mocks.exists.mockReturnValue(true);
    xoaAnhUpload('uploads/sanpham/a.jpg');
    expect(existsSync).toHaveBeenCalledWith(join(UPLOAD_ROOT, 'sanpham/a.jpg'));
    expect(unlinkSync).toHaveBeenCalledWith(join(UPLOAD_ROOT, 'sanpham/a.jpg'));
  });

  it('HIỆN TẠI: không xóa file không tồn tại (fs giả)', () => {
    mocks.exists.mockReturnValue(false);
    xoaAnhUpload('uploads/sanpham/khong-co.jpg');
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it('HIỆN TẠI: xóa file thật trong thư mục tạm được chỉ định làm UPLOAD_DIR', async () => {
    const fs = await vi.importActual<typeof import('fs')>('fs');
    const os = await import('os');
    const dir = fs.mkdtempSync(join(os.tmpdir(), 'kiem-thu-upload-'));
    const file = join(dir, 'anh.jpg');
    try {
      fs.writeFileSync(file, 'test');
      vi.stubEnv('UPLOAD_DIR', dir);
      vi.resetModules();
      mocks.exists.mockImplementation(fs.existsSync);
      mocks.unlink.mockImplementation(fs.unlinkSync);
      const upload = await import('./upload.js');
      upload.xoaAnhUpload('uploads/anh.jpg');
      expect(fs.existsSync(file)).toBe(false);
      expect(mocks.unlink).toHaveBeenCalledWith(file);
    } finally {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      fs.rmdirSync(dir);
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe('Dọn ảnh khi lỗi', () => {
  const file = () => ({ path: join(UPLOAD_ROOT, 'sanpham', 'moi.jpg'), filename: 'moi.jpg' }) as Express.Multer.File;
  const context = (uploaded?: Express.Multer.File) => ({ switchToHttp: () => ({ getRequest: () => ({ file: uploaded }) }) }) as unknown as ExecutionContext;
  const interceptor = new DonAnhKhiLoi();

  beforeEach(() => {
    mocks.exists.mockReset().mockReturnValue(true);
    mocks.unlink.mockReset();
    mocks.mkdir.mockReset();
    mocks.interceptor.mockImplementation((field, options) => Object.assign(class FileGia {}, { field, options }));
  });

  it('xoaAnhUpload không ném khi unlink lỗi', () => {
    mocks.unlink.mockImplementationOnce(() => { throw new Error('không có quyền xóa'); });
    expect(() => xoaAnhUpload('uploads/sanpham/cu.jpg')).not.toThrow();
    expect(mocks.unlink).toHaveBeenCalledWith(join(UPLOAD_ROOT, 'sanpham', 'cu.jpg'));
  });

  it('xóa file mới khi handler lỗi và ném lại chính lỗi gốc', async () => {
    const uploaded = file();
    const error = new Error('ghi DB lỗi');
    const next = { handle: () => throwError(() => error) };
    await expect(lastValueFrom(interceptor.intercept(context(uploaded), next))).rejects.toBe(error);
    expect(mocks.unlink).toHaveBeenCalledWith(uploaded.path);
  });

  it('lỗi dọn file không thay thế lỗi gốc', async () => {
    const error = new BadRequestException('DTO sai');
    mocks.unlink.mockImplementationOnce(() => { throw new Error('file đang bị khóa'); });
    await expect(lastValueFrom(interceptor.intercept(context(file()), { handle: () => throwError(() => error) }))).rejects.toBe(error);
  });

  it('bắt cả lỗi đồng bộ từ CallHandler', async () => {
    const error = new Error('handler lỗi');
    const next: CallHandler = { handle: () => { throw error; } };
    await expect(lastValueFrom(interceptor.intercept(context(file()), next))).rejects.toBe(error);
    expect(mocks.unlink).toHaveBeenCalledOnce();
  });

  it('ValidationPipe thật từ chối DTO: dọn file trước khi gọi handler', async () => {
    const { SanPhamDto } = await import('../admin/admin-san-pham.controller.js');
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const handler = vi.fn();
    let error: unknown;
    const next = { handle: () => defer(async () => {
      try {
        await pipe.transform({}, { type: 'body', metatype: SanPhamDto });
      } catch (e) {
        error = e;
        throw e;
      }
      return handler();
    }) };
    const caught = await lastValueFrom(interceptor.intercept(context(file()), next)).catch((e: unknown) => e);
    expect(caught).toBe(error);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(handler).not.toHaveBeenCalled();
    expect(mocks.unlink).toHaveBeenCalledOnce();
  });

  it('thành công không xóa file mới', async () => {
    const result = { id: 'san-pham' };
    await expect(lastValueFrom(interceptor.intercept(context(file()), { handle: () => of(result) }))).resolves.toBe(result);
    expect(mocks.exists).not.toHaveBeenCalled();
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it('không có file: giữ lỗi và không xóa ảnh cũ', async () => {
    const error = new Error('ghi DB lỗi');
    await expect(lastValueFrom(interceptor.intercept(context(), { handle: () => throwError(() => error) }))).rejects.toBe(error);
    expect(mocks.exists).not.toHaveBeenCalled();
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it.each(['../ngoai-upload.jpg', '../uploads-khac/anh.jpg'])('không xóa file ngoài UPLOAD_ROOT: %s', async (path) => {
    const error = new Error('handler lỗi');
    const uploaded = Object.assign(file(), { path: join(UPLOAD_ROOT, path) });
    await expect(lastValueFrom(interceptor.intercept(context(uploaded), { handle: () => throwError(() => error) }))).rejects.toBe(error);
    expect(mocks.exists).not.toHaveBeenCalled();
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it('không xóa ảnh mới đã được DB sử dụng nếu bước sau lỗi', async () => {
    const uploaded = file();
    DonAnhKhiLoi.daLuu.add(uploaded);
    const error = new Error('ghi lịch sử lỗi');
    await expect(lastValueFrom(interceptor.intercept(context(uploaded), { handle: () => throwError(() => error) }))).rejects.toBe(error);
    expect(mocks.exists).not.toHaveBeenCalled();
    expect(mocks.unlink).not.toHaveBeenCalled();
  });

  it('bốn route: multer chạy trước interceptor dọn lỗi, giữ field, thư mục và tiền tố', async () => {
    const { AdminSanPhamController } = await import('../admin/admin-san-pham.controller.js');
    const upload = await import('./upload.js');
    for (const method of ['tao', 'capNhat', 'themBienThe', 'capNhatBienThe'] as const) {
      const interceptors = Reflect.getMetadata(INTERCEPTORS_METADATA, AdminSanPhamController.prototype[method]);
      expect(interceptors).toHaveLength(2);
      expect(interceptors[1]).toBe(upload.DonAnhKhiLoi);
      expect(interceptors[0].field).toBe('HinhAnhUpload');
      expect(interceptors[0].options.limits.fileSize).toBe(5 * 1024 * 1024);
      const cb = vi.fn();
      interceptors[0].options.storage.destination({}, {}, cb);
      expect(cb).toHaveBeenCalledWith(null, join(upload.UPLOAD_ROOT, 'sanpham'));
      cb.mockClear();
      interceptors[0].options.storage.filename({}, { originalname: 'anh.JPG' }, cb);
      const prefix = method === 'tao' || method === 'capNhat' ? 'sp' : 'bt';
      expect(cb.mock.calls[0][1]).toMatch(new RegExp(`^${prefix}_\\d+_[0-9a-f]{8}\\.jpg$`));
    }
  });
});

it('nạp cấu hình môi trường trước khi chốt UPLOAD_ROOT (không đọc .env thật)', async () => {
  const { tmpdir } = await import('os');
  const dir = join(tmpdir(), 'kiem-thu-upload-env');
  vi.stubEnv('UPLOAD_DIR', undefined);
  vi.doMock('dotenv/config', () => {
    process.env.UPLOAD_DIR = dir;
    return {};
  });
  vi.resetModules();
  try {
    const upload = await import('./upload.js');
    expect(upload.UPLOAD_ROOT).toBe(dir);
  } finally {
    vi.doUnmock('dotenv/config');
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});

it('T-404: unlink EPERM được bỏ qua và không lan ra caller', () => {
  mocks.exists.mockReturnValueOnce(true);
  mocks.unlink.mockImplementationOnce(() => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); });
  expect(() => xoaAnhUpload('uploads/sanpham/cu.jpg')).not.toThrow();
  expect(mocks.unlink).toHaveBeenCalledOnce();
});

it('T-404: đường dẫn chứa .. bị từ chối trước khi kiểm tra file', () => {
  xoaAnhUpload('uploads/sanpham/../khac.jpg');
  expect(mocks.exists).not.toHaveBeenCalled();
  expect(mocks.unlink).not.toHaveBeenCalled();
});
