import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Put, Query,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString, IsEmail, IsIn, IsInt, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { Model } from 'mongoose';
import { CurrentUser } from '../auth/auth.decorators';
import { SDT_MESSAGE, SDT_REGEX } from '../auth/auth.dto';
import { Roles } from '../auth/auth.guards';
import type { NguoiDung } from '../auth/auth.types';
import { CauHinhService, LOGO_MAC_DINH } from '../cau-hinh/cau-hinh.service';
import { likeRegex, parseObjectId, phanTrang } from '../common/helpers';
import { idOf, khuyenMaiView } from '../common/mappers';
import { anhInterceptor, duongDanTuongDoi } from '../common/upload';
import { tranDauView } from '../cong-khai/cong-khai.service';
import { DonHang, GioHang, KhachHang, KhuyenMai, Quyen, SanPham, TaiKhoan, TinTuc, TranDau } from '../schemas';

/* eslint-disable @typescript-eslint/no-explicit-any */
const rong = () => Transform(({ value }) => (value === '' ? undefined : value));

/* ------------------------------- Khuyến mãi ------------------------------- */
export class KhuyenMaiDto {
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập tên chương trình.' }) @MaxLength(100) tenChuongTrinh: string;
  @rong() @IsOptional() @IsString() @MaxLength(255) moTa?: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100, { message: 'Phần trăm giảm tối đa là 100.' }) phanTramGiam: number;
  @rong() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) giamToiDa?: number;
  @rong() @IsOptional() @Type(() => Number) @IsInt() @Min(0) soLuongSuDung?: number;
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ.' }) ngayBatDau: string;
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ.' }) ngayKetThuc: string;
}

@Roles(Quyen.Admin)
@Controller('admin/khuyen-mai')
export class AdminKhuyenMaiController {
  constructor(
    @InjectModel(KhuyenMai.name) private readonly kmModel: Model<KhuyenMai>,
    @InjectModel(SanPham.name) private readonly spModel: Model<SanPham>,
  ) {}

  private kiemTra(dto: KhuyenMaiDto) {
    if (new Date(dto.ngayKetThuc) < new Date(dto.ngayBatDau)) {
      throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
    }
  }

  @Get()
  async danhSach(@Query() q: Record<string, any>) {
    const keyword = String(q.keyword ?? '').trim();
    const [all, dem] = await Promise.all([
      this.kmModel.find(keyword ? { tenChuongTrinh: likeRegex(keyword) } : {}).sort({ ngayBatDau: -1 }).lean(),
      this.spModel.aggregate<{ _id: any; n: number }>([{ $match: { deletedAt: null, khuyenMai: { $ne: null } } }, { $group: { _id: '$khuyenMai', n: { $sum: 1 } } }]),
    ]);
    const demMap = new Map(dem.map((d) => [String(d._id), d.n]));
    const trang = phanTrang(all, Number(q.page) || 1, 10);
    return { ...trang, items: trang.items.map((k) => ({ ...khuyenMaiView(k), soSanPham: demMap.get(String(k._id)) ?? 0 })) };
  }

  @Get(':id')
  async chiTiet(@Param('id') id: string) {
    const km = await this.kmModel.findById(parseObjectId(id, 'Khuyến mãi')).lean();
    if (!km) {
      throw new NotFoundException('Không tìm thấy khuyến mãi.');
    }
    return khuyenMaiView(km);
  }

  @Post()
  async tao(@Body() dto: KhuyenMaiDto) {
    this.kiemTra(dto);
    await this.kmModel.create(dto);
    return { message: 'Tạo khuyến mãi thành công!' };
  }

  @Put(':id')
  async capNhat(@Param('id') id: string, @Body() dto: KhuyenMaiDto) {
    this.kiemTra(dto);
    const r = await this.kmModel.updateOne({ _id: parseObjectId(id, 'Khuyến mãi') }, { $set: dto });
    if (!r.matchedCount) {
      throw new NotFoundException('Không tìm thấy khuyến mãi.');
    }
    return { message: 'Cập nhật khuyến mãi thành công!' };
  }

  @Delete(':id')
  async xoa(@Param('id') id: string) {
    const oid = parseObjectId(id, 'Khuyến mãi');
    const r = await this.kmModel.deleteOne({ _id: oid });
    if (!r.deletedCount) {
      throw new NotFoundException('Không tìm thấy khuyến mãi.');
    }
    await this.spModel.updateMany({ khuyenMai: oid }, { $set: { khuyenMai: null } });
    return { message: 'Xóa chương trình khuyến mãi thành công!' };
  }
}

