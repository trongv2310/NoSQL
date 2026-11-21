/** Client HTTP nhỏ có giữ cookie, dùng cho kiểm thử API trên server thật. */
export const API = process.env.API_URL ?? 'http://localhost:4000/api';

export interface KetQua<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export class Client {
  private cookies = new Map<string, string>();
  constructor(public readonly ten = 'khach-vang-lai') {}

  get cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private nhanCookie(res: Response) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [cap] = c.split(';');
      const i = cap.indexOf('=');
      const k = cap.slice(0, i).trim();
      const v = cap.slice(i + 1).trim();
      if (!v || /expires=Thu, 01 Jan 1970/i.test(c) || /max-age=0/i.test(c)) this.cookies.delete(k);
      else this.cookies.set(k, v);
    }
  }

  async goi<T = any>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<KetQua<T>> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.cookies.size) headers.cookie = this.cookieHeader;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(API + path, { method, headers, body: payload, redirect: 'manual' });
    this.nhanCookie(res);
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* giữ dạng chuỗi */
    }
    return { status: res.status, body: parsed as T, headers: res.headers };
  }

  get<T = any>(p: string) { return this.goi<T>('GET', p); }
  post<T = any>(p: string, b?: unknown) { return this.goi<T>('POST', p, b ?? {}); }
  put<T = any>(p: string, b?: unknown) { return this.goi<T>('PUT', p, b ?? {}); }
  patch<T = any>(p: string, b?: unknown) { return this.goi<T>('PATCH', p, b ?? {}); }
  del<T = any>(p: string) { return this.goi<T>('DELETE', p); }

  async dangNhap(tenDangNhap: string, matKhau: string, quanTri = false) {
    const r = await this.post(quanTri ? '/auth/admin/dang-nhap' : '/auth/dang-nhap', { tenDangNhap, matKhau });
    if (r.status !== 200 && r.status !== 201) throw new Error(`Đăng nhập ${tenDangNhap} lỗi ${r.status}: ${JSON.stringify(r.body)}`);
    return r.body;
  }
}

/** Chuỗi duy nhất cho mỗi lần chạy (tên đăng nhập, SKU...). */
export const duyNhat = (tien = 't') => `${tien}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Số điện thoại hợp lệ ngẫu nhiên (0 + 9 chữ số). */
export const sdt = () => '09' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');

export const TAI_KHOAN_MAU = {
  admin: ['admin', 'admin@123'],
  nhanVien: ['nhanvien_banhang', 'nv@123'],
  khach: ['nguyenvana', 'vana@123'],
} as const;

export async function adminClient() {
  const c = new Client('admin');
  await c.dangNhap(TAI_KHOAN_MAU.admin[0], TAI_KHOAN_MAU.admin[1], true);
  return c;
}

export async function nhanVienClient() {
  const c = new Client('nhan-vien');
  await c.dangNhap(TAI_KHOAN_MAU.nhanVien[0], TAI_KHOAN_MAU.nhanVien[1], true);
  return c;
}

/** Đăng ký một khách hàng mới (không đụng dữ liệu mẫu), trả về client đã đăng nhập. */
export async function khachMoi(tien = 'kh') {
  const c = new Client(tien);
  const tenDangNhap = duyNhat(tien);
  const r = await c.post('/auth/dang-ky', {
    hoTen: `Khách kiểm thử ${tenDangNhap}`,
    tenDangNhap,
    email: `${tenDangNhap}@kiemthu.local`,
    soDienThoai: sdt(),
    diaChi: '1 Đường Kiểm Thử, Q.1, TP.HCM',
    matKhau: 'matkhau123',
    xacNhanMatKhau: 'matkhau123',
  });
  if (r.status !== 201 && r.status !== 200) throw new Error(`Đăng ký lỗi ${r.status}: ${JSON.stringify(r.body)}`);
  return Object.assign(c, { tenDangNhap, matKhau: 'matkhau123', user: r.body.user });
}

/** Dữ liệu form chọn sẵn (loại, hãng, nhà cung cấp, màu, size) từ API quản trị. */
export async function luaChonForm(admin: Client) {
  const f = (await admin.get('/admin/form-san-pham')).body;
  const bt = (await admin.get('/admin/bien-the-lua-chon')).body;
  return { ...f, ...bt };
}

/**
 * Tạo sản phẩm + 1 biến thể với tồn kho cho trước bằng API quản trị (multipart như form thật).
 * Trả về { sanPhamId, bienTheId, sku }.
 */
export async function taoSanPhamKiemThu(admin: Client, opts: { ton?: number; gia?: number; tenLoai?: string } = {}) {
  const lc = await luaChonForm(admin);
  const loai = (lc.loaiSanPhams as any[]).find((l) => !opts.tenLoai || l.tenLoai === opts.tenLoai) ?? lc.loaiSanPhams[0];
  const fd = new FormData();
  fd.set('tenSanPham', `SP kiểm thử ${duyNhat()}`);
  fd.set('giaGoc', String(opts.gia ?? 150000));
  fd.set('loai', loai.id);
  fd.set('hang', lc.hangs[0].id);
  fd.set('nhaCungCap', lc.nhaCungCaps[0].id);
  fd.set('moTa', 'Sản phẩm tạo tự động bởi bộ kiểm thử API.');
  fd.set('coSize', 'false');
  fd.set('coMau', 'false');
  const tao = await admin.goi('POST', '/admin/san-pham', fd);
  if (tao.status !== 201) throw new Error(`Tạo sản phẩm lỗi ${tao.status}: ${JSON.stringify(tao.body)}`);
  const sanPhamId = tao.body.id as string;
  const sku = duyNhat('SKU-').toUpperCase();
  const bt = new FormData();
  bt.set('giaBan', String(opts.gia ?? 150000));
  bt.set('soLuongTon', String(opts.ton ?? 10));
  bt.set('sku', sku);
  const r = await admin.goi('POST', `/admin/san-pham/${sanPhamId}/bien-the`, bt);
  if (r.status !== 201) throw new Error(`Tạo biến thể lỗi ${r.status}: ${JSON.stringify(r.body)}`);
  const ct = (await admin.get(`/admin/san-pham/${sanPhamId}`)).body;
  const bienThe = (ct.bienThes ?? ct.chiTiet ?? ct.sanPham?.bienThes ?? []).find((b: any) => b.sku === sku);
  if (!bienThe) throw new Error(`Không tìm thấy biến thể vừa tạo trong ${JSON.stringify(ct).slice(0, 300)}`);
  return { sanPhamId, bienTheId: (bienThe.id ?? bienThe.maChiTiet) as string, sku };
}

export const THONG_TIN_GIAO = { hoTenNhan: 'Người Nhận Kiểm Thử', soDienThoaiNhan: '0901234567', diaChiGiao: '12 Nguyễn Huệ, Q.1, TP.HCM', ghiChu: 'kiểm thử' };
