import { request } from '@playwright/test';
import { mkdirSync } from 'fs';

/** Đăng nhập sẵn admin và khách mẫu qua API (cùng origin với frontend vì Next chuyển tiếp /api), lưu cookie cho các test dùng lại. */
export default async function globalSetup() {
  const base = process.env.UI_URL ?? 'http://localhost:3000';
  mkdirSync('.auth', { recursive: true });
  for (const [file, path, tenDangNhap, matKhau] of [
    ['.auth/admin.json', '/api/auth/admin/dang-nhap', 'admin', 'admin@123'],
    ['.auth/khach.json', '/api/auth/dang-nhap', 'nguyenvana', 'vana@123'],
  ]) {
    const ctx = await request.newContext({ baseURL: base });
    const r = await ctx.post(path, { data: { tenDangNhap, matKhau } });
    if (!r.ok()) throw new Error(`Đăng nhập ${tenDangNhap} lỗi ${r.status()}: ${await r.text()}`);
    await ctx.storageState({ path: file });
    await ctx.dispose();
  }
}
