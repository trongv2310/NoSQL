import { BadRequestException, Body, Controller, Get, HttpCode, Logger, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Model } from 'mongoose';
import { CurrentUser } from '../auth/auth.decorators';
import { SDT_MESSAGE, SDT_REGEX } from '../auth/auth.dto';
import { CanDangNhap } from '../auth/auth.guards';
import type { NguoiDung } from '../auth/auth.types';
import { GioHangService } from '../gio-hang/gio-hang.service';
import { idOf } from '../common/mappers';
import { DonHang, TRANG_THAI } from '../schemas';
import { DuLieuMomo, MomoService } from './momo.service';
import { OrderService } from './order.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
export class CheckoutDto {
  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập họ tên người nhận.' }) @MaxLength(100)
  hoTenNhan: string;

  @Matches(SDT_REGEX, { message: SDT_MESSAGE })
  soDienThoaiNhan: string;

  @IsString() @IsNotEmpty({ message: 'Vui lòng nhập địa chỉ giao hàng.' }) @MaxLength(255)
  diaChiGiao: string;

  @IsOptional() @IsString() @MaxLength(400)
  ghiChu?: string;
}

export function donHangView(don: any, chiTietDayDu = true) {
  return {
    id: idOf(don),
    soDonHang: don.soDonHang,
    ngayDat: don.ngayDat,
    trangThai: don.trangThai,
    tongTien: don.tongTien,
    tongTienSauGiam: don.tongTienSauGiam,
    tienGiam: don.tienGiam,
    diaChiGiaoHang: don.diaChiGiaoHang,
    soDienThoaiNhanHang: don.soDienThoaiNhanHang,
    ghiChu: don.ghiChu,
    khachHang: don.khachHang?._id
      ? { id: idOf(don.khachHang), hoTen: don.khachHang.hoTen, email: don.khachHang.email, soDienThoai: don.khachHang.soDienThoai }
      : null,
    chiTiet: (chiTietDayDu ? don.chiTiet : (don.chiTiet ?? []).slice(0, 3)).map((c: any) => ({
      id: idOf(c),
      chiTietSanPhamId: idOf(c.chiTietSanPham),
      sanPhamId: idOf(c.sanPham),
      tenSanPham: c.tenSanPham,
      hinhAnh: c.hinhAnh,
      sku: c.sku,
      tenMau: c.tenMau,
      tenSize: c.tenSize,
      soLuong: c.soLuong,
      donGia: c.donGia,
      thanhTien: c.thanhTien,
    })),
    soDong: (don.chiTiet ?? []).length,
  };
}

@Controller('don-hang')
export class DonHangController {
  private readonly logger = new Logger(DonHangController.name);

  constructor(
    @InjectModel(DonHang.name) private readonly donHangModel: Model<DonHang>,
    private readonly gioHang: GioHangService,
    private readonly orders: OrderService,
    private readonly momo: MomoService,
  ) {}

  private async gioKhongRong(user: NguoiDung) {
    const kh = await this.gioHang.khachHangId(user.id);
    const dongs = await this.gioHang.layDong(kh);
    if (!dongs.length) {
      throw new BadRequestException('Giỏ hàng của bạn đang trống.');
    }
    return { kh, dongs };
  }

  @Get('checkout')
  @CanDangNhap()
  async checkout(@CurrentUser() user: NguoiDung) {
    await this.gioKhongRong(user);
    return this.gioHang.xem(user.id);
  }

  @Post('checkout')
  @CanDangNhap()
  async datHang(@CurrentUser() user: NguoiDung, @Body() dto: CheckoutDto) {
    const { kh, dongs } = await this.gioKhongRong(user);
    const don = await this.orders.createOrder(
      kh,
      { diaChiGiaoHang: dto.diaChiGiao, soDienThoaiNhanHang: dto.soDienThoaiNhan, ghiChu: dto.ghiChu ?? '' },
      dongs,
      TRANG_THAI.DangXuLy,
    );
    return { soDonHang: don.soDonHang, message: `Đặt hàng thành công! Đơn hàng #${don.soDonHang}` };
  }

  /** Tạo đơn chờ thanh toán MoMo và trả về đường dẫn thanh toán. */
  @Post('momo')
  @CanDangNhap()
  async thanhToanMomo(@CurrentUser() user: NguoiDung, @Body() dto: CheckoutDto) {
    const { kh, dongs } = await this.gioKhongRong(user);
    const don = await this.orders.createOrder(
      kh,
      {
        diaChiGiaoHang: dto.diaChiGiao,
        soDienThoaiNhanHang: dto.soDienThoaiNhan,
        ghiChu: `${dto.ghiChu ?? ''} (Thanh toán qua MoMo)`,
      },
      dongs,
      TRANG_THAI.ChoThanhToanMomo,
      false,
    );
    try {
      const payUrl = await this.momo.createPayment(don.soDonHang, don.tongTien, `Thanh toan don hang #${don.soDonHang}`);
      return { soDonHang: don.soDonHang, payUrl };
    } catch (e) {
      await this.orders.huyDoThanhToanThatBai(don.soDonHang);
      throw new BadRequestException(`Lỗi cổng MoMo: ${(e as Error).message}`);
    }
  }

