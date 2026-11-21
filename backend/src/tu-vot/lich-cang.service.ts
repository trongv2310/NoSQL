import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KhachHang, LichCang, SUC_CHUA_MAC_DINH, VotCaNhan } from '../schemas';
import { doiSangLbs, DonViCang, TRAN_NHAP, vuotMucNSX } from './so-cang';
import { TuVotService } from './tu-vot.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Giờ mở khung căng trong ngày (giờ Việt Nam, UTC+7). */
export const GIO_MO = [9, 10, 11, 14, 15, 16, 17, 19, 20];
const LECH_VN_MS = 7 * 3600_000;

/** Các khung giờ trong `soNgay` ngày tới (tính theo lịch Việt Nam), bỏ khung bắt đầu trước `now + 1 giờ`. */
export function khungGioSapToi(now: Date, soNgay = 7): Date[] {
  const vn = new Date(now.getTime() + LECH_VN_MS);
  const ra: Date[] = [];
  for (let d = 0; d < soNgay; d++) {
    for (const h of GIO_MO) {
      const t = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + d, h) - LECH_VN_MS);
      if (t.getTime() >= now.getTime() + 3600_000) ra.push(t);
    }
  }
  return ra;
}

/** Khung có đúng là một khung mở trong lịch không (giờ VN tròn, thuộc GIO_MO). */
export function laKhungHopLe(t: Date): boolean {
  const vn = new Date(t.getTime() + LECH_VN_MS);
  return vn.getUTCMinutes() === 0 && vn.getUTCSeconds() === 0 && vn.getUTCMilliseconds() === 0 && GIO_MO.includes(vn.getUTCHours());
}

/** Ngày lịch Việt Nam của một khung → 00:00 UTC của ngày đó (cách lưu ngày căng trong sổ). */
export const ngayLichVN = (t: Date) => {
  const vn = new Date(t.getTime() + LECH_VN_MS);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
};

/** Giờ hẹn theo giờ Việt Nam, dạng "09:00 24/11/2026" (dùng trong thông báo lỗi). */
export const gioHenVN = (t: Date) => {
  const vn = new Date(t.getTime() + LECH_VN_MS);
  const hai = (n: number) => String(n).padStart(2, '0');
  return `${hai(vn.getUTCHours())}:${hai(vn.getUTCMinutes())} ${vn.getUTCDate()}/${vn.getUTCMonth() + 1}/${vn.getUTCFullYear()}`;
};

export interface DatChoNhap {
  ngay: string;
  votCaNhanId: string;
  giaTri: number;
  donVi: DonViCang;
  tenDay?: string;
}

@Injectable()
export class LichCangService {
  constructor(
    @InjectModel(LichCang.name) private readonly lichModel: Model<LichCang>,
    @InjectModel(VotCaNhan.name) private readonly votModel: Model<VotCaNhan>,
    @InjectModel(KhachHang.name) private readonly khachHangModel: Model<KhachHang>,
    private readonly tuVot: TuVotService,
  ) {}

  /** Khung giờ 7 ngày tới kèm số chỗ còn trống. Khung chưa ai đặt thì chưa có document, coi như còn đủ chỗ. */
  async khungTrong(now = new Date()) {
    const khung = khungGioSapToi(now);
    const docs = await this.lichModel.find({ ngay: { $in: khung } }, { ngay: 1, sucChua: 1, soDaDat: 1 }).lean();
    const theoGio = new Map(docs.map((d) => [d.ngay.getTime(), d]));
    return khung.map((t) => {
      const d = theoGio.get(t.getTime());
      const sucChua = d?.sucChua ?? SUC_CHUA_MAC_DINH;
      return { ngay: t, sucChua, conTrong: sucChua - (d?.soDaDat ?? 0) };
    });
  }

