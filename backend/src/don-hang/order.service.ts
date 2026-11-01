import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { giaBienThe } from '../common/pricing';
import { ChiTietSanPham, Counter, DonHang, GioHang, TRANG_THAI } from '../schemas';
import { adminCoTheHuy, coTheChuyen, khachCoTheHuy } from './trang-thai';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ThongTinGiaoHang {
  diaChiGiaoHang?: string;
  soDienThoaiNhanHang?: string;
  ghiChu?: string;
}

interface DongDaTru {
  chiTiet: Types.ObjectId;
  soLuong: number;
}

/**
 * Logic đặt/hủy đơn. MongoDB bản standalone không có transaction nên tồn kho được trừ
 * bằng $inc có điều kiện (soLuongTon >= n) – an toàn khi nhiều người mua cùng lúc – và
 * hoàn lại thủ công nếu một bước phía sau thất bại.
 */
@Injectable()
export class OrderService {
  constructor(
    @InjectModel(DonHang.name) private readonly donHangModel: Model<DonHang>,
    @InjectModel(ChiTietSanPham.name) private readonly chiTietModel: Model<ChiTietSanPham>,
    @InjectModel(GioHang.name) private readonly gioHangModel: Model<GioHang>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
  ) {}

  private async soDonKeTiep(): Promise<number> {
    const c = await this.counterModel.findOneAndUpdate(
      { _id: 'donhang' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return c.seq;
  }

  /** Bảo đảm bộ đếm không thấp hơn mã đơn lớn nhất (dùng sau khi import dữ liệu). */
  async dongBoBoDem(): Promise<void> {
    const max = await this.donHangModel.findOne().sort({ soDonHang: -1 }).lean();
    if (max) {
      await this.counterModel.updateOne({ _id: 'donhang' }, { $max: { seq: max.soDonHang } }, { upsert: true });
    }
  }

  private async hoanLaiTon(dongs: DongDaTru[]): Promise<void> {
    for (const d of dongs) {
      await this.chiTietModel.updateOne({ _id: d.chiTiet }, { $inc: { soLuongTon: d.soLuong } });
    }
  }

  async createOrder(
    khachHang: Types.ObjectId,
    thongTin: ThongTinGiaoHang,
    dongGio: { chiTietSanPham: any; soLuong: number }[],
    trangThaiDau: string = TRANG_THAI.DangXuLy,
    xoaGioHang = true,
  ) {
    const daTru: DongDaTru[] = [];
    const chiTiet: any[] = [];
    let tongTien = 0;
    try {
      for (const dong of dongGio) {
        const ctId = dong.chiTietSanPham?._id ?? dong.chiTietSanPham;
        const ct: any = await this.chiTietModel
          .findById(ctId)
          .populate([{ path: 'sanPham', populate: { path: 'khuyenMai' } }, { path: 'mau' }, { path: 'size' }])
          .lean();
        if (!ct) {
          throw new BadRequestException(`Sản phẩm biến thể ID: ${ctId} không tồn tại.`);
        }
        const tru = await this.chiTietModel.updateOne(
          { _id: ct._id, soLuongTon: { $gte: dong.soLuong } },
          { $inc: { soLuongTon: -dong.soLuong } },
        );
        if (tru.modifiedCount === 0) {
          const ten = ct.sanPham?.tenSanPham ?? 'Sản phẩm';
          throw new BadRequestException(`Sản phẩm '${ten}' vừa hết hàng hoặc không đủ số lượng tồn kho.`);
        }
        daTru.push({ chiTiet: ct._id, soLuong: dong.soLuong });
        const donGia = giaBienThe(ct, ct.sanPham);
        const thanhTien = donGia * dong.soLuong;
        tongTien += thanhTien;
        chiTiet.push({
          chiTietSanPham: ct._id,
          sanPham: ct.sanPham?._id,
          tenSanPham: ct.sanPham?.tenSanPham,
          hinhAnh: ct.hinhAnh || ct.sanPham?.hinhAnhDaiDien,
          sku: ct.sku,
          tenMau: ct.mau?.tenMau,
          tenSize: ct.size?.tenSize,
          soLuong: dong.soLuong,
          donGia,
          thanhTien,
        });
      }
      const don = await this.donHangModel.create({
        soDonHang: await this.soDonKeTiep(),
        ngayDat: new Date(),
        trangThai: trangThaiDau,
        tongTien,
        tongTienSauGiam: tongTien,
        tienGiam: 0,
        khachHang,
        diaChiGiaoHang: thongTin.diaChiGiaoHang ?? 'Tại cửa hàng',
        soDienThoaiNhanHang: thongTin.soDienThoaiNhanHang ?? '0000000000',
        ghiChu: thongTin.ghiChu ?? '',
        chiTiet,
      });
      if (xoaGioHang) {
        await this.gioHangModel.deleteMany({ khachHang });
      }
      return don;
    } catch (e) {
      await this.hoanLaiTon(daTru);
      throw e;
    }
  }

  /** Chuyển trạng thái có điều kiện (compare-and-set) để tránh hoàn kho hai lần khi bấm đồng thời. */
  private async doiTrangThai(soDonHang: number, tu: string, den: string): Promise<any | null> {
    return this.donHangModel.findOneAndUpdate(
      { soDonHang, trangThai: tu },
      { $set: { trangThai: den } },
      { returnDocument: 'after' },
    );
  }

  private async hoanKho(don: { chiTiet: any[] }): Promise<void> {
    await this.hoanLaiTon(
      don.chiTiet
        .filter((c) => c.chiTietSanPham)
        .map((c) => ({ chiTiet: c.chiTietSanPham, soLuong: Number(c.soLuong ?? 0) })),
    );
  }

  async cancelOrder(soDonHang: number, khachHang: Types.ObjectId | null, isAdmin = false): Promise<void> {
    const don: any = await this.donHangModel.findOne({
      soDonHang,
      ...(!isAdmin && khachHang ? { khachHang } : {}),
    });
    if (!don) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }
    const duoc = isAdmin ? adminCoTheHuy(don.trangThai) : khachCoTheHuy(don.trangThai);
    if (!duoc) {
      throw new BadRequestException('Đơn hàng đang giao, đã hoàn tất hoặc đã hủy, không thể hủy.');
    }
    const daDoi = await this.doiTrangThai(soDonHang, don.trangThai, TRANG_THAI.DaHuy);
    if (!daDoi) {
      throw new BadRequestException('Đơn hàng vừa được cập nhật, vui lòng tải lại trang.');
    }
    await this.hoanKho(daDoi);
  }

  async huyDoThanhToanThatBai(soDonHang: number): Promise<void> {
    const don = await this.doiTrangThai(soDonHang, TRANG_THAI.ChoThanhToanMomo, TRANG_THAI.DaHuyThanhToanThatBai);
    if (don) {
      await this.hoanKho(don);
    }
  }

  async danhDauDaThanhToanMomo(soDonHang: number): Promise<any | null> {
    const don = await this.doiTrangThai(soDonHang, TRANG_THAI.ChoThanhToanMomo, TRANG_THAI.DaThanhToanMomo);
    if (don?.khachHang) {
      await this.gioHangModel.deleteMany({ khachHang: don.khachHang });
    }
    return don;
  }

  async setTrangThai(soDonHang: number, trangThaiMoi: string): Promise<void> {
    const don: any = await this.donHangModel.findOne({ soDonHang });
    if (!don) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }
    if (!coTheChuyen(don.trangThai, trangThaiMoi)) {
      throw new BadRequestException(`Không thể chuyển đơn hàng từ '${don.trangThai}' sang '${trangThaiMoi}'.`);
    }
    const daDoi = await this.doiTrangThai(soDonHang, don.trangThai, trangThaiMoi);
    if (!daDoi) {
      throw new BadRequestException('Đơn hàng vừa được cập nhật, vui lòng tải lại trang.');
    }
    if (trangThaiMoi === TRANG_THAI.DaHuy) {
      await this.hoanKho(daDoi);
    }
  }
}
