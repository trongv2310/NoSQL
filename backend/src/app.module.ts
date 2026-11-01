import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CongKhaiModule } from './cong-khai/cong-khai.module';
import { DatabaseModule } from './database/database.module';
import { DonHangModule } from './don-hang/don-hang.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.get<string>('MONGODB_URI', 'mongodb://127.0.0.1:27017/shop_caulong'),
      }),
    }),
    DatabaseModule,
    AuthModule,
    CatalogModule,
    CongKhaiModule,
    DonHangModule,
    AdminModule,
  ],
})
export class AppModule {}
