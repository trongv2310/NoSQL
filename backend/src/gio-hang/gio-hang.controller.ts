import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsInt, IsMongoId, IsOptional, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../auth/auth.decorators';
import { CanDangNhap } from '../auth/auth.guards';
import type { NguoiDung } from '../auth/auth.types';
import { GioHangService } from './gio-hang.service';
import { GioKhachService, MA_LOI_SAI_TAI_KHOAN } from './gio-khach.service';
import { TOI_DA_SO_LUONG } from './gio-khach';

export class ThemGioHangDto {
  @IsMongoId({ message: 'Vui lòng chọn phiên bản (màu/size) sản phẩm.' })
  chiTietId: string;

  @IsOptional() @Type(() => Number)
  @IsInt() @Min(1, { message: 'Số lượng phải lớn hơn 0.' }) @Max(100, { message: 'Mỗi lần chỉ được thêm tối đa 100 sản phẩm.' })
  quantity?: number;

  /**
   * Tài khoản mà trình duyệt định thêm món này cho (giao diện lúc người dùng bấm). Tùy chọn để client cũ vẫn chạy; khi có gửi thì server đối chiếu
   * với tài khoản của phiên đăng nhập và từ chối 403 TRƯỚC khi ghi bất cứ thứ gì nếu khác nhau. Giỏ luôn chọn theo phiên đăng nhập, không bao giờ theo giá trị này.
   */
  @IsOptional() @IsMongoId({ message: 'Tài khoản dự kiến không hợp lệ.' })
  taiKhoanDuKien?: string;
}

class CapNhatGioHangDto {
  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên.' })
  @Min(1, { message: 'Số lượng sản phẩm trong giỏ hàng phải lớn hơn 0.' })
  @Max(100, { message: 'Mỗi sản phẩm chỉ được đặt tối đa 100.' })
  quantity: number;
}

/** Một dòng giỏ khách: chỉ nhận id biến thể và số lượng nguyên (không ép kiểu chuỗi/boolean). Mọi trường khác bị bỏ qua. */
export class DongGioDto {
  @IsMongoId({ message: 'Phiên bản sản phẩm không hợp lệ.' })
  chiTietId: string;

  @IsInt({ message: 'Số lượng phải là số nguyên.' })
  @Min(1, { message: 'Số lượng phải lớn hơn 0.' })
  @Max(TOI_DA_SO_LUONG, { message: `Mỗi sản phẩm chỉ được đặt tối đa ${TOI_DA_SO_LUONG}.` })
  soLuong: number;
}

/** Số dòng thô được phép gửi lên (có thể trùng id); sau khi gộp, số sản phẩm khác nhau còn bị giới hạn lại ở service. */
const TOI_DA_DONG_THO = 100;

export class TinhGioDto {
  @IsArray({ message: 'Danh sách sản phẩm không hợp lệ.' })
  @ArrayMaxSize(TOI_DA_DONG_THO, { message: 'Giỏ hàng có quá nhiều dòng.' })
  @ValidateNested({ each: true })
  @Type(() => DongGioDto)
  dong: DongGioDto[];
}

export class DongBoGioDto extends TinhGioDto {
  @Matches(/^[A-Za-z0-9_-]{16,64}$/, { message: 'Mã đồng bộ không hợp lệ.' })
  syncId: string;

  /**
   * Tài khoản mà trình duyệt lập bản đồng bộ này cho. Server KHÔNG dùng nó để chọn giỏ: giỏ luôn chọn theo tài khoản của phiên đăng
   * nhập; giá trị này chỉ để đối chiếu, khác nhau thì từ chối 403 (xem GioKhachService.dongBo).
   */
  @IsMongoId({ message: 'Tài khoản dự kiến không hợp lệ.' })
  taiKhoanId: string;
}

/**
 * Thêm món theo ý định của một tài khoản cụ thể: nếu phiên đăng nhập đã đổi sang người khác (đăng nhập ở thẻ khác, hoặc giữa lúc yêu cầu đang chờ)
 * thì từ chối 403 kèm maLoi trước khi chạm vào giỏ nào. Không có giá trị dự kiến thì giữ hành vi cũ.
 */
export function kiemTraChuGio(principalId: string, taiKhoanDuKien?: string): void {
  if (taiKhoanDuKien !== undefined && String(taiKhoanDuKien) !== String(principalId)) {
    throw new ForbiddenException({
      message: 'Phiên đăng nhập đã đổi sang tài khoản khác nên sản phẩm này chưa được thêm vào giỏ hàng.',
      maLoi: MA_LOI_SAI_TAI_KHOAN,
    });
  }
}

@Controller('gio-hang')
export class GioHangController {
  constructor(
    private readonly gioHang: GioHangService,
    private readonly gioKhach: GioKhachService,
  ) {}

  /** Báo giá công khai cho giỏ của khách chưa đăng nhập: giá, tồn kho và trạng thái từng dòng đều do server tính lại. */
  @Post('tinh')
  @HttpCode(200)
  tinh(@Body() dto: TinhGioDto) {
    return this.gioKhach.tinh(dto.dong);
  }

  /** Gộp giỏ khách vào giỏ tài khoản sau đăng nhập. Gửi lại cùng syncId không cộng thêm lần nữa. */
  @Post('dong-bo')
  @HttpCode(200)
  @CanDangNhap()
  dongBo(@CurrentUser() user: NguoiDung, @Body() dto: DongBoGioDto) {
    return this.gioKhach.dongBo(user.id, dto.taiKhoanId, dto.syncId, dto.dong);
  }

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
    kiemTraChuGio(user.id, dto.taiKhoanDuKien);
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
