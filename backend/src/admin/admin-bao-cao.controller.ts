import { Controller, Get, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Roles } from '../auth/auth.guards';
import { LanCang, PhanHoi, Quyen, VotCaNhan } from '../schemas';
import {
  locMau, pipelineChuKyThucTe, pipelineDayTheoLoiChoi, pipelineDenHan, pipelineMucCangTheoTrinhDo, pipelinePhanBoMucCang,
  pipelineVotTheoTrinhDo, pipelineVuotMucNSX,
} from './bao-cao-csdl';

/** Báo cáo thống kê từ sổ căng cước và đánh giá theo nhóm người chơi (M6). `?mau=1` để tính cả dữ liệu mẫu. */
@Roles(Quyen.Admin, Quyen.NhanVien)
@Controller('admin/bao-cao-csdl')
export class AdminBaoCaoController {
  constructor(
    @InjectModel(LanCang.name) private readonly lanCangModel: Model<LanCang>,
    @InjectModel(PhanHoi.name) private readonly phanHoiModel: Model<PhanHoi>,
    @InjectModel(VotCaNhan.name) private readonly votModel: Model<VotCaNhan>,
  ) {}

  @Get()
  async baoCao(@Query('mau') mau?: string) {
    const coMau = mau === '1' || mau === 'true';
    const loc = locMau(coMau);
    const batDau = Date.now();
    const [mucCangTheoTrinhDo, phanBoMucCang, dayTheoLoiChoi, chuKyThucTe, vuotMucNSX, votTheoTrinhDo, denHan, soLieuMau] = await Promise.all([
      this.lanCangModel.aggregate(pipelineMucCangTheoTrinhDo(loc)),
      this.lanCangModel.aggregate(pipelinePhanBoMucCang(loc)),
      this.lanCangModel.aggregate(pipelineDayTheoLoiChoi(loc)),
      this.lanCangModel.aggregate(pipelineChuKyThucTe(loc)),
      this.lanCangModel.aggregate(pipelineVuotMucNSX(loc)),
      this.phanHoiModel.aggregate(pipelineVotTheoTrinhDo(loc)),
      this.votModel.aggregate(pipelineDenHan(loc, new Date())),
      this.lanCangModel.countDocuments({ laDuLieuMau: true }),
    ]);
    return {
      coMau, coDuLieuMau: soLieuMau > 0, thoiGianMs: Date.now() - batDau,
      mucCangTheoTrinhDo, phanBoMucCang, dayTheoLoiChoi, chuKyThucTe, vuotMucNSX, votTheoTrinhDo, denHan,
    };
  }
}
