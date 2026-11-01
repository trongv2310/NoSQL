"use client";

import { ErrorBox, Loading, Page, ProductCard } from "@/components/Ui";
import { useApi } from "@/lib/hooks";
import type { SanPhamV } from "@/lib/types";

export default function CuaHangPage() {
  const { data, error, loading } = useApi<SanPhamV[]>("/san-pham/cua-hang");
  return (
    <Page>
      <h2 className="page-title mb-3">Cửa hàng</h2>
      {loading ? <Loading /> : error || !data ? <ErrorBox message={error ?? "Lỗi tải dữ liệu"} /> : (
        <div className="row g-3">{data.map((s) => <div key={s.id} className="col-6 col-md-4 col-lg-3"><ProductCard sp={s} /></div>)}</div>
      )}
    </Page>
  );
}