/* -------------------------------- Trận đấu -------------------------------- */
export class TranDauDto {
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập tên giải đấu.' }) @MaxLength(150) tenGiaiDau: string;
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập vòng đấu.' }) @MaxLength(60) vong: string;
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập nội dung thi đấu.' }) @MaxLength(60) noiDung: string;
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập bên A.' }) @MaxLength(150) doiA: string;
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập bên B.' }) @MaxLength(150) doiB: string;
  @rong() @IsOptional() @Matches(/^\d{1,2}-\d{1,2}(,\s*\d{1,2}-\d{1,2}){0,2}$/, {
    message: 'Tỉ số phải theo dạng 21-11, 21-11 (mỗi ván cách nhau bằng dấu phẩy, tối đa 3 ván).',
  }) tiSo?: string;
  @rong() @IsOptional() @IsIn(['A', 'B']) doiThang?: string;
  @IsDateString({}, { message: 'Ngày thi đấu không hợp lệ.' }) ngayThiDau: string;
  @rong() @IsOptional() @IsString() @MaxLength(120) diaDiem?: string;
  @rong() @IsOptional() @IsString() @MaxLength(150) nguonTin?: string;
  @rong() @IsOptional() @MaxLength(300) @Matches(/^https?:\/\/\S+$/, {
    message: 'Liên kết nguồn phải là đường dẫn hợp lệ (bắt đầu bằng http:// hoặc https://).',
  }) lienKetNguon?: string;
}

@Roles(Quyen.Admin, Quyen.NhanVien)
@Controller('admin/tran-dau')
export class AdminTranDauController {
  constructor(
    @InjectModel(TranDau.name) private readonly model: Model<TranDau>,
    @InjectModel(TinTuc.name) private readonly tinModel: Model<TinTuc>,
  ) {}

  private kiemTra(dto: TranDauDto) {
    if (dto.doiA.trim() === dto.doiB.trim()) {
      throw new BadRequestException('Hai bên thi đấu phải khác nhau.');
    }
    if (dto.tiSo && !dto.doiThang) {
      throw new BadRequestException('Hãy chọn bên thắng khi đã nhập tỉ số.');
    }
  }

  @Get()
  async danhSach(@Query() q: Record<string, any>) {
    const keyword = String(q.keyword ?? '').trim();
    const re = keyword ? likeRegex(keyword) : null;
    const all = await this.model
      .find(re ? { $or: [{ tenGiaiDau: re }, { noiDung: re }, { doiA: re }, { doiB: re }] } : {})
      .sort({ ngayThiDau: -1, _id: -1 })
      .lean();
    const dem = await this.tinModel.aggregate<{ _id: any; n: number }>([{ $match: { deletedAt: null, tranDau: { $ne: null } } }, { $group: { _id: '$tranDau', n: { $sum: 1 } } }]);
    const demMap = new Map(dem.map((d) => [String(d._id), d.n]));
    const trang = phanTrang(all, Number(q.page) || 1, 10);
    return { ...trang, items: trang.items.map((t) => ({ ...tranDauView(t), soTin: demMap.get(String(t._id)) ?? 0 })) };
  }

  @Get(':id')
  async chiTiet(@Param('id') id: string) {
    const t = await this.model.findById(parseObjectId(id, 'Trận đấu')).lean();
    if (!t) {
      throw new NotFoundException('Không tìm thấy trận đấu.');
    }
    return { ...tranDauView(t), soTin: await this.tinModel.countDocuments({ deletedAt: null, tranDau: t._id }) };
  }

  @Post()
  async tao(@Body() dto: TranDauDto) {
    this.kiemTra(dto);
    await this.model.create({ ...dto, doiThang: dto.tiSo ? dto.doiThang : null });
    return { message: 'Thêm kết quả trận đấu thành công!' };
  }

  @Put(':id')
  async capNhat(@Param('id') id: string, @Body() dto: TranDauDto) {
    this.kiemTra(dto);
    const r = await this.model.updateOne({ _id: parseObjectId(id, 'Trận đấu') }, { $set: { ...dto, doiThang: dto.tiSo ? dto.doiThang : null } });
    if (!r.matchedCount) {
      throw new NotFoundException('Không tìm thấy trận đấu.');
    }
    return { message: 'Cập nhật trận đấu thành công!' };
  }

