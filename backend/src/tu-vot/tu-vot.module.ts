import { Module } from '@nestjs/common';
import { AdminLichCangController, LichCangController } from './lich-cang.controller';
import { LichCangService } from './lich-cang.service';
import { TuVotController } from './tu-vot.controller';
import { TuVotService } from './tu-vot.service';

@Module({
  controllers: [TuVotController, LichCangController, AdminLichCangController],
  providers: [TuVotService, LichCangService],
  exports: [TuVotService],
})
export class TuVotModule {}
