import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../auth/auth.decorators';
import { CanDangNhap } from '../auth/auth.guards';
import type { NguoiDung } from '../auth/auth.types';
import { GioHangService } from './gio-hang.service';

class ThemGioHangDto {
  @IsMongoId({ message: 'Vui lòng chọn phiên bản (màu/size) sản phẩm.' })
  chiTietId: string;

  @IsOptional() @Type(() => Number)
  @IsInt() @Min(1, { message: 'Số lượng phải lớn hơn 0.' }) @Max(100, { message: 'Mỗi lần chỉ được thêm tối đa 100 sản phẩm.' })
  quantity?: number;
}

class CapNhatGioHangDto {
  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên.' })
  @Min(1, { message: 'Số lượng sản phẩm trong giỏ hàng phải lớn hơn 0.' })
  @Max(100, { message: 'Mỗi sản phẩm chỉ được đặt tối đa 100.' })
  quantity: number;
}

@Controller('gio-hang')
export class GioHangController {
  constructor(private readonly gioHang: GioHangService) {}

  /** Số lượng trong giỏ; khách chưa đăng nhập luôn là 0. */
  @Get('count')
  async count(@CurrentUser() user?: NguoiDung) {
    return { count: user ? await this.gioHang.dem(user.id) : 0 };
  }

  @Get()
  @CanDangNhap()
  xem(@CurrentUser() user: NguoiDung) {
    return this.gioHang.xem(user.id);
  }

  @Post()
  @CanDangNhap()
  them(@CurrentUser() user: NguoiDung, @Body() dto: ThemGioHangDto) {
    return this.gioHang.them(user.id, dto.chiTietId, dto.quantity ?? 1);
  }

  @Patch(':id')
  @CanDangNhap()
  capNhat(@CurrentUser() user: NguoiDung, @Param('id') id: string, @Body() dto: CapNhatGioHangDto) {
    return this.gioHang.capNhat(user.id, id, dto.quantity);
  }

  @Delete(':id')
  @CanDangNhap()
  xoa(@CurrentUser() user: NguoiDung, @Param('id') id: string) {
    return this.gioHang.xoa(user.id, id);
  }
}
