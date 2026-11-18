import { Body, Controller, Delete, Get, HttpCode, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from './auth.decorators';
import { DangKyDto, DangNhapDto, DoiMatKhauDto, HoSoChoiDto } from './auth.dto';
import { CanDangNhap, COOKIE_TOKEN } from './auth.guards';
import { AuthService } from './auth.service';
import type { NguoiDung } from './auth.types';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
  maxAge: 7 * 24 * 3600 * 1000,
  path: '/',
};

/** Địa chỉ IP người gọi (sau proxy Next.js thì lấy phần tử cuối của x-forwarded-for do proxy thêm vào). */
function diaChiIp(req: Request): string {
  const xff = String(req.headers['x-forwarded-for'] ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  return xff[xff.length - 1] ?? req.ip ?? req.socket?.remoteAddress ?? '?';
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('dang-nhap')
  @HttpCode(200)
  async dangNhap(@Body() dto: DangNhapDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.dangNhap(dto, false, diaChiIp(req));
    res.cookie(COOKIE_TOKEN, token, COOKIE_OPTS);
    return { user, message: 'Đăng nhập thành công.' };
  }

  @Post('admin/dang-nhap')
  @HttpCode(200)
  async adminDangNhap(@Body() dto: DangNhapDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.dangNhap(dto, true, diaChiIp(req));
    res.cookie(COOKIE_TOKEN, token, COOKIE_OPTS);
    return { user, message: 'Đăng nhập thành công.' };
  }

  @Post('dang-ky')
  async dangKy(@Body() dto: DangKyDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.dangKy(dto);
    res.cookie(COOKIE_TOKEN, token, COOKIE_OPTS);
    return { user, message: 'Đăng ký tài khoản thành công!' };
  }

  @Post('dang-xuat')
  @HttpCode(200)
  dangXuat(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_TOKEN, { path: '/' });
    return { message: 'Bạn đã đăng xuất.' };
  }

  /** Trả về người dùng hiện tại hoặc null nếu chưa đăng nhập (không báo lỗi 401). */
  @Get('me')
  async me(@CurrentUser() user?: NguoiDung) {
    return { user: user ? await this.auth.thongTinHienTai(user.id) : null };
  }

  @Get('thong-tin')
  @CanDangNhap()
  thongTin(@CurrentUser() user: NguoiDung) {
    return this.auth.thongTinKhachHang(user.id);
  }

  /** Hồ sơ người chơi: chỉ chủ tài khoản đọc/ghi được (có thông tin chấn thương). */
  @Get('ho-so-choi')
  @CanDangNhap()
  hoSoChoi(@CurrentUser() user: NguoiDung) {
    return this.auth.hoSoChoi(user.id);
  }

  @Put('ho-so-choi')
  @CanDangNhap()
  async capNhatHoSoChoi(@CurrentUser() user: NguoiDung, @Body() dto: HoSoChoiDto) {
    return { ...(await this.auth.capNhatHoSoChoi(user.id, dto)), message: 'Đã lưu hồ sơ người chơi.' };
  }

  @Delete('ho-so-choi')
  @CanDangNhap()
  async xoaHoSoChoi(@CurrentUser() user: NguoiDung) {
    await this.auth.xoaHoSoChoi(user.id);
    return { hoSoChoi: null, message: 'Đã xoá hồ sơ người chơi.' };
  }

  @Post('doi-mat-khau')
  @HttpCode(200)
  @CanDangNhap()
  async doiMatKhau(@CurrentUser() user: NguoiDung, @Body() dto: DoiMatKhauDto) {
    await this.auth.doiMatKhau(user.id, dto);
    return { message: 'Đổi mật khẩu thành công!' };
  }
}
