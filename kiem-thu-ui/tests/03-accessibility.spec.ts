import AxeBuilder from '@axe-core/playwright';
import { test } from '@playwright/test';
import { apiGet, choOnDinh, expect, ghiChu } from './_tien-ich';

/**
 * Accessibility (WCAG 2.1 A/AA) bằng axe-core trên các trang chính. Lỗi mức "critical" và "serious" bị đánh trượt;
 * mức "moderate/minor" chỉ ghi chú vào báo cáo.
 */
const TRANG = ['/', '/SanPham/Index', '/SanPham/KhuyenMai', '/BangTin', '/TaiKhoan/DangNhap', '/TaiKhoan/DangKy', '/Home/ViewCart', '/Home/Contact', 'SP'];
const TRANG_ADMIN = ['/admin', '/admin/san-pham', '/admin/san-pham/create', '/admin/don-hang', '/admin/khuyen-mai/create'];

async function quet(page: import('@playwright/test').Page, testInfo: import('@playwright/test').TestInfo) {
  const kq = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const nang = kq.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  const tomTat = kq.violations.map((v) => ({ id: v.id, muc: v.impact, so: v.nodes.length, mau: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) }));
  ghiChu(testInfo, 'axe', tomTat);
  await testInfo.attach('axe.json', { body: JSON.stringify(kq.violations, null, 2), contentType: 'application/json' });
  expect.soft(nang.map((v) => `${v.impact} ${v.id} ×${v.nodes.length}: ${v.help}`)).toEqual([]);
}

test.describe('Accessibility – trang khách', () => {
  test.beforeEach(({}, ti) => test.skip(ti.project.name !== 'desktop', 'chạy trên desktop'));
  for (const t of TRANG) {
    test(`axe ${t}`, async ({ page }, testInfo) => {
      const url = t === 'SP' ? `/Home/ChiTietSanPham/${(await apiGet('/san-pham?page=1')).items[0].id}` : t;
      await page.goto(url);
      await choOnDinh(page);
      await quet(page, testInfo);
    });
  }
});

test.describe('Accessibility – trang quản trị', () => {
  test.beforeEach(({}, ti) => test.skip(ti.project.name !== 'desktop', 'chạy trên desktop'));
  test.use({ storageState: '.auth/admin.json' });
  for (const t of TRANG_ADMIN) {
    test(`axe ${t}`, async ({ page }, testInfo) => {
      await page.goto(t);
      await choOnDinh(page);
      await quet(page, testInfo);
    });
  }
});

test.describe('Dùng bàn phím', () => {
  test.beforeEach(({}, ti) => test.skip(ti.project.name !== 'desktop', 'chạy trên desktop'));
  test('Tab qua trang chủ: mọi phần tử nhận focus đều thấy được vòng focus', async ({ page }) => {
    await page.goto('/');
    await choOnDinh(page);
    const khongThayFocus: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const coVien = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
        return { ten: `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`, coVien };
      });
      if (info && !info.coVien) khongThayFocus.push(info.ten);
    }
    expect.soft(khongThayFocus, 'Phần tử nhận focus nhưng không có viền focus').toEqual([]);
  });
});
