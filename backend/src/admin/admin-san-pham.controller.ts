import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Model, Types } from 'mongoose';
import { CurrentUser } from '../auth/auth.decorators';
import { Roles } from '../auth/auth.guards';
import type { NguoiDung } from '../auth/auth.types';
import { likeRegex, parseObjectId, phanTrangDb, toBool } from '../common/helpers';
import { bienTheView, idOf, khuyenMaiView, sanPhamView } from '../common/mappers';
import { anhInterceptor, DonAnhKhiLoi, duongDanTuongDoi, xoaAnhUpload } from '../common/upload';
import {
  ChiTietSanPham, DonHang, GioHang, Hang, KhuyenMai, LichSuThayDoiGia, LoaiSanPham, MauSac,
  NhaCungCap, Quyen, SanPham, Size,
} from '../schemas';

/* eslint-disable @typescript-eslint/no-explicit-any */
const BOOL = () => Transform(({ value }) => toBool(value));
const EMPTY_TO_UNDEF = () => Transform(({ value }) => (value === '' || value === 'null' ? undefined : value));

export class SanPhamDto {
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập tên sản phẩm.' }) @MaxLength(100)
  tenSanPham: string;

  @Type(() => Number) @IsNumber({}, { message: 'Giá gốc phải là số.' }) @Min(0) @Max(9999999999)
  giaGoc: number;

  @IsMongoId({ message: 'Vui lòng chọn loại sản phẩm.' }) loai: string;
  @IsMongoId({ message: 'Vui lòng chọn hãng sản xuất.' }) hang: string;
  @IsMongoId({ message: 'Vui lòng chọn nhà cung cấp.' }) nhaCungCap: string;

  @EMPTY_TO_UNDEF() @IsOptional() @IsMongoId() khuyenMai?: string;
  @IsOptional() @IsString() @MaxLength(5000) moTa?: string;
  @BOOL() @IsBoolean() coSize: boolean;
  @BOOL() @IsBoolean() coMau: boolean;
}

export class BienTheDto {
  @EMPTY_TO_UNDEF() @IsOptional() @IsMongoId() mau?: string;
  @EMPTY_TO_UNDEF() @IsOptional() @IsMongoId() size?: string;

  @Type(() => Number) @IsNumber({}, { message: 'Giá bán phải là số.' }) @Min(0) @Max(9999999999)
  giaBan: number;

  @Type(() => Number) @IsInt({ message: 'Số lượng tồn phải là số nguyên.' }) @Min(0) @Max(100000)
  soLuongTon: number;

  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập mã SKU.' }) @MaxLength(50)
  sku: string;

  @IsOptional() @IsString() doCanBang?: string;
  @IsOptional() @IsString() trongLuong?: string;
  @IsOptional() @IsString() doCung?: string;
  @IsOptional() @IsString() chieuDai?: string;
  @IsOptional() @IsString() sucCang?: string;

  /**
   * Tồn kho ở thời điểm form được tải (M5A-07). Có thì: form không đổi tồn → giữ NGUYÊN tồn hiện tại (đơn mới có thể đã trừ);
   * form đổi tồn mà tồn hiện tại khác giá trị đã tải → 409, không ghi đè.
   */
  @EMPTY_TO_UNDEF() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000)
  soLuongTonDaTai?: number;
}

@Roles(Quyen.Admin, Quyen.NhanVien)
@Controller('admin')
export class AdminSanPhamController {
  constructor(
    @InjectModel(SanPham.name) private readonly spModel: Model<SanPham>,
    @InjectModel(ChiTietSanPham.name) private readonly ctModel: Model<ChiTietSanPham>,
    @InjectModel(LoaiSanPham.name) private readonly loaiModel: Model<LoaiSanPham>,
    @InjectModel(NhaCungCap.name) private readonly nccModel: Model<NhaCungCap>,
    @InjectModel(Hang.name) private readonly hangModel: Model<Hang>,
    @InjectModel(KhuyenMai.name) private readonly kmModel: Model<KhuyenMai>,
    @InjectModel(MauSac.name) private readonly mauModel: Model<MauSac>,
    @InjectModel(Size.name) private readonly sizeModel: Model<Size>,
    @InjectModel(GioHang.name) private readonly gioModel: Model<GioHang>,
    @InjectModel(DonHang.name) private readonly donModel: Model<DonHang>,
    @InjectModel(LichSuThayDoiGia.name) private readonly lichSuModel: Model<LichSuThayDoiGia>,
  ) {}

