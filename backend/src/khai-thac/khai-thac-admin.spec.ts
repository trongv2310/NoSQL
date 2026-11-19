import { ArgumentMetadata, ExecutionContext, ValidationPipe } from '@nestjs/common';
import { HTTP_CODE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AccessGuard, ROLES_KEY } from '../auth/auth.guards';
import { KhaiThacAdminController, TopKDto } from './khai-thac-admin.controller';
import { KetQuaKhaiThac } from './khai-thac.service';

const pipe = new ValidationPipe({ transform: true, whitelist: true });
const metadata: ArgumentMetadata = { type: 'body', metatype: TopKDto };
const validate = (body: Record<string, unknown>): Promise<TopKDto> => pipe.transform(body, metadata) as Promise<TopKDto>;
const kq: KetQuaKhaiThac = { k: 5, soThang: 3, soDonXet: 12, soBatch: 3, biCat: false, thoiGianMs: 1, chayLuc: '2026-11-19T00:00:00.000Z', ketQua: [] };
const handler = (name: string): object => Object.getOwnPropertyDescriptor(KhaiThacAdminController.prototype, name)!.value as object;

describe('API admin Top-K', () => {
  it.each([{ k: 0 }, { k: 51 }, { k: 1.5 }, { k: '5' }, { k: true }, {}, { k: null }, { k: 5, soThang: 0 }, { k: 5, soThang: 13 },
    { k: 5, soThang: '3' }, { k: 5, soThang: 1.5 }, { k: 5, soThang: null }, { k: 5, luuGoiY: 'true' }, { k: 5, luuGoiY: null }])('400 cho body sai %j, lỗi tiếng Việt', async (body) => {
    await expect(validate(body)).rejects.toMatchObject({ status: 400, response: { message: expect.arrayContaining([expect.stringMatching(/K |Số tháng|Lưu gợi ý/)]) } });
  });

  it('mặc định 3 tháng, không lưu; phân tích không ghi DB', async () => {
    const service = { chay: vi.fn().mockResolvedValue(kq), luuGoiY: vi.fn() };
    const ctrl = new KhaiThacAdminController(service as never);
    const dto = await validate({ k: 5 });
    expect(dto).toEqual({ k: 5, soThang: 3, luuGoiY: false });
    expect(await ctrl.topK(dto)).toEqual({ thanhCong: true, daLuuGoiY: false, ...kq });
    expect(service.chay).toHaveBeenCalledWith(5, 3);
    expect(service.luuGoiY).not.toHaveBeenCalled();
  });

  it('lưu chỉ khi yêu cầu, và không trả thành công nếu lưu lỗi', async () => {
    const service = { chay: vi.fn().mockResolvedValue(kq), luuGoiY: vi.fn().mockResolvedValue(undefined) };
    const ctrl = new KhaiThacAdminController(service as never);
    const dto = await validate({ k: 5, soThang: 3, luuGoiY: true });
    expect(await ctrl.topK(dto)).toEqual({ thanhCong: true, daLuuGoiY: true, ...kq });
    expect(service.luuGoiY).toHaveBeenCalledWith(kq);
    service.luuGoiY.mockRejectedValueOnce(new Error('ghi lỗi'));
    await expect(ctrl.topK(dto)).rejects.toThrow('ghi lỗi');
  });

  it('GET đã lưu trả cấu trúc rỗng/có dữ liệu', async () => {
    const saved = { k: 5, soThang: 3, capNhatLuc: kq.chayLuc, ketQua: [] };
    const service = { docGoiYDaLuu: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(saved) };
    const ctrl = new KhaiThacAdminController(service as never);
    expect(await ctrl.goiYDaLuu()).toEqual({ coDuLieu: false, ketQua: [] });
    expect(await ctrl.goiYDaLuu()).toEqual({ coDuLieu: true, ...saved });
  });

  it('metadata đúng route, POST 200 và class chỉ Admin', () => {
    expect(Reflect.getMetadata(PATH_METADATA, KhaiThacAdminController)).toBe('admin/khai-thac');
    expect(Reflect.getMetadata(ROLES_KEY, KhaiThacAdminController)).toEqual([1]);
    expect(Reflect.getMetadata(PATH_METADATA, handler('topK'))).toBe('top-k');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler('topK'))).toBe(200);
    expect(Reflect.getMetadata(PATH_METADATA, handler('goiYDaLuu'))).toBe('goi-y-da-luu');
  });

  it.each([1, 2, 3, undefined])('guard thật cho vai trò %s trên cả hai endpoint', (maQuyen) => {
    const guard = new AccessGuard(new Reflector());
    for (const method of ['topK', 'goiYDaLuu']) {
      const context = { getClass: () => KhaiThacAdminController, getHandler: () => handler(method),
        switchToHttp: () => ({ getRequest: () => ({ user: maQuyen ? { maQuyen } : undefined }) }) } as unknown as ExecutionContext;
      if (maQuyen === 1) expect(guard.canActivate(context)).toBe(true);
      else expect(() => guard.canActivate(context)).toThrow(expect.objectContaining({ status: maQuyen ? 403 : 401 }));
    }
  });
});
