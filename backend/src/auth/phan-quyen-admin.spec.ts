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
