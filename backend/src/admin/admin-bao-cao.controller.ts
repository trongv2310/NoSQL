import { Controller, Get, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Roles } from '../auth/auth.guards';
import { LanCang, LuotXem, PhanHoi, Quyen, VotCaNhan } from '../schemas';
import {
  locMau, pipelineChuKyThucTe, pipelineDayTheoLoiChoi, pipelineDenHan, pipelineMucCangTheoTrinhDo, pipelinePhanBoMucCang,
  pipelineLuotXemTheoNgay, pipelineVotTheoTrinhDo, pipelineVuotMucNSX, pipelineXemNhieu,
} from './bao-cao-csdl';

/** Báo cáo thống kê từ sổ căng cước và đánh giá theo nhóm người chơi (M6). `?mau=1` để tính cả dữ liệu mẫu. */
@Roles(Quyen.Admin)
@Controller('admin/bao-cao-csdl')
export class AdminBaoCaoController {
  constructor(
    @InjectModel(LanCang.name) private readonly lanCangModel: Model<LanCang>,
    @InjectModel(PhanHoi.name) private readonly phanHoiModel: Model<PhanHoi>,
    @InjectModel(VotCaNhan.name) private readonly votModel: Model<VotCaNhan>,
    @InjectModel(LuotXem.name) private readonly luotXemModel: Model<LuotXem>,
  ) {}

  /** Số lượt xem và số bucket thật sự lưu trên đĩa ($collStats của time series): thấy được MongoDB gom bao nhiêu phép đo vào một bucket. */
  private async luuTruLuotXem() {
    try {
      const [s] = await this.luotXemModel.aggregate([{ $collStats: { storageStats: {} } }]);
      const t = s?.storageStats?.timeseries ?? {};
      return { soLuotXem: await this.luotXemModel.estimatedDocumentCount(), soBucket: t.bucketCount ?? null, kichThuocByte: s?.storageStats?.size ?? null };
    } catch {
      return null; // collection chưa được tạo (chưa chạy db:setup) hoặc không phải time series
    }
  }

  @Get()
  async baoCao(@Query('mau') mau?: string) {
    const coMau = mau === '1' || mau === 'true';
    const loc = locMau(coMau);
    const batDau = Date.now();
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [mucCangTheoTrinhDo, phanBoMucCang, dayTheoLoiChoi, chuKyThucTe, vuotMucNSX, votTheoTrinhDo, denHan, soLieuMau, luotXemTheoNgay, xemNhieu, luuTruLuotXem] = await Promise.all([
      this.lanCangModel.aggregate(pipelineMucCangTheoTrinhDo(loc)),
      this.lanCangModel.aggregate(pipelinePhanBoMucCang(loc)),
      this.lanCangModel.aggregate(pipelineDayTheoLoiChoi(loc)),
      this.lanCangModel.aggregate(pipelineChuKyThucTe(loc)),
      this.lanCangModel.aggregate(pipelineVuotMucNSX(loc)),
      this.phanHoiModel.aggregate(pipelineVotTheoTrinhDo(loc)),
      this.votModel.aggregate(pipelineDenHan(loc, new Date())),
      Promise.all([this.lanCangModel.exists({ laDuLieuMau: true }), this.luotXemModel.exists({ laDuLieuMau: true })]).then((x) => x.filter(Boolean).length),
      this.luotXemModel.aggregate(pipelineLuotXemTheoNgay(loc, now, tz)),
      this.luotXemModel.aggregate(pipelineXemNhieu(loc, now, tz)),
      this.luuTruLuotXem(),
    ]);
    return {
      coMau, coDuLieuMau: soLieuMau > 0, thoiGianMs: Date.now() - batDau,
      mucCangTheoTrinhDo, phanBoMucCang, dayTheoLoiChoi, chuKyThucTe, vuotMucNSX, votTheoTrinhDo, denHan,
      luotXemTheoNgay, xemNhieu, luuTruLuotXem,
    };
  }
}
