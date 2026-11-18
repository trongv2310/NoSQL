/**
 * Thông tin liên hệ thật của cửa hàng. Chỉ lấy từ biến môi trường do chủ cửa hàng cấu hình; chưa cấu hình thì là `null`
 * và giao diện/chatbot hiển thị "đang cập nhật" chứ không dùng số điện thoại, email hay giờ mở cửa mẫu.
 *   SHOP_HOTLINE, SHOP_EMAIL, SHOP_DIA_CHI, SHOP_GIO_MO_CUA
 */
export interface LienHe {
  dienThoai: string | null;
  email: string | null;
  diaChi: string | null;
  gioMoCua: string | null;
}

/** Các giá trị mẫu từng nằm trong mã nguồn cũ; nếu bị cấu hình nhầm thì vẫn coi là chưa có. */
const GIA_TRI_MAU = new Set(['0123456789', 'huit@gmail.com']);

const SDT = /^[0-9 .+()-]{8,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function lam(v: string | undefined, kiemTra: (s: string) => boolean): string | null {
  const s = (v ?? '').trim().replace(/\s+/g, ' ');
  if (!s || s.length > 200 || GIA_TRI_MAU.has(s.toLocaleLowerCase('vi')) || !kiemTra(s)) {
    return null;
  }
  return s;
}

export function docLienHe(env: Record<string, string | undefined> = process.env): LienHe {
  return {
    dienThoai: lam(env.SHOP_HOTLINE, (s) => SDT.test(s)),
    email: lam(env.SHOP_EMAIL, (s) => EMAIL.test(s)),
    diaChi: lam(env.SHOP_DIA_CHI, () => true),
    gioMoCua: lam(env.SHOP_GIO_MO_CUA, () => true),
  };
}

export function coLienHe(l: LienHe): boolean {
  return !!(l.dienThoai || l.email || l.diaChi || l.gioMoCua);
}
