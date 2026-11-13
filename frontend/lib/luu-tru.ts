/**
 * Lưu JSON vào localStorage một cách trung thực: chỉ báo "đã lưu" khi đã đọc lại đúng giá trị. Không có lưu trữ (chế độ riêng tư, bị chặn),
 * bộ nhớ đầy hoặc dữ liệu cũ bị hỏng đều trả về trạng thái rõ ràng để giao diện nói thật thay vì giả vờ đã lưu.
 * Nhận `kho` làm tham số để kiểm thử với bộ nhớ giả; không import module khác (chạy được bằng `node --test`).
 */
export type KhoChuoi = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type LyDoLoiLuu = "khong-dung-duoc" | "day-bo-nho" | "doc-lai-khong-khop";
export type KetQuaDoc<T> =
  | { trangThai: "ok"; giaTri: T }
  | { trangThai: "rong" }
  | { trangThai: "hong"; tho: string }
  | { trangThai: "khong-dung-duoc" };
export type KetQuaGhi = { ok: true } | { ok: false; lyDo: LyDoLoiLuu };

/** Kho của trình duyệt; `null` khi không truy cập được (SSR, bị chặn). */
export function khoTrinhDuyet(): KhoChuoi | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function docJson<T>(kho: KhoChuoi | null, khoa: string, hopLe: (x: unknown) => x is T): KetQuaDoc<T> {
  if (!kho) return { trangThai: "khong-dung-duoc" };
  let tho: string | null;
  try {
    tho = kho.getItem(khoa);
  } catch {
    return { trangThai: "khong-dung-duoc" };
  }
  if (tho === null) return { trangThai: "rong" };
  try {
    const x: unknown = JSON.parse(tho);
    return hopLe(x) ? { trangThai: "ok", giaTri: x } : { trangThai: "hong", tho };
  } catch {
    return { trangThai: "hong", tho };
  }
}

export function ghiJson(kho: KhoChuoi | null, khoa: string, giaTri: unknown): KetQuaGhi {
  if (!kho) return { ok: false, lyDo: "khong-dung-duoc" };
  try {
    const chuoi = JSON.stringify(giaTri);
    kho.setItem(khoa, chuoi);
    if (kho.getItem(khoa) !== chuoi) return { ok: false, lyDo: "doc-lai-khong-khop" };
    return { ok: true };
  } catch (e) {
    const ten = (e as { name?: string } | null)?.name ?? "";
    return { ok: false, lyDo: /quota/i.test(ten) ? "day-bo-nho" : "khong-dung-duoc" };
  }
}

export function xoaKhoa(kho: KhoChuoi | null, khoa: string): KetQuaGhi {
  if (!kho) return { ok: false, lyDo: "khong-dung-duoc" };
  try {
    kho.removeItem(khoa);
    return kho.getItem(khoa) === null ? { ok: true } : { ok: false, lyDo: "doc-lai-khong-khop" };
  } catch {
    return { ok: false, lyDo: "khong-dung-duoc" };
  }
}

export const NOI_DUNG_LOI_LUU: Record<LyDoLoiLuu, string> = {
  "khong-dung-duoc": "Trình duyệt này không cho lưu dữ liệu (chế độ riêng tư hoặc đã chặn lưu trữ), nên chưa lưu được.",
  "day-bo-nho": "Bộ nhớ lưu trữ của trình duyệt đã đầy, nên chưa lưu được.",
  "doc-lai-khong-khop": "Trình duyệt không giữ lại dữ liệu vừa ghi, nên chưa lưu được.",
};
