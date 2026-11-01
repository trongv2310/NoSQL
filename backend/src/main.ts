import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { cauHinhApp } from './app.setup';
import { UPLOAD_ROOT } from './common/upload';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  cauHinhApp(app);
  app.useStaticAssets(UPLOAD_ROOT, { prefix: '/uploads' });
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API đang chạy tại http://localhost:${port}/api`);
}
void bootstrap();
