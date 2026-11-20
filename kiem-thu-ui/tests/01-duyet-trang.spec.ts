import { test } from '@playwright/test';
import { anhHong, apiGet, choOnDinh, expect, ghiChu, theoDoi, tranNgang } from './_tien-ich';

/**
 * Duyệt MỌI trang (khách + quản trị) trên desktop và điện thoại. Mỗi trang kiểm:
 *  - tải được (HTTP < 400), có tiêu đề <title> và một <h1>
 *  - không có lỗi JavaScript, lỗi console, request API hỏng
 *  - không có ảnh hỏng
 *  - không tràn ngang trên điện thoại
 */
let SP_ID = '';
let TIN_ID = '';
let DON_KHACH = 0;
let BIEN_THE_ID = '';
let KM_ID = '';
let TD_ID = '';
let TK_ID = '';

test.beforeAll(async () => {
  const sp = await apiGet('/san-pham?page=1');
  SP_ID = sp.items.find((x: any) => /Vợt/.test(x.tenSanPham))?.id ?? sp.items[0].id;
  const ct = await apiGet(`/san-pham/${SP_ID}`);
  BIEN_THE_ID = ct.bienThes[0]?.id;
  const tin = await apiGet('/ban-tin');
  TIN_ID = (tin.items ?? tin.tinTucs)[0].id;
});

const TRANG_KHACH = [
  '/', '/Home/Index', '/SanPham/Index', '/SanPham/ViewAllProduct', '/SanPham/KhuyenMai', '/SanPham/TimKiem?keyword=yonex',
  '/KhuyenMai/Index', '/BangTin', '/Home/Contact', '/so-sanh', '/TaiKhoan/DangNhap', '/TaiKhoan/DangKy',
  '/ChinhSach/bao-hanh', '/ChinhSach/doi-tra', '/ChinhSach/giao-hang', '/ChinhSach/huong-dan-mua-hang', '/ChinhSach/cau-hoi-thuong-gap',
  '/trai-nghiem/index.html',
  'SP', 'TIN',
];
const TRANG_KHACH_DANG_NHAP = ['/Home/ViewCart', '/DonHang/Index', '/DonHang/Checkout', '/TaiKhoan/ThongTin', '/TaiKhoan/DoiMatKhau', '/TaiKhoan/HoSoChoi', '/tu-vot', 'DON', 'REVIEW'];
const TRANG_ADMIN = [
  '/admin', '/admin/don-hang', 'ADON', '/admin/san-pham', '/admin/san-pham/create', 'ASP', 'ASPEDIT', 'ABT',
  '/admin/khuyen-mai', '/admin/khuyen-mai/create', 'AKM', '/admin/tran-dau', '/admin/tran-dau/create', 'ATD',
  '/admin/ban-tin', '/admin/ban-tin/create', 'ABTIN', '/admin/tai-khoan', '/admin/tai-khoan/create', 'ATK',
  '/admin/thong-bao', '/admin/logo', '/admin/bao-cao-csdl', '/admin/khai-thac', '/admin/lich-cang',
];

function duongDan(k: string): string {
  const map: Record<string, () => string> = {
    SP: () => `/Home/ChiTietSanPham/${SP_ID}`,
    TIN: () => `/BangTin/${TIN_ID}`,
    DON: () => `/DonHang/Details/${DON_KHACH || 1}`,
    REVIEW: () => `/ThemPhanHoiSP/ReviewForm/${SP_ID}`,
    ADON: () => `/admin/don-hang/${DON_KHACH || 1}`,
    ASP: () => `/admin/san-pham/${SP_ID}`,
    ASPEDIT: () => `/admin/san-pham/${SP_ID}/edit`,
    ABT: () => `/admin/bien-the/${BIEN_THE_ID}/edit`,
    AKM: () => `/admin/khuyen-mai/${KM_ID}/edit`,
    ATD: () => `/admin/tran-dau/${TD_ID}/edit`,
    ABTIN: () => `/admin/ban-tin/${TIN_ID}/edit`,
    ATK: () => `/admin/tai-khoan/${TK_ID}/edit`,
  };
  return map[k]?.() ?? k;
}

