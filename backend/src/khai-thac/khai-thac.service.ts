import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { idOf } from '../common/mappers';
import { ChiTietSanPham, DonHang, GoiYSanPham, SanPham, TRANG_THAI } from '../schemas';
import { GiaoDichDto, VertTopKDS } from './vert-topk-ds';

export interface SanPhamTrongTap { id: string; tenSanPham: string; hinhAnhDaiDien?: string }
export interface DongKetQua { hang: number; sanPhams: SanPhamTrongTap[]; tenTap: string; loiNhuan: number; khoa: string }
export interface KetQuaKhaiThac {
  k: number; soThang: number; soDonXet: number; soBatch: number; biCat: boolean;
  thoiGianMs: number; chayLuc: string; ketQua: DongKetQua[];
}
export interface GoiYDaLuu { k: number; soThang: number; capNhatLuc: string; ketQua: DongKetQua[] }
export const TOI_DA_DON_KHAI_THAC = 20_000;

@Injectable()
export class KhaiThacService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KhaiThacService.name);
  private timer?: ReturnType<typeof setInterval>;
  private dangTuDong = false;
  private lanLuu: Promise<void> = Promise.resolve();

  constructor(
    @InjectModel(DonHang.name) private readonly donModel: Model<DonHang>,
    @InjectModel(ChiTietSanPham.name) private readonly ctModel: Model<ChiTietSanPham>,
    @InjectModel(SanPham.name) private readonly spModel: Model<SanPham>,
    @InjectModel(GoiYSanPham.name) private readonly goiYModel: Model<GoiYSanPham>,
  ) {}

  async chay(k: number, soThang: number, now = new Date()): Promise<KetQuaKhaiThac> {
    if (!Number.isInteger(k) || k < 1 || k > 50) throw new BadRequestException('K phải là số nguyên từ 1 đến 50.');
    if (!Number.isInteger(soThang) || soThang < 1 || soThang > 12) throw new BadRequestException('Số tháng phải là số nguyên từ 1 đến 12.');
    const batDau = performance.now();
    const cacThang = Array.from({ length: soThang }, (_, i) => new Date(now.getFullYear(), now.getMonth() - soThang + 1 + i, 1));
    const ds = await this.donModel.find({ trangThai: TRANG_THAI.HoanThanh, ngayDat: { $gte: cacThang[0], $lte: now } }, { ngayDat: 1, chiTiet: 1 })
      .sort({ ngayDat: -1, _id: -1 }).limit(TOI_DA_DON_KHAI_THAC + 1).lean();
    const donHangs = ds.slice(0, TOI_DA_DON_KHAI_THAC).reverse();
    const maBienThe = [...new Set(donHangs.flatMap((don) => don.chiTiet.filter((d) => !d.sanPham && d.chiTietSanPham).map((d) => idOf(d.chiTietSanPham)!)))];
    const bienThes = maBienThe.length ? await this.ctModel.find({ _id: { $in: maBienThe.map((id) => new Types.ObjectId(id)) } }, { sanPham: 1 }).lean() : [];
    const spCuaBienThe = new Map(bienThes.map((bt) => [idOf(bt)!, idOf(bt.sanPham)]));
    const cacDon = donHangs.map((don, index) => {
      const items = new Map<string, number>();
      const utils = new Map<string, number>();
      for (const dong of don.chiTiet) {
        const id = idOf(dong.sanPham) ?? spCuaBienThe.get(idOf(dong.chiTietSanPham) ?? '');
        if (!id) continue;
        items.set(id, (items.get(id) ?? 0) + dong.soLuong);
        utils.set(id, (utils.get(id) ?? 0) + (dong.thanhTien ?? dong.soLuong * dong.donGia));
      }
      return { tid: index + 1, ngayDat: don.ngayDat, items, utils };
    }).filter((don) => don.items.size >= 2);
    const ids = [...new Set(cacDon.flatMap((don) => [...don.items.keys()]))].sort();
    const maSo = new Map(ids.map((id, i) => [id, i + 1]));
    const miner = new VertTopKDS(k, soThang);
    for (const thang of cacThang) {
      const batch: GiaoDichDto[] = cacDon.filter((don) => don.ngayDat.getFullYear() === thang.getFullYear() && don.ngayDat.getMonth() === thang.getMonth())
        .map((don) => ({ tid: don.tid, items: new Map([...don.items].map(([id, sl]) => [maSo.get(id)!, sl])),
          utils: new Map([...don.utils].map(([id, utility]) => [maSo.get(id)!, utility])), tu: [...don.utils.values()].reduce((sum, u) => sum + u, 0) }));
      miner.xuLyBatch(`${thang.getFullYear()}-${String(thang.getMonth() + 1).padStart(2, '0')}`, batch);
    }
    const ketQua = await this.dichKetQua(miner.layKetQua().map((r) => ({
      sanPham: r.itemset.map((ma) => new Types.ObjectId(ids[ma - 1])), loiNhuan: r.utility,
    })));
    return { k, soThang, soDonXet: donHangs.length, soBatch: cacThang.length, biCat: ds.length > TOI_DA_DON_KHAI_THAC,
      thoiGianMs: Math.round(performance.now() - batDau), chayLuc: now.toISOString(), ketQua };
  }

  private async dichKetQua(rows: { sanPham: Types.ObjectId[]; loiNhuan: number }[]): Promise<DongKetQua[]> {
    if (!rows.length) return [];
    const ids = [...new Set(rows.flatMap((row) => row.sanPham.map((id) => id.toHexString())))];
    const sanPhams = await this.spModel.find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } }, { tenSanPham: 1, hinhAnhDaiDien: 1 }).lean();
    const byId = new Map(sanPhams.map((sp) => [idOf(sp)!, sp]));
    const ketQua: DongKetQua[] = [];
    const daCo = new Set<string>();
    for (const row of rows) {
      const sanPhamsTrongTap = row.sanPham.map((id) => byId.get(id.toHexString())).filter((sp) => sp !== undefined)
        .map((sp) => ({ id: idOf(sp)!, tenSanPham: sp.tenSanPham, hinhAnhDaiDien: sp.hinhAnhDaiDien })).sort((a, b) => a.id.localeCompare(b.id));
      const khoa = sanPhamsTrongTap.map((sp) => sp.id).join(',');
      if (sanPhamsTrongTap.length < 2 || daCo.has(khoa)) continue;
      daCo.add(khoa);
      ketQua.push({ hang: ketQua.length + 1, sanPhams: sanPhamsTrongTap, tenTap: sanPhamsTrongTap.map((sp) => sp.tenSanPham).join(' + '), loiNhuan: row.loiNhuan, khoa });
    }
    return ketQua;
  }

  luuGoiY(kq: KetQuaKhaiThac): Promise<void> {
    // Tuần tự trong một process để timer và admin không xóa kết quả vừa ghi của nhau.
    const viec = this.lanLuu.catch(() => undefined).then(async () => {
      if (kq.ketQua.length) {
        await this.goiYModel.bulkWrite(kq.ketQua.map((row) => ({ updateOne: {
          filter: { khoa: row.khoa }, upsert: true,
          update: { $set: { khoa: row.khoa, sanPham: row.sanPhams.map((sp) => new Types.ObjectId(sp.id)), loiNhuan: row.loiNhuan,
            hang: row.hang, k: kq.k, soThang: kq.soThang, taoLuc: new Date(kq.chayLuc) } },
        } })), { ordered: true });
      }
      await this.goiYModel.deleteMany({ khoa: { $nin: kq.ketQua.map((row) => row.khoa) } });
    });
    this.lanLuu = viec;
    return viec;
  }

  async docGoiYDaLuu(): Promise<GoiYDaLuu | null> {
    const rows = await this.goiYModel.find().sort({ hang: 1, khoa: 1 }).lean();
    if (!rows.length) return null;
    return { k: rows[0].k, soThang: rows[0].soThang, capNhatLuc: rows[0].taoLuc.toISOString(), ketQua: await this.dichKetQua(rows) };
  }

  onModuleInit() {
    const phut = Number(process.env.KHAI_THAC_TU_DONG_PHUT ?? 0);
    const ms = phut * 60_000;
    if (!Number.isFinite(phut) || phut < 5 || ms > 2_147_483_647) return;
    this.timer = setInterval(() => { void this.tuDong(); }, ms);
    this.timer.unref();
  }

  private async tuDong() {
    if (this.dangTuDong) return;
    this.dangTuDong = true;
    try { await this.luuGoiY(await this.chay(10, 3)); }
    catch { this.logger.error('Không thể cập nhật gợi ý Top-K tự động.'); }
    finally { this.dangTuDong = false; }
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
