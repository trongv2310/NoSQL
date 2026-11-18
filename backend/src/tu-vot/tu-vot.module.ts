import { Module } from '@nestjs/common';
import { TuVotController } from './tu-vot.controller';
import { TuVotService } from './tu-vot.service';

/** Hộ chiếu cây vợt + sổ căng cước (M4). Model đã được DatabaseModule (global) đăng ký. */
@Module({
  controllers: [TuVotController],
  providers: [TuVotService],
  exports: [TuVotService],
})
export class TuVotModule {}
