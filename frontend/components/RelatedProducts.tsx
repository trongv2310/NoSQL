"use client";

import Link from "next/link";
import { useApi } from "@/lib/hooks";
import type { SanPhamV, Trang } from "@/lib/types";
import { ProductCard } from "./Ui";

export function RelatedProducts({ sanPhamId, loai }: { sanPhamId: string; loai: { id: string; tenLoai: string } }) {
  const { data, loading, error } = useApi<Trang<SanPhamV>>(`/san-pham?loai=${encodeURIComponent(loai.id)}&con_hang=1`);
  const ds = data?.items.filter((sp) => sp.id !== sanPhamId).slice(0, 4) ?? [];
  if (!loading && !error && !ds.length) return null;
  return <section className="pdp-related" aria-labelledby="pdp-related-title" aria-busy={loading}>
    <div className="pdp-related-heading"><div><span>CÙNG KHÁM PHÁ</span><h2 id="pdp-related-title">Lựa chọn khác dành cho bạn</h2><p>Các sản phẩm còn hàng trong nhóm {loai.tenLoai.toLocaleLowerCase("vi")}.</p></div><Link href={`/SanPham/Index?loai=${loai.id}`}>Xem tất cả <span aria-hidden="true">↗</span></Link></div>
    {loading ? <div className="pdp-related-grid" role="status" aria-label="Đang tải sản phẩm cùng loại">{[0, 1, 2, 3].map((i) => <div className="pdp-related-placeholder" key={i} aria-hidden="true" />)}</div>
      : error ? <p className="text-muted small">Chưa tải được gợi ý. Bạn có thể bấm “Xem tất cả” để tiếp tục tìm sản phẩm.</p>
      : <div className="pdp-related-grid">{ds.map((sp) => <ProductCard key={sp.id} sp={sp} />)}</div>}
  </section>;
}
