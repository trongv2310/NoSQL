import { Controller, Get, Param, Query } from '@nestjs/common';
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

  @Get(':id')
  chiTiet(@Param('id') id: string) {
    return this.catalog.chiTiet(id);
  }
}
