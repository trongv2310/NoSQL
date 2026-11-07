import { layTrangChuSanPham } from "@/lib/server-api";
import { CatalogProvider } from "./CatalogProvider";
import { RacketPicker } from "./RacketPicker";
import { Showcase } from "./Showcase";

/**
 * Hai khu cần dữ liệu sản phẩm (bộ chọn vợt + khu sản phẩm) dùng chung một lần lấy dữ liệu ở server.
 * Server không lấy được thì `initial = null` và phía client tự tải lại (có loading, lỗi, thử lại).
 */
export async function Catalog() {
  const items = await layTrangChuSanPham();
  return (
    <CatalogProvider initial={items}>
      <RacketPicker />
      <Showcase />
    </CatalogProvider>
  );
}
