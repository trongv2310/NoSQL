import { createHash } from 'node:crypto';

/** Giới hạn cho giỏ của khách chưa đăng nhập. Server áp dụng lại, không tin giới hạn ở trình duyệt. */
export const TOI_DA_DONG = 50;
export const TOI_DA_SO_LUONG = 100;
/**
 * Mã đồng bộ nhớ trên MỘT dòng giỏ là chốt chặn nguyên tử "đã cộng rồi". Không loại theo số lượng (đã từng làm biên nhận dở dang
 * cộng đôi); chỉ bỏ mã quá `HAN_MA_DONG_BO_MS` và đặt trần: quá trần thì từ chối (503) chứ không âm thầm bỏ mã.
 */
export const SO_MA_DONG_BO_TOI_DA = 200;
/** Bằng thời hạn tự xóa của biên nhận và sổ cái (30 ngày); trình duyệt bỏ bản chụp chờ sau 14 ngày nên không gửi lại mã đã hết hạn. */
export const HAN_MA_DONG_BO_MS = 30 * 24 * 3600 * 1000;

/** Một dòng do trình duyệt gửi lên: chỉ có id biến thể và số lượng. Giá, tên, tổng tiền luôn do server tính. */
export interface DongGio {
  chiTietId: string;
  soLuong: number;
}

/**
 * Gộp các dòng trùng biến thể trước khi tính: cộng số lượng, chặn ở `TOI_DA_SO_LUONG`, giữ thứ tự xuất hiện đầu tiên.
 * Id được đưa về chữ thường để "ABC…" và "abc…" không thành hai dòng.
 */
export function gopDong(dongs: DongGio[]): DongGio[] {
  const theoId = new Map<string, number>();
  for (const d of dongs) {
    const id = String(d.chiTietId).toLowerCase();
    theoId.set(id, Math.min(TOI_DA_SO_LUONG, (theoId.get(id) ?? 0) + Math.floor(Number(d.soLuong))));
  }
  return [...theoId].map(([chiTietId, soLuong]) => ({ chiTietId, soLuong }));
}

/** Băm nội dung đã gộp, không phụ thuộc thứ tự dòng: cùng giỏ thì cùng dấu. */
export function dauNoiDung(dongs: DongGio[]): string {
  const chuoi = gopDong(dongs)
    .map((d) => `${d.chiTietId}:${d.soLuong}`)
    .sort()
    .join('|');
  return createHash('sha256').update(chuoi).digest('hex');
}

export function laLoiTrungKhoa(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: number }).code === 11000;
}
