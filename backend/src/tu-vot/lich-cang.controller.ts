import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsISO8601, IsMongoId, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/auth.decorators';
import { CanDangNhap, Roles } from '../auth/auth.guards';
import type { NguoiDung } from '../auth/auth.types';
import { Quyen } from '../schemas';
import { LichCangService } from './lich-cang.service';
import { TuVotService } from './tu-vot.service';

class DatChoDto {
  @IsISO8601({}, { message: 'Khung giờ không hợp lệ.' }) ngay: string;
  @IsMongoId({ message: 'Mã vợt không hợp lệ.' }) votCaNhanId: string;
  @IsNumber({}, { message: 'Số căng phải là số.' }) giaTri: number;
  @IsIn(['kg', 'lbs'], { message: 'Đơn vị là kg hoặc lbs.' }) donVi: 'kg' | 'lbs';
  @IsOptional() @IsString() @MaxLength(60) tenDay?: string;
}

/** Khách: đặt lịch căng cước tại shop cho một cây vợt trong tủ. */
@Controller('lich-cang')
@CanDangNhap()
export class LichCangController {
  constructor(private readonly lich: LichCangService, private readonly tuVot: TuVotService) {}

  @Get('khung')
  khung() {
    return this.lich.khungTrong();
  }

  @Get('cua-toi')
  async cuaToi(@CurrentUser() user: NguoiDung) {
    const kh = await this.tuVot.khachHangCua(user.id);
    return { lich: await this.lich.cuaToi(kh._id) };
  }

  @Post()
  async dat(@CurrentUser() user: NguoiDung, @Body() dto: DatChoDto) {
    const kh = await this.tuVot.khachHangCua(user.id);
    return { ...(await this.lich.datCho(kh._id, dto)), message: 'Đã đặt lịch căng tại shop.' };
  }

  @Post(':lichId/:datChoId/huy')
  @HttpCode(200)
  async huy(@CurrentUser() user: NguoiDung, @Param('lichId') lichId: string, @Param('datChoId') datChoId: string) {
    const kh = await this.tuVot.khachHangCua(user.id);
    await this.lich.huyCho(kh._id, lichId, datChoId);
    return { message: 'Đã huỷ lịch căng.' };
  }
}

/** Nhân viên/quản trị: xem lịch và đánh dấu đã căng xong (ghi luôn vào sổ căng của khách). */
@Roles(Quyen.Admin)
@Controller('admin/lich-cang')
export class AdminLichCangController {
  constructor(private readonly lich: LichCangService) {}

  @Get()
  danhSach(@Query('tu') tu?: string, @Query('den') den?: string) {
    const a = tu ? new Date(tu) : new Date(Date.now() - 86_400_000);
    const b = den ? new Date(den) : new Date(a.getTime() + 8 * 86_400_000);
    if (Number.isNaN(+a) || Number.isNaN(+b) || b <= a || b.getTime() - a.getTime() > 62 * 86_400_000) throw new BadRequestException('Khoảng ngày không hợp lệ (tối đa 62 ngày).');
    return this.lich.theoKhoang(a, b);
  }

  @Post(':lichId/:datChoId/xong')
  @HttpCode(200)
  async xong(@Param('lichId') lichId: string, @Param('datChoId') datChoId: string) {
    return { ...(await this.lich.hoanTat(lichId, datChoId)), message: 'Đã ghi lần căng vào sổ của khách.' };
  }
}
