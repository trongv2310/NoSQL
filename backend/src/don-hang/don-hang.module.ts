import { Module } from '@nestjs/common';
import { GioHangController } from '../gio-hang/gio-hang.controller';
import { GioHangService } from '../gio-hang/gio-hang.service';
import { PhanHoiController } from '../phan-hoi/phan-hoi.controller';
import { DonHangController } from './don-hang.controller';
import { MomoService } from './momo.service';
import { OrderService } from './order.service';

@Module({
  controllers: [DonHangController, GioHangController, PhanHoiController],
  providers: [OrderService, MomoService, GioHangService],
  exports: [OrderService, GioHangService],
})
export class DonHangModule {}