  /**
   * Đặt chỗ. Toàn bộ việc "còn chỗ thì giữ" là MỘT lệnh: điều kiện `soDaDat < sucChua` + $push + $inc (upsert cho khung chưa có
   * document). Khung đã kín → lệnh không khớp, upsert đụng index unique `khung_gio` → lỗi 11000 → báo hết chỗ.
   */
  async datCho(khachHang: Types.ObjectId, n: DatChoNhap, now = new Date()) {
    const ngay = new Date(n.ngay);
    if (Number.isNaN(+ngay) || !laKhungHopLe(ngay)) throw new BadRequestException('Khung giờ không có trong lịch của shop.');
    if (ngay.getTime() < now.getTime() + 3600_000) throw new BadRequestException('Chỉ đặt được khung bắt đầu sau ít nhất 1 giờ nữa.');
    if (!(n.giaTri > 0 && n.giaTri <= TRAN_NHAP[n.donVi])) throw new BadRequestException(`Số căng phải lớn hơn 0 và tối đa ${TRAN_NHAP[n.donVi]} ${n.donVi}.`);
    const mucCangLbs = doiSangLbs(n.giaTri, n.donVi);
    if (mucCangLbs < 5) throw new BadRequestException('Số căng quá nhỏ (dưới 5 lbs), kiểm tra lại đơn vị.');
    if (!Types.ObjectId.isValid(n.votCaNhanId)) throw new BadRequestException('Mã vợt không hợp lệ.');
    const vot = await this.votModel.findOne({ _id: n.votCaNhanId, khachHang, deletedAt: null }, { ten: 1, thongSoChup: 1 }).lean();
    if (!vot) throw new NotFoundException('Không tìm thấy vợt trong tủ của bạn.');
    if (vuotMucNSX(mucCangLbs, vot.thongSoChup?.sucCangMaxLbs)) {
      throw new BadRequestException(`Mức ${mucCangLbs} lbs vượt mức tối đa nhà sản xuất ghi cho cây vợt này (${vot.thongSoChup!.sucCangMaxLbs} lbs). Shop không căng vượt mức này.`);
    }
    // Một cây vợt chỉ có một lịch đang chờ.
    if (await this.lichModel.exists({ ngay: { $gte: now }, datCho: { $elemMatch: { votCaNhan: vot._id, trangThai: 'cho' } } })) {
      throw new ConflictException('Cây vợt này đã có một lịch căng đang chờ.');
    }
    const kh = await this.khachHangModel.findById(khachHang, { hoTen: 1 }).lean();
    const cho = {
      _id: new Types.ObjectId(), khachHang, votCaNhan: vot._id, tenVot: vot.ten, tenKhach: kh?.hoTen, mucCangLbs,
      giaTriNhap: Math.round(n.giaTri * 100) / 100, donViNhap: n.donVi, ...(n.tenDay?.trim() ? { tenDay: n.tenDay.trim().slice(0, 60) } : {}),
      trangThai: 'cho', taoLuc: new Date(),
    };
    // Lỗi 11000 có hai nghĩa: khung đã kín, HOẶC hai người cùng tạo document cho một khung chưa có ai đặt (một người thắng).
    // Thử lại đúng một lần: lúc này document đã tồn tại nên điều kiện $lt quyết định còn chỗ hay không.
    for (let lan = 1; ; lan++) {
      try {
        await this.lichModel.updateOne(
          { ngay, soDaDat: { $lt: SUC_CHUA_MAC_DINH } },
          { $push: { datCho: cho }, $inc: { soDaDat: 1 }, $setOnInsert: { sucChua: SUC_CHUA_MAC_DINH } },
          { upsert: true },
        );
        break;
      } catch (e: any) {
        if (e?.code !== 11000) throw e;
        if (lan >= 2) throw new ConflictException('Khung giờ này đã kín chỗ, vui lòng chọn khung khác.');
      }
    }
    return { ngay, datChoId: cho._id };
  }

  /** Huỷ chỗ của chính mình (chỉ khi còn chờ và khung chưa bắt đầu): toán tử vị trí `$` đổi đúng phần tử khớp $elemMatch. */
  async huyCho(khachHang: Types.ObjectId, lichId: string, datChoId: string, now = new Date()) {
    if (!Types.ObjectId.isValid(lichId) || !Types.ObjectId.isValid(datChoId)) throw new BadRequestException('Mã lịch không hợp lệ.');
    const r = await this.lichModel.updateOne(
      { _id: lichId, ngay: { $gt: now }, datCho: { $elemMatch: { _id: datChoId, khachHang, trangThai: 'cho' } } },
      { $set: { 'datCho.$.trangThai': 'huy' }, $inc: { soDaDat: -1 } },
    );
    if (!r.modifiedCount) throw new NotFoundException('Không tìm thấy lịch đang chờ để huỷ (hoặc khung đã bắt đầu).');
  }

