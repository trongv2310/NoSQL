import { expect, type Page, type TestInfo } from '@playwright/test';

export const API = process.env.API_URL ?? 'http://localhost:4000/api';

/** Lỗi console / request hỏng / lỗi JS thu được khi mở trang. */
export interface GhiNhan {
  consoleLoi: string[];
  pageLoi: string[];
  requestHong: string[];
}

/** Bỏ qua tiếng ồn của chế độ dev (HMR, font Google không tải được ở môi trường không có mạng). */
const BO_QUA = [
  /\[HMR\]/, /Download the React DevTools/, /fonts\.(googleapis|gstatic)\.com/, /Failed to download `.*` from Google Fonts/, /webpack-hmr|turbopack-hmr|__nextjs/, /favicon\.ico/,
  // Môi trường không ra được Internet (CI/sandbox): đặt BO_QUA_CDN=1 để không tính CDN Font Awesome là lỗi.
  ...(process.env.BO_QUA_CDN ? [/font-awesome|cdnjs\.cloudflare\.com/, /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED/] : []),
];

export function theoDoi(page: Page): GhiNhan {
  const g: GhiNhan = { consoleLoi: [], pageLoi: [], requestHong: [] };
  page.on('console', (m) => {
    if (m.type() === 'error' && !BO_QUA.some((r) => r.test(m.text()))) g.consoleLoi.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => g.pageLoi.push(e.message.slice(0, 300)));
  page.on('response', (r) => {
    const u = r.url();
    if (r.status() >= 400 && !BO_QUA.some((x) => x.test(u))) g.requestHong.push(`${r.status()} ${r.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '')}`);
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    const loi = r.failure()?.errorText ?? '';
    if (!BO_QUA.some((x) => x.test(u)) && !/ERR_ABORTED|NS_BINDING_ABORTED/.test(loi)) g.requestHong.push(`FAILED ${u.replace(/^https?:\/\/[^/]+/, '')} ${loi}`);
  });
  return g;
}

/** Chờ trang ổn định: mạng rảnh + hết spinner "Đang tải". */
export async function choOnDinh(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

/** Ảnh đã tải mà kích thước tự nhiên = 0 (ảnh hỏng). */
export async function anhHong(page: Page): Promise<string[]> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
  return page.evaluate(() =>
    [...document.images]
      .filter((i) => i.complete && i.getAttribute('src') && i.naturalWidth === 0 && getComputedStyle(i).display !== 'none')
      .map((i) => i.getAttribute('src')!)
      .slice(0, 10),
  );
}

/** Trang có bị tràn ngang không (lỗi responsive hay gặp trên điện thoại). */
export async function tranNgang(page: Page): Promise<{ tran: number; thuPham: string[] }> {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const tran = document.documentElement.scrollWidth - w;
    const thuPham: string[] = [];
    if (tran > 1) {
      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        const r = el.getBoundingClientRect();
        if (r.right > w + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') {
          thuPham.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} (phải ${Math.round(r.right)}px)`);
          if (thuPham.length >= 5) break;
        }
      }
    }
    return { tran, thuPham };
  });
}

/** Gắn ghi chú vào báo cáo HTML của Playwright. */
export function ghiChu(testInfo: TestInfo, ten: string, noiDung: unknown) {
  testInfo.annotations.push({ type: ten, description: typeof noiDung === 'string' ? noiDung : JSON.stringify(noiDung) });
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const r = await fetch(API + path);
  return r.json() as Promise<T>;
}

export { expect };
