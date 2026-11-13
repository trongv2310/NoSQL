import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { bienTheView, idOf } from '../common/mappers';
import { giaBienThe } from '../common/pricing';
import { ChiTietSanPham, GioHang, GioHangDongBo, GioHangDongBoDong } from '../schemas';
import {
  DongGio, HAN_MA_DONG_BO_MS, SO_MA_DONG_BO_TOI_DA, TOI_DA_DONG, TOI_DA_SO_LUONG, dauNoiDung, gopDong, laLoiTrungKhoa,
} from './gio-khach';
import { GioHangService } from './gio-hang.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type TrangThaiDong = 'ok' | 'giam_so_luong' | 'het_hang' | 'ngung_kinh_doanh' | 'khong_ton_tai';
export type TrangThaiGop = 'da_gop' | 'giam_so_luong' | 'da_ap_dung' | 'het_hang' | 'ngung_kinh_doanh' | 'khong_ton_tai';

export interface KetQuaGop {
  chiTietId: string;
  tenSanPham: string | null;
  yeuCau: number;
  /** Số lượng thực sự được cộng thêm vào giỏ tài khoản (0 nếu bị bỏ qua hoặc đã áp dụng từ lần trước). */
  daThem: number;
  trangThai: TrangThaiGop;
}

/** Mã lỗi trong thân phản hồi 403 khi bản đồng bộ được lập cho một tài khoản khác với phiên đăng nhập hiện tại. */
export const MA_LOI_SAI_TAI_KHOAN = 'sai_tai_khoan';

const POPULATE_BIEN_THE = [{ path: 'sanPham', populate: { path: 'khuyenMai' } }, { path: 'mau' }, { path: 'size' }];
const SO_LAN_THU_TOI_DA = 5;

/**
 * Giỏ hàng của khách chưa đăng nhập. Trình duyệt chỉ giữ id biến thể + số lượng; mọi thứ khác do server quyết định:
 *  - `tinh`: báo giá công khai, tính lại giá và tồn kho từ DB, không nhận giá/tên/tổng tiền từ client.
 *  - `dongBo`: gộp giỏ khách vào giỏ tài khoản sau đăng nhập, an toàn khi bị gửi lại hoặc gửi song song, và chỉ khi tài khoản mà
 *    bản đồng bộ được lập cho (`taiKhoanDuKien`) đúng là tài khoản của phiên đăng nhập đang gửi yêu cầu.
 */
@Injectable()
export class GioKhachService {
  constructor(
    @InjectModel(GioHang.name) private readonly gioHangModel: Model<GioHang>,
    @InjectModel(GioHangDongBo.name) private readonly dongBoModel: Model<GioHangDongBo>,
    @InjectModel(GioHangDongBoDong.name) private readonly soCaiModel: Model<GioHangDongBoDong>,
    @InjectModel(ChiTietSanPham.name) private readonly chiTietModel: Model<ChiTietSanPham>,
    private readonly gioHang: GioHangService,
  ) {}

  private kiemTraDauVao(dongs: DongGio[]): DongGio[] {
    const gop = gopDong(dongs);
    if (gop.length > TOI_DA_DONG) {
      throw new BadRequestException(`Giỏ hàng chỉ được tối đa ${TOI_DA_DONG} sản phẩm khác nhau.`);
    }
    return gop;
  }

  private async layBienThe(gop: DongGio[]): Promise<Map<string, any>> {
    if (!gop.length) {
      return new Map();
    }
    const cts: any[] = await this.chiTietModel
      .find({ _id: { $in: gop.map((d) => new Types.ObjectId(d.chiTietId)) } })
      .populate(POPULATE_BIEN_THE)
      .lean();
    return new Map(cts.map((ct) => [String(ct._id), ct]));
  }

  // ---------------------------------------------------------------------------
  // Báo giá
  // ---------------------------------------------------------------------------

