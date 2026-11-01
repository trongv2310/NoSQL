import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsIn, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, MinLength,
} from 'class-validator';
import { Model } from 'mongoose';
import { CurrentUser } from '../auth/auth.decorators';
import { Roles } from '../auth/auth.guards';
import type { NguoiDung } from '../auth/auth.types';
import { likeRegex, parseObjectId, phanTrang, toBool } from '../common/helpers';
import { idOf } from '../common/mappers';
import { anhInterceptor, duongDanTuongDoi, xoaAnhUpload } from '../common/upload';
import { ChatbotService } from '../cong-khai/chatbot.service';
import { tinView, tranDauView } from '../cong-khai/cong-khai.service';
import { LOAI_TIN, Quyen, SanPham, TinTuc, TranDau } from '../schemas';

/* eslint-disable @typescript-eslint/no-explicit-any */
const rong = () => Transform(({ value }) => (value === '' || value === 'null' ? undefined : value));
const BOOL = () => Transform(({ value }) => toBool(value));

export class TinTucDto {
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề.' }) @MaxLength(200) tieuDe: string;
  @rong() @IsOptional() @IsString() @MaxLength(500) tomTat?: string;
  @IsString() @MinLength(20, { message: 'Nội dung quá ngắn, hãy nhập ít nhất 20 ký tự.' }) noiDung: string;
  @IsIn(Object.keys(LOAI_TIN), { message: 'Loại tin không hợp lệ.' }) loaiTin: string;
  @rong() @IsOptional() @IsString() @MaxLength(255) hinhAnh?: string;
  @rong() @IsOptional() @IsMongoId() sanPham?: string;
  @rong() @IsOptional() @IsMongoId() tranDau?: string;
  @rong() @IsOptional() @IsString() @MaxLength(150) nguonTin?: string;
  @rong() @IsOptional() @MaxLength(300) @Matches(/^https?:\/\/\S+$/, {
    message: 'Liên kết nguồn phải là đường dẫn hợp lệ (bắt đầu bằng http:// hoặc https://).',
  }) lienKetNguon?: string;
  @BOOL() @IsBoolean() noiBat: boolean;
  @BOOL() @IsBoolean() hienThi: boolean;
  @rong() @IsOptional() @Type(() => Number) @IsInt() @Min(0) thuTu?: number;
  @rong() @IsOptional() @IsDateString({}, { message: 'Ngày đăng không hợp lệ.' }) ngayDang?: string;
}

class ToggleDto {
  @IsIn(['noiBat', 'hienThi'], { message: 'Trường cập nhật không hợp lệ.' }) field: string;
  @rong() @IsOptional() value?: unknown;
}

class AiDto {
  @IsOptional() @IsString() topic?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() summary?: string;
}

@Roles(Quyen.Admin, Quyen.NhanVien)
@Controller('admin/ban-tin')
export class AdminBanTinController {
  constructor(
    @InjectModel(TinTuc.name) private readonly model: Model<TinTuc>,
    @InjectModel(SanPham.name) private readonly spModel: Model<SanPham>,
    @InjectModel(TranDau.name) private readonly tranModel: Model<TranDau>,
    private readonly chatbot: ChatbotService,
  ) {}

  private async duLieuForm() {
    const [sps, trans] = await Promise.all([
      this.spModel.find({ deletedAt: null }, { tenSanPham: 1 }).sort({ tenSanPham: 1 }).lean(),
      this.tranModel.find().sort({ ngayThiDau: -1, _id: -1 }).limit(200).lean(),
    ]);
    return {
      sanPhams: sps.map((s) => ({ id: idOf(s), tenSanPham: s.tenSanPham })),
      tranDaus: trans.map(tranDauView),
      loaiTins: Object.entries(LOAI_TIN).map(([khoa, [nhan]]) => ({ khoa, nhan })),
    };
  }

  @Get('form')
  form() {
    return this.duLieuForm();
  }

  @Get()
  async danhSach(@Query() q: Record<string, any>) {
    const filter: Record<string, any> = { deletedAt: null };
    const loai = q.loai && LOAI_TIN[String(q.loai)] ? String(q.loai) : null;
    if (loai) {
      filter.loaiTin = loai;
    }
    const keyword = String(q.keyword ?? '').trim();
    if (keyword) {
      const re = likeRegex(keyword);
      filter.$or = [{ tieuDe: re }, { tomTat: re }, { noiDung: re }];
    }
    const dateRange = String(q.date_range ?? '').trim();
    const parts = dateRange.split(/\s+(?:to|-)\s+/i);
    if (parts.length === 2) {
      const tu = new Date(parts[0].trim());
      const den = new Date(parts[1].trim());
      if (!isNaN(+tu) && !isNaN(+den)) {
        tu.setHours(0, 0, 0, 0);
        den.setHours(23, 59, 59, 999);
        filter.ngayDang = { $gte: tu, $lte: den };
      }
    }
    const all = await this.model
      .find(filter)
      .populate({ path: 'sanPham', select: 'tenSanPham hinhAnhDaiDien' })
      .populate('tranDau')
      .populate('tacGia', 'tenDangNhap')
      .sort({ thuTu: 1, ngayDang: -1, _id: -1 })
      .lean();
    const trang = phanTrang(all, Number(q.page) || 1, 10);
    return { ...trang, items: trang.items.map(tinView), loai, keyword, dateRange };
  }

