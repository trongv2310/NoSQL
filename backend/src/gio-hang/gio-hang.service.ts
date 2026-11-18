import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { bienTheView, idOf } from '../common/mappers';
import { giaBienThe } from '../common/pricing';
import { parseObjectId } from '../common/helpers';
import { ChiTietSanPham, GioHang, KhachHang } from '../schemas';
import { DONG_GIO_HOAT_DONG, xoaDongGio } from './gio-hang-xoa';
import { TOI_DA_SO_LUONG, laLoiTrungKhoa } from './gio-khach';

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
      .find({ khachHang, ...DONG_GIO_HOAT_DONG })
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
      { $match: { khachHang: kh._id, ...DONG_GIO_HOAT_DONG } },
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
    const ton = Math.max(0, Number(ct.soLuongTon ?? 0));
    const tran = Math.min(ton, TOI_DA_SO_LUONG);
    const quaTran = () =>
      new BadRequestException(
        ton < TOI_DA_SO_LUONG ? 'Số lượng sản phẩm trong giỏ vượt quá tồn kho!' : `Mỗi sản phẩm chỉ được đặt tối đa ${TOI_DA_SO_LUONG}.`,
      );
    if (soLuong > tran) {
      throw quaTran();
    }
    // Cộng nguyên tử và chỉ khi tổng sau khi cộng không vượt trần: hai yêu cầu cùng lúc (hoặc một lần đồng bộ giỏ khách xen vào)
    // không ghi đè số lượng của nhau như kiểu đọc rồi lưu lại cả tài liệu.
    let xong = false;
    for (let lan = 0; lan < 5 && !xong; lan++) {
      // Số lượng hiện có của dòng đã bị xóa tính là 0 và thêm lại sẽ kích hoạt lại dòng (mã đồng bộ trên dòng được giữ nguyên).
      const hienCo = { $cond: [{ $eq: ['$daXoa', true] }, 0, { $ifNull: ['$soLuong', 0] }] };
      const r = await this.gioHangModel.updateOne(
        { khachHang: kh, chiTietSanPham: ct._id, $expr: { $lte: [hienCo, tran - soLuong] } },
        [{ $set: { soLuong: { $add: [hienCo, soLuong] }, daXoa: false, ngayThem: new Date() } }, { $unset: 'ngayXoa' }],
        { updatePipeline: true },
      );
      if (r.matchedCount > 0) {
        xong = true;
      } else if (await this.dongDaCo(kh, ct._id, soLuong, tran, quaTran)) {
        continue; // dòng vừa xuất hiện giữa hai bước (ví dụ một lần đồng bộ vừa tạo) và còn đủ chỗ: thử lại cộng nguyên tử
      } else {
        try {
          await this.gioHangModel.create({ khachHang: kh, chiTietSanPham: ct._id, soLuong });
          xong = true;
        } catch (e) {
          if (!laLoiTrungKhoa(e)) {
            throw e;
          }
        }
      }
    }
    if (!xong) {
      throw new ServiceUnavailableException('Chưa thêm được vào giỏ hàng lúc này, vui lòng thử lại.');
    }
    return { message: 'Đã thêm sản phẩm vào giỏ hàng thành công!', cartCount: await this.dem(taiKhoanId) };
  }

  /**
   * Cộng nguyên tử thất bại: hoặc dòng chưa có (→ false, để tạo mới), hoặc dòng đã có. Dòng đã có chỉ bị từ chối khi THỰC SỰ không đủ
   * chỗ (số lượng hiện tại + thêm > trần); còn chỗ thì là dòng vừa xuất hiện giữa hai bước nên trả true để thử cộng lại.
   */
  private async dongDaCo(kh: Types.ObjectId, ctId: Types.ObjectId, them: number, tran: number, quaTran: () => Error): Promise<boolean> {
    const co: any = await this.gioHangModel.findOne({ khachHang: kh, chiTietSanPham: ctId }, { soLuong: 1, daXoa: 1 }).lean();
    if (!co) {
      return false;
    }
    if ((co.daXoa ? 0 : Number(co.soLuong ?? 0)) + them > tran) {
      throw quaTran();
    }
    return true;
  }

  async capNhat(taiKhoanId: string, dongId: string, soLuong: number) {
    const kh = await this.khachHangId(taiKhoanId);
    const dong = await this.gioHangModel.findOne({ _id: parseObjectId(dongId, 'Dòng giỏ hàng'), khachHang: kh, ...DONG_GIO_HOAT_DONG });
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
    await xoaDongGio(this.gioHangModel, { _id: parseObjectId(dongId, 'Dòng giỏ hàng'), khachHang: kh });
    return { message: 'Đã xóa sản phẩm khỏi giỏ hàng.', cartCount: await this.dem(taiKhoanId) };
  }
}