async function kiemTraTrang(page: import('@playwright/test').Page, url: string, testInfo: import('@playwright/test').TestInfo) {
  const g = theoDoi(page);
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
  await choOnDinh(page);
  const hong = await anhHong(page);
  const tran = await tranNgang(page);
  const h1 = await page.locator('h1').count();
  const tieuDe = await page.title();
  const coThongBaoLoi = await page.getByText(/Không tải được|Đã xảy ra lỗi|Application error|Unhandled Runtime Error|This page could not be found/i).count();
  await page.screenshot({ path: testInfo.outputPath('trang.png'), fullPage: testInfo.project.name === 'desktop' && !url.endsWith('.html') });
  const ketQua = { url, status: res?.status(), tieuDe, h1, anhHong: hong, tranNgang: tran, ...g, coThongBaoLoi };
  ghiChu(testInfo, 'ket-qua', ketQua);
  expect.soft(res?.status() ?? 0, 'HTTP status').toBeLessThan(400);
  expect.soft(g.pageLoi, 'Lỗi JavaScript trên trang').toEqual([]);
  expect.soft(g.requestHong, 'Request hỏng (4xx/5xx)').toEqual([]);
  expect.soft(g.consoleLoi, 'Lỗi console').toEqual([]);
  expect.soft(hong, 'Ảnh hỏng').toEqual([]);
  expect.soft(coThongBaoLoi, 'Trang hiện thông báo lỗi').toBe(0);
  if (!url.endsWith('.html')) {
    expect.soft(tieuDe.trim().length, '<title> rỗng').toBeGreaterThan(0);
    expect.soft(h1, 'Số thẻ <h1> (nên có đúng 1)').toBe(1);
  }
  if (testInfo.project.name === 'mobile') expect.soft(tran.tran, `Tràn ngang trên điện thoại: ${tran.thuPham.join(', ')}`).toBeLessThanOrEqual(1);
}

test.describe('Trang khách – chưa đăng nhập', () => {
  for (const k of TRANG_KHACH) {
    test(`Trang ${k}`, async ({ page }, testInfo) => {
      await kiemTraTrang(page, duongDan(k), testInfo);
    });
  }
});

test.describe('Trang khách – đã đăng nhập (nguyenvana)', () => {
  test.use({ storageState: '.auth/khach.json' });
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: '.auth/khach.json', baseURL: process.env.UI_URL ?? 'http://localhost:3000' });
    const ds = await (await ctx.request.get('/api/don-hang')).json();
    DON_KHACH = (Array.isArray(ds) ? ds : ds.items)[0]?.soDonHang ?? 0;
    await ctx.close();
  });
  for (const k of TRANG_KHACH_DANG_NHAP) {
    test(`Trang ${k}`, async ({ page }, testInfo) => {
      await kiemTraTrang(page, duongDan(k), testInfo);
    });
  }
});

test.describe('Trang quản trị – admin', () => {
  test.use({ storageState: '.auth/admin.json' });
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: '.auth/admin.json', baseURL: process.env.UI_URL ?? 'http://localhost:3000' });
    const g = async (p: string) => (await ctx.request.get('/api' + p)).json();
    KM_ID = (await g('/admin/khuyen-mai')).items[0]?.id;
    TD_ID = (await g('/admin/tran-dau')).items[0]?.id;
    TK_ID = (await g('/admin/tai-khoan')).items.find((x: any) => x.maQuyen !== 1)?.id;
    if (!DON_KHACH) DON_KHACH = (await g('/admin/don-hang')).items[0]?.soDonHang;
    await ctx.close();
  });
  for (const k of TRANG_ADMIN) {
    test(`Trang ${k}`, async ({ page }, testInfo) => {
      await kiemTraTrang(page, duongDan(k), testInfo);
    });
  }
});