  @Get(':id')
  async chiTiet(@Param('id') id: string) {
    const tin: any = await this.model.findOne({ _id: parseObjectId(id, 'Tin'), deletedAt: null }).populate('sanPham tranDau').lean();
    if (!tin) {
      throw new NotFoundException('Không tìm thấy bài viết.');
    }
    return { ...tinView(tin), sanPhamId: idOf(tin.sanPham), tranDauId: idOf(tin.tranDau), hinhAnhGoc: tin.hinhAnh ?? '', ...(await this.duLieuForm()) };
  }

  private duLieu(dto: TinTucDto, file?: Express.Multer.File) {
    const anh = duongDanTuongDoi('tintuc', file);
    return {
      tieuDe: dto.tieuDe, tomTat: dto.tomTat, noiDung: dto.noiDung, loaiTin: dto.loaiTin,
      sanPham: dto.sanPham ?? null, tranDau: dto.tranDau ?? null,
      nguonTin: dto.nguonTin, lienKetNguon: dto.lienKetNguon,
      noiBat: dto.noiBat, hienThi: dto.hienThi, thuTu: dto.thuTu ?? 1,
      ...(anh ? { hinhAnh: anh } : dto.hinhAnh !== undefined ? { hinhAnh: dto.hinhAnh } : {}),
      ...(dto.ngayDang ? { ngayDang: new Date(dto.ngayDang) } : {}),
    };
  }

  @Post()
  @UseInterceptors(anhInterceptor('HinhAnh_file', 'tintuc', 'news'))
  async tao(@CurrentUser() user: NguoiDung, @Body() dto: TinTucDto, @UploadedFile() file?: Express.Multer.File) {
    const tin = await this.model.create({ ...this.duLieu(dto, file), tacGia: user.id, ngayDang: dto.ngayDang ? new Date(dto.ngayDang) : new Date() } as any);
    return { id: idOf(tin), message: 'Đăng bài lên bảng tin thành công!' };
  }

  @Put(':id')
  @UseInterceptors(anhInterceptor('HinhAnh_file', 'tintuc', 'news'))
  async capNhat(@Param('id') id: string, @Body() dto: TinTucDto, @UploadedFile() file?: Express.Multer.File) {
    const tin = await this.model.findOne({ _id: parseObjectId(id, 'Tin'), deletedAt: null });
    if (!tin) {
      throw new NotFoundException('Không tìm thấy bài viết.');
    }
    const anhCu = tin.hinhAnh;
    tin.set(this.duLieu(dto, file));
    await tin.save();
    if (file && anhCu !== tin.hinhAnh) {
      xoaAnhUpload(anhCu);
    }
    return { id: idOf(tin), message: 'Cập nhật bài viết thành công!' };
  }

  @Delete(':id')
  async xoa(@Param('id') id: string) {
    const r = await this.model.updateOne({ _id: parseObjectId(id, 'Tin'), deletedAt: null }, { $set: { deletedAt: new Date() } });
    if (!r.matchedCount) {
      throw new NotFoundException('Không tìm thấy bài viết.');
    }
    return { message: 'Đã xóa bài viết khỏi bảng tin.' };
  }

  @Post(':id/toggle-status')
  @HttpCode(200)
  async doiTrangThai(@Param('id') id: string, @Body() dto: ToggleDto) {
    const tin: any = await this.model.findOne({ _id: parseObjectId(id, 'Tin'), deletedAt: null });
    if (!tin) {
      throw new NotFoundException('Không tìm thấy bài viết.');
    }
    const value = dto.value === undefined ? !tin[dto.field] : toBool(dto.value);
    tin[dto.field] = value;
    await tin.save();
    const message =
      dto.field === 'noiBat'
        ? value ? 'Đã gạt nổi bật: bài viết sẽ được hiển thị ở vị trí chính!' : 'Đã tắt nổi bật bài viết.'
        : value ? 'Đã bật hiển thị: bài viết đã xuất hiện trên website!' : 'Đã tắt hiển thị: bài viết đã bị ẩn khỏi website!';
    return { success: true, field: dto.field, value, message };
  }

  /** Upload ảnh cho trình soạn thảo; trả về JSON theo chuẩn CKEditor 5 SimpleUpload. */
  @Post('upload-image')
  @HttpCode(200)
  @UseInterceptors(anhInterceptor('upload', 'editor', 'editor'))
  uploadAnh(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({ uploaded: 0, error: { message: 'Không tìm thấy file hình ảnh tải lên hoặc file không hợp lệ.' } });
    }
    return { uploaded: 1, fileName: file.filename, url: `/uploads/editor/${file.filename}` };
  }

  @Post('ai-generate')
  @HttpCode(200)
  aiGenerate(@Body() dto: AiDto) {
    return this.chatbot.generateArticle(dto.topic ?? dto.title ?? '', dto.summary);
  }
}
