import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';
import { Roles } from '../auth/auth.guards';
import { Quyen } from '../schemas';
import { KhaiThacService } from './khai-thac.service';

export class TopKDto {
  @IsInt({ message: 'K phải là số nguyên.' }) @Min(1, { message: 'K tối thiểu là 1.' }) @Max(50, { message: 'K tối đa là 50.' }) k: number;
  @IsInt({ message: 'Số tháng phải là số nguyên.' }) @Min(1, { message: 'Số tháng tối thiểu là 1.' }) @Max(12, { message: 'Số tháng tối đa là 12.' }) soThang = 3;
  @IsBoolean({ message: 'Lưu gợi ý phải là boolean.' }) luuGoiY = false;
}

@Roles(Quyen.Admin)
@Controller('admin/khai-thac')
export class KhaiThacAdminController {
  constructor(private readonly khaiThac: KhaiThacService) {}

  @Post('top-k')
  @HttpCode(200)
  async topK(@Body() dto: TopKDto) {
    const kq = await this.khaiThac.chay(dto.k, dto.soThang);
    if (dto.luuGoiY) await this.khaiThac.luuGoiY(kq);
    return { thanhCong: true, daLuuGoiY: dto.luuGoiY, ...kq };
  }

  @Get('goi-y-da-luu')
  async goiYDaLuu() {
    const goiY = await this.khaiThac.docGoiYDaLuu();
    return goiY ? { coDuLieu: true, ...goiY } : { coDuLieu: false, ketQua: [] };
  }
}
