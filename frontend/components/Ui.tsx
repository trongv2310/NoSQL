"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment } from "react";
import { vnd, imgUrl } from "@/lib/format";
import type { SanPhamV, Trang } from "@/lib/types";

export function Stars({ value }: { value: number }) {
  return (
    <div className="rating-small">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={i < Math.round(value) ? undefined : "off"}>★</span>
      ))}
      <span className="count">({value.toFixed(1)})</span>
    </div>
  );
}

export function ProductCard({ sp }: { sp: SanPhamV }) {
  return (
    <div className="product-card">
      {sp.dangGiamGia && sp.khuyenMai && <div className="badge-promo">-{Math.round(sp.khuyenMai.phanTramGiam)}%</div>}
      <Link href={`/Home/ChiTietSanPham/${sp.id}`} className="thumb">
        { }
        <img src={imgUrl(sp.hinhAnhDaiDien)} alt={sp.tenSanPham} loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = "/images/default-product.jpg"; }} />
      </Link>
      <div className="body">
        <div className="product-brand">{sp.hang?.tenHang ?? "Hãng khác"}</div>
        <Link href={`/Home/ChiTietSanPham/${sp.id}`} className="product-title" title={sp.tenSanPham}>{sp.tenSanPham}</Link>
        <Stars value={sp.trungBinhDanhGia} />
        <div className="product-footer">
          <div>
            <span className="product-price">{vnd(sp.giaSauKhuyenMai)}</span>
            {sp.dangGiamGia && sp.giaSauKhuyenMai < sp.giaGoc && <span className="price-small">{vnd(sp.giaGoc)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Empty({ message, linkUrl, linkText }: { message: string; linkUrl?: string; linkText?: string }) {
  return (
    <div className="empty-state is-compact">
      <svg className="empty-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="32" cy="52" r="7" fill="currentColor" fillOpacity=".12" />
        <path d="M26 46 14 12M32 45V8M38 46l12-34" />
        <path d="M14 12Q32 4 50 12" />
        <path d="M21 30q11-4 22 0" />
      </svg>
      <p className="empty-text">{message}</p>
      {linkUrl && <Link href={linkUrl} className="btn btn-primary btn-sm">{linkText ?? "Quay lại"}</Link>}
    </div>
  );
}

/** Phân trang theo query ?page=; giữ nguyên các tham số lọc khác trên URL. */
export function Pagination({ trang }: { trang: Pick<Trang<unknown>, "page" | "pages" | "total"> }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  if (trang.pages <= 1) {
    return trang.total > 0 ? <div className="mt-3 small text-muted">Tổng cộng {trang.total} kết quả</div> : null;
  }
  const di = (p: number) => {
    const q = new URLSearchParams(sp.toString());
    q.set("page", String(p));
    router.push(`${pathname}?${q.toString()}`);
  };
  const dsTrang = Array.from({ length: trang.pages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === trang.pages || Math.abs(p - trang.page) <= 1,
  );
  return (
    <nav className="mt-3" aria-label="Phân trang">
      <ul className="pagination">
        <li className={`page-item ${trang.page <= 1 ? "disabled" : ""}`}>
          <button className="page-link" onClick={() => di(trang.page - 1)} disabled={trang.page <= 1}>‹</button>
        </li>
        {dsTrang.map((p, i) => (
          <Fragment key={p}>
            {i > 0 && p - dsTrang[i - 1] > 1 && <li className="page-item disabled"><span className="page-link">…</span></li>}
            <li className={`page-item ${p === trang.page ? "active" : ""}`}>
              <button className="page-link" onClick={() => di(p)}>{p}</button>
            </li>
          </Fragment>
        ))}
        <li className={`page-item ${trang.page >= trang.pages ? "disabled" : ""}`}>
          <button className="page-link" onClick={() => di(trang.page + 1)} disabled={trang.page >= trang.pages}>›</button>
        </li>
      </ul>
    </nav>
  );
}

export function Loading({ text = "Đang tải..." }: { text?: string }) {
  return <div className="text-center text-muted py-5"><i className="fa-solid fa-spinner fa-spin" /> {text}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="alert alert-danger"><i className="fa-solid fa-triangle-exclamation" /> {message}</div>;
}

/** Khung nội dung chuẩn của các trang khách (trang Landing tự dựng full-width nên không dùng). */
export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`container my-4 my-lg-5 ${className}`}>{children}</div>;
}
