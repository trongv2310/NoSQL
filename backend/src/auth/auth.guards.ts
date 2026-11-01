import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthRequest } from './auth.types';
import { Quyen } from '../schemas';

export const COOKIE_TOKEN = 'token';

/** Guard toàn cục: nếu có token hợp lệ thì gắn req.user, không bao giờ chặn request. */
@Injectable()
export class ParseTokenGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;
    const token = (req.cookies?.[COOKIE_TOKEN] as string | undefined) ?? bearer;
    if (token) {
      try {
        const p = this.jwt.verify<{ sub: string; tenDangNhap: string; maQuyen: number }>(token);
        req.user = { id: p.sub, tenDangNhap: p.tenDangNhap, maQuyen: p.maQuyen };
      } catch {
        req.user = undefined;
      }
    }
    return true;
  }
}

export const ROLES_KEY = 'roles';
export const LOGIN_KEY = 'requireLogin';

/** Yêu cầu đăng nhập (mọi vai trò). */
export const CanDangNhap = () => SetMetadata(LOGIN_KEY, true);
/** Chỉ cho phép các vai trò liệt kê. Admin = 1, Nhân viên = 2, Khách = 3. */
export const Roles = (...roles: Quyen[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<Quyen[] | undefined>(ROLES_KEY, targets);
    const needLogin = this.reflector.getAllAndOverride<boolean | undefined>(LOGIN_KEY, targets);
    if (!roles && !needLogin) {
      return true;
    }
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (!req.user) {
      throw new UnauthorizedException('Vui lòng đăng nhập để tiếp tục.');
    }
    if (roles && !roles.includes(req.user.maQuyen)) {
      throw new ForbiddenException(
        req.user.maQuyen === Quyen.NhanVien
          ? 'Bạn không có quyền truy cập chức năng này (chỉ dành cho Quản trị viên).'
          : 'Bạn không có quyền truy cập vào trang quản trị.',
      );
    }
    return true;
  }
}
