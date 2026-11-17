import {
  ArrayMaxSize, IsArray, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import {
  CHAN_THUONG, ChanThuong, LOI_CHOI, LoiChoi, NOI_DUNG, NoiDung, TAY_THUAN, TayThuan, TOI_DA_BUOI_MOI_TUAN, TRINH_DO, TrinhDo,
} from '../common/ho-so-choi';

export const SDT_REGEX = /^0[0-9]{9,10}$/;
export const SDT_MESSAGE = 'Số điện thoại phải bắt đầu bằng 0 và có 10–11 chữ số.';

export class DangNhapDto {
  @IsString({ message: 'Vui lòng nhập tên đăng nhập.' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập.' })
  @MaxLength(50)
  tenDangNhap: string;

  @IsString({ message: 'Vui lòng nhập mật khẩu.' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu.' })
  @MaxLength(100)
  matKhau: string;
}

export class DangKyDto {
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập họ tên.' }) @MaxLength(100)
  hoTen: string;

  @IsString() @MinLength(3, { message: 'Tên đăng nhập tối thiểu 3 ký tự.' }) @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Tên đăng nhập chỉ gồm chữ, số, gạch ngang và gạch dưới.' })
  tenDangNhap: string;

  @IsEmail({}, { message: 'Email không hợp lệ.' }) @MaxLength(100)
  email: string;

  @IsOptional() @Matches(SDT_REGEX, { message: SDT_MESSAGE })
  soDienThoai?: string;

  @IsOptional() @IsString() @MaxLength(255)
  diaChi?: string;

  @IsString() @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự.' }) @MaxLength(100)
  matKhau: string;

  @IsString()
  xacNhanMatKhau: string;
}

export class DoiMatKhauDto {
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu cũ.' })
  matKhauCu: string;

  @IsString() @MinLength(6, { message: 'Mật khẩu mới tối thiểu 6 ký tự.' }) @MaxLength(100)
  matKhauMoi: string;

  @IsString()
  xacNhanMoi: string;
}

/** Bản khai đầy đủ hồ sơ người chơi (PUT). Trường bỏ trống hoặc null nghĩa là xoá trường đó; mọi trường đều không bắt buộc. */
export class HoSoChoiDto {
  @IsOptional() @IsIn(TRINH_DO, { message: 'Trình độ không hợp lệ.' })
  trinhDo?: TrinhDo | null;

  @IsOptional() @IsArray() @ArrayMaxSize(NOI_DUNG.length) @IsIn(NOI_DUNG, { each: true, message: 'Nội dung đánh không hợp lệ.' })
  noiDung?: NoiDung[] | null;

  @IsOptional() @IsIn(LOI_CHOI, { message: 'Lối chơi không hợp lệ.' })
  loiChoi?: LoiChoi | null;

  @IsOptional() @IsIn(TAY_THUAN, { message: 'Tay thuận không hợp lệ.' })
  tayThuan?: TayThuan | null;

  @IsOptional() @IsArray() @ArrayMaxSize(CHAN_THUONG.length) @IsIn(CHAN_THUONG, { each: true, message: 'Vị trí chấn thương không hợp lệ.' })
  chanThuong?: ChanThuong[] | null;

  @IsOptional() @IsInt({ message: 'Số buổi mỗi tuần phải là số nguyên.' }) @Min(0) @Max(TOI_DA_BUOI_MOI_TUAN, { message: `Tối đa ${TOI_DA_BUOI_MOI_TUAN} buổi mỗi tuần.` })
  soBuoiMoiTuan?: number | null;
}
