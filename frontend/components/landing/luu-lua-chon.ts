/**
 * Nhớ lựa chọn trên landing trong phiên (sessionStorage) để quay lại từ trang chi tiết vẫn thấy đúng tab/bộ lọc/bước đã chọn.
 * Mọi thao tác bọc try/catch: chế độ riêng tư hoặc bị chặn lưu trữ thì chỉ là không nhớ, không gây lỗi.
 */
export function docLuaChon<T>(khoa: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(khoa);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function ghiLuaChon(khoa: string, giaTri: unknown) {
  try {
    window.sessionStorage.setItem(khoa, JSON.stringify(giaTri));
  } catch {
    /* không lưu được thì thôi */
  }
}
