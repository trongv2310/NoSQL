"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Con số đếm lên khi cuộn tới. Server và lần render đầu luôn là SỐ THẬT (không có số 0 giả); chỉ khi khu nằm dưới màn hình lúc tải xong
 * mới đặt lại 0 (đang ngoài tầm nhìn) rồi đếm lên lúc lộ ra. Giảm chuyển động hoặc khu đã thấy sẵn thì giữ nguyên số thật.
 * Chữ số cùng bề rộng (tabular-nums) nên không làm dịch bố cục.
 */
export function SoDem({ den, className }: { den: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(den);

  useEffect(() => {
    const el = ref.current;
    if (!el || den <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || el.getBoundingClientRect().top < window.innerHeight) return;
    let khung = 0;
    setV(0);
    const quanSat = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      quanSat.disconnect();
      const bd = performance.now();
      const chay = (t: number) => {
        const p = Math.min(1, (t - bd) / 900);
        setV(Math.round(den * (1 - Math.pow(1 - p, 3))));
        if (p < 1) khung = requestAnimationFrame(chay);
      };
      khung = requestAnimationFrame(chay);
    }, { threshold: 0.6 });
    quanSat.observe(el);
    return () => { quanSat.disconnect(); cancelAnimationFrame(khung); setV(den); };
  }, [den]);

  return <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>{v.toLocaleString("vi-VN")}</span>;
}
