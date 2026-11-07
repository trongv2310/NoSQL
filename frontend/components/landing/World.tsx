"use client";

import { useEffect, useRef } from "react";
import s from "./world.module.css";

/** Các chương (id phần tử) mà camera đi qua, theo thứ tự. Phải khớp WAY trong engine. */
const CHUONG = ["hero", "tim-vot", "cau-chuyen", "ket-thuc"] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function coWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Thế giới 3D cố định phía sau trang chủ (canvas WebGL, dựng bằng Three.js, tải theo yêu cầu).
 * - Chỉ bật khi thiết bị đủ khả năng: có WebGL, không giảm chuyển động, không tiết kiệm dữ liệu, RAM > 2GB.
 *   Không đủ điều kiện (hoặc lỗi) thì trang giữ nguyên ảnh sân tĩnh của hero và các khối tối; hero luôn hiện ngay từ ảnh này.
 * - Khi cảnh đã vẽ khung đầu tiên mới đặt `data-gl="on"` lên trang để CSS làm các khối tối trong suốt, cảnh hiện ra bằng cross-fade.
 * - Chỉ vẽ khi một khối tối đang trong màn hình; tự giảm độ phân giải khi khung hình chậm, chậm kéo dài thì tự rút về ảnh tĩnh.
 * - `?gl=off` tắt hẳn (xem bản ảnh tĩnh); `?gl=force` bỏ qua cổng thiết bị và việc tự rút lui (để kiểm tra/so sánh trên máy yếu).
 */
export function World({ fontFamily, brands, wordmark }: { fontFamily: string; brands: string[]; wordmark: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const goc = document.querySelector<HTMLElement>("[data-landing]");
    const phan = CHUONG.map((id) => document.getElementById(id));
    if (!canvas || !goc || phan.some((p) => !p)) return;
    const bieu = new URLSearchParams(window.location.search).get("gl");
    const ep = bieu === "force";
    const giam = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (bieu === "off" || !coWebGL()) return;
    if (!ep && (giam.matches || nav.connection?.saveData || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2))) return;

    const nhe = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
    let huy = false;
    let raf = 0;
    let chay = false;
    let world: import("./world/engine").World | null = null;
    let neo: number[] = [];
    let mx = 0, my = 0;
    const thay = phan as HTMLElement[];

    const doKichThuoc = () => {
      const vh = window.innerHeight;
      const max = Math.max(1, document.documentElement.scrollHeight - vh);
      neo = thay.map((el, i) => {
        if (i === 0) return 0;
        if (i === thay.length - 1) return max;
        const r = el.getBoundingClientRect();
        return clamp(r.top + window.scrollY + r.height * 0.5 - vh * 0.5, 0, max);
      });
      for (let i = 1; i < neo.length; i++) neo[i] = Math.max(neo[i], neo[i - 1] + 1);
    };
    const tienDo = (y: number) => {
      if (y <= neo[0]) return 0;
      for (let i = 0; i < neo.length - 1; i++) if (y <= neo[i + 1]) return i + (y - neo[i]) / (neo[i + 1] - neo[i]);
      return neo.length - 1;
    };

    // Theo dõi nhịp khung hình để tự hạ độ phân giải / rút lui.
    let dem = 0, tong = 0, truoc = 0;
    const kiemTra = (now: number) => {
      if (truoc) { dem++; if (dem > 24) tong += now - truoc; }
      truoc = now;
      if (!ep && dem >= 24 + 90 && world) {
        const tb = tong / 90;
        dem = 24; tong = 0;
        if (tb > 27 && world.pixelRatio > 0.8) world.setPixelRatio(Math.max(0.75, world.pixelRatio * 0.8));
        else if (tb > 40) rutLui();
      }
    };

    const khung = (now: number) => {
      raf = requestAnimationFrame(khung);
      if (!world) return;
      world.render(now, tienDo(window.scrollY), mx, my);
      kiemTra(now);
    };
    const bat = () => { if (chay || !world || huy) return; chay = true; truoc = 0; raf = requestAnimationFrame(khung); };
    const tat = () => { chay = false; cancelAnimationFrame(raf); };
    function rutLui() {
      tat();
      goc!.removeAttribute("data-gl");
      world?.dispose();
      world = null;
    }

    // Chỉ vẽ khi có ít nhất một khối tối (hero, tìm vợt, câu chuyện, kết thúc) trong màn hình; các khối sáng che kín canvas.
    const hienThi = new Map<Element, boolean>();
    const io = new IntersectionObserver((es) => {
      for (const e of es) hienThi.set(e.target, e.isIntersecting);
      if ([...hienThi.values()].some(Boolean) && !document.hidden) bat(); else tat();
    }, { rootMargin: "120px 0px" });

    const khiAn = () => { if (document.hidden) tat(); };
    const khiDiChuot = (e: PointerEvent) => { mx = (e.clientX / window.innerWidth) * 2 - 1; my = (e.clientY / window.innerHeight) * 2 - 1; };
    const khiDoiCuaSo = () => { world?.resize(); doKichThuoc(); };
    const ro = new ResizeObserver(() => doKichThuoc());

    (async () => {
      // Chờ trình duyệt rảnh (hero đã hiện, CTA đã bấm được) rồi mới tải và dựng cảnh.
      await new Promise<void>((xong) => {
        if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => xong(), { timeout: 2500 });
        else window.setTimeout(xong, 400);
      });
      if (huy) return;
      try { await document.fonts.load(`800 100px ${fontFamily}`, wordmark); } catch { /* font chưa sẵn thì dùng chữ dự phòng */ }
      const { createWorld } = await import("./world/engine");
      if (huy) return;
      const w = await createWorld({ canvas, fontFamily, brands, wordmark, light: nhe, onContextLost: () => rutLui() });
      if (huy) { w.dispose(); return; }
      world = w;
      w.setPixelRatio(Math.min(window.devicePixelRatio || 1, nhe ? 1.25 : 1.5));
      doKichThuoc();
      w.render(performance.now(), tienDo(window.scrollY), 0, 0); // khung đầu tiên trước khi lộ canvas
      goc.dataset.gl = "on";
      thay.forEach((el) => io.observe(el));
      window.addEventListener("resize", khiDoiCuaSo, { passive: true });
      window.addEventListener("pointermove", khiDiChuot, { passive: true });
      document.addEventListener("visibilitychange", khiAn);
      ro.observe(document.body);
    })().catch(() => rutLui());

    return () => {
      huy = true;
      tat();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", khiDoiCuaSo);
      window.removeEventListener("pointermove", khiDiChuot);
      document.removeEventListener("visibilitychange", khiAn);
      goc.removeAttribute("data-gl");
      world?.dispose();
      world = null;
    };
  }, [fontFamily, brands, wordmark]);

  return <canvas ref={ref} className={s.canvas} aria-hidden="true" />;
}
