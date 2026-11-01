import { Module } from '@nestjs/common';
import { CongKhaiModule } from '../cong-khai/cong-khai.module';
import { DonHangModule } from '../don-hang/don-hang.module';
import { AdminBanTinController } from './admin-ban-tin.controller';
import {
  AdminKhuyenMaiController, AdminLogoController, AdminTaiKhoanController, AdminTranDauController,
} from './admin-danh-muc.controller';
import { AdminSanPhamController } from './admin-san-pham.controller';
import { AdminVanHanhController } from './admin-van-hanh.controller';

@Module({
  imports: [DonHangModule, CongKhaiModule],
  controllers: [
    AdminSanPhamController, AdminVanHanhController, AdminBanTinController,
    AdminKhuyenMaiController, AdminTranDauController, AdminTaiKhoanController, AdminLogoController,
  ],
})
export class AdminModule {}
