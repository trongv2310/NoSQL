import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AdminBanTinController } from '../admin/admin-ban-tin.controller';
import { AdminBaoCaoController } from '../admin/admin-bao-cao.controller';
import { AdminKhuyenMaiController, AdminLogoController, AdminTaiKhoanController, AdminTranDauController } from '../admin/admin-danh-muc.controller';
import { AdminSanPhamController } from '../admin/admin-san-pham.controller';
import { AdminVanHanhController } from '../admin/admin-van-hanh.controller';
import { Quyen } from '../schemas';
import { SuKienController } from '../su-kien/su-kien.controller';
import { AdminLichCangController } from '../tu-vot/lich-cang.controller';
import { AccessGuard, ROLES_KEY } from './auth.guards';
import { PATH_METADATA } from '@nestjs/common/constants';
import * as KhaiThacAdmin from '../khai-thac/khai-thac-admin.controller';
import * as KhaiThacCongKhai from '../khai-thac/khai-thac-cong-khai.controller';

const A = [Quyen.Admin];
const AN = [Quyen.Admin, Quyen.NhanVien];
const nhom = [
  [AdminSanPhamController, ['formSanPham', 'luaChonBienThe', 'danhSach', 'chiTiet', 'layDeSua', 'tao', 'capNhat', 'themBienThe', 'layBienThe', 'capNhatBienThe', 'an', 'hien'], AN],
  [AdminSanPhamController, ['xoa', 'xoaBienThe'], A],
  [AdminVanHanhController, ['danhSachDon', 'chiTietDon', 'doiTrangThai'], AN],
  [AdminVanHanhController, ['thongBao', 'soThongBao', 'dashboard'], A],
  [AdminBanTinController, ['form', 'danhSach', 'chiTiet', 'tao', 'capNhat', 'doiTrangThai', 'uploadAnh', 'aiGenerate'], AN],
  [AdminBanTinController, ['xoa'], A],
  [AdminTranDauController, ['danhSach', 'chiTiet', 'tao', 'capNhat', 'doiTrangThai'], AN],
  [AdminTranDauController, ['xoa'], A],
  [AdminKhuyenMaiController, ['danhSach', 'chiTiet', 'tao', 'capNhat', 'xoa'], A],
  [AdminTaiKhoanController, ['danhSach', 'chiTiet', 'tao', 'capNhat', 'xoa'], A],
  [AdminLogoController, ['xem', 'capNhat'], A],
  [AdminBaoCaoController, ['baoCao'], A],
  [AdminLichCangController, ['danhSach', 'xong'], A],
  [SuKienController, ['trangThai', 'luong'], A],
] as const;
const reflector = new Reflector();
const bang = nhom.flatMap(([controller, methods, roles]) => methods.map((method) => ({ controller, method, roles })));

describe('Quyền hiện tại của endpoint quản trị', () => {
  it.each(bang)('$controller.name.$method có quyền hiệu lực $roles', ({ controller, method, roles }) => {
    const handler = (controller.prototype as unknown as Record<string, unknown>)[method];
    expect(typeof handler).toBe('function');
    expect(Reflect.getMetadata(METHOD_METADATA, handler as Function)).toBeDefined();
    expect(reflector.getAllAndOverride(ROLES_KEY, [handler as Function, controller])).toEqual(roles);
  });

  it.each([...new Set(nhom.map(([controller]) => controller))])('%s không bỏ sót endpoint trong bảng', (controller) => {
    const methods = bang.filter((row) => row.controller === controller).map((row) => row.method);
    const actual = Object.getOwnPropertyNames(controller.prototype).filter((name) => {
      const handler = (controller.prototype as unknown as Record<string, unknown>)[name];
      return typeof handler === 'function' && Reflect.getMetadata(METHOD_METADATA, handler) !== undefined;
    });
    expect(actual.sort()).toEqual([...methods].sort());
  });
});

