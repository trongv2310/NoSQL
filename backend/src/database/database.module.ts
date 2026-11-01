import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ALL_MODELS } from '../schemas';

/** Đăng ký toàn bộ model một lần, các module khác chỉ việc @InjectModel. */
@Global()
@Module({
  imports: [MongooseModule.forFeature(ALL_MODELS)],
  exports: [MongooseModule],
})
export class DatabaseModule {}
