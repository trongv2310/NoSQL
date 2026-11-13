"use client";

import { ProductCard as TheSanPham } from "@/components/product/ProductCard";
import type { SanPhamLanding } from "@/lib/landing-data";

/** Giữ API cũ (`sp`, `lyDo`) cho các khu landing cũ; toàn bộ hiển thị do thẻ sản phẩm duy nhất đảm nhiệm. */
export function ProductCard({ sp, lyDo }: { sp: SanPhamLanding; lyDo?: string }) {
  return <TheSanPham sp={sp} lyDo={lyDo} />;
}