  async tinh(dongs: DongGio[]) {
    const gop = this.kiemTraDauVao(dongs);
    const theoId = await this.layBienThe(gop);
    const items = gop.map((d) => {
      const ct = theoId.get(d.chiTietId);
      const sp = ct?.sanPham;
      const conKinhDoanh = !!sp && !sp.deletedAt;
      const ton = Math.max(0, Number(ct?.soLuongTon ?? 0));
      let trangThai: TrangThaiDong = 'ok';
      let soLuong = d.soLuong;
      if (!ct) {
        trangThai = 'khong_ton_tai';
      } else if (!conKinhDoanh) {
        trangThai = 'ngung_kinh_doanh';
      } else if (ton <= 0) {
        trangThai = 'het_hang';
      } else if (ton < d.soLuong) {
        trangThai = 'giam_so_luong';
        soLuong = ton;
      }
      const mua = trangThai === 'ok' || trangThai === 'giam_so_luong';
      const donGia = ct && conKinhDoanh ? giaBienThe(ct, sp) : 0;
      return {
        id: d.chiTietId,
        trangThai,
        soLuongYeuCau: d.soLuong,
        soLuong: mua ? soLuong : 0,
        tenSanPham: sp?.tenSanPham ?? null,
        sanPhamId: idOf(sp),
        sanPhamConKinhDoanh: conKinhDoanh,
        bienThe: ct ? bienTheView(ct, sp) : null,
        donGia,
        thanhTien: mua ? donGia * soLuong : 0,
      };
    });
    return {
      items,
      tongTien: items.reduce((t, i) => t + i.thanhTien, 0),
      tongSoLuong: items.reduce((t, i) => t + i.soLuong, 0),
    };
  }

  // ---------------------------------------------------------------------------
  // Đồng bộ sau đăng nhập
  // ---------------------------------------------------------------------------

  /** Ghi sổ cái "mã này đã cộng biến thể này vào giỏ khách này" (trùng khóa nghĩa là đã có, bỏ qua). */
  private async ghiSoCai(khachHang: Types.ObjectId, syncId: string, chiTiet: Types.ObjectId, daThem: number): Promise<void> {
    try {
      await this.soCaiModel.create({ khachHang, syncId, chiTiet, daThem });
    } catch (e) {
      if (!laLoiTrungKhoa(e)) {
        throw e;
      }
    }
  }

