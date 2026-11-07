"use client";

import { useEffect, useRef, useState } from "react";

const giamChuyenDong = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Gắn một lần ở layout của site. Làm ba việc, không đụng tới JSX của từng trang:
 * 1. Đánh dấu `html.sf-js` (CSS chỉ ẩn phần tử chờ hiện khi JS đã chạy, nên không bao giờ mất nội dung).
 * 2. Theo dõi mọi phần tử `.sf-reveal` (kể cả loại xuất hiện sau khi tải dữ liệu) và cho hiện dần khi cuộn tới.
 * 3. Cập nhật thanh tiến trình cuộn và nút "lên đầu trang".
 */
export function SiteMotion() {
  const [nutLen, setNutLen] = useState(false);
  const thanh = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sf-js");
    const giam = giamChuyenDong();

    const quanSat = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        quanSat.unobserve(el);
        el.classList.add("is-in");
        // Gỡ lớp sau khi xong để không đè transform của hiệu ứng hover (thẻ sản phẩm nhấc lên...).
        window.setTimeout(() => el.classList.remove("sf-reveal", "is-in"), giam ? 0 : 1100);
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });

    // Cờ nằm trong vòng đời effect (không để trên DOM) để Strict Mode chạy effect hai lần vẫn quan sát lại đủ phần tử.
    const daThay = new WeakSet<Element>();
    const quet = (nut: ParentNode) => {
      const ds = nut instanceof Element && nut.matches(".sf-reveal") ? [nut as HTMLElement] : [];
      nut.querySelectorAll?.<HTMLElement>(".sf-reveal").forEach((el) => ds.push(el));
      for (const el of ds) {
        if (daThay.has(el)) continue;
        daThay.add(el);
        if (giam) { el.classList.remove("sf-reveal"); continue; }
        // Độ trễ theo thứ tự anh em để lưới thẻ hiện lần lượt thay vì cùng lúc.
        const anhEm = el.parentElement ? Array.from(el.parentElement.children).filter((c) => c.classList.contains("sf-reveal")) : [];
        const i = Math.max(0, anhEm.indexOf(el));
        el.style.setProperty("--sf-delay", `${Math.min(i, 9) * 70}ms`);
        quanSat.observe(el);
      }
    };
    quet(document.body);
    const theoDoi = new MutationObserver((ds) => { for (const d of ds) d.addedNodes.forEach((n) => { if (n instanceof Element) quet(n); }); });
    theoDoi.observe(document.body, { childList: true, subtree: true });

    let cho = false;
    const capNhat = () => {
      cho = false;
      const cao = document.documentElement.scrollHeight - innerHeight;
      const tiLe = cao > 0 ? Math.min(1, scrollY / cao) : 0;
      thanh.current?.style.setProperty("--sf-progress", String(tiLe));
      setNutLen(scrollY > 700);
      root.classList.toggle("sf-scrolled", scrollY > 24);
    };
    const khiCuon = () => { if (!cho) { cho = true; requestAnimationFrame(capNhat); } };
    capNhat();
    // Chiều cao header thay đổi khi cuộn (thanh trên cùng thu lại); các thanh dính bám theo biến này.
    const header = document.querySelector<HTMLElement>(".main-header");
    const doCao = header ? new ResizeObserver(() => root.style.setProperty("--sf-header-h", `${Math.round(header.getBoundingClientRect().height)}px`)) : null;
    if (header) doCao?.observe(header);
    addEventListener("scroll", khiCuon, { passive: true });
    addEventListener("resize", khiCuon);
    return () => {
      root.classList.remove("sf-js", "sf-scrolled");
      quanSat.disconnect(); theoDoi.disconnect(); doCao?.disconnect();
      removeEventListener("scroll", khiCuon); removeEventListener("resize", khiCuon);
    };
  }, []);

  return (
    <>
      <div ref={thanh} className="sf-progress" aria-hidden="true"><i /></div>
      <button type="button" className={`sf-to-top${nutLen ? " is-show" : ""}`} aria-label="Lên đầu trang" tabIndex={nutLen ? 0 : -1}
        onClick={() => scrollTo({ top: 0, behavior: giamChuyenDong() ? "auto" : "smooth" })}>
        <i className="fa-solid fa-arrow-up" aria-hidden="true" />
      </button>
    </>
  );
}

/** Đếm số tăng dần khi cuộn tới (dùng cho thống kê). Giá trị cuối luôn được hiển thị đúng, kể cả khi giảm chuyển động. */
export function CountUp({ to, className }: { to: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [gt, setGt] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || giamChuyenDong()) return;
    let raf = 0;
    const quanSat = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      quanSat.disconnect();
      const bat = performance.now();
      const chay = (t: number) => {
        const k = Math.min(1, (t - bat) / 1100);
        setGt(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(chay);
      };
      setGt(0);
      raf = requestAnimationFrame(chay);
    }, { threshold: 0.4 });
    quanSat.observe(el);
    return () => { quanSat.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref} className={className}>{gt.toLocaleString("vi-VN")}</span>;
}

/** Đồng hồ đếm ngược tới một thời điểm thật (ngày kết thúc khuyến mãi). Chỉ vẽ sau khi mount để không lệch SSR. */
export function Countdown({ den, className = "" }: { den: string | Date | null | undefined; className?: string }) {
  const [con, setCon] = useState<number | null>(null);
  useEffect(() => {
    if (!den) return;
    const dich = new Date(den).getTime();
    const tick = () => setCon(Math.max(0, dich - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [den]);
  if (con === null) return <div className={`sf-countdown ${className}`} aria-hidden="true" />;
  const giay = Math.floor(con / 1000);
  const o = [
    [Math.floor(giay / 86400), "Ngày"], [Math.floor((giay % 86400) / 3600), "Giờ"],
    [Math.floor((giay % 3600) / 60), "Phút"], [giay % 60, "Giây"],
  ] as const;
  return (
    <div className={`sf-countdown ${className}`} role="timer" aria-label={`Còn ${o[0][0]} ngày ${o[1][0]} giờ ${o[2][0]} phút`}>
      {o.map(([n, nhan]) => <div key={nhan}><b>{String(n).padStart(2, "0")}</b><span>{nhan}</span></div>)}
    </div>
  );
}

/** Nghiêng 3D nhẹ theo con trỏ; tắt khi giảm chuyển động hoặc thiết bị cảm ứng. */
export function Tilt({ children, className = "", max = 7 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const dichuyen = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || giamChuyenDong()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--tilt-x", `${(-y * max).toFixed(2)}deg`);
    el.style.setProperty("--tilt-y", `${(x * max).toFixed(2)}deg`);
    el.style.setProperty("--glow-x", `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--glow-y", `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const roi = () => { ref.current?.style.removeProperty("--tilt-x"); ref.current?.style.removeProperty("--tilt-y"); };
  return <div ref={ref} className={`sf-tilt ${className}`} onPointerMove={dichuyen} onPointerLeave={roi}>{children}</div>;
}
