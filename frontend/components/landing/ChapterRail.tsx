"use client";

import { useEffect, useRef, useState } from "react";
import { cuonToi } from "@/lib/cuon";
import s from "./rail.module.css";

const CHUONG = [
  { id: "hero", nhan: "Mở đầu" },
  { id: "danh-muc", nhan: "Danh mục" },
  { id: "tim-vot", nhan: "Tìm vợt" },
  { id: "san-pham", nhan: "Sản phẩm" },
  { id: "cau-chuyen", nhan: "Câu chuyện" },
  { id: "danh-gia", nhan: "Đánh giá" },
  { id: "ket-thuc", nhan: "Bắt đầu" },
] as const;

/**
 * Thanh chương ở mép phải (chỉ màn hình rộng): chấm cho từng phần của trang, phần đang xem sáng lên, vạch nối đầy dần theo
 * tiến độ cuộn toàn trang, bấm để cuộn mượt tới phần đó. Tiến độ ghi thẳng vào biến CSS, chỉ đổi React state khi sang chương khác.
 * Chỉ liệt kê những phần thực sự có trên trang (vd. khối đánh giá có thể vắng).
 */
export function ChapterRail() {
  const [co, setCo] = useState<{ id: string; nhan: string }[]>([]);
  const [dang, setDang] = useState(0);
  const goc = useRef<HTMLElement>(null);

  useEffect(() => {
    const ds = CHUONG.filter((c) => document.getElementById(c.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCo(ds.map((c) => ({ ...c })));
    const phanTu = ds.map((c) => document.getElementById(c.id) as HTMLElement);

    // Chương đang xem = phần cắt dải ngang giữa màn hình.
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setDang(phanTu.indexOf(e.target as HTMLElement));
    }, { rootMargin: "-45% 0px -45% 0px" });
    phanTu.forEach((el) => io.observe(el));

    let raf = 0;
    const ve = () => {
      raf = 0;
      const cao = document.documentElement.scrollHeight - window.innerHeight;
      goc.current?.style.setProperty("--rail-p", String(cao > 0 ? Math.min(1, window.scrollY / cao) : 0));
    };
    const hen = () => { if (!raf) raf = requestAnimationFrame(ve); };
    window.addEventListener("scroll", hen, { passive: true });
    ve();
    return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); window.removeEventListener("scroll", hen); };
  }, []);

  const di = (id: string) => {
    if (id === "hero") {
      window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return;
    }
    const el = document.getElementById(id);
    if (el) cuonToi(el);
  };

  if (co.length < 2) return null;
  return (
    <nav ref={goc} className={s.rail} aria-label="Các phần của trang chủ">
      <span className={s.line} aria-hidden="true"><i /></span>
      <ul>
        {co.map((c, i) => (
          <li key={c.id}>
            <button type="button" className={s.dot} aria-label={c.nhan} aria-current={dang === i ? "true" : undefined}
              onClick={() => di(c.id)}>
              <span className={s.label}>{c.nhan}</span>
              <i aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