  @Delete(':id')
  async xoa(@Param('id') id: string) {
    const oid = parseObjectId(id, 'Trận đấu');
    const r = await this.model.deleteOne({ _id: oid });
    if (!r.deletedCount) {
      throw new NotFoundException('Không tìm thấy trận đấu.');
    }
    await this.tinModel.updateMany({ tranDau: oid }, { $set: { tranDau: null } });
    return { message: 'Đã xóa trận đấu.' };
  }
}

/* -------------------------------- Tài khoản ------------------------------- */
export class TaiKhoanDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(50) @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Tên đăng nhập chỉ gồm chữ, số, gạch ngang và gạch dưới.' })
  tenDangNhap?: string;
  @rong() @IsOptional() @IsString() @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự.' }) @MaxLength(100) matKhau?: string;
  @IsEmail({}, { message: 'Email không hợp lệ.' }) @MaxLength(100) email: string;
  @Type(() => Number) @IsIn([1, 2, 3], { message: 'Phân quyền không hợp lệ.' }) maQuyen: number;
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập họ tên.' }) @MaxLength(100) hoTen: string;
  @rong() @IsOptional() @Matches(SDT_REGEX, { message: SDT_MESSAGE }) soDienThoai?: string;
  @rong() @IsOptional() @IsString() @MaxLength(255) diaChi?: string;
}

export const TEN_PHAN_QUYEN = [
  { maQuyen: 1, tenQuyen: 'Quản trị' },
  { maQuyen: 2, tenQuyen: 'Nhân viên' },
  { maQuyen: 3, tenQuyen: 'Khách hàng' },
];

@Roles(Quyen.Admin)
@Controller('admin/tai-khoan')
export class AdminTaiKhoanController {
  constructor(
    @InjectModel(TaiKhoan.name) private readonly tkModel: Model<TaiKhoan>,
    @InjectModel(KhachHang.name) private readonly khModel: Model<KhachHang>,
    @InjectModel(GioHang.name) private readonly gioModel: Model<GioHang>,
    @InjectModel(DonHang.name) private readonly donModel: Model<DonHang>,
  ) {}

  private view(tk: any, kh?: any) {
    return {
      id: idOf(tk),
      tenDangNhap: tk.tenDangNhap,
      email: tk.email,
      maQuyen: tk.maQuyen,
      tenQuyen: TEN_PHAN_QUYEN.find((p) => p.maQuyen === tk.maQuyen)?.tenQuyen ?? '',
      ngayTao: tk.ngayTao,
      hoTen: kh?.hoTen ?? null,
      soDienThoai: kh?.soDienThoai ?? '',
      diaChi: kh?.diaChi ?? '',
    };
  }

  @Get()
  async danhSach(@Query() q: Record<string, any>) {
    const filter: Record<string, any> = {};
    const keyword = String(q.keyword ?? '').trim();
    if (keyword) {
      const re = likeRegex(keyword);
      const khs = await this.khModel.find({ hoTen: re }, { taiKhoan: 1 }).lean();
      filter.$or = [{ tenDangNhap: re }, { email: re }, { _id: { $in: khs.map((k) => k.taiKhoan).filter(Boolean) } }];
    }
    if (q.maQuyen) {
      filter.maQuyen = Number(q.maQuyen);
    }
    const all = await this.tkModel.find(filter).sort({ maQuyen: 1, _id: 1 }).lean();
    const trang = phanTrang(all, Number(q.page) || 1, 10);
    const khs = await this.khModel.find({ taiKhoan: { $in: trang.items.map((t) => t._id) } }).lean();
    const khMap = new Map(khs.map((k) => [String(k.taiKhoan), k]));
    return { ...trang, items: trang.items.map((t) => this.view(t, khMap.get(String(t._id)))), phanQuyens: TEN_PHAN_QUYEN };
  }

  @Get(':id')
  async chiTiet(@Param('id') id: string) {
    const tk = await this.tkModel.findById(parseObjectId(id, 'Tài khoản')).lean();
    if (!tk) {
      throw new NotFoundException('Không tìm thấy tài khoản.');
    }
    return { ...this.view(tk, await this.khModel.findOne({ taiKhoan: tk._id }).lean()), phanQuyens: TEN_PHAN_QUYEN };
  }

