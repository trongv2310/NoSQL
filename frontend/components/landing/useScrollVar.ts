"use client";

import { useEffect, type RefObject } from "react";

/**
 * `hero`    0 → 1 khi cuộn hết chiều cao phần tử, tính từ đầu trang.
 * `section` 0 → 1 khi phần tử cao hơn màn hình (có khung dính bên trong) đi qua màn hình.
 * `pass`    0 → 1 từ lúc mép trên phần tử chạm đáy màn hình tới lúc mép dưới rời đỉnh màn hình.
 */
export type ScrollMode = "hero" | "section" | "pass";

/**
 * Ghi tiến độ cuộn vào biến CSS `--p` (0 → 1) trên chính phần tử. Không dùng React state: mỗi khung hình chỉ đổi một
 * biến CSS, còn dịch chuyển/phóng ảnh/mờ dần do CSS tính. Chế độ `section` và `pass` chỉ lắng nghe cuộn khi phần tử
 * gần màn hình. Giảm chuyển động (kể cả đổi giữa phiên) → `--p` = 0; CSS phải coi `--p` = 0 là trạng thái cuối đọc được.
 *
 * `drift` (chỉ hero, chỉ chuột thật): ghi `--mx`, `--my` ∈ [-1, 1] bám theo con trỏ, làm mượt, để ảnh nền "trôi" nhẹ như
 * máy quay cầm tay. Dừng hẳn khi con trỏ đứng yên hoặc hero đã cuộn đi.
 */
export function useScrollVar(ref: RefObject<HTMLElement | null>, mode: ScrollMode = "hero", drift = false) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const giam = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let cao = el.offsetHeight;
    let cuoi = -1;
    let gan = mode === "hero";

    const tinhP = () => {
      if (mode === "hero") return window.scrollY / cao;
      const r = el.getBoundingClientRect();
      if (mode === "pass") return (window.innerHeight - r.top) / (window.innerHeight + r.height);
      const tong = r.height - window.innerHeight;
      return tong > 0 ? -r.top / tong : 0;
    };
    const ve = () => {
      raf = 0;
      if (!gan) return;
      const p = giam.matches || cao <= 0 ? 0 : Math.min(1, Math.max(0, tinhP()));
      if (Math.abs(p - cuoi) < 0.001) return;
      cuoi = p;
      el.style.setProperty("--p", p.toFixed(3));
    };
    const hen = () => { if (!raf) raf = requestAnimationFrame(ve); };

    const doCao = new ResizeObserver(() => { cao = el.offsetHeight; hen(); });
    doCao.observe(el);
    const quanSat = new IntersectionObserver(([e]) => { gan = e.isIntersecting; if (gan) hen(); }, { rootMargin: "200px 0px" });
    if (mode !== "hero") quanSat.observe(el);
    window.addEventListener("scroll", hen, { passive: true });
    giam.addEventListener("change", hen);

    // Trôi theo con trỏ: rAF chỉ chạy khi còn khoảng cách cần san phẳng.
    let rafTroi = 0;
    let mx = 0, my = 0, tx = 0, ty = 0;
    const troi = () => {
      mx += (tx - mx) * 0.08; my += (ty - my) * 0.08;
      el.style.setProperty("--mx", mx.toFixed(3));
      el.style.setProperty("--my", my.toFixed(3));
      rafTroi = Math.abs(tx - mx) > 0.002 || Math.abs(ty - my) > 0.002 ? requestAnimationFrame(troi) : 0;
    };
    const khiDiChuot = (e: PointerEvent) => {
      if (giam.matches || window.scrollY > cao) { tx = 0; ty = 0; } else {
        tx = (e.clientX / window.innerWidth) * 2 - 1;
        ty = (e.clientY / window.innerHeight) * 2 - 1;
      }
      if (!rafTroi) rafTroi = requestAnimationFrame(troi);
    };
    const dungChuotThat = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (drift && dungChuotThat) window.addEventListener("pointermove", khiDiChuot, { passive: true });

    ve();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (rafTroi) cancelAnimationFrame(rafTroi);
      doCao.disconnect();
      quanSat.disconnect();
      window.removeEventListener("scroll", hen);
      window.removeEventListener("pointermove", khiDiChuot);
      giam.removeEventListener("change", hen);
    };
  }, [ref, mode, drift]);
}
