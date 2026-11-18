import { layTrangChuSanPham } from "@/lib/server-api";
import { CatalogProvider } from "./CatalogProvider";

/**
 * Các khu cần dữ liệu sản phẩm (hàng nổi bật, bộ chọn vợt, khu sản phẩm) dùng chung một lần lấy dữ liệu ở server.
 * Server không lấy được thì `initial = null` và phía client tự tải lại (có loading, lỗi, thử lại).
 */
export async function Catalog({ children }: { children: React.ReactNode }) {
  const items = await layTrangChuSanPham();
  return (
    <CatalogProvider initial={items}>{children}</CatalogProvider>
  );
}
