import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Model, Types } from 'mongoose';
import { CurrentUser } from '../auth/auth.decorators';
import { CanDangNhap } from '../auth/auth.guards';
import type { NguoiDung } from '../auth/auth.types';
import { locPhanHoiCongKhai, THE_DANH_GIA, TheDanhGia } from '../common/danh-gia';
import { parseObjectId } from '../common/helpers';
import { ChiTietSanPham, DonHang, KhachHang, PhanHoi, SanPham, TRANG_THAI } from '../schemas';
import { chupNguoiDanh, ketQuaDanhGia, nhomTuQuery, pipelineDanhGia } from './danh-gia-nhom';

const coKhong = ({ value }: { value: unknown }) => (value === undefined ? undefined : value === true || value === 'true');

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

  /** Phiên bản đang dùng (không bắt buộc), phải thuộc đúng sản phẩm. */
  @IsOptional() @IsMongoId({ message: 'Phiên bản không hợp lệ.' })
  bienTheId?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(THE_DANH_GIA.length) @IsIn(THE_DANH_GIA, { each: true, message: 'Thẻ cảm nhận không hợp lệ.' })
  the?: TheDanhGia[];

  /** Kèm bản chụp hồ sơ người chơi (trình độ, nội dung đánh, lối chơi). Mặc định có. */
  @IsOptional() @Transform(coKhong) @IsBoolean()
  chiaSeHoSo?: boolean;

  /** Kèm thông tin chấn thương (chỉ dùng thống kê, không hiện công khai). Mặc định KHÔNG. */
  @IsOptional() @Transform(coKhong) @IsBoolean()
  chiaSeChanThuong?: boolean;
}

@Controller('phan-hoi')
export class PhanHoiController {
  constructor(
    @InjectModel(PhanHoi.name) private readonly phanHoiModel: Model<PhanHoi>,
    @InjectModel(SanPham.name) private readonly sanPhamModel: Model<SanPham>,
    @InjectModel(KhachHang.name) private readonly khachHangModel: Model<KhachHang>,
    @InjectModel(ChiTietSanPham.name) private readonly chiTietModel: Model<ChiTietSanPham>,
    @InjectModel(DonHang.name) private readonly donHangModel: Model<DonHang>,
  ) {}

  @Post()
  @CanDangNhap()
  async gui(@CurrentUser() user: NguoiDung, @Body() dto: GuiDanhGiaDto) {
    if (!(await this.sanPhamModel.exists({ _id: dto.sanPhamId, deletedAt: null }))) {
      throw new NotFoundException('Không tìm thấy sản phẩm.');
    }
    const kh = await this.khachHangModel.findOne({ taiKhoan: user.id }, { _id: 1, hoSoChoi: 1 }).lean();
    if (!kh) {
      throw new BadRequestException('Tài khoản của bạn không phải là khách hàng và không thể gửi đánh giá.');
    }
    if (dto.bienTheId && !(await this.chiTietModel.exists({ _id: dto.bienTheId, sanPham: dto.sanPhamId }))) {
      throw new BadRequestException('Phiên bản không thuộc sản phẩm này.');
    }
    // "Đã mua hàng": có đơn ĐÃ HOÀN THÀNH của chính khách này chứa sản phẩm (truy vấn trên mảng nhúng chiTiet, dùng index don_cua_khach).
    const daMuaHang = !!(await this.donHangModel.exists({
      khachHang: kh._id, trangThai: TRANG_THAI.HoanThanh, 'chiTiet.sanPham': new Types.ObjectId(dto.sanPhamId),
    }));
    const nguoiDanh = chupNguoiDanh(kh.hoSoChoi, { chiaSeHoSo: dto.chiaSeHoSo ?? true, chiaSeChanThuong: dto.chiaSeChanThuong ?? false });
    await this.phanHoiModel.create({
      khachHang: kh._id,
      sanPham: dto.sanPhamId,
      danhGia: dto.danhGia,
      noiDung: dto.noiDung,
      // Gửi qua tài khoản khách hàng thật trên hệ thống nên được tính là đã xác minh (khác dữ liệu mẫu/import).
      daXacMinh: true,
      daMuaHang,
      ...(dto.bienTheId ? { bienThe: dto.bienTheId } : {}),
      ...(nguoiDanh ? { nguoiDanh } : {}),
      ...(dto.the?.length ? { the: [...new Set(dto.the)] } : {}),
    });
    return { message: 'Gửi đánh giá thành công!', daMuaHang, kemHoSo: !!nguoiDanh };
  }

  /**
   * Thống kê đánh giá của một sản phẩm, kèm nhánh "người chơi giống bạn" khi có `trinhDo` (và tuỳ chọn `noiDung=don,doi`).
   * Công khai: không trả thông tin chấn thương, không trả danh tính.
   */
  @Get('san-pham/:id')
  async thongKe(@Param('id') id: string, @Query() q: Record<string, unknown>) {
    const sanPham = parseObjectId(id, 'Mã sản phẩm');
    const nhom = nhomTuQuery(q);
    const [f] = await this.phanHoiModel.aggregate(pipelineDanhGia(sanPham, nhom, locPhanHoiCongKhai()));
    return ketQuaDanhGia(f ?? {}, nhom);
  }

  /**
   * Bật/tắt "hữu ích". Mỗi khách tính một lần: điều kiện `huuIch: { $ne: kh }` nằm CÙNG lệnh với $addToSet + $inc, nên bấm hai lần
   * hay hai tab gửi song song cũng không cộng đôi; bỏ bấm thì ngược lại ($pull + $inc -1 khi `huuIch: kh`). Không tự bấm cho đánh giá của mình.
   */
  @Post(':id/huu-ich')
  @HttpCode(200)
  @CanDangNhap()
  async huuIch(@CurrentUser() user: NguoiDung, @Param('id') id: string) {
    const _id = parseObjectId(id, 'Mã đánh giá');
    const kh = await this.khachHangModel.findOne({ taiKhoan: user.id }, { _id: 1 }).lean();
    if (!kh) throw new BadRequestException('Tài khoản của bạn không phải là khách hàng.');
    const loc = { _id, ...locPhanHoiCongKhai(), khachHang: { $ne: kh._id } };
    const sau = { returnDocument: 'after' as const, projection: { soHuuIch: 1 } };
    let doc = await this.phanHoiModel.findOneAndUpdate({ ...loc, huuIch: { $ne: kh._id } }, { $addToSet: { huuIch: kh._id }, $inc: { soHuuIch: 1 } }, sau).lean();
    if (doc) return { daBam: true, soHuuIch: doc.soHuuIch };
    doc = await this.phanHoiModel.findOneAndUpdate({ ...loc, huuIch: kh._id }, { $pull: { huuIch: kh._id }, $inc: { soHuuIch: -1 } }, sau).lean();
    if (doc) return { daBam: false, soHuuIch: doc.soHuuIch };
    throw new NotFoundException('Không tìm thấy đánh giá (hoặc đây là đánh giá của chính bạn).');
  }
}
