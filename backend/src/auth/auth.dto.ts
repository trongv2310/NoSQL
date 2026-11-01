import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
