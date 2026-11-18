"use client";

import { useEffect, useRef } from "react";
import s from "./landing.module.css";

/**
 * Cây vợt 3D "sống" trong ô Vợt cầu lông (thay ảnh tĩnh). Chỉ bật khi thiết bị đủ khả năng (có WebGL, không giảm chuyển động,
 * không tiết kiệm dữ liệu, RAM > 2GB, màn hình ≥ 768px) và chỉ vẽ khi ô đang trong màn hình; mọi trường hợp khác giữ ảnh sản phẩm.
 * Khi đã vẽ khung đầu thì đặt `data-live="1"` lên thẻ liên kết cha để CSS đổi sang giao diện nền tối. `?gl=off` tắt, `?gl=force` bỏ qua cổng.
 */
export function RacketLive({ fontFamily }: { fontFamily: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const o = canvas?.closest<HTMLElement>("a");
    if (!canvas || !o) return;
    const bieu = new URLSearchParams(window.location.search).get("gl");
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const ep = bieu === "force";
    if (bieu === "off" || window.innerWidth < 768) return;
    if (!ep && (window.matchMedia("(prefers-reduced-motion: reduce)").matches || nav.connection?.saveData || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2))) return;
    try { const c = document.createElement("canvas"); if (!c.getContext("webgl2") && !c.getContext("webgl")) return; } catch { return; }

    let huy = false, raf = 0, hien = false;
    let live: import("./world/live-racket").LiveRacket | null = null;

    const lap = (now: number) => { raf = requestAnimationFrame(lap); live?.render(now); };
    const bat = () => { if (!raf && live && hien && !document.hidden) raf = requestAnimationFrame(lap); };
    const tat = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    const rutLui = () => { tat(); delete o.dataset.live; live?.dispose(); live = null; };

    const io = new IntersectionObserver(([e]) => { hien = e.isIntersecting; if (hien) bat(); else tat(); }, { rootMargin: "80px" });
    const ro = new ResizeObserver(() => live?.resize());
    const diChuot = (e: PointerEvent) => {
      if (!live || e.pointerType !== "mouse") return;
      const r = o.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width * 0.9), ny = (e.clientY - (r.top + r.height / 2)) / (r.height * 0.9);
      const gan = Math.hypot(nx, ny) < 1.6; // xa quá thì thả về tư thế nghỉ
      live.setPointer(gan ? Math.max(-1, Math.min(1, nx)) : 0, gan ? Math.max(-1, Math.min(1, ny)) : 0);
    };
    const vao = () => live?.setHover(true);
    const ra = () => live?.setHover(false);
    const khiAn = () => { if (document.hidden) tat(); else bat(); };

    (async () => {
      await new Promise<void>((xong) => {
        if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => xong(), { timeout: 3000 });
        else window.setTimeout(xong, 600);
      });
      if (huy) return;
      try { await document.fonts.load(`800 100px ${fontFamily}`, "SHOP CẦU LÔNG"); } catch { /* dùng chữ dự phòng */ }
      const { createLiveRacket } = await import("./world/live-racket");
      if (huy) return;
      const light = window.matchMedia("(pointer: coarse)").matches;
      const l = createLiveRacket(canvas, fontFamily, light);
      if (huy) { l.dispose(); return; }
      live = l;
      l.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      l.resize();
      l.render(performance.now());
      o.dataset.live = "1";
      io.observe(canvas);
      ro.observe(canvas);
      window.addEventListener("pointermove", diChuot, { passive: true });
      o.addEventListener("pointerenter", vao);
      o.addEventListener("pointerleave", ra);
      document.addEventListener("visibilitychange", khiAn);
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); rutLui(); }, { once: true });
    })().catch(() => rutLui());

    return () => {
      huy = true;
      tat();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", diChuot);
      o.removeEventListener("pointerenter", vao);
      o.removeEventListener("pointerleave", ra);
      document.removeEventListener("visibilitychange", khiAn);
      delete o.dataset.live;
      live?.dispose();
      live = null;
    };
  }, [fontFamily]);

  return <canvas ref={ref} className={s.live} aria-hidden="true" />;
}
