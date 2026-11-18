import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
@Controller('san-pham')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  danhSach(@Query() q: Record<string, any>) {
    return this.catalog.danhSach(q);
  }

  @Get('trang-chu')
  trangChu() {
    return this.catalog.trangChu();
  }

  @Get('cua-hang')
  cuaHang() {
    return this.catalog.cuaHang();
  }

  @Get('khuyen-mai')
  khuyenMai() {
    return this.catalog.khuyenMaiDangChay();
  }

  /** Gợi ý khi gõ: /api/san-pham/goi-y?q=astr */
  @Get('goi-y')
  goiY(@Query('q') q?: string) {
    return this.catalog.goiY(String(q ?? '').slice(0, 100));
  }

  /** Trang chi tiết gọi một lần khi mở (trình duyệt tự bỏ lần lặp trong 30 phút). Ghi vào time series luotxems. */
  @Post(':id/luot-xem')
  @HttpCode(204)
  async luotXem(@Param('id') id: string) {
    await this.catalog.ghiLuotXem(id);
  }

  @Get(':id')
  chiTiet(@Param('id') id: string) {
    return this.catalog.chiTiet(id);
  }
}