describe('Top-K: phân quyền API theo CONTRACT-D2', () => {
  const guard = new AccessGuard(reflector);
  const timRoute = (exports: Record<string, unknown>, prefix: string, path: string, method: number) => {
    const controller = Object.values(exports).find((x) => typeof x === 'function' && Reflect.getMetadata(PATH_METADATA, x) === prefix) as Function | undefined;
    expect(controller, `thiếu controller ${prefix}`).toBeDefined();
    const proto = controller!.prototype as Record<string, unknown>;
    const name = Object.getOwnPropertyNames(proto).find((key) => {
      const f = proto[key];
      return typeof f === 'function' && Reflect.getMetadata(PATH_METADATA, f) === path && Reflect.getMetadata(METHOD_METADATA, f) === method;
    });
    expect(name, `thiếu ${prefix}/${path}`).toBeDefined();
    return { controller: controller!, handler: proto[name!] as Function };
  };
  const ctx = (controller: Function, handler: Function, role?: Quyen) => ({
    getHandler: () => handler, getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: role === undefined ? undefined : { maQuyen: role } }) }),
  }) as unknown as ExecutionContext;

  it.each([['top-k', 1], ['goi-y-da-luu', 0]])('admin/khai-thac/%s chỉ cho Admin', (path, method) => {
    const { controller, handler } = timRoute(KhaiThacAdmin, 'admin/khai-thac', path, method);
    expect(Reflect.getMetadata(ROLES_KEY, controller)).toEqual([Quyen.Admin]);
    expect(guard.canActivate(ctx(controller, handler, Quyen.Admin))).toBe(true);
    for (const role of [Quyen.NhanVien, Quyen.KhachHang]) expect(() => guard.canActivate(ctx(controller, handler, role))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx(controller, handler))).toThrow(UnauthorizedException);
  });

  it.each(['combo', 'san-pham/:id'])('goi-y/%s công khai không yêu cầu phiên', (path) => {
    const { controller, handler } = timRoute(KhaiThacCongKhai, 'goi-y', path, 0);
    expect(guard.canActivate(ctx(controller, handler))).toBe(true);
  });
});

describe('T-204: AccessGuard theo từng endpoint C-3', () => {
  const guard = new AccessGuard(reflector);
  it.each(bang)('$controller.name.$method: admin, nhân viên và khách', ({ controller, method, roles }) => {
    const handler = Object.getOwnPropertyDescriptor(controller.prototype, method)!.value as Function;
    const ctx = (maQuyen: Quyen) => ({ getHandler: () => handler, getClass: () => controller, switchToHttp: () => ({ getRequest: () => ({ user: { maQuyen } }) }) }) as unknown as ExecutionContext;
    expect(guard.canActivate(ctx(Quyen.Admin))).toBe(true);
    if ((roles as readonly Quyen[]).includes(Quyen.NhanVien)) expect(guard.canActivate(ctx(Quyen.NhanVien))).toBe(true);
    else expect(() => guard.canActivate(ctx(Quyen.NhanVien))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx(Quyen.KhachHang))).toThrow(ForbiddenException);
  });
});

describe('AccessGuard', () => {
  const guard = new AccessGuard(reflector);
  const context = (handler: Function, controller: Function, maQuyen?: Quyen) => ({
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: maQuyen === undefined ? undefined : { maQuyen } }) }),
  }) as unknown as ExecutionContext;
  const handler = Object.getOwnPropertyDescriptor(AdminSanPhamController.prototype, 'xoa')!.value as Function;

  it('chưa đăng nhập nhận 401', () => {
    expect(() => guard.canActivate(context(handler, AdminSanPhamController))).toThrow(UnauthorizedException);
  });

  it.each([Quyen.NhanVien, Quyen.KhachHang])('sai quyền %i nhận 403', (quyen) => {
    expect(() => guard.canActivate(context(handler, AdminSanPhamController, quyen))).toThrow(ForbiddenException);
  });

  it('admin được phép', () => {
    expect(guard.canActivate(context(handler, AdminSanPhamController, Quyen.Admin))).toBe(true);
  });

  it('metadata của method ưu tiên hơn class', () => {
    class Gia {}
    const method = () => {};
    Reflect.defineMetadata(ROLES_KEY, A, Gia);
    Reflect.defineMetadata(ROLES_KEY, AN, method);
    expect(guard.canActivate(context(method, Gia, Quyen.NhanVien))).toBe(true);
    expect(() => guard.canActivate(context(method, Gia, Quyen.KhachHang))).toThrow(ForbiddenException);
  });
});
