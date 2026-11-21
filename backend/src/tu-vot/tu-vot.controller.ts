import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsMongoId, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { CurrentUser } from '../auth/auth.decorators';
import { CanDangNhap } from '../auth/auth.guards';
import type { NguoiDung } from '../auth/auth.types';
import { LOAI_SU_KIEN, TOI_DA_CHU_KY_NGAY } from '../schemas/vot-ca-nhan.schema';
import { TuVotService } from './tu-vot.service';

const NGAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Định dạng trả về cho client như các API khác: có `id` dạng chuỗi, bỏ trường nội bộ của Mongoose (`__v`) và chủ sở hữu (`khachHang`,
 * vốn chỉ là chính người đang đăng nhập). Giữ lại `_id` để không làm hỏng giao diện tủ vợt đang đọc trường này.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xemTaiLieu<T extends Record<string, any> | null | undefined>(doc: T) {
  if (!doc) return doc;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __v, khachHang, ...con } = doc;
  return { id: String(doc._id), ...con };
}

class TaoVotDto {
  @IsString() @MinLength(1, { message: 'Nhập tên cây vợt.' }) @MaxLength(80, { message: 'Tên vợt tối đa 80 ký tự.' })
  ten: string;
  @IsOptional() @IsMongoId() sanPhamId?: string;
  @IsOptional() @IsMongoId() bienTheId?: string;
  @IsOptional() @IsString() @MaxLength(40, { message: 'Số serial tối đa 40 ký tự.' }) soSerial?: string;
  @IsOptional() @IsInt() @Min(1) @Max(TOI_DA_CHU_KY_NGAY, { message: `Chu kỳ nhắc từ 1 đến ${TOI_DA_CHU_KY_NGAY} ngày.` }) chuKyNhacNgay?: number | null;
  @IsOptional() @IsString() @MaxLength(200) ghiChu?: string;
}

class SuaVotDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) ten?: string;
  @IsOptional() @IsString() @MaxLength(40) soSerial?: string | null;
  /** null = tắt nhắc. */
  @IsOptional() @IsInt() @Min(1) @Max(TOI_DA_CHU_KY_NGAY, { message: `Chu kỳ nhắc từ 1 đến ${TOI_DA_CHU_KY_NGAY} ngày.` }) chuKyNhacNgay?: number | null;
  @IsOptional() @IsString() @MaxLength(200) ghiChu?: string;
}

class LanCangDto {
  @Matches(NGAY, { message: 'Ngày căng phải có dạng YYYY-MM-DD.' }) ngay: string;
  @IsNumber({}, { message: 'Số căng phải là số.' }) giaTri: number;
  @IsIn(['kg', 'lbs'], { message: 'Đơn vị là kg hoặc lbs.' }) donVi: 'kg' | 'lbs';
  @IsOptional() @IsString() @MaxLength(60, { message: 'Tên dây tối đa 60 ký tự.' }) tenDay?: string;
  @IsIn(['shop', 'ngoai'], { message: 'Nơi căng không hợp lệ.' }) noiCang: 'shop' | 'ngoai';
}

class SuKienDto {
  @IsIn(LOAI_SU_KIEN, { message: 'Loại sự kiện không hợp lệ.' }) loai: string;
  @Matches(NGAY) ngay: string;
  @IsOptional() @IsString() @MaxLength(200) ghiChu?: string;
}

class CangTrinhDuyetDto {
  @IsNumber() giaTri: number;
  @IsIn(['kg', 'lbs']) donVi: 'kg' | 'lbs';
}
class VotTrinhDuyetDto {
  @IsString() @MinLength(1) @MaxLength(80) id: string;
  @IsString() @MinLength(1) @MaxLength(80) ten: string;
  @IsOptional() @IsMongoId() sanPhamId?: string | null;
  @IsOptional() @IsMongoId() bienTheId?: string | null;
  @IsOptional() @Matches(NGAY) ngayCang?: string | null;
  @IsOptional() @ValidateNested() @Type(() => CangTrinhDuyetDto) cang?: CangTrinhDuyetDto | null;
  @IsOptional() @IsInt() @Min(1) @Max(TOI_DA_CHU_KY_NGAY) chuKyNgay?: number | null;
  @IsOptional() @IsString() @MaxLength(200) ghiChu?: string;
}
class ChuyenDto {
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => VotTrinhDuyetDto) vot: VotTrinhDuyetDto[];
}

/** Hộ chiếu cây vợt + sổ căng cước của khách đang đăng nhập (xem tu-vot.service.ts). */
@Controller('tu-vot')
@CanDangNhap()
export class TuVotController {
  constructor(private readonly tuVot: TuVotService) {}

  @Get()
  async danhSach(@CurrentUser() user: NguoiDung) {
    const kh = await this.tuVot.khachHangCua(user.id);
    return { vot: (await this.tuVot.danhSach(kh._id)).map(xemTaiLieu), coTransaction: await this.tuVot.dungTransaction() };
  }

  @Post()
  async tao(@CurrentUser() user: NguoiDung, @Body() dto: TaoVotDto) {
    const kh = await this.tuVot.khachHangCua(user.id);
    return { vot: xemTaiLieu(await this.tuVot.tao(kh._id, dto)), message: 'Đã thêm vợt vào tủ.' };
  }

  @Patch(':id')
  async sua(@CurrentUser() user: NguoiDung, @Param('id') id: string, @Body() dto: SuaVotDto) {
    const kh = await this.tuVot.khachHangCua(user.id);
    return { vot: xemTaiLieu(await this.tuVot.sua(kh._id, id, dto)), message: 'Đã cập nhật vợt.' };
  }

  @Delete(':id')
  async xoa(@CurrentUser() user: NguoiDung, @Param('id') id: string) {
    const kh = await this.tuVot.khachHangCua(user.id);
    await this.tuVot.xoa(kh._id, id);
    return { message: 'Đã xoá vợt khỏi tủ (lịch sử căng vẫn được giữ).' };
  }

  @Post(':id/lan-cang')
  async ghiLanCang(@CurrentUser() user: NguoiDung, @Param('id') id: string, @Body() dto: LanCangDto) {
    const kh = await this.tuVot.khachHangCua(user.id);
    const r = await this.tuVot.ghiLanCang(kh._id, id, dto);
    return {
      ...r,
      vot: xemTaiLieu(r.vot),
      message: r.vuotMucNSX
        ? `Đã ghi lần căng. Lưu ý: mức này cao hơn mức tối đa nhà sản xuất ghi (${r.toiDaLbs} lbs).`
        : 'Đã ghi lần căng.',
    };
  }

  @Get(':id/lan-cang')
  async lichSu(@CurrentUser() user: NguoiDung, @Param('id') id: string) {
    const kh = await this.tuVot.khachHangCua(user.id);
    return { lanCang: (await this.tuVot.lichSuCang(kh._id, id)).map(xemTaiLieu) };
  }

  @Post(':id/su-kien')
  async suKien(@CurrentUser() user: NguoiDung, @Param('id') id: string, @Body() dto: SuKienDto) {
    const kh = await this.tuVot.khachHangCua(user.id);
    return { vot: xemTaiLieu(await this.tuVot.themSuKien(kh._id, id, dto)), message: 'Đã ghi sự kiện.' };
  }

  @Post('chuyen-tu-trinh-duyet')
  @HttpCode(200)
  async chuyen(@CurrentUser() user: NguoiDung, @Body() dto: ChuyenDto) {
    const kh = await this.tuVot.khachHangCua(user.id);
    return this.tuVot.chuyenTuTrinhDuyet(kh._id, dto.vot);
  }
}