  @Post()
  async tao(@Body() dto: TaiKhoanDto) {
    if (!dto.tenDangNhap || !dto.matKhau) {
      throw new BadRequestException('Vui lòng nhập tên đăng nhập và mật khẩu.');
    }
    if (await this.tkModel.exists({ tenDangNhap: dto.tenDangNhap })) {
      throw new ConflictException('Tên đăng nhập đã tồn tại.');
    }
    if (await this.tkModel.exists({ email: dto.email })) {
      throw new ConflictException('Email đã được sử dụng.');
    }
    const tk = await this.tkModel.create({
      tenDangNhap: dto.tenDangNhap, matKhau: await bcrypt.hash(dto.matKhau, 10), email: dto.email, maQuyen: dto.maQuyen,
    });
    try {
      await this.khModel.create({ hoTen: dto.hoTen, email: dto.email, soDienThoai: dto.soDienThoai ?? '', diaChi: dto.diaChi ?? '', taiKhoan: tk._id });
    } catch (e) {
      await this.tkModel.deleteOne({ _id: tk._id });
      throw new BadRequestException(`Lỗi khi tạo tài khoản: ${(e as Error).message}`);
    }
    return { message: 'Tạo tài khoản thành công!' };
  }

  @Put(':id')
  async capNhat(@CurrentUser() user: NguoiDung, @Param('id') id: string, @Body() dto: TaiKhoanDto) {
    if (dto.tenDangNhap) {
      throw new BadRequestException('Không được thay đổi tên đăng nhập.');
    }
    const tk = await this.tkModel.findById(parseObjectId(id, 'Tài khoản'));
    if (!tk) {
      throw new NotFoundException('Không tìm thấy tài khoản.');
    }
    if (String(tk._id) === user.id && dto.maQuyen !== Quyen.Admin) {
      throw new BadRequestException('Bạn không thể tự thay đổi quyền Quản trị của chính mình.');
    }
    if (dto.email !== tk.email && (await this.tkModel.exists({ email: dto.email, _id: { $ne: tk._id } }))) {
      throw new ConflictException('Email đã được sử dụng.');
    }
    tk.email = dto.email;
    tk.maQuyen = dto.maQuyen;
    if (dto.matKhau) {
      tk.matKhau = await bcrypt.hash(dto.matKhau, 10);
    }
    await tk.save();
    await this.khModel.updateOne(
      { taiKhoan: tk._id },
      { $set: { hoTen: dto.hoTen, email: dto.email, soDienThoai: dto.soDienThoai ?? '', diaChi: dto.diaChi ?? '' } },
      { upsert: true },
    );
    return { message: 'Cập nhật tài khoản thành công!' };
  }

  /** Xóa tài khoản kéo theo hồ sơ khách và giỏ hàng; đơn cũ được giữ lại (khachHang = null). */
  @Delete(':id')
  async xoa(@CurrentUser() user: NguoiDung, @Param('id') id: string) {
    const oid = parseObjectId(id, 'Tài khoản');
    if (String(oid) === user.id) {
      throw new ForbiddenException('Bạn không thể xóa tài khoản đang đăng nhập.');
    }
    const r = await this.tkModel.deleteOne({ _id: oid });
    if (!r.deletedCount) {
      throw new NotFoundException('Không tìm thấy tài khoản.');
    }
    const kh = await this.khModel.findOneAndDelete({ taiKhoan: oid });
    if (kh) {
      await this.gioModel.deleteMany({ khachHang: kh._id });
      await this.donModel.updateMany({ khachHang: kh._id }, { $set: { khachHang: null } });
    }
    return { message: 'Xóa tài khoản thành công!' };
  }
}

/* ---------------------------------- Logo ---------------------------------- */
@Roles(Quyen.Admin)
@Controller('admin/logo')
export class AdminLogoController {
  constructor(private readonly cauHinh: CauHinhService) {}

  @Get()
  async xem() {
    return this.cauHinh.thongTinSite();
  }

  @Post()
  @UseInterceptors(anhInterceptor('logo_file', 'logo', 'logo', 10))
  async capNhat(@Body() body: { site_name?: string }, @UploadedFile() file?: Express.Multer.File) {
    if (body.site_name !== undefined && body.site_name.length > 200) {
      throw new BadRequestException('Tên website tối đa 200 ký tự.');
    }
    const anh = duongDanTuongDoi('logo', file);
    if (anh) {
      await this.cauHinh.set('logo_url', anh, 'Logo chính thức của hệ thống');
    }
    if (body.site_name !== undefined) {
      await this.cauHinh.set('site_name', body.site_name, 'Tên website');
    }
    return { message: 'Cập nhật logo hệ thống thành công!', logoMacDinh: LOGO_MAC_DINH };
  }
}
