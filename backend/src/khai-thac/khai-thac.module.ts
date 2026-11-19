import { Module } from '@nestjs/common';
import { KhaiThacAdminController } from './khai-thac-admin.controller';
import { KhaiThacCongKhaiController } from './khai-thac-cong-khai.controller';
import { KhaiThacService } from './khai-thac.service';

@Module({ controllers: [KhaiThacAdminController, KhaiThacCongKhaiController], providers: [KhaiThacService] })
export class KhaiThacModule {}
