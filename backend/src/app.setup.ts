import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/** Cấu hình dùng chung cho app thật (main.ts) và app trong test e2e. */
export function cauHinhApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  // Không lộ "X-Powered-By: Express"; helmet thêm các header bảo mật cơ bản (X-Content-Type-Options, X-Frame-Options, HSTS...).
  // Ảnh /uploads được trang Next.js (khác cổng) nhúng vào, nên cho phép tải chéo nguồn (Cross-Origin-Resource-Policy: cross-origin).
  (app.getHttpAdapter().getInstance() as { disable?: (k: string) => void }).disable?.('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true });
}
