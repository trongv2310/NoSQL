import { Module } from '@nestjs/common';
import { AdminLichCangController, LichCangController } from './lich-cang.controller';
import { LichCangService } from './lich-cang.service';
import { TuVotController } from './tu-vot.controller';
import { TuVotService } from './tu-vot.service';

/** Hộ chiếu cây vợt + sổ căng cước (M4) + lịch căng tại shop (M5). Model đã được DatabaseModule (global) đăng ký. */
@Module({
  controllers: [TuVotController, LichCangController, AdminLichCangController],
  providers: [TuVotService, LichCangService],
  exports: [TuVotService],
})
export class TuVotModule {}
