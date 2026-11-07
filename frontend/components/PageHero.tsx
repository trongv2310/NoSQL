import Link from "next/link";

/** Quả cầu lông vẽ bằng SVG, dùng làm họa tiết trôi nhẹ trong banner và trạng thái chờ. */
export function Shuttle({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 170" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="sf-cork" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb061" /><stop offset="1" stopColor="#e25d0f" /></linearGradient>
        <linearGradient id="sf-feather" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#dfeee7" /><stop offset="1" stopColor="#ffffff" /></linearGradient>
      </defs>
      <path d="M46 124 8 28Q60 4 112 28L74 124Z" fill="url(#sf-feather)" />
      <path d="M46 124 8 28M74 124 112 28M53 124 34 17M60 124V10M67 124 86 17" stroke="#b7d3c6" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 28Q60 4 112 28" stroke="#148f5f" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="60" cy="136" rx="19" ry="17" fill="url(#sf-cork)" />
      <path d="M44 128Q60 140 76 128" stroke="#fff" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export interface Crumb { nhan: string; href?: string }

/**
 * Banner đầu trang con: nền gradient + vạch sân, họa tiết cầu lông trôi, breadcrumb, tiêu đề và số liệu.
 * Là server-safe (không dùng hook) nên dùng được ở cả trang server lẫn client.
 */
export function PageHero({ kicker, title, sub, crumbs, stats, aside, tone = "green", compact = false }: {
  kicker?: string; title: React.ReactNode; sub?: React.ReactNode; crumbs?: Crumb[];
  stats?: { value: React.ReactNode; nhan: string }[]; aside?: React.ReactNode; tone?: "green" | "orange" | "navy"; compact?: boolean;
}) {
  return (
    <section className={`sf-hero is-${tone}${compact ? " is-compact" : ""}`}>
      <div className="sf-hero-bg" aria-hidden="true"><i className="sf-hero-glow" /><Shuttle className="sf-hero-shuttle s1" /><Shuttle className="sf-hero-shuttle s2" /></div>
      <div className="container sf-hero-inner">
        <div className="sf-hero-copy">
          {crumbs && crumbs.length > 0 && (
            <nav className="sf-crumbs" aria-label="Đường dẫn">
              {crumbs.map((c, i) => <span key={c.nhan}>{c.href ? <Link href={c.href}>{c.nhan}</Link> : <b aria-current="page">{c.nhan}</b>}{i < crumbs.length - 1 && <i className="fa-solid fa-chevron-right" aria-hidden="true" />}</span>)}
            </nav>
          )}
          {kicker && <span className="sf-kicker">{kicker}</span>}
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
          {stats && stats.length > 0 && <dl className="sf-hero-stats">{stats.map((s) => <div key={s.nhan}><dt>{s.value}</dt><dd>{s.nhan}</dd></div>)}</dl>}
        </div>
        {aside && <div className="sf-hero-aside">{aside}</div>}
      </div>
    </section>
  );
}

/** Khung chờ dạng thẻ sản phẩm, dùng thay cho chữ "Đang tải..." ở lưới sản phẩm. */
export function ProductGridSkeleton({ n = 9, cot = "col-6 col-md-4" }: { n?: number; cot?: string }) {
  return (
    <div className="row g-3" aria-busy="true" aria-label="Đang tải sản phẩm">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={cot}>
          <div className="sf-skel-card"><div className="sf-skel sf-skel-img" /><div className="sf-skel sf-skel-line w-40" /><div className="sf-skel sf-skel-line" /><div className="sf-skel sf-skel-line w-70" /><div className="sf-skel sf-skel-line w-50 big" /></div>
        </div>
      ))}
    </div>
  );
}
