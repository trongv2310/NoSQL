import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CauHinhService } from '../cau-hinh/cau-hinh.service';
import { ChatbotService } from './chatbot.service';
import { CongKhaiController } from './cong-khai.controller';
import { CongKhaiService } from './cong-khai.service';

@Module({
  imports: [CatalogModule],
  controllers: [CongKhaiController],
  providers: [CongKhaiService, ChatbotService, CauHinhService],
  exports: [ChatbotService, CauHinhService, CongKhaiService],
})
export class CongKhaiModule {}
