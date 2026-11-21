import { test } from '@playwright/test';
import { choOnDinh, expect, theoDoi } from './_tien-ich';

/** CRUD qua giao diện quản trị: khuyến mãi (tạo → sửa → xóa) và đổi trạng thái đơn. */
test.describe('Quản trị qua giao diện', () => {
  test.beforeEach(({}, ti) => test.skip(ti.project.name !== 'desktop', 'chạy trên desktop'));
  test.use({ storageState: '.auth/admin.json' });

  test('Khuyến mãi: tạo → thấy trong danh sách → sửa → xóa', async ({ page }) => {
    const g = theoDoi(page);
    const ten = `KM UI ${Date.now()}`;
    await page.goto('/admin/khuyen-mai/create');
    await choOnDinh(page);
    await page.getByLabel('Tên chương trình *').fill(ten);
    await page.getByLabel('Phần trăm giảm (%) *').fill('15');
    await page.getByLabel('Ngày bắt đầu *').fill('2026-01-01');
    await page.getByLabel('Ngày kết thúc *').fill('2026-12-31');
    await page.getByRole('button', { name: /^Lưu|Tạo/ }).click();
    await page.waitForURL(/\/admin\/khuyen-mai(\?|$)/, { timeout: 30_000 });
    await choOnDinh(page);
    const dong = page.locator('tr', { hasText: ten });
    await expect(dong).toBeVisible();

    await dong.getByRole('link', { name: /Sửa/ }).click();
    await choOnDinh(page);
    await page.getByLabel('Phần trăm giảm (%) *').fill('25');
    await page.getByRole('button', { name: /^Lưu|Cập nhật/ }).click();
    await page.waitForURL(/\/admin\/khuyen-mai(\?|$)/, { timeout: 30_000 });
    await choOnDinh(page);
    await expect(page.locator('tr', { hasText: ten })).toContainText('25');

    page.once('dialog', (d) => d.accept());
    await page.locator('tr', { hasText: ten }).getByRole('button', { name: /Xóa/ }).click();
    await page.waitForTimeout(1500);
    const conKhong = await page.locator('tr', { hasText: ten }).count();
    if (conKhong) {
      // Có thể là hộp xác nhận tự làm (modal) thay vì window.confirm
      await page.getByRole('button', { name: /Xóa|Đồng ý|Xác nhận/ }).last().click();
      await page.waitForTimeout(1500);
    }
    await expect(page.locator('tr', { hasText: ten })).toHaveCount(0);
    expect.soft(g.pageLoi).toEqual([]);
  });

  test('Tạo khuyến mãi ngày kết thúc trước ngày bắt đầu: báo lỗi, không lưu', async ({ page }) => {
    const ten = `KM UI sai ${Date.now()}`;
    await page.goto('/admin/khuyen-mai/create');
    await choOnDinh(page);
    await page.getByLabel('Tên chương trình *').fill(ten);
    await page.getByLabel('Phần trăm giảm (%) *').fill('10');
    await page.getByLabel('Ngày bắt đầu *').fill('2026-12-31');
    await page.getByLabel('Ngày kết thúc *').fill('2026-01-01');
    await page.getByRole('button', { name: /^Lưu|Tạo/ }).click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/create/);
  });

  test('Đơn hàng: danh sách có lọc, mở chi tiết được', async ({ page }) => {
    await page.goto('/admin/don-hang');
    await choOnDinh(page);
    const soDong = await page.locator('tbody tr').count();
    expect(soDong).toBeGreaterThan(0);
    await page.locator('tbody tr a').first().click();
    await choOnDinh(page);
    await expect(page).toHaveURL(/\/admin\/don-hang\/\d+/);
    await expect(page.locator('h1')).toContainText(/#\d+|Đơn/);
  });

  test('Nhân viên đăng nhập → chỉ thấy menu được phép, vào /admin/tai-khoan bị chặn', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: process.env.UI_URL ?? 'http://localhost:3000', storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/admin');
    await choOnDinh(page);
    await page.getByLabel('Tên đăng nhập').fill('nhanvien_banhang');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('nv@123');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL(/\/admin\/don-hang/, { timeout: 30_000 });
    await choOnDinh(page);
    await expect(page.getByRole('link', { name: /Tài khoản/ })).toHaveCount(0);
    await page.goto('/admin/tai-khoan');
    await choOnDinh(page);
    const body = await page.locator('body').innerText();
    expect(/không có quyền|Quản trị viên|403/i.test(body) || /\/admin\/don-hang/.test(page.url())).toBe(true);
    await ctx.close();
  });
});