  /**
   * Cộng một dòng vào giỏ tài khoản mà không bao giờ vượt `min(tồn kho, 100)`, và chỉ cộng một lần cho mỗi `syncId`.
   * MongoDB bản standalone không có transaction nên mọi bước dựa vào một thao tác nguyên tử trên MỘT tài liệu:
   *  0. sổ cái đã ghi "syncId này đã cộng dòng này" → bỏ qua (kể cả khi khách đã xóa dòng giỏ hoặc mã trên dòng đã bị bỏ);
   *  1. cập nhật có điều kiện `dongBo.t != syncId` bằng pipeline (đọc số lượng cũ, tính `min`, thêm mã kèm thời điểm) và trả về bản
   *     TRƯỚC khi sửa. Mã không bao giờ bị loại theo số lượng, nên một biên nhận dở dang không thể bị "quên" bởi các lần đồng bộ khác;
   *  2. không khớp → đọc lại dòng: có mã thì là đã áp dụng; chưa có dòng thì tạo mới;
   *  3. tạo mới đụng khóa duy nhất (E11000) chỉ nghĩa là ai đó vừa tạo dòng, KHÔNG nghĩa là đã đồng bộ → quay lại bước 1;
   *  4. sau khi cộng xong mới ghi sổ cái (cộng trước, ghi sổ sau: nếu bị ngắt giữa hai bước thì mã trên dòng vẫn chặn cộng đôi).
   */
  private async gopMotDong(khachHang: Types.ObjectId, ct: any, soLuong: number, syncId: string): Promise<KetQuaGop> {
    const chiTietId = String(ct._id);
    const tenSanPham = ct.sanPham?.tenSanPham ?? null;
    const base = { chiTietId, tenSanPham, yeuCau: soLuong };
    if (await this.soCaiModel.exists({ khachHang, syncId, chiTiet: ct._id })) {
      return { ...base, daThem: 0, trangThai: 'da_ap_dung' };
    }
    if (!ct.sanPham || ct.sanPham.deletedAt) {
      return { ...base, daThem: 0, trangThai: 'ngung_kinh_doanh' };
    }
    const tran = Math.min(TOI_DA_SO_LUONG, Math.max(0, Math.floor(Number(ct.soLuongTon ?? 0))));
    if (tran <= 0) {
      return { ...base, daThem: 0, trangThai: 'het_hang' };
    }
    const hoanTat = async (daThem: number, trangThai: TrangThaiGop): Promise<KetQuaGop> => {
      await this.ghiSoCai(khachHang, syncId, ct._id, daThem);
      return { ...base, daThem, trangThai };
    };
    const ketQuaCong = (truoc: number) => {
      const sau = Math.min(tran, truoc + soLuong);
      return { daThem: Math.max(0, sau - truoc), trangThai: (sau < truoc + soLuong ? 'giam_so_luong' : 'da_gop') as TrangThaiGop };
    };
    for (let lan = 0; lan < SO_LAN_THU_TOI_DA; lan++) {
      const bay = new Date();
      const hanCu = new Date(bay.getTime() - HAN_MA_DONG_BO_MS);
      const cu: any = await this.gioHangModel
        .findOneAndUpdate(
          {
            khachHang,
            chiTietSanPham: ct._id,
            'dongBo.t': { $ne: syncId },
            $expr: { $lt: [{ $size: { $ifNull: ['$dongBo', []] } }, SO_MA_DONG_BO_TOI_DA] },
          },
          [
            {
              $set: {
                // dòng đã bị khách xóa tính là 0 và được kích hoạt lại (mã cũ trên dòng vẫn giữ để chặn cộng lại)
                soLuong: { $min: [tran, { $add: [{ $cond: [{ $eq: ['$daXoa', true] }, 0, { $ifNull: ['$soLuong', 0] }] }, soLuong] }] },
                daXoa: false,
                ngayThem: bay,
                dongBo: {
                  $concatArrays: [
                    // bỏ mã quá hạn (kể cả phần tử kiểu cũ không có `ts`), giữ mọi mã còn hạn
                    { $filter: { input: { $ifNull: ['$dongBo', []] }, as: 'm', cond: { $gte: [{ $ifNull: ['$$m.ts', new Date(0)] }, hanCu] } } },
                    [{ t: syncId, ts: bay }],
                  ],
                },
              },
            },
            { $unset: 'ngayXoa' },
          ],
          { updatePipeline: true, returnDocument: 'before' },
        )
        .lean();
      if (cu) {
        const kq = ketQuaCong(cu.daXoa ? 0 : Number(cu.soLuong ?? 0));
        return hoanTat(kq.daThem, kq.trangThai);
      }
      const co: any = await this.gioHangModel.findOne({ khachHang, chiTietSanPham: ct._id }, { dongBo: 1 }).lean();
      if (co) {
        const ds: { t?: string }[] = co.dongBo ?? [];
        if (ds.some((m) => m?.t === syncId)) {
          return hoanTat(0, 'da_ap_dung');
        }
        if (ds.length >= SO_MA_DONG_BO_TOI_DA) {
          // Gỡ các mã đã quá hạn rồi thử lại; nếu vẫn đầy thì từ chối rõ ràng thay vì bỏ bớt mã còn hiệu lực.
          await this.gioHangModel.updateOne(
            { khachHang, chiTietSanPham: ct._id },
            [{ $set: { dongBo: { $filter: { input: { $ifNull: ['$dongBo', []] }, as: 'm', cond: { $gte: [{ $ifNull: ['$$m.ts', new Date(0)] }, hanCu] } } } } }],
            { updatePipeline: true },
          );
          const sau: any = await this.gioHangModel.findOne({ khachHang, chiTietSanPham: ct._id }, { dongBo: 1 }).lean();
          if ((sau?.dongBo ?? []).length >= SO_MA_DONG_BO_TOI_DA) {
            throw new ServiceUnavailableException('Sản phẩm này có quá nhiều lần đồng bộ giỏ hàng gần đây, vui lòng thử lại sau.');
          }
        }
        continue; // dòng vừa xuất hiện giữa hai bước: thử lại cập nhật có điều kiện
      }
      try {
        await this.gioHangModel.create({ khachHang, chiTietSanPham: ct._id, soLuong: Math.min(tran, soLuong), dongBo: [{ t: syncId, ts: bay }] });
        const kq = ketQuaCong(0);
        return hoanTat(kq.daThem, kq.trangThai);
      } catch (e) {
        if (!laLoiTrungKhoa(e)) {
          throw e;
        }
      }
    }
    throw new ServiceUnavailableException('Chưa đồng bộ được giỏ hàng lúc này, vui lòng thử lại.');
  }

