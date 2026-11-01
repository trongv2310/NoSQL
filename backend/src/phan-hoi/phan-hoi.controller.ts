import { Body, Controller, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Model } from 'mongoose';
import { CurrentUser } from '../auth/auth.decorators';
import { CanDangNhap } from '../auth/auth.guards';
import type { NguoiDung } from '../auth/auth.types';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KhachHang, PhanHoi, SanPham } from '../schemas';

class GuiDanhGiaDto {
  @IsMongoId({ message: 'Sản phẩm không hợp lệ.' })
  sanPhamId: string;

  @Type(() => Number)
  @IsInt({ message: 'Số sao đánh giá không hợp lệ.' })
  @Min(1, { message: 'Số sao đánh giá phải từ 1 đến 5.' })
  @Max(5, { message: 'Số sao đánh giá phải từ 1 đến 5.' })
  danhGia: number;

  @IsString()
  @MinLength(5, { message: 'Nội dung đánh giá tối thiểu 5 ký tự.' })
  @MaxLength(255, { message: 'Nội dung đánh giá tối đa 255 ký tự.' })
  noiDung: string;
}

@Controller('phan-hoi')
export class PhanHoiController {
  constructor(
    @InjectModel(PhanHoi.name) private readonly phanHoiModel: Model<PhanHoi>,
    @InjectModel(SanPham.name) private readonly sanPhamModel: Model<SanPham>,
    @InjectModel(KhachHang.name) private readonly khachHangModel: Model<KhachHang>,
  ) {}

  @Post()
  @CanDangNhap()
  async gui(@CurrentUser() user: NguoiDung, @Body() dto: GuiDanhGiaDto) {
    if (!(await this.sanPhamModel.exists({ _id: dto.sanPhamId, deletedAt: null }))) {
      throw new NotFoundException('Không tìm thấy sản phẩm.');
    }
    const kh = await this.khachHangModel.findOne({ taiKhoan: user.id }, { _id: 1 }).lean();
    if (!kh) {
      throw new BadRequestException('Tài khoản của bạn không phải là khách hàng và không thể gửi đánh giá.');
    }
    await this.phanHoiModel.create({
      khachHang: kh._id,
      sanPham: dto.sanPhamId,
      danhGia: dto.danhGia,
      noiDung: dto.noiDung,
    });
    return { message: 'Gửi đánh giá thành công!' };
  }
}
