import { test } from '@playwright/test';
import { API, apiGet, choOnDinh, expect, theoDoi } from './_tien-ich';

/**
 * Luồng mua hàng đầu-cuối trên giao diện thật: khách vãng lai thêm giỏ → đăng nhập (giỏ được gộp) → sửa số lượng →
 * thanh toán COD → thấy đơn trong "Đơn hàng của tôi" → hủy đơn. Chỉ chạy trên desktop (mobile đi đường giống hệt).
 */
test.describe('Luồng mua hàng đầu-cuối', () => {
  test.beforeEach(({}, ti) => test.skip(ti.project.name !== 'desktop', 'chạy 1 lần trên desktop'));

  test('Khách vãng lai → giỏ → đăng nhập → thanh toán COD → xem đơn → hủy đơn', async ({ page, playwright }) => {
    // Dọn giỏ trên server của tài khoản mẫu để số liệu tồn kho của test là chính xác
    const kh = await playwright.request.newContext({ baseURL: process.env.UI_URL ?? 'http://localhost:3000', storageState: '.auth/khach.json' });
    for (const d of (await (await kh.get('/api/gio-hang')).json()).items ?? []) await kh.delete(`/api/gio-hang/${d.id}`);
    await kh.dispose();
    const g = theoDoi(page);
    const sp = (await apiGet('/san-pham?keyword=vot&page=1')).items.find((x: any) => /Vợt/.test(x.tenSanPham));
    const truocTon = (await apiGet(`/san-pham/${sp.id}`)).bienThes.reduce((s: number, b: any) => s + b.soLuongTon, 0);

    // 1. Trang sản phẩm, thêm 2 vào giỏ khi chưa đăng nhập
    await page.goto(`/Home/ChiTietSanPham/${sp.id}`);
    await choOnDinh(page);
    await expect(page.locator('h1')).toContainText(sp.tenSanPham.slice(0, 10));
    await page.getByRole('button', { name: 'Tăng số lượng' }).first().click();
    await page.locator('.pdp-add-to-cart').click();
    await expect(page.getByText(/đã thêm|thêm vào giỏ hàng thành công/i).first()).toBeVisible();

    // 2. Giỏ hàng khách: có sản phẩm, giá do server tính
    await page.goto('/Home/ViewCart');
    await choOnDinh(page);
    await expect(page.getByText(sp.tenSanPham).first()).toBeVisible();

    // 3. Tiến hành thanh toán → bị yêu cầu đăng nhập → đăng nhập → quay lại thanh toán, giỏ được gộp
    await page.getByText(/^(Tiến hành thanh toán|Đăng nhập để thanh toán)/).first().click();
    await page.waitForURL(/DangNhap|Checkout/);
    if (/DangNhap/.test(page.url())) {
      await page.getByLabel('Tên đăng nhập').fill('nguyenvana');
      await page.getByLabel('Mật khẩu', { exact: true }).fill('vana@123');
      await page.getByRole('button', { name: /Đăng nhập/ }).click();
      await page.waitForURL((u) => !/DangNhap/.test(u.pathname), { timeout: 30_000 });
    }
    if (!/Checkout/.test(page.url())) await page.goto('/DonHang/Checkout');
    await choOnDinh(page);
    await expect(page.getByText(sp.tenSanPham).first()).toBeVisible();

    // 4. Điền thông tin, chọn COD, đặt hàng
    await page.getByLabel('Họ tên người nhận').fill('Người Nhận UI');
    await page.getByLabel('Số điện thoại').fill('0909123456');
    await page.getByLabel('Địa chỉ giao hàng').fill('1 Lê Lợi, Q.1, TP.HCM');
    await page.getByRole('radio', { name: /COD/ }).check({ force: true }); // header dính che mất lựa chọn khi cuộn tới (xem báo cáo)
    await page.getByRole('button', { name: 'Đặt hàng' }).click();
    await page.waitForURL(/DonHang\/(Details|Index)/, { timeout: 30_000 });
    await choOnDinh(page);
    const so = Number((await page.locator('body').innerText()).match(/#(\d+)/)?.[1]);
    expect(so).toBeGreaterThan(0);

    // Tồn kho giảm đúng 2
    const sauTon = (await apiGet(`/san-pham/${sp.id}`)).bienThes.reduce((s: number, b: any) => s + b.soLuongTon, 0);
    expect(truocTon - sauTon).toBe(2);

    // 5. Danh sách đơn có đơn vừa đặt
    await page.goto('/DonHang/Index');
    await choOnDinh(page);
    await expect(page.getByText(`#${so}`).first()).toBeVisible();

    // 6. Chi tiết đơn → hủy
    await page.goto(`/DonHang/Details/${so}`);
    await choOnDinh(page);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Hủy đơn hàng' }).click();
    await expect(page.getByText(/Đã hủy/).first()).toBeVisible();
    const hoanTon = (await apiGet(`/san-pham/${sp.id}`)).bienThes.reduce((s: number, b: any) => s + b.soLuongTon, 0);
    expect(hoanTon).toBe(truocTon);

    expect.soft(g.pageLoi, 'Lỗi JavaScript trong cả luồng').toEqual([]);
    expect.soft(g.requestHong.filter((x) => !/401/.test(x)), 'Request hỏng trong cả luồng').toEqual([]);
  });

  test('Đăng nhập sai hiện thông báo lỗi rõ ràng, không xóa tên đăng nhập đã nhập', async ({ page }) => {
    await page.goto('/TaiKhoan/DangNhap');
    await choOnDinh(page);
    await page.getByLabel('Tên đăng nhập').fill('nguyenvana');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('sai-mat-khau');
    await page.getByRole('button', { name: /Đăng nhập/ }).click();
    await expect(page.getByText(/không đúng/i)).toBeVisible();
    await expect(page.getByLabel('Tên đăng nhập')).toHaveValue('nguyenvana');
    await fetch(API.replace(/\/api$/, '') + '/api/site'); // giữ kết nối
  });

  test('Đặt hàng thiếu thông tin: trình duyệt chặn, không gửi request', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: '.auth/khach.json', baseURL: process.env.UI_URL ?? 'http://localhost:3000' });
    const page = await ctx.newPage();
    const sp = (await apiGet('/san-pham?page=1')).items[0];
    const bt = (await apiGet(`/san-pham/${sp.id}`)).bienThes.find((b: any) => b.soLuongTon > 0);
    await ctx.request.post('/api/gio-hang', { data: { chiTietId: bt.id, quantity: 1 } });
    await page.goto('/DonHang/Checkout');
    await choOnDinh(page);
    let daGui = false;
    page.on('request', (r) => { if (/\/api\/don-hang\/(checkout|momo)/.test(r.url()) && r.method() === 'POST') daGui = true; });
    await page.getByLabel('Họ tên người nhận').fill('');
    await page.getByRole('button', { name: 'Đặt hàng' }).click();
    await page.waitForTimeout(800);
    expect(daGui).toBe(false);
    expect(await page.getByLabel('Họ tên người nhận').evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    // dọn giỏ
    const gio = await (await ctx.request.get('/api/gio-hang')).json();
    for (const d of gio.items) await ctx.request.delete(`/api/gio-hang/${d.id}`);
    await ctx.close();
  });
});