  private async capNhatKetQuaMomo(soDonHang: number, thanhCong: boolean) {
    if (thanhCong) {
      await this.orders.danhDauDaThanhToanMomo(soDonHang);
    } else {
      await this.orders.huyDoThanhToanThatBai(soDonHang);
    }
  }

  /** Trang kết quả (return URL): xác thực chữ ký rồi cập nhật trạng thái đơn. */
  @Get('momo/ket-qua')
  async ketQuaMomo(@Query() q: DuLieuMomo) {
    const soDonHang = Number(q.orderId);
    const don = Number.isFinite(soDonHang) ? await this.donHangModel.findOne({ soDonHang }).lean() : null;
    if (!don || !this.momo.chuKyHopLe(q)) {
      return {
        isSuccess: false,
        soDonHang: soDonHang || null,
        message: 'Không xác thực được kết quả thanh toán từ MoMo.',
        description: 'Chữ ký giao dịch không hợp lệ hoặc đơn hàng không tồn tại.',
      };
    }
    const thanhCong = String(q.resultCode ?? '-1') === '0';
    await this.capNhatKetQuaMomo(soDonHang, thanhCong);
    return {
      isSuccess: thanhCong,
      soDonHang,
      message: thanhCong ? 'Giao dịch MoMo thành công!' : 'Giao dịch MoMo thất bại hoặc đã bị hủy.',
      description: q.message ?? '',
    };
  }

  /** IPN do MoMo gọi server-to-server. */
  @Post('momo/ipn')
  @HttpCode(204)
  async ipnMomo(@Body() body: DuLieuMomo) {
    const soDonHang = Number(body.orderId);
    const don = await this.donHangModel.findOne({ soDonHang }).lean();
    if (don && this.momo.chuKyHopLe(body)) {
      await this.capNhatKetQuaMomo(soDonHang, String(body.resultCode) === '0');
    } else {
      this.logger.warn(`MoMo IPN không hợp lệ: orderId=${body.orderId}`);
    }
  }

  @Get('momo/mock/:soDonHang')
  async thongTinMock(@Param('soDonHang', ParseIntPipe) soDonHang: number) {
    const don: any = await this.donHangModel.findOne({ soDonHang }).populate('khachHang').lean();
    if (!don || don.trangThai !== TRANG_THAI.ChoThanhToanMomo) {
      throw new BadRequestException('Đơn hàng không tồn tại hoặc đã được xử lý.');
    }
    return { soDonHang, tongTien: don.tongTien, hoTen: don.khachHang?.hoTen ?? null };
  }

  @Post('momo/mock/xu-ly')
  @HttpCode(200)
  async xuLyMock(@Body() body: { orderId: number | string; action?: string }) {
    const soDonHang = Number(body.orderId);
    const don = await this.donHangModel.findOne({ soDonHang }).lean();
    if (!don || don.trangThai !== TRANG_THAI.ChoThanhToanMomo) {
      throw new BadRequestException('Đơn hàng không tồn tại hoặc đã được xử lý.');
    }
    return this.momo.taoKetQuaMock(soDonHang, don.tongTien, (body.action ?? 'success') === 'success');
  }

  @Get()
  @CanDangNhap()
  async danhSach(@CurrentUser() user: NguoiDung) {
    const kh = await this.gioHang.khachHangId(user.id);
    const ds = await this.donHangModel.find({ khachHang: kh }).sort({ ngayDat: -1, soDonHang: -1 }).lean();
    return ds.map((d) => donHangView(d, false));
  }

  @Get(':soDonHang')
  @CanDangNhap()
  async chiTiet(@CurrentUser() user: NguoiDung, @Param('soDonHang', ParseIntPipe) soDonHang: number) {
    const kh = await this.gioHang.khachHangId(user.id);
    const don = await this.donHangModel.findOne({ soDonHang, khachHang: kh }).lean();
    if (!don) {
      throw new BadRequestException('Không tìm thấy đơn hàng.');
    }
    return donHangView(don);
  }

  @Post(':soDonHang/huy')
  @HttpCode(200)
  @CanDangNhap()
  async huy(@CurrentUser() user: NguoiDung, @Param('soDonHang', ParseIntPipe) soDonHang: number) {
    const kh = await this.gioHang.khachHangId(user.id);
    await this.orders.cancelOrder(soDonHang, kh, false);
    return { message: `Đã hủy đơn hàng #${soDonHang}` };
  }
}
