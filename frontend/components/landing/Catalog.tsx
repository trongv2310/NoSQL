import { layTrangChuSanPham } from "@/lib/server-api";
import { CatalogProvider } from "./CatalogProvider";

/** Các khu sản phẩm dùng chung một lần tải dữ liệu ở server. */
export async function Catalog({ children }: { children: React.ReactNode }) {
  const items = await layTrangChuSanPham();
  return (
    <CatalogProvider initial={items}>{children}</CatalogProvider>
  );
}