  private async xoaAnhNeuKhongConDung(duongDan?: string | null, boQuaSanPham?: Types.ObjectId, boQuaBienThe?: Types.ObjectId) {
    if (!duongDan?.startsWith('uploads/')) return;
    try {
      const [soSanPham, soBienThe] = await Promise.all([
        this.spModel.countDocuments({ hinhAnhDaiDien: duongDan, ...(boQuaSanPham ? { _id: { $ne: boQuaSanPham } } : {}) }),
        this.ctModel.countDocuments({ hinhAnh: duongDan, ...(boQuaBienThe ? { _id: { $ne: boQuaBienThe } } : {}) }),
      ]);
      if (soSanPham + soBienThe === 0) xoaAnhUpload(duongDan);
    } catch {
      // DB đã ghi; không chắc hết tham chiếu thì giữ file và không làm hỏng request.
    }
  }

  /**
   * MongoDB không có khóa ngoại: DTO chỉ kiểm định dạng ObjectId, nên phải tự kiểm loại / hãng / nhà cung cấp / khuyến mãi có thật
   * trước khi ghi, tránh sản phẩm "mồ côi" (không có loại, hãng) lọt khỏi các bộ lọc của trang khách.
   */
  private async kiemTraThamChieu(dto: SanPhamDto) {
    const [loai, hang, ncc, km] = await Promise.all([
      this.loaiModel.exists({ _id: dto.loai }),
      this.hangModel.exists({ _id: dto.hang }),
      this.nccModel.exists({ _id: dto.nhaCungCap }),
      dto.khuyenMai ? this.kmModel.exists({ _id: dto.khuyenMai }) : Promise.resolve(true),
    ]);
    if (!loai) throw new BadRequestException('Loại sản phẩm không tồn tại.');
    if (!hang) throw new BadRequestException('Hãng sản xuất không tồn tại.');
    if (!ncc) throw new BadRequestException('Nhà cung cấp không tồn tại.');
    if (!km) throw new BadRequestException('Chương trình khuyến mãi không tồn tại.');
  }

  private async duLieuForm() {
    const [loais, nccs, hangs, kms] = await Promise.all([
      this.loaiModel.find().sort({ tenLoai: 1 }).lean(),
      this.nccModel.find().sort({ tenNhaCungCap: 1 }).lean(),
      this.hangModel.find().sort({ tenHang: 1 }).lean(),
      this.kmModel.find().sort({ ngayBatDau: -1 }).lean(),
    ]);
    return {
      loaiSanPhams: loais.map((l) => ({ id: idOf(l), tenLoai: l.tenLoai })),
      nhaCungCaps: nccs.map((n) => ({ id: idOf(n), tenNhaCungCap: n.tenNhaCungCap })),
      hangs: hangs.map((h) => ({ id: idOf(h), tenHang: h.tenHang })),
      khuyenMais: kms.map(khuyenMaiView),
    };
  }

  @Get('form-san-pham')
  formSanPham() {
    return this.duLieuForm();
  }

  @Get('bien-the-lua-chon')
  async luaChonBienThe() {
    const [mauSacs, sizes] = await Promise.all([
      this.mauModel.find().sort({ tenMau: 1 }).lean(),
      this.sizeModel.find().sort({ loaiSize: 1, _id: 1 }).lean(),
    ]);
    return {
      mauSacs: mauSacs.map((m) => ({ id: idOf(m), tenMau: m.tenMau })),
      sizes: sizes.map((s) => ({ id: idOf(s), tenSize: s.tenSize, loaiSize: s.loaiSize })),
    };
  }

