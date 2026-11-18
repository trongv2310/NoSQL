import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { docMoiTruong } from '../csdl/moi-truong';
import { ChiTietSanPham, KhachHang, LanCang, SanPham, VotCaNhan } from '../schemas';
import {
  kiemTraLanCang, LanCangDaKiem, NhapLanCang, pipelineDoiChuKy, pipelineGhiLanCang, thongSoChupTuThuocTinh, vuotMucNSX,
} from './so-cang';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TaoVotNhap {
  ten: string;
  sanPhamId?: string;
  bienTheId?: string;
  soSerial?: string;
  chuKyNhacNgay?: number | null;
  ghiChu?: string;
}

/** Bản ghi tủ vợt trong localStorage (frontend/lib/tu-vot.ts `VotTrongTu`), đã được frontend kiểm. */
export interface VotTrinhDuyet {
  id: string;
  ten: string;
  sanPhamId?: string | null;
  bienTheId?: string | null;
  ngayCang?: string | null;
  cang?: { giaTri: number; donVi: 'kg' | 'lbs' } | null;
  chuKyNgay?: number | null;
  ghiChu?: string;
}

const homNayUtc = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

@Injectable()
export class TuVotService {
  private readonly logger = new Logger(TuVotService.name);
  private coTransaction: Promise<boolean> | null = null;

  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(VotCaNhan.name) private readonly votModel: Model<VotCaNhan>,
    @InjectModel(LanCang.name) private readonly lanCangModel: Model<LanCang>,
    @InjectModel(KhachHang.name) private readonly khachHangModel: Model<KhachHang>,
    @InjectModel(ChiTietSanPham.name) private readonly chiTietModel: Model<ChiTietSanPham>,
    @InjectModel(SanPham.name) private readonly sanPhamModel: Model<SanPham>,
  ) {}

  /** MongoDB có hỗ trợ transaction không (replica set / mongos). Hỏi một lần rồi nhớ. */
  dungTransaction(): Promise<boolean> {
    this.coTransaction ??= docMoiTruong(this.conn.db!).then((m) => m.coTransaction).catch(() => false);
    return this.coTransaction;
  }

  /** Chạy `viec` trong một transaction nếu có; không có thì chạy thẳng (session = undefined). */
  async trongTransaction<T>(viec: (s?: ClientSession) => Promise<T>): Promise<{ kq: T; coTransaction: boolean }> {
    if (!(await this.dungTransaction())) return { kq: await viec(undefined), coTransaction: false };
    const s = await this.conn.startSession();
    try {
      let kq!: T;
      await s.withTransaction(async () => {
        kq = await viec(s);
      });
      return { kq, coTransaction: true };
    } finally {
      await s.endSession();
    }
  }

  async khachHangCua(taiKhoanId: string) {
    const kh = await this.khachHangModel.findOne({ taiKhoan: taiKhoanId }, { _id: 1, hoSoChoi: 1 }).lean();
    if (!kh) throw new BadRequestException('Tài khoản quản trị không có tủ vợt.');
    return kh;
  }

  private async layVot(khachHang: Types.ObjectId, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Mã vợt không hợp lệ.');
    const vot = await this.votModel.findOne({ _id: id, khachHang, deletedAt: null }).lean();
    if (!vot) throw new NotFoundException('Không tìm thấy vợt trong tủ của bạn.');
    return vot;
  }

  danhSach(khachHang: Types.ObjectId) {
    return this.votModel.find({ khachHang, deletedAt: null }).sort({ taoLuc: -1 }).lean();
  }

  /** Thông tin sản phẩm/phiên bản đi kèm (nếu chọn từ cửa hàng): kiểm phiên bản thuộc sản phẩm và chụp khoảng căng. */
  private async thongTinSanPham(sanPhamId?: string, bienTheId?: string) {
    if (!sanPhamId && !bienTheId) return {};
    let sanPham = sanPhamId ? new Types.ObjectId(sanPhamId) : undefined;
    let thongSoChup: ReturnType<typeof thongSoChupTuThuocTinh>;
    if (bienTheId) {
      const bt = await this.chiTietModel.findById(bienTheId, { sanPham: 1, thuocTinh: 1 }).lean();
      if (!bt || (sanPham && !bt.sanPham.equals(sanPham))) throw new BadRequestException('Phiên bản không thuộc sản phẩm đã chọn.');
      sanPham = bt.sanPham;
      thongSoChup = thongSoChupTuThuocTinh(bt.thuocTinh);
    }
    if (sanPham && !(await this.sanPhamModel.exists({ _id: sanPham }))) throw new BadRequestException('Không tìm thấy sản phẩm.');
    return { ...(sanPham ? { sanPham } : {}), ...(bienTheId ? { bienThe: new Types.ObjectId(bienTheId) } : {}), ...(thongSoChup ? { thongSoChup } : {}) };
  }

  async tao(khachHang: Types.ObjectId, n: TaoVotNhap) {
    const sp = await this.thongTinSanPham(n.sanPhamId, n.bienTheId);
    try {
      const doc = await this.votModel.create({
        khachHang, nguon: 'tu-nhap', ten: n.ten.trim(), ...sp,
        ...(n.soSerial?.trim() ? { soSerial: n.soSerial.trim() } : {}),
        ...(n.chuKyNhacNgay ? { chuKyNhacNgay: n.chuKyNhacNgay } : {}),
        ghiChu: n.ghiChu?.trim() ?? '',
      });
      return doc.toObject();
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Số serial này đã được đăng ký cho một cây vợt khác.');
      throw e;
    }
  }

  async sua(khachHang: Types.ObjectId, id: string, n: { ten?: string; ghiChu?: string; soSerial?: string | null; chuKyNhacNgay?: number | null }) {
    await this.layVot(khachHang, id);
    const loc = { _id: new Types.ObjectId(id), khachHang, deletedAt: null };
    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    if (n.ten !== undefined) set.ten = n.ten.trim();
    if (n.ghiChu !== undefined) set.ghiChu = n.ghiChu.trim();
    if (n.soSerial !== undefined) {
      if (n.soSerial && n.soSerial.trim()) set.soSerial = n.soSerial.trim();
      else unset.soSerial = '';
    }
    try {
      if (Object.keys(set).length || Object.keys(unset).length) {
        await this.votModel.updateOne(loc, { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { runValidators: true });
      }
      // Đổi chu kỳ: update pipeline tính lại hanNhacLuc ngay trong cùng lệnh ($dateAdd).
      if (n.chuKyNhacNgay !== undefined) await this.votModel.updateOne(loc, pipelineDoiChuKy(n.chuKyNhacNgay), { updatePipeline: true });
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Số serial này đã được đăng ký cho một cây vợt khác.');
      throw e;
    }
    return this.layVot(khachHang, id);
  }

  /** Xoá mềm; bỏ luôn hanNhacLuc để vợt đã xoá không còn nằm trong index nhắc. Lịch sử căng (lancangs) vẫn giữ. */
  async xoa(khachHang: Types.ObjectId, id: string) {
    const kq = await this.votModel.updateOne({ _id: id, khachHang, deletedAt: null }, { $set: { deletedAt: new Date() }, $unset: { hanNhacLuc: '' } });
    if (!kq.matchedCount) throw new NotFoundException('Không tìm thấy vợt trong tủ của bạn.');
  }

  /**
   * Ghi một lần căng: thêm vào `lancangs` (lịch sử đầy đủ) VÀ cập nhật hộ chiếu (10 lần gần nhất, lần gần nhất, hạn nhắc).
   * - Có replica set: hai thao tác trong MỘT transaction (cùng thành công hoặc cùng huỷ).
   * - Standalone: ghi lancangs trước, cập nhật hộ chiếu sau; nếu bước sau lỗi thì xoá bản ghi vừa thêm (bù trừ), không để lịch sử
   *   lệch với hộ chiếu.
   * Căng tại shop vượt mức tối đa nhà sản xuất bị TỪ CHỐI; căng ở ngoài vẫn ghi (là sự việc đã xảy ra) nhưng gắn cờ vuotMucNSX.
   */
  async ghiLanCang(khachHang: Types.ObjectId, id: string, nhap: NhapLanCang) {
    const kt = kiemTraLanCang(nhap, homNayUtc());
    if (!kt.ok) throw new BadRequestException(Object.values(kt.loi));
    const { kq, coTransaction } = await this.trongTransaction((session) => this.ghiLanCangTrongPhien(khachHang, id, kt.lan, session));
    return { vot: await this.layVot(khachHang, id), vuotMucNSX: kq.vuotMucNSX, toiDaLbs: kq.toiDaLbs, coTransaction };
  }

  /**
   * Lõi ghi lần căng (đã kiểm dữ liệu). Có `session` → chạy trong transaction của người gọi (vd. hoàn tất lịch căng tại shop),
   * không tự bù trừ vì transaction sẽ huỷ cả gói. Không có `session` → bù trừ: xoá lần căng vừa thêm nếu bước cập nhật hộ chiếu lỗi.
   */
  async ghiLanCangTrongPhien(khachHang: Types.ObjectId, id: string, lan: LanCangDaKiem, session?: ClientSession) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Mã vợt không hợp lệ.');
    const vot = await this.votModel.findOne({ _id: id, khachHang, deletedAt: null }).session(session ?? null).lean();
    if (!vot) throw new NotFoundException('Không tìm thấy vợt trong tủ của bạn.');
    const toiDa = vot.thongSoChup?.sucCangMaxLbs;
    const vuot = vuotMucNSX(lan.mucCangLbs, toiDa);
    if (vuot && lan.noiCang === 'shop') {
      throw new BadRequestException(`Mức ${lan.mucCangLbs} lbs vượt mức tối đa nhà sản xuất ghi cho phiên bản này (${toiDa} lbs). Shop không căng vượt mức này.`);
    }
    const kh = await this.khachHangModel.findById(khachHang, { hoSoChoi: 1 }).session(session ?? null).lean();
    const nguoiDanhChup = kh?.hoSoChoi?.trinhDo || kh?.hoSoChoi?.loiChoi
      ? { ...(kh.hoSoChoi.trinhDo ? { trinhDo: kh.hoSoChoi.trinhDo } : {}), ...(kh.hoSoChoi.loiChoi ? { loiChoi: kh.hoSoChoi.loiChoi } : {}) }
      : undefined;
    const _id = new Types.ObjectId();
    await this.lanCangModel.create([{ _id, votCaNhan: vot._id, khachHang, ...lan, vuotMucNSX: vuot, ...(nguoiDanhChup ? { nguoiDanhChup } : {}) }], { session });
    try {
      const r = await this.votModel.updateOne({ _id: vot._id, khachHang, deletedAt: null }, pipelineGhiLanCang({ _id, ...lan, vuotMucNSX: vuot }), { session, updatePipeline: true });
      if (!r.matchedCount) throw new NotFoundException('Vợt vừa bị xoá khỏi tủ.');
    } catch (e) {
      if (!session) await this.lanCangModel.deleteOne({ _id }).catch((x) => this.logger.error(`Không bù trừ được lần căng ${_id}: ${x.message}`));
      throw e;
    }
    return { lanCangId: _id, vuotMucNSX: vuot, toiDaLbs: toiDa ?? null };
  }

  async lichSuCang(khachHang: Types.ObjectId, id: string) {
    const vot = await this.layVot(khachHang, id);
    return this.lanCangModel.find({ votCaNhan: vot._id, khachHang }).sort({ ngay: -1, _id: -1 }).limit(200).lean();
  }

  async themSuKien(khachHang: Types.ObjectId, id: string, sk: { loai: string; ngay: string; ghiChu?: string }) {
    const ngay = /^\d{4}-\d{2}-\d{2}$/.test(sk.ngay) ? new Date(`${sk.ngay}T00:00:00Z`) : null;
    if (!ngay || Number.isNaN(+ngay)) throw new BadRequestException('Ngày không hợp lệ.');
    const kq = await this.votModel.updateOne(
      { _id: id, khachHang, deletedAt: null },
      { $push: { suKien: { $each: [{ loai: sk.loai, ngay, ...(sk.ghiChu?.trim() ? { ghiChu: sk.ghiChu.trim() } : {}) }], $sort: { ngay: -1 }, $slice: 50 } } },
      { runValidators: true },
    );
    if (!kq.matchedCount) throw new NotFoundException('Không tìm thấy vợt trong tủ của bạn.');
    return this.layVot(khachHang, id);
  }

  /**
   * Chuyển tủ vợt localStorage vào tài khoản. Idempotent: mỗi vợt upsert theo maNguon "cb:<id>" ($setOnInsert), nên gửi lại
   * (mạng chập chờn, hai tab) không nhân đôi. Lần căng ghi trong localStorage chỉ được thêm khi vợt vừa được TẠO MỚI.
   */
  async chuyenTuTrinhDuyet(khachHang: Types.ObjectId, ds: VotTrinhDuyet[]) {
    let them = 0;
    let daCo = 0;
    const loi: string[] = [];
    for (const v of ds) {
      try {
        const sp = await this.thongTinSanPham(v.sanPhamId ?? undefined, v.bienTheId ?? undefined).catch(() => ({}));
        const r = await this.votModel.updateOne(
          { khachHang, maNguon: `cb:${v.id}` },
          {
            $setOnInsert: {
              khachHang, maNguon: `cb:${v.id}`, nguon: 'chuyen-tu-trinh-duyet', ten: v.ten.trim().slice(0, 80), ...sp,
              ...(v.chuKyNgay ? { chuKyNhacNgay: v.chuKyNgay } : {}), ghiChu: (v.ghiChu ?? '').trim().slice(0, 200),
              soLanCang: 0, lichSuCang: [], taoLuc: new Date(), deletedAt: null,
            },
          },
          { upsert: true, runValidators: true },
        );
        if (!r.upsertedId) { daCo++; continue; }
        them++;
        if (v.ngayCang && v.cang) {
          await this.ghiLanCang(khachHang, String(r.upsertedId), { ngay: v.ngayCang, giaTri: v.cang.giaTri, donVi: v.cang.donVi, noiCang: 'ngoai' });
        }
      } catch (e) {
        loi.push(`${v.ten}: ${(e as Error).message}`);
      }
    }
    return { them, daCo, loi };
  }

  /**
   * Đơn chuyển sang "Đã hoàn thành": mỗi cây vợt trong đơn (theo số lượng) có một hộ chiếu, chụp khoảng căng của phiên bản.
   * Upsert theo maNguon "dh:<id dòng đơn>:<thứ tự>" nên chạy lại (bấm hai lần, retry) không tạo trùng. Nhận session để chạy
   * chung transaction với việc đổi trạng thái đơn khi có replica set.
   */
  async taoHoChieuTuDon(don: any, session?: ClientSession): Promise<number> {
    if (!don?.khachHang) return 0;
    const dong = (don.chiTiet ?? []).filter((c: any) => c.sanPham && Number(c.soLuong) > 0);
    if (!dong.length) return 0;
    const sps = await this.sanPhamModel.find({ _id: { $in: dong.map((c: any) => c.sanPham) } }, { loai: 1 }).populate({ path: 'loai', select: 'tenLoai' }).session(session ?? null).lean();
    const laVot = new Set(sps.filter((s: any) => /^vợt/i.test(s.loai?.tenLoai ?? '')).map((s) => String(s._id)));
    const bts = await this.chiTietModel.find({ _id: { $in: dong.map((c: any) => c.chiTietSanPham).filter(Boolean) } }, { thuocTinh: 1 }).session(session ?? null).lean();
    const ttTheoBt = new Map(bts.map((b) => [String(b._id), thongSoChupTuThuocTinh(b.thuocTinh)]));
    let tao = 0;
    for (const c of dong) {
      if (!laVot.has(String(c.sanPham))) continue;
      const thongSoChup = c.chiTietSanPham ? ttTheoBt.get(String(c.chiTietSanPham)) : undefined;
      const ten = [c.tenSanPham, c.tenSize].filter(Boolean).join(' ').slice(0, 80) || 'Vợt mua tại shop';
      for (let i = 1; i <= Number(c.soLuong); i++) {
        const maNguon = `dh:${c._id}:${i}`;
        const r = await this.votModel.updateOne(
          { khachHang: don.khachHang, maNguon },
          {
            $setOnInsert: {
              khachHang: don.khachHang, maNguon, nguon: 'mua-tai-shop', ten, sanPham: c.sanPham, donHang: don._id, ngayMua: don.ngayDat,
              ...(c.chiTietSanPham ? { bienThe: c.chiTietSanPham } : {}), ...(thongSoChup ? { thongSoChup } : {}),
              soLanCang: 0, lichSuCang: [], ghiChu: '', taoLuc: new Date(), deletedAt: null,
            },
          },
          { upsert: true, session },
        );
        if (r.upsertedId) tao++;
      }
    }
    return tao;
  }
}
