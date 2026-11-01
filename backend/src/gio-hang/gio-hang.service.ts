import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { bienTheView, idOf } from '../common/mappers';
import { giaBienThe } from '../common/pricing';
import { parseObjectId } from '../common/helpers';
import { ChiTietSanPham, GioHang, KhachHang } from '../schemas';

/* eslint-disable @typescript-eslint/no-explicit-any */
@Injectable()
export class GioHangService {
  constructor(
    @InjectModel(GioHang.name) private readonly gioHangModel: Model<GioHang>,
    @InjectModel(ChiTietSanPham.name) private readonly chiTietModel: Model<ChiTietSanPham>,
    @InjectModel(KhachHang.name) private readonly khachHangModel: Model<KhachHang>,
  ) {}

  async khachHangId(taiKhoanId: string): Promise<Types.ObjectId> {
    const kh = await this.khachHangModel.findOne({ taiKhoan: taiKhoanId }, { _id: 1 }).lean();
    if (!kh) {
      throw new NotFoundException('Không tìm thấy thông tin khách hàng của tài khoản.');
    }
    return kh._id as Types.ObjectId;
  }

  async layDong(khachHang: Types.ObjectId): Promise<any[]> {
    return this.gioHangModel
      .find({ khachHang })
      .populate({
        path: 'chiTietSanPham',
        populate: [
          { path: 'sanPham', populate: { path: 'khuyenMai' } },
          { path: 'mau' },
          { path: 'size' },
        ],
      })
      .sort({ ngayThem: -1 })
      .lean();
  }

  private tinhGia(dong: any): number {
    const ct = dong.chiTietSanPham;
    return ct ? giaBienThe(ct, ct.sanPham) : 0;
  }

  private tomTat(dongs: any[]) {
    const items = dongs
      .filter((d) => d.chiTietSanPham)
      .map((d) => {
        const ct = d.chiTietSanPham;
        const donGia = this.tinhGia(d);
        return {
          id: idOf(d),
          soLuong: d.soLuong,
          ngayThem: d.ngayThem,
          tenSanPham: ct.sanPham?.tenSanPham ?? 'Sản phẩm',
          sanPhamId: idOf(ct.sanPham),
          sanPhamConKinhDoanh: !!ct.sanPham && !ct.sanPham.deletedAt,
          bienThe: bienTheView(ct, ct.sanPham),
          donGia,
          thanhTien: donGia * d.soLuong,
        };
      });
    return {
      items,
      tongTien: items.reduce((t, i) => t + i.thanhTien, 0),
      tongSoLuong: items.reduce((t, i) => t + i.soLuong, 0),
    };
  }

  async xem(taiKhoanId: string) {
    const kh = await this.khachHangId(taiKhoanId);
    return this.tomTat(await this.layDong(kh));
  }

  async dem(taiKhoanId: string): Promise<number> {
    const kh = await this.khachHangModel.findOne({ taiKhoan: taiKhoanId }, { _id: 1 }).lean();
    if (!kh) {
      return 0;
    }
    const r = await this.gioHangModel.aggregate<{ t: number }>([
      { $match: { khachHang: kh._id } },
      { $group: { _id: null, t: { $sum: '$soLuong' } } },
    ]);
    return r[0]?.t ?? 0;
  }

  async them(taiKhoanId: string, chiTietId: string, soLuong: number) {
    const kh = await this.khachHangId(taiKhoanId);
    const ct: any = await this.chiTietModel.findById(parseObjectId(chiTietId, 'Biến thể')).populate('sanPham').lean();
    if (!ct) {
      throw new BadRequestException('Sản phẩm biến thể không tồn tại.');
    }
    if (!ct.sanPham || ct.sanPham.deletedAt) {
      throw new BadRequestException('Sản phẩm không còn kinh doanh.');
    }
    const co = await this.gioHangModel.findOne({ khachHang: kh, chiTietSanPham: ct._id });
    const moi = (co?.soLuong ?? 0) + soLuong;
    if ((ct.soLuongTon ?? 0) < moi) {
      throw new BadRequestException('Số lượng sản phẩm trong giỏ vượt quá tồn kho!');
    }
    if (co) {
      co.soLuong = moi;
      co.ngayThem = new Date();
      await co.save();
    } else {
      await this.gioHangModel.create({ khachHang: kh, chiTietSanPham: ct._id, soLuong: moi });
    }
    return { message: 'Đã thêm sản phẩm vào giỏ hàng thành công!', cartCount: await this.dem(taiKhoanId) };
  }

  async capNhat(taiKhoanId: string, dongId: string, soLuong: number) {
    const kh = await this.khachHangId(taiKhoanId);
    const dong = await this.gioHangModel.findOne({ _id: parseObjectId(dongId, 'Dòng giỏ hàng'), khachHang: kh });
    if (!dong) {
      throw new NotFoundException('Sản phẩm không có trong giỏ hàng.');
    }
    const ct: any = await this.chiTietModel.findById(dong.chiTietSanPham).populate('sanPham').lean();
    if (!ct || !ct.sanPham || ct.sanPham.deletedAt) {
      throw new BadRequestException('Sản phẩm không còn kinh doanh.');
    }
    const ton = Number(ct.soLuongTon ?? 0);
    if (soLuong > ton) {
      throw new BadRequestException({ message: `Số lượng trong kho chỉ còn ${ton} sản phẩm.`, maxStock: ton });
    }
    dong.soLuong = soLuong;
    await dong.save();
    const tomTat = this.tomTat(await this.layDong(kh));
    const dongMoi = tomTat.items.find((i) => i.id === dongId);
    return {
      message: 'Đã cập nhật số lượng.',
      quantity: soLuong,
      itemTotal: dongMoi?.thanhTien ?? 0,
      cartTotal: tomTat.tongTien,
      cartCount: tomTat.tongSoLuong,
    };
  }

  async xoa(taiKhoanId: string, dongId: string) {
    const kh = await this.khachHangId(taiKhoanId);
    await this.gioHangModel.deleteOne({ _id: parseObjectId(dongId, 'Dòng giỏ hàng'), khachHang: kh });
    return { message: 'Đã xóa sản phẩm khỏi giỏ hàng.', cartCount: await this.dem(taiKhoanId) };
  }
}
