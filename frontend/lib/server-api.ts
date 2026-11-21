import { cache } from "react";
import type { SanPhamLanding } from "./landing-data";
import type { TinV } from "./types";

/** Địa chỉ backend phía server (cùng biến với rewrites trong next.config.ts); không đi vòng qua chính frontend. */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** Một khối dữ liệu chậm không được giữ trang quá lâu: quá hạn thì coi như chưa có dữ liệu. */
const HAN_CHO_MS = 2500;

/** Giá, khuyến mãi, tồn kho, ảnh và việc ẩn sản phẩm đổi nhanh (ảnh cũ bị dọn ngay, ẩn thì phải biến mất) nên làm mới mỗi 10 giây; bài viết và đánh giá ít đổi hơn. Việc mua hàng luôn do backend xác minh lại. */
export const LAM_MOI_SAN_PHAM_GIAY = 10;
export const LAM_MOI_NOI_DUNG_GIAY = 600;

/** Gọi API công khai từ server và trả null khi lỗi hoặc quá thời gian chờ. */
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

/** Combo mua chung (Top-K, công khai: chỉ kết quả sản phẩm). Thân phản hồi chưa được tin: `chonComboHienThi` (lib/goi-y.ts) làm sạch trước khi hiển thị. */
export const layGoiYCombo = cache(() => layApi<unknown>("/goi-y/combo", LAM_MOI_SAN_PHAM_GIAY));

export interface NoiDungLanding {
  danhGia: { id: string; noiDung: string; danhGia: number; tenKhachHang: string; tenSanPham: string | null }[];
  dsNoiBat: TinV[];
  tinMoi: TinV[];
}

/** Bài viết và đánh giá. Dùng chung API `/landing` hiện có. */
export const layNoiDungLanding = cache(() => layApi<NoiDungLanding>("/landing", LAM_MOI_NOI_DUNG_GIAY));
