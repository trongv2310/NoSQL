import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { IsIn, IsString } from 'class-validator';
import { Model } from 'mongoose';
import { Roles } from '../auth/auth.guards';
import { donHangView } from '../don-hang/don-hang.controller';
import { OrderService } from '../don-hang/order.service';
import { TRANG_THAI_LOAI_TRU } from '../don-hang/trang-thai';
import { likeRegex, phanTrang } from '../common/helpers';
import { idOf } from '../common/mappers';
import { DonHang, KhachHang, PhanHoi, Quyen, SanPham } from '../schemas';

/* eslint-disable @typescript-eslint/no-explicit-any */
export class DoiTrangThaiDto {
  @IsString()
  @IsIn(['Đang xử lý', 'Đang giao hàng', 'Đã hoàn thành', 'Đã hủy'], { message: 'Trạng thái đơn hàng không hợp lệ.' })
  trangThaiMoi: string;
}

@Roles(Quyen.Admin, Quyen.NhanVien)
@Controller('admin')
export class AdminVanHanhController {
  constructor(
    @InjectModel(DonHang.name) private readonly donModel: Model<DonHang>,
    @InjectModel(KhachHang.name) private readonly khModel: Model<KhachHang>,
    @InjectModel(PhanHoi.name) private readonly phanHoiModel: Model<PhanHoi>,
    @InjectModel(SanPham.name) private readonly spModel: Model<SanPham>,
    private readonly orders: OrderService,
  ) {}

  @Get('don-hang')
  async danhSachDon(@Query() q: Record<string, any>) {
    const filter: Record<string, any> = {};
    const keyword = String(q.keyword ?? '').trim();
    if (keyword) {
      const ma = keyword.replace(/^#/, '');
      const re = likeRegex(keyword);
      const khs = await this.khModel.find({ hoTen: re }, { _id: 1 }).lean();
      filter.$or = [
        ...(/^\d+$/.test(ma) ? [{ soDonHang: Number(ma) }] : []),
        { soDienThoaiNhanHang: re },
        { khachHang: { $in: khs.map((k) => k._id) } },
      ];
    }
    if (q.trangThai) {
      filter.trangThai = String(q.trangThai);
    }
    const [all, dsTrangThai] = await Promise.all([
      this.donModel.find(filter).populate('khachHang').sort({ ngayDat: -1, soDonHang: -1 }).lean(),
      this.donModel.distinct('trangThai'),
    ]);
    const trang = phanTrang(all, Number(q.page) || 1, 10);
    return { ...trang, items: trang.items.map((d) => donHangView(d, false)), dsTrangThai: dsTrangThai.sort() };
  }

  @Get('don-hang/:soDonHang')
  async chiTietDon(@Param('soDonHang', ParseIntPipe) so: number) {
    const don = await this.donModel.findOne({ soDonHang: so }).populate('khachHang').lean();
    if (!don) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }
    return donHangView(don);
  }

  @Post('don-hang/:soDonHang/trang-thai')
  @HttpCode(200)
  async doiTrangThai(@Param('soDonHang', ParseIntPipe) so: number, @Body() dto: DoiTrangThaiDto) {
    await this.orders.setTrangThai(so, dto.trangThaiMoi);
    return { message: `Cập nhật trạng thái đơn hàng sang '${dto.trangThaiMoi}' thành công!` };
  }

  @Get('thong-bao')
  async thongBao() {
    const ds: any[] = await this.phanHoiModel
      .find({ danhGia: { $lte: 2 } })
      .populate('khachHang sanPham')
      .sort({ ngayPhanHoi: -1 })
      .lean();
    return ds.map((r) => ({
      id: idOf(r),
      noiDung: r.noiDung,
      danhGia: r.danhGia,
      ngayPhanHoi: r.ngayPhanHoi,
      tenKhachHang: r.khachHang?.hoTen ?? 'Khách hàng',
      sanPhamId: idOf(r.sanPham),
      tenSanPham: r.sanPham?.tenSanPham ?? null,
    }));
  }

  @Get('thong-bao/so-luong')
  async soThongBao() {
    return { count: await this.phanHoiModel.countDocuments({ danhGia: { $lte: 2 } }) };
  }

  @Get('dashboard')
  async dashboard(@Query('nam') namQuery?: string) {
    let nam = Number(namQuery) || new Date().getFullYear();
    if (nam < 2000 || nam > 2100) {
      nam = new Date().getFullYear();
    }
    const tu = new Date(nam, 0, 1);
    const den = new Date(nam + 1, 0, 1);
    const hopLe = { ngayDat: { $gte: tu, $lt: den }, trangThai: { $nin: TRANG_THAI_LOAI_TRU } };

    const [theoThang, banChay, tongSanPham, soCanhBao] = await Promise.all([
      this.donModel.aggregate<{ _id: number; soLuongDon: number; tongDoanhThu: number }>([
        { $match: hopLe },
        { $group: { _id: { $month: { date: '$ngayDat', timezone: 'Asia/Ho_Chi_Minh' } }, soLuongDon: { $sum: 1 }, tongDoanhThu: { $sum: '$tongTienSauGiam' } } },
      ]),
      this.donModel.aggregate([
        { $match: hopLe },
        { $unwind: '$chiTiet' },
        {
          $group: {
            _id: '$chiTiet.sanPham',
            tenSanPham: { $first: '$chiTiet.tenSanPham' },
            hinhAnh: { $first: '$chiTiet.hinhAnh' },
            tongSoLuongBan: { $sum: '$chiTiet.soLuong' },
            tongDoanhThu: { $sum: '$chiTiet.thanhTien' },
          },
        },
        { $sort: { tongSoLuongBan: -1 } },
        { $limit: 10 },
      ]),
      this.spModel.countDocuments({ deletedAt: null }),
      this.phanHoiModel.countDocuments({ danhGia: { $lte: 2 } }),
    ]);

    const thang = Array.from({ length: 12 }, (_, i) => {
      const r = theoThang.find((x) => x._id === i + 1);
      return { thang: i + 1, nam, soLuongDon: r?.soLuongDon ?? 0, tongDoanhThu: r?.tongDoanhThu ?? 0 };
    });
    const quy = [0, 1, 2, 3].map((q) => {
      const ba = thang.slice(q * 3, q * 3 + 3);
      return {
        quy: q + 1,
        nam,
        soLuongDon: ba.reduce((t, x) => t + x.soLuongDon, 0),
        tongDoanhThu: ba.reduce((t, x) => t + x.tongDoanhThu, 0),
      };
    });
    return {
      nam,
      tongSanPham,
      soCanhBao,
      tongDoanhThuNam: thang.reduce((t, x) => t + x.tongDoanhThu, 0),
      soLuongDonNam: thang.reduce((t, x) => t + x.soLuongDon, 0),
      doanhThuQuy: quy,
      doanhThuThang: thang,
      sanPhamBanChay: banChay.map((b) => ({
        sanPhamId: idOf(b._id),
        tenSanPham: b.tenSanPham,
        hinhAnh: b.hinhAnh,
        tongSoLuongBan: b.tongSoLuongBan,
        tongDoanhThu: b.tongDoanhThu,
      })),
    };
  }
}
