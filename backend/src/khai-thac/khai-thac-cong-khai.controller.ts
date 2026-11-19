import { Controller, Get, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { parseObjectId } from '../common/helpers';
import { idOf } from '../common/mappers';
import { giaSauKhuyenMai } from '../common/pricing';
import { ChiTietSanPham, GoiYSanPham, SanPham } from '../schemas';

export interface SanPhamGoiY { id: string; tenSanPham: string; hinhAnhDaiDien?: string; gia: number; chiTietMacDinh: string }

@Controller('goi-y')
export class KhaiThacCongKhaiController {
  constructor(
    @InjectModel(GoiYSanPham.name) private readonly goiYModel: Model<GoiYSanPham>,
    @InjectModel(SanPham.name) private readonly spModel: Model<SanPham>,
    @InjectModel(ChiTietSanPham.name) private readonly ctModel: Model<ChiTietSanPham>,
  ) {}

  private async sanPhamHienDuoc(ids: string[]): Promise<Map<string, SanPhamGoiY>> {
    if (!ids.length) return new Map();
    const [sanPhams, bienThes] = await Promise.all([
      this.spModel.find({ _id: { $in: ids }, deletedAt: null }).populate('khuyenMai').lean(),
      this.ctModel.find({ sanPham: { $in: ids }, soLuongTon: { $gt: 0 } }, { sanPham: 1 }).sort({ _id: 1 }).lean(),
    ]);
    const macDinh = new Map<string, string>();
    for (const bt of bienThes) if (!macDinh.has(idOf(bt.sanPham)!)) macDinh.set(idOf(bt.sanPham)!, idOf(bt)!);
    const result = new Map<string, SanPhamGoiY>();
    for (const sp of sanPhams) {
      const id = idOf(sp)!;
      const chiTietMacDinh = macDinh.get(id);
      if (!chiTietMacDinh) continue;
      const km = sp.khuyenMai as unknown as Parameters<typeof giaSauKhuyenMai>[1];
      result.set(id, { id, tenSanPham: sp.tenSanPham, hinhAnhDaiDien: sp.hinhAnhDaiDien,
        gia: giaSauKhuyenMai(sp.giaGoc, km), chiTietMacDinh });
    }
    return result;
  }

  @Get('combo')
  async combo() {
    const rows = await this.goiYModel.find().sort({ hang: 1, khoa: 1 }).limit(50).lean();
    const sanPhams = await this.sanPhamHienDuoc([...new Set(rows.flatMap((r) => r.sanPham.map((id) => id.toHexString())))]);
    const combos: { khoa: string; tongGia: number; sanPhams: SanPhamGoiY[] }[] = [];
    const daCo = new Set<string>();
    for (const row of rows) {
      const ds = row.sanPham.map((id) => sanPhams.get(id.toHexString())).filter((sp) => sp !== undefined);
      if (ds.length < 2) continue;
      const khoa = ds.map((sp) => sp.id).sort().join(',');
      if (daCo.has(khoa)) continue;
      daCo.add(khoa);
      combos.push({ khoa, tongGia: ds.reduce((sum, sp) => sum + sp.gia, 0), sanPhams: ds });
      if (combos.length === 3) break;
    }
    return { combos };
  }

  @Get('san-pham/:id')
  async sanPham(@Param('id') id: string) {
    const oid = parseObjectId(id, 'Mã sản phẩm');
    const sp = await this.spModel.findOne({ _id: oid, deletedAt: null }, { loai: 1 }).lean();
    if (!sp) return { sanPhams: [] };
    const rows = await this.goiYModel.find({ sanPham: oid }).sort({ hang: 1, khoa: 1 }).limit(50).lean();
    const ids = [...new Set(rows.flatMap((r) => r.sanPham.map((ma) => ma.toHexString())))].filter((ma) => ma !== oid.toHexString());
    const hienDuoc = await this.sanPhamHienDuoc(ids);
    if (hienDuoc.size) return { sanPhams: ids.flatMap((ma) => hienDuoc.has(ma) ? [hienDuoc.get(ma)!] : []).slice(0, 4) };
    if (!sp.loai) return { sanPhams: [] };
    const cungLoai = await this.spModel.find({ loai: sp.loai, _id: { $ne: oid }, deletedAt: null }, { _id: 1 }).sort({ _id: 1 }).lean();
    const goiY = await this.sanPhamHienDuoc(cungLoai.map((s) => idOf(s)!));
    return { sanPhams: cungLoai.flatMap((s) => goiY.has(idOf(s)!) ? [goiY.get(idOf(s)!)!] : []).slice(0, 4) };
  }
}
