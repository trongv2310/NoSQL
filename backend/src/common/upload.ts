import 'dotenv/config';
import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, isAbsolute, join, relative, sep } from 'path';
import { randomBytes } from 'crypto';
import { catchError, defer, throwError } from 'rxjs';

export const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
const CHO_PHEP = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** Nhận một file ảnh (tối đa 5MB) và lưu vào uploads/<thuMuc>/. req.file.path được thay bằng đường dẫn tương đối. */
export function anhInterceptor(truongFile: string, thuMuc: string, tienTo = 'img', toiDaMb = 5) {
  return FileInterceptor(truongFile, {
    limits: { fileSize: toiDaMb * 1024 * 1024 },
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(UPLOAD_ROOT, thuMuc);
        mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        cb(null, `${tienTo}_${Date.now()}_${randomBytes(4).toString('hex')}${extname(file.originalname).toLowerCase()}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!CHO_PHEP.has(extname(file.originalname).toLowerCase()) || !file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Hình ảnh phải có định dạng jpg, jpeg, png, webp hoặc gif.'), false);
      }
      cb(null, true);
    },
  });
}

export function duongDanTuongDoi(thuMuc: string, file?: Express.Multer.File): string | undefined {
  return file ? `uploads/${thuMuc}/${file.filename}` : undefined;
}

/** Chỉ xóa file nằm trong uploads/, không bao giờ đụng tới ảnh tĩnh của giao diện. */
export function xoaAnhUpload(duongDan?: string | null): void {
  if (!duongDan || !duongDan.startsWith('uploads/') || duongDan.includes('..')) {
    return;
  }
  const full = join(UPLOAD_ROOT, duongDan.slice('uploads/'.length));
  try {
    if (existsSync(full)) unlinkSync(full);
  } catch {
    // DB đã lưu; lỗi dọn ảnh không được làm hỏng request.
  }
}

@Injectable()
export class DonAnhKhiLoi implements NestInterceptor {
  static readonly daLuu = new WeakSet<Express.Multer.File>();

  intercept(context: ExecutionContext, next: CallHandler) {
    return defer(() => next.handle()).pipe(catchError((error: unknown) => {
      const file = context.switchToHttp().getRequest<{ file?: Express.Multer.File }>().file;
      if (file?.path && !DonAnhKhiLoi.daLuu.has(file)) {
        const path = relative(UPLOAD_ROOT, file.path);
        if (!isAbsolute(path)) xoaAnhUpload(`uploads/${path.split(sep).join('/')}`);
      }
      return throwError(() => error);
    }));
  }
}
