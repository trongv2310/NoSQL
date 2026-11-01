"use client";

import Link from "next/link";
import { Empty, ErrorBox, Loading, Page, ProductCard } from "@/components/Ui";
import { useApi } from "@/lib/hooks";
import { ngay, vnd } from "@/lib/format";
import type { KhuyenMaiV, SanPhamV } from "@/lib/types";

export default function KhuyenMaiPage() {
  const { data, error, loading } = useApi<{ khuyenMais: KhuyenMaiV[]; sanPhams: SanPhamV[] }>("/san-pham/khuyen-mai");
  return (
    <Page>
      <link href="/css/promo.css" rel="stylesheet" />
      <h2 className="page-title mb-3">Chương trình khuyến mãi</h2>
      {loading ? <Loading /> : error || !data ? <ErrorBox message={error ?? "Lỗi tải dữ liệu"} /> : data.khuyenMais.length === 0 ? (
        <Empty message="Hiện chưa có chương trình khuyến mãi nào đang diễn ra." linkUrl="/SanPham/Index" linkText="Xem sản phẩm" />
      ) : data.khuyenMais.map((km) => {
        const sps = data.sanPhams.filter((s) => s.khuyenMai?.id === km.id);
        return (
          <section key={km.id} className="promo-block mb-5">
            <div className="promo-head d-flex flex-wrap align-items-center gap-3 mb-3">
              <span className="promo-percent badge bg-danger fs-5">-{Math.round(km.phanTramGiam)}%</span>
              <div>
                <h4 className="mb-0">{km.tenChuongTrinh}</h4>
                <small className="text-muted">{km.moTa} · {ngay(km.ngayBatDau)} – {ngay(km.ngayKetThuc)}{km.giamToiDa ? ` · Giảm tối đa ${vnd(km.giamToiDa)}` : ""}</small>
              </div>
            </div>
            {sps.length ? <div className="row g-3">{sps.map((s) => <div key={s.id} className="col-6 col-md-4 col-lg-3"><ProductCard sp={s} /></div>)}</div>
              : <p className="text-muted">Chưa có sản phẩm áp dụng. <Link href="/SanPham/Index">Xem sản phẩm khác</Link></p>}
          </section>
        );
      })}
    </Page>
  );
}
