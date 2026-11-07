import { cache } from "react";
import type { SanPhamLanding } from "./landing-data";
import type { TinV } from "./types";

/** Địa chỉ backend phía server (cùng biến với rewrites trong next.config.ts); không đi vòng qua chính frontend. */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** Một khối dữ liệu chậm không được giữ trang quá lâu: quá hạn thì coi như chưa có dữ liệu. */
const HAN_CHO_MS = 2500;

/** Giá, khuyến mãi và tồn kho đổi nhanh nên làm mới thường xuyên; bài viết và đánh giá ít đổi hơn. Việc mua hàng luôn do backend xác minh lại. */
export const LAM_MOI_SAN_PHAM_GIAY = 120;
export const LAM_MOI_NOI_DUNG_GIAY = 600;

/**
 * Gọi API công khai (không kèm cookie, nên không bao giờ gắn với một người dùng cụ thể).
 * Trả `null` khi API lỗi/chậm để giao diện tự rơi về nội dung tĩnh hoặc tự tải lại phía client,
 * không ném lỗi làm hỏng cả trang.
 */
async function layApi<T>(duongDan: string, lamMoiGiay: number): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api${duongDan}`, { next: { revalidate: lamMoiGiay }, signal: AbortSignal.timeout(HAN_CHO_MS) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Mọi sản phẩm kèm tồn kho và thông số vợt, một lần gọi. `cache()` gộp nhiều nơi dùng trong cùng một request. */
export const layTrangChuSanPham = cache(async (): Promise<SanPhamLanding[] | null> => {
  const d = await layApi<{ sanPhams: SanPhamLanding[] }>("/san-pham/trang-chu", LAM_MOI_SAN_PHAM_GIAY);
  return d?.sanPhams ?? null;
});

export interface NoiDungLanding {
  danhGia: { id: string; noiDung: string; danhGia: number; tenKhachHang: string; tenSanPham: string | null }[];
  dsNoiBat: TinV[];
  tinMoi: TinV[];
}

/** Bài viết và đánh giá. Dùng chung API `/landing` hiện có (chưa có bằng chứng cần tách endpoint riêng). */
export const layNoiDungLanding = cache(() => layApi<NoiDungLanding>("/landing", LAM_MOI_NOI_DUNG_GIAY));