  async dongBoChoKhachHang(khachHang: Types.ObjectId, syncId: string, dongs: DongGio[]) {
    const gop = this.kiemTraDauVao(dongs);
    const dau = dauNoiDung(gop);

    // Dấu vết của lần đồng bộ: tạo trước khi ghi dòng đầu tiên, đánh dấu "xong" sau khi mọi dòng đã được áp dụng.
    let dauVet: any = await this.dongBoModel.findOne({ khachHang, syncId }).lean();
    if (!dauVet) {
      try {
        dauVet = (await this.dongBoModel.create({ khachHang, syncId, dau, trangThai: 'dang_xu_ly' })).toObject();
      } catch (e) {
        if (!laLoiTrungKhoa(e)) {
          throw e;
        }
        dauVet = await this.dongBoModel.findOne({ khachHang, syncId }).lean();
      }
    }
    if (!dauVet) {
      throw new ServiceUnavailableException('Chưa đồng bộ được giỏ hàng lúc này, vui lòng thử lại.');
    }
    if (dauVet.dau !== dau) {
      throw new ConflictException('Mã đồng bộ này đã được dùng cho một giỏ hàng khác.');
    }
    if (dauVet.trangThai === 'xong') {
      return {
        daApDungTruoc: true,
        ketQua: gop.map<KetQuaGop>((d) => ({ chiTietId: d.chiTietId, tenSanPham: null, yeuCau: d.soLuong, daThem: 0, trangThai: 'da_ap_dung' })),
      };
    }

    const theoId = await this.layBienThe(gop);
    const ketQua: KetQuaGop[] = [];
    for (const d of gop) {
      const ct = theoId.get(d.chiTietId);
      ketQua.push(
        ct
          ? await this.gopMotDong(khachHang, ct, d.soLuong, syncId)
          : { chiTietId: d.chiTietId, tenSanPham: null, yeuCau: d.soLuong, daThem: 0, trangThai: 'khong_ton_tai' },
      );
    }
    await this.dongBoModel.updateOne({ _id: dauVet._id }, { $set: { trangThai: 'xong' } });
    return { daApDungTruoc: false, ketQua };
  }

  /**
   * Dùng cho controller. `principalId` là tài khoản của phiên đăng nhập (do server xác thực, KHÔNG phải do client gửi);
   * `taiKhoanDuKien` là tài khoản mà trình duyệt lập bản đồng bộ này cho. Hai giá trị phải trùng: nếu phiên đã đổi sang người khác
   * (đăng nhập tài khoản khác ở thẻ khác, hoặc giữa lúc yêu cầu đang chờ) thì từ chối 403 trước khi chạm vào bất kỳ giỏ nào,
   * để giỏ của tài khoản cũ không bao giờ bị gộp vào tài khoản mới. Khách hàng luôn được chọn theo `principalId`.
   */
  async dongBo(principalId: string, taiKhoanDuKien: string, syncId: string, dongs: DongGio[]) {
    if (String(taiKhoanDuKien) !== String(principalId)) {
      throw new ForbiddenException({
        message: 'Giỏ hàng này được lưu cho một tài khoản khác với phiên đăng nhập hiện tại nên chưa được gộp.',
        maLoi: MA_LOI_SAI_TAI_KHOAN,
      });
    }
    const khachHang = await this.gioHang.khachHangId(principalId);
    const r = await this.dongBoChoKhachHang(khachHang, syncId, dongs);
    const gio = await this.gioHang.xem(principalId);
    return { ...gio, taiKhoanId: principalId, daApDungTruoc: r.daApDungTruoc, ketQua: r.ketQua, cartCount: gio.tongSoLuong };
  }
}
