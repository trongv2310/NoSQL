"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import type { Trang } from "@/lib/types";
import { Shuttle } from "./PageHero";

/**
 * Ảnh sản phẩm. Khi ảnh không tải được thì nói thẳng "Chưa có ảnh" thay vì thay bằng ảnh giả
 * (tệp /images/default-product.jpg hiện rỗng nên ảnh sẽ vỡ).
 */
export function AnhSanPham({ src, alt, loading = "lazy" }: { src: string; alt: string; loading?: "lazy" | "eager" }) {
  const [loi, setLoi] = useState(false);
  if (loi) return <span className="sf-no-image" role="img" aria-label={alt ? `${alt}: chưa có ảnh` : "Chưa có ảnh sản phẩm"}>Chưa có ảnh</span>;
  return <img src={src} alt={alt} loading={loading} onError={() => setLoi(true)} />;
}

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

/** Thẻ sản phẩm duy nhất của storefront (xem components/product/ProductCard.tsx); giữ tên xuất cũ cho các trang đang import từ đây. */
export { ProductCard } from "./product/ProductCard";

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
  return <div className="sf-loading" role="status"><Shuttle className="sf-loading-shuttle" /><span>{text}</span></div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="alert alert-danger"><i className="fa-solid fa-triangle-exclamation" /> {message}</div>;
}

/** Khung nội dung chuẩn của các trang khách (trang Landing tự dựng full-width nên không dùng). */
export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`container my-4 my-lg-5 ${className}`}>{children}</div>;
}