  @Get('san-pham')
  async danhSach(@Query() q: Record<string, any>) {
    const filter: Record<string, any> = { deletedAt: q.an === '1' || q.an === 'true' ? { $ne: null } : null };
    if (q.maLoai) {
      filter.loai = parseObjectId(q.maLoai, 'Loại');
    }
    if (q.maHang) {
      filter.hang = parseObjectId(q.maHang, 'Hãng');
    }
    const keyword = String(q.keyword ?? '').trim();
    if (keyword) {
      const re = likeRegex(keyword);
      const [hangs, loais] = await Promise.all([
        this.hangModel.find({ tenHang: re }, { _id: 1 }).lean(),
        this.loaiModel.find({ tenLoai: re }, { _id: 1 }).lean(),
      ]);
      filter.$or = [{ tenSanPham: re }, { hang: { $in: hangs.map((h) => h._id) } }, { loai: { $in: loais.map((l) => l._id) } }];
    }
    // Phân trang trong MongoDB (skip/limit) và populate cả khuyenMai để giá hiển thị giống trang khách (đã trừ khuyến mãi).
    const trang = await phanTrangDb(
      () => this.spModel.countDocuments(filter),
      (skip, limit) =>
        this.spModel.find(filter).populate('loai hang khuyenMai').sort({ ngayTao: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Number(q.page) || 1,
      10,
    );
    const ton = await this.ctModel.aggregate<{ _id: any; t: number }>([
      { $match: { sanPham: { $in: trang.items.map((s) => s._id) } } },
      { $group: { _id: '$sanPham', t: { $sum: '$soLuongTon' } } },
    ]);
    const tonMap = new Map(ton.map((x) => [String(x._id), x.t]));
    return {
      ...trang,
      items: trang.items.map((s) => ({ ...sanPhamView(s), tongTonKho: tonMap.get(String(s._id)) ?? 0, daAn: s.deletedAt != null })),
      ...(await this.duLieuForm()),
    };
  }

  private async layKhongXoa(id: string, populate = '') {
    const sp = await this.spModel.findOne({ _id: parseObjectId(id, 'Sản phẩm'), deletedAt: null }).populate(populate).lean();
    if (!sp) {
      throw new NotFoundException('Không tìm thấy sản phẩm.');
    }
    return sp;
  }

  @Get('san-pham/:id')
  async chiTiet(@Param('id') id: string) {
    const sp: any = await this.layKhongXoa(id, 'loai hang nhaCungCap khuyenMai');
    const bienThes = await this.ctModel.find({ sanPham: sp._id }).populate('mau size').sort({ _id: 1 }).lean();
    return {
      sanPham: sanPhamView(sp),
      bienThes: bienThes.map((b) => bienTheView(b, sp)),
      ...(await this.luaChonBienThe()),
    };
  }

  @Get('san-pham/:id/sua')
  async layDeSua(@Param('id') id: string) {
    const sp: any = await this.layKhongXoa(id);
    return {
      sanPham: {
        id: idOf(sp), tenSanPham: sp.tenSanPham, moTa: sp.moTa ?? '', giaGoc: sp.giaGoc,
        loai: idOf(sp.loai), hang: idOf(sp.hang), nhaCungCap: idOf(sp.nhaCungCap), khuyenMai: idOf(sp.khuyenMai),
        coSize: !!sp.coSize, coMau: !!sp.coMau, hinhAnhDaiDien: sp.hinhAnhDaiDien,
      },
      ...(await this.duLieuForm()),
    };
  }

  @Post('san-pham')
  @UseInterceptors(anhInterceptor('HinhAnhUpload', 'sanpham', 'sp'), DonAnhKhiLoi)
  async tao(@Body() dto: SanPhamDto, @UploadedFile() file?: Express.Multer.File) {
    await this.kiemTraThamChieu(dto);
    const sp = await this.spModel.create({
      ...dto,
      khuyenMai: dto.khuyenMai ?? null,
      hinhAnhDaiDien: duongDanTuongDoi('sanpham', file) ?? 'default-product.jpg',
      ngayTao: new Date(),
    } as any);
    return {
      id: idOf(sp),
      message: `Thêm sản phẩm "${sp.tenSanPham}" thành công! Hãy thêm biến thể (màu/size, tồn kho) để khách có thể đặt mua.`,
    };
  }

  @Put('san-pham/:id')
  @UseInterceptors(anhInterceptor('HinhAnhUpload', 'sanpham', 'sp'), DonAnhKhiLoi)
  async capNhat(@Param('id') id: string, @Body() dto: SanPhamDto, @UploadedFile() file?: Express.Multer.File) {
    const sp: any = await this.layKhongXoa(id);
    await this.kiemTraThamChieu(dto);
    const anhCu = sp.hinhAnhDaiDien;
    const update: Record<string, any> = { ...dto, khuyenMai: dto.khuyenMai ?? null };
    const anhMoi = duongDanTuongDoi('sanpham', file);
    if (anhMoi) {
      update.hinhAnhDaiDien = anhMoi;
    }
    await this.spModel.updateOne({ _id: sp._id }, { $set: update });
    if (anhMoi) {
      if (file) DonAnhKhiLoi.daLuu.add(file);
      if (anhCu) await this.ctModel.updateMany({ sanPham: sp._id, hinhAnh: anhCu }, { $set: { hinhAnh: anhMoi } });
      await this.xoaAnhNeuKhongConDung(anhCu, sp._id);
    }
    return { message: 'Cập nhật sản phẩm thành công!' };
  }

  private async anSanPham(sp: any) {
    const bienThes = await this.ctModel.find({ sanPham: sp._id }, { _id: 1 }).lean();
    await this.gioModel.deleteMany({ chiTietSanPham: { $in: bienThes.map((b) => b._id) } });
    await this.spModel.updateOne({ _id: sp._id }, { $set: { deletedAt: new Date() } });
  }

  @Post('san-pham/:id/an')
  @HttpCode(200)
  async an(@Param('id') id: string) {
    const sp = await this.spModel.findOne({ _id: parseObjectId(id, 'Sản phẩm') }).lean();
    if (!sp) throw new NotFoundException('Không tìm thấy sản phẩm.');
    if (sp.deletedAt == null) await this.anSanPham(sp);
    return { message: `Đã ẩn sản phẩm "${sp.tenSanPham}" thành công!` };
  }

  @Post('san-pham/:id/hien')
  @HttpCode(200)
  async hien(@Param('id') id: string) {
    const sp = await this.spModel.findOne({ _id: parseObjectId(id, 'Sản phẩm') }).lean();
    if (!sp) throw new NotFoundException('Không tìm thấy sản phẩm.');
    if (sp.deletedAt != null) await this.spModel.updateOne({ _id: sp._id }, { $set: { deletedAt: null } });
    return { message: `Đã hiện sản phẩm "${sp.tenSanPham}" thành công!` };
  }

  /** Xóa mềm: sản phẩm ngừng kinh doanh nhưng đơn cũ vẫn còn dữ liệu. Giỏ hàng chứa sản phẩm này bị dọn. */
  @Delete('san-pham/:id')
  @Roles(Quyen.Admin)
  async xoa(@Param('id') id: string) {
    const sp: any = await this.layKhongXoa(id);
    await this.anSanPham(sp);
    return { message: `Đã xóa sản phẩm "${sp.tenSanPham}" thành công!` };
  }

  private async kiemTraSku(sku: string, boQuaId?: any) {
    const trung = await this.ctModel.exists({ sku, ...(boQuaId ? { _id: { $ne: boQuaId } } : {}) });
    if (trung) {
      throw new ConflictException(`Mã SKU "${sku}" đã tồn tại.`);
    }
  }

  private thongSo(dto: BienTheDto) {
    const t = { doCanBang: dto.doCanBang, trongLuong: dto.trongLuong, doCung: dto.doCung, chieuDai: dto.chieuDai, sucCang: dto.sucCang };
    return Object.values(t).some((v) => v) ? t : undefined;
  }

  /** Có gửi bất kỳ ô thông số nào không (kể cả chuỗi rỗng = admin chủ động xóa)? Không gửi gì thì giữ nguyên thông số cũ. */
  private coGuiThongSo(dto: BienTheDto): boolean {
    return [dto.doCanBang, dto.trongLuong, dto.doCung, dto.chieuDai, dto.sucCang].some((v) => v !== undefined);
  }

  @Post('san-pham/:id/bien-the')
  @UseInterceptors(anhInterceptor('HinhAnhUpload', 'sanpham', 'bt'), DonAnhKhiLoi)
  async themBienThe(@Param('id') id: string, @Body() dto: BienTheDto, @UploadedFile() file?: Express.Multer.File) {
    const sp: any = await this.layKhongXoa(id);
    await this.kiemTraSku(dto.sku);
    await this.ctModel.create({
      sanPham: sp._id, mau: dto.mau, size: dto.size, giaBan: dto.giaBan, soLuongTon: dto.soLuongTon, sku: dto.sku,
      hinhAnh: duongDanTuongDoi('sanpham', file), thongSo: this.thongSo(dto),
    });
    return { message: `Đã thêm biến thể SKU "${dto.sku}".` };
  }

  @Get('bien-the/:maChiTiet')
  async layBienThe(@Param('maChiTiet') ma: string) {
    const bt: any = await this.ctModel.findById(parseObjectId(ma, 'Biến thể')).populate('mau size sanPham').lean();
    if (!bt) {
      throw new NotFoundException('Không tìm thấy biến thể.');
    }
    return { bienThe: bienTheView(bt), sanPham: { id: idOf(bt.sanPham), tenSanPham: bt.sanPham?.tenSanPham }, ...(await this.luaChonBienThe()) };
  }

  @Put('bien-the/:maChiTiet')
  @UseInterceptors(anhInterceptor('HinhAnhUpload', 'sanpham', 'bt'), DonAnhKhiLoi)
  async capNhatBienThe(
    @CurrentUser() user: NguoiDung, @Param('maChiTiet') ma: string, @Body() dto: BienTheDto, @UploadedFile() file?: Express.Multer.File,
  ) {
    const bt: any = await this.ctModel.findById(parseObjectId(ma, 'Biến thể'));
    if (!bt) {
      throw new NotFoundException('Không tìm thấy biến thể.');
    }
    await this.kiemTraSku(dto.sku, bt._id);
    const giaCu = bt.giaBan;
    const anhCu = bt.hinhAnh;
    // Một lệnh cập nhật DUY NHẤT cho cả tồn và metadata, có điều kiện theo tồn lúc mở form (CAS): hai yêu cầu đồng thời hoặc một đơn chen giữa không bị ghi đè,
    // và lỗi ghi (trùng SKU...) thì KHÔNG có phần nào được lưu (không còn "tồn đã đổi nhưng giá/SKU chưa").
    if (dto.soLuongTonDaTai === undefined) {
      throw new BadRequestException('Thiếu số lượng tồn lúc mở form (soLuongTonDaTai). Hãy tải lại trang rồi lưu lại.');
    }
    const doiTon = dto.soLuongTon !== dto.soLuongTonDaTai;
    const dat: Record<string, unknown> = { mau: dto.mau ?? null, size: dto.size ?? null, giaBan: dto.giaBan, sku: dto.sku };
    if (doiTon) dat.soLuongTon = dto.soLuongTon; // không đổi tồn thì KHÔNG đặt trường này: số đã đổi do bán hàng được giữ nguyên
    const anhMoi = duongDanTuongDoi('sanpham', file);
    if (anhMoi) dat.hinhAnh = anhMoi;
    const ts = this.thongSo(dto);
    const capNhat: Record<string, unknown> = { $set: dat };
    if (ts) dat.thongSo = ts;
    else if (this.coGuiThongSo(dto)) capNhat.$unset = { thongSo: '' }; // admin xóa hết ô thông số: bỏ cả bộ
    const kq = await this.ctModel.updateOne({ _id: bt._id, ...(doiTon ? { soLuongTon: dto.soLuongTonDaTai } : {}) }, capNhat);
    if (kq.matchedCount === 0) {
      const hienTai: any = await this.ctModel.findById(bt._id).select('soLuongTon').lean();
      if (!hienTai) throw new NotFoundException('Không tìm thấy biến thể.');
      throw new ConflictException(`Tồn kho vừa thay đổi (hiện còn ${hienTai.soLuongTon}, lúc mở form là ${dto.soLuongTonDaTai}). Hãy tải lại trang rồi nhập lại số lượng.`);
    }
    if (anhMoi) {
      // Ảnh mới đã thuộc DB; giữ lại nếu bước ghi lịch sử phía sau lỗi.
      if (file) DonAnhKhiLoi.daLuu.add(file);
      await this.xoaAnhNeuKhongConDung(anhCu, undefined, bt._id);
    }
    if (giaCu !== undefined && giaCu !== dto.giaBan) {
      await this.lichSuModel.create({ chiTiet: bt._id, giaCu, giaMoi: dto.giaBan, nguoiThayDoi: user.tenDangNhap });
    }
    return { sanPhamId: idOf(bt.sanPham), message: `Cập nhật biến thể SKU "${dto.sku}" thành công!` };
  }

  @Delete('bien-the/:maChiTiet')
  @Roles(Quyen.Admin)
  async xoaBienThe(@Param('maChiTiet') ma: string) {
    const bt: any = await this.ctModel.findById(parseObjectId(ma, 'Biến thể'));
    if (!bt) {
      throw new NotFoundException('Không tìm thấy biến thể.');
    }
    if (await this.donModel.exists({ 'chiTiet.chiTietSanPham': bt._id })) {
      throw new BadRequestException(
        `Biến thể SKU "${bt.sku}" đã phát sinh đơn hàng nên không thể xóa. Hãy sửa tồn kho về 0 để ngừng bán.`,
      );
    }
    await this.gioModel.deleteMany({ chiTietSanPham: bt._id });
    await bt.deleteOne();
    await this.xoaAnhNeuKhongConDung(bt.hinhAnh, undefined, bt._id);
    return { sanPhamId: idOf(bt.sanPham), message: `Đã xóa biến thể SKU "${bt.sku}".` };
  }
}
