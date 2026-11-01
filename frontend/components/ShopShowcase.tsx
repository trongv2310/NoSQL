"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const theoDoiChuyenDong = (cb: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", cb);
  return () => media.removeEventListener("change", cb);
};
const docChuyenDong = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const macDinhChuyenDong = () => true;

const SLIDES = [
  { nhan: "Vợt cầu lông", title: "Làm chủ từng", nhanManh: "đường cầu.", moTa: "Tìm cây vợt hợp lực tay và lối chơi. Khám phá các dòng vợt từ Yonex, Li-Ning, Victor và Mizuno.", anh: "cat-vot.webp", href: "/SanPham/Index?loai=Vot", cta: "Khám phá vợt cầu lông", so: "01", theme: "racket" },
  { nhan: "Giày cầu lông", title: "Vững bước chân.", nhanManh: "Bứt tốc trên sân.", moTa: "Một đôi giày phù hợp cho những pha di chuyển. Xem mẫu, chọn size và kiểm tra tồn kho trước khi mua.", anh: "cat-giay.webp", href: "/SanPham/Index?loai=Giay", cta: "Tìm đôi giày của bạn", so: "02", theme: "shoes" },
  { nhan: "Trang phục & phụ kiện", title: "Sẵn sàng cho", nhanManh: "trận đấu mới.", moTa: "Hoàn thiện bộ đồ ra sân với áo quần, quả cầu và quấn cán. Những lựa chọn nhỏ cho niềm vui chơi cầu mỗi ngày.", anh: "cat-aoquan.webp", href: "/SanPham/Index?loai=AoQuan", cta: "Khám phá trang phục", so: "03", theme: "apparel" },
] as const;

export function ShopShowcase({ thongKe }: { thongKe: { sanPham: number; hang: number; uuDai: number } }) {
  const [slide, setSlide] = useState(0);
  const [dung, setDung] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [hien, setHien] = useState(true);
  const [thongBao, setThongBao] = useState("");
  const giam = useSyncExternalStore(theoDoiChuyenDong, docChuyenDong, macDinhChuyenDong);
  const khung = useRef<HTMLElement>(null);

  useEffect(() => {
    const visibility = () => setHien(!document.hidden && !!khung.current && khung.current.getBoundingClientRect().bottom > 0);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(([entry]) => setHien(entry.isIntersecting && !document.hidden));
    if (khung.current) observer.observe(khung.current);
    // CSS chỉ tăng cường hiệu ứng; mọi nội dung vẫn đọc được khi JS chưa sẵn sàng.
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  const tuChay = !dung && !giam && !hover && !focus && hien;
  useEffect(() => {
    if (!tuChay) return;
    const hen = setTimeout(() => setSlide((n) => (n + 1) % SLIDES.length), 6500);
    return () => clearTimeout(hen);
  }, [slide, tuChay]);

  const chon = (n: number) => {
    const next = (n + SLIDES.length) % SLIDES.length;
    setSlide(next); setThongBao(`${next + 1} / ${SLIDES.length}: ${SLIDES[next].nhan}`);
  };

  return <section ref={khung} className="shop-showcase" aria-roledescription="băng chuyền" aria-label="Khám phá dụng cụ cầu lông"
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocusCapture={() => setFocus(true)}
    onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}>
    <h1 className="visually-hidden">Dụng cụ cầu lông cho trận đấu của bạn</h1>
    <div className="showcase-stage" aria-live="off">
      {SLIDES.map((s, i) => <div key={s.so} className={`showcase-slide showcase-${s.theme}`} hidden={slide !== i} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${SLIDES.length}: ${s.nhan}`}>
        <div className="container showcase-inner">
          <div className="showcase-copy"><span className="showcase-eyebrow">SHOP CẦU LÔNG / {s.nhan}</span><h2>{s.title}<br /><em>{s.nhanManh}</em></h2><p>{s.moTa}</p>
            <div className="showcase-links"><Link href={s.href} className="showcase-primary">{s.cta} <span aria-hidden="true">↗</span></Link><Link href="/KhuyenMai/Index" className="showcase-secondary">Xem ưu đãi</Link></div>
            <dl className="showcase-stats"><div><dt>{thongKe.sanPham}</dt><dd>Sản phẩm</dd></div><div><dt>{thongKe.hang}</dt><dd>Thương hiệu</dd></div><div><dt>{thongKe.uuDai}</dt><dd>Ưu đãi đang chạy</dd></div></dl>
          </div>
          <div className="showcase-art"><span className="showcase-number" aria-hidden="true">{s.so}</span><div className="showcase-photo"><img src={`/images/landing/${s.anh}`} alt={s.nhan} width={720} height={920} loading="eager" /></div><span className="showcase-art-label">CHỌN DỤNG CỤ · CHỌN PHONG CÁCH</span></div>
        </div>
      </div>)}
    </div>
    <div className="container showcase-controls"><div className="showcase-dots" aria-label="Chọn banner">{SLIDES.map((s, i) => <button key={s.so} type="button" onClick={() => chon(i)} aria-current={slide === i ? "true" : undefined} aria-label={`Banner ${i + 1}: ${s.nhan}`}><span>{s.so}</span><i aria-hidden="true" /></button>)}</div>
      <div className="showcase-arrows"><span aria-hidden="true">{String(slide + 1).padStart(2, "0")} / 03</span><button type="button" onClick={() => chon(slide - 1)} aria-label="Banner trước">←</button><button type="button" onClick={() => chon(slide + 1)} aria-label="Banner tiếp theo">→</button><button type="button" disabled={giam} onClick={() => setDung((v) => !v)} aria-label={dung || giam ? "Bật tự chuyển banner" : "Dừng tự chuyển banner"} aria-pressed={dung || giam}><i className={`fa-solid ${dung || giam ? "fa-play" : "fa-pause"}`} aria-hidden="true" /></button></div>
    </div>
    <span className="visually-hidden" role="status">{thongBao}</span>
  </section>;
}

/** Chỉ animate lúc đi vào màn hình, không ẩn sẵn nội dung hay thay đổi chiều cao trang. */
export function ShopMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const running = new Set<Animation>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (media.matches) continue;
        const diChuyen = entry.target.classList.contains("l-head");
        const animation = entry.target.animate([{ opacity: .15, transform: diChuyen ? "translateY(20px)" : "none" }, { opacity: 1, transform: "none" }], { duration: 620, easing: "cubic-bezier(.2,.7,.2,1)" });
        running.add(animation);
        void animation.finished.then(() => running.delete(animation), () => running.delete(animation));
      }
    }, { threshold: .1 });
    root.current?.querySelectorAll(".l-head, .l-cats, .l-budgets, .shop-category-row, .l-products, .l-guides, .l-reviews, .l-brands").forEach((el) => observer.observe(el));
    const stop = () => { if (media.matches) { running.forEach((a) => a.cancel()); running.clear(); } };
    media.addEventListener("change", stop);
    return () => { observer.disconnect(); media.removeEventListener("change", stop); running.forEach((a) => a.cancel()); };
  }, []);
  return <div ref={root}>{children}</div>;
}
