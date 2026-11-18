import { Global, Injectable, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { CANH_BAO_STANDALONE, docMoiTruong } from '../csdl/moi-truong';
import { ALL_MODELS } from '../schemas';

/** Lúc khởi động, in MongoDB đang chạy kiểu gì để biết sớm là chưa có transaction (không chặn khởi động). */
@Injectable()
export class KiemTraMoiTruongMongo implements OnApplicationBootstrap {
  private readonly logger = new Logger('MongoDB');
  constructor(@InjectConnection() private readonly conn: Connection) {}

  async onApplicationBootstrap() {
    try {
      const mt = await docMoiTruong(this.conn.db!);
      if (mt.coTransaction) this.logger.log(`MongoDB ${mt.phienBan}, replica set "${mt.replicaSet}": có transaction.`);
      else this.logger.warn(`MongoDB ${mt.phienBan}. ${CANH_BAO_STANDALONE}`);
    } catch (e) {
      this.logger.warn(`Không đọc được thông tin máy chủ MongoDB: ${(e as Error).message}`);
    }
  }
}

/** Đăng ký toàn bộ model một lần, các module khác chỉ việc @InjectModel. */
@Global()
@Module({
  imports: [MongooseModule.forFeature(ALL_MODELS)],
  providers: [KiemTraMoiTruongMongo],
  exports: [MongooseModule],
})
export class DatabaseModule {}