  /** Lịch của tôi: $unwind mảng chỗ rồi lọc lại đúng chỗ của khách (một khung có thể có chỗ của nhiều người). */
  cuaToi(khachHang: Types.ObjectId) {
    return this.lichModel.aggregate([
      { $match: { 'datCho.khachHang': khachHang } },
      { $unwind: '$datCho' },
      { $match: { 'datCho.khachHang': khachHang } },
      { $sort: { ngay: -1 } },
      { $limit: 50 },
      { $project: { _id: 1, ngay: 1, datCho: 1 } },
    ]);
  }

  /** Nhân viên: lịch trong khoảng ngày. */
  theoKhoang(tu: Date, den: Date) {
    return this.lichModel.find({ ngay: { $gte: tu, $lt: den } }).sort({ ngay: 1 }).lean();
  }

  /**
   * Nhân viên bấm "Đã căng xong": đổi chỗ sang "xong" VÀ ghi lần căng vào sổ của hộ chiếu (lancangs + votcanhans).
   * - Replica set: cả ba thao tác trong MỘT transaction.
   * - Standalone: đổi trạng thái có điều kiện trước (chặn bấm hai lần), ghi sổ sau; ghi sổ lỗi thì trả chỗ về "chờ".
   * Chỉ xác nhận được khi khung giờ đã bắt đầu: lần căng được ghi theo ngày của khung, xác nhận sớm sẽ để lại trong sổ một lần căng
   * mang ngày chưa tới và đẩy lịch nhắc của khách lệch theo.
   */
  async hoanTat(lichId: string, datChoId: string, now = new Date()) {
    if (!Types.ObjectId.isValid(lichId) || !Types.ObjectId.isValid(datChoId)) throw new BadRequestException('Mã lịch không hợp lệ.');
    const loc = { _id: new Types.ObjectId(lichId), datCho: { $elemMatch: { _id: new Types.ObjectId(datChoId), trangThai: 'cho' } } };
    const { kq, coTransaction } = await this.tuVot.trongTransaction(async (session) => {
      const lich = await this.lichModel.findOne(loc, { ngay: 1, 'datCho.$': 1 }).session(session ?? null).lean();
      const cho: any = lich?.datCho?.[0];
      if (!lich || !cho) throw new NotFoundException('Không tìm thấy chỗ đang chờ (có thể đã hoàn tất hoặc bị huỷ).');
      if (lich.ngay.getTime() > now.getTime()) {
        throw new BadRequestException(`Chưa tới giờ hẹn (${gioHenVN(lich.ngay)}). Chỉ xác nhận đã căng khi khung giờ đã bắt đầu.`);
      }
      const doi = await this.lichModel.updateOne(loc, { $set: { 'datCho.$.trangThai': 'xong' } }, { session });
      if (!doi.modifiedCount) throw new ConflictException('Chỗ này vừa được cập nhật.');
      try {
        const lan = { ngay: ngayLichVN(lich.ngay), mucCangLbs: cho.mucCangLbs, giaTriNhap: cho.giaTriNhap, donViNhap: cho.donViNhap, noiCang: 'shop' as const, ...(cho.tenDay ? { tenDay: cho.tenDay } : {}) };
        const r = await this.tuVot.ghiLanCangTrongPhien(cho.khachHang, String(cho.votCaNhan), lan, session);
        await this.lichModel.updateOne({ _id: lich._id, 'datCho._id': cho._id }, { $set: { 'datCho.$.lanCang': r.lanCangId } }, { session });
        return { lanCangId: r.lanCangId };
      } catch (e) {
        if (!session) await this.lichModel.updateOne({ _id: lich._id, 'datCho._id': cho._id }, { $set: { 'datCho.$.trangThai': 'cho' } });
        throw e;
      }
    });
    return { ...kq, coTransaction };
  }
}
