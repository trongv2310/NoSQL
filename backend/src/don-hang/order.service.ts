import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { giaBienThe } from '../common/pricing';
import { DONG_GIO_HOAT_DONG, xoaDongGio } from '../gio-hang/gio-hang-xoa';
import { ChiTietSanPham, Counter, DonHang, GioHang, TRANG_THAI } from '../schemas';
import { TuVotService } from '../tu-vot/tu-vot.service';
import { adminCoTheHuy, coTheChuyen, khachCoTheHuy } from './trang-thai';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ThongTinGiaoHang {
  hoTenNhan?: string;
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
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectModel(DonHang.name) private readonly donHangModel: Model<DonHang>,
    @InjectModel(ChiTietSanPham.name) private readonly chiTietModel: Model<ChiTietSanPham>,
    @InjectModel(GioHang.name) private readonly gioHangModel: Model<GioHang>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
    @Optional() private readonly tuVot?: TuVotService,
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
    let daTaoDon = false; // sau điểm này đơn đã tồn tại: KHÔNG được hoàn tồn kho nếu bước phụ (dọn giỏ) lỗi
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
        hoTenNhan: thongTin.hoTenNhan,
        diaChiGiaoHang: thongTin.diaChiGiaoHang ?? 'Tại cửa hàng',
        soDienThoaiNhanHang: thongTin.soDienThoaiNhanHang ?? '0000000000',
        ghiChu: thongTin.ghiChu ?? '',
        chiTiet,
      });
      daTaoDon = true;
      if (xoaGioHang) {
        try {
          await xoaDongGio(this.gioHangModel, { khachHang });
        } catch (e) {
          // Đơn đã lưu và tồn đã trừ: báo thành công; giỏ còn dòng cũ sẽ hiện lại, khách tự xóa được. Không hoàn tồn vì đơn vẫn có hiệu lực.
          this.logger.error(`Đơn #${don.soDonHang} đã tạo nhưng dọn giỏ lỗi: ${(e as Error).message}`);
        }
      }
      return don;
    } catch (e) {
      if (!daTaoDon) await this.hoanLaiTon(daTru);
      throw e;
    }
  }

  /** Chuyển trạng thái có điều kiện (compare-and-set) để tránh hoàn kho hai lần khi bấm đồng thời. */
  private async doiTrangThai(soDonHang: number, tu: string, den: string, session?: ClientSession): Promise<any | null> {
    return this.donHangModel.findOneAndUpdate(
      { soDonHang, trangThai: tu },
      { $set: { trangThai: den } },
      { returnDocument: 'after', session },
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
      // Chỉ tiêu thụ ĐÚNG số lượng thuộc đơn: dòng khác, hay phần khách thêm sau khi tạo đơn (cùng SKU tăng lên, hoặc thêm lại) vẫn nằm trong giỏ.
      try {
        for (const c of don.chiTiet ?? []) {
          const n = Number(c.soLuong ?? 0);
          if (!c.chiTietSanPham || !(n > 0)) continue;
          const loc = { khachHang: don.khachHang, chiTietSanPham: c.chiTietSanPham };
          // Một lệnh nguyên tử: số lượng giỏ hiện tại trừ đi phần của đơn (không âm), dù khách có sửa giỏ ngay trước đó; rồi dọn dòng đã hết.
          // Giới hạn đã biết: khách xóa rồi thêm lại ĐÚNG món đó trong lúc chờ thì không phân biệt được món mới với món cũ (cùng biến thể coi như thay thế được).
          await this.gioHangModel.updateOne({ ...loc, ...DONG_GIO_HOAT_DONG }, [{ $set: { soLuong: { $max: [0, { $subtract: ['$soLuong', n] }] } } }], { updatePipeline: true });
          await xoaDongGio(this.gioHangModel, { ...loc, soLuong: { $lte: 0 } });
        }
      } catch (e) {
        // Đơn đã chuyển sang "đã thanh toán": lỗi dọn giỏ không được làm hỏng xác nhận thanh toán.
        this.logger.error(`Đơn #${soDonHang} đã thanh toán nhưng dọn giỏ lỗi: ${(e as Error).message}`);
      }
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
    if (trangThaiMoi === TRANG_THAI.HoanThanh && this.tuVot) {
      // Hoàn thành đơn + tạo hộ chiếu cho từng cây vợt trong đơn: chung MỘT transaction khi MongoDB chạy replica set.
      // Standalone: đổi trạng thái (CAS) rồi tạo hộ chiếu; tạo hộ chiếu là upsert theo maNguon nên chạy lại không trùng.
      const tuVot = this.tuVot;
      await tuVot.trongTransaction(async (session) => {
        const daDoi = await this.doiTrangThai(soDonHang, don.trangThai, trangThaiMoi, session);
        if (!daDoi) throw new BadRequestException('Đơn hàng vừa được cập nhật, vui lòng tải lại trang.');
        try {
          await tuVot.taoHoChieuTuDon(daDoi, session);
        } catch (e) {
          if (session) throw e; // có transaction: huỷ cả việc đổi trạng thái
          this.logger.error(`Đơn #${soDonHang} đã hoàn thành nhưng tạo hộ chiếu vợt lỗi: ${(e as Error).message}`);
        }
      });
      return;
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
