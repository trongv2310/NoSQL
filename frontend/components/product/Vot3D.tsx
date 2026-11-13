"use client";

import { useEffect, useRef, useState } from "react";
import { fontTieuDe } from "@/components/landing/fonts";
import { bacCanBang } from "@/lib/landing-data";
import type { ThongSoVotV } from "@/lib/types";
import { DnaVot } from "./DnaVot";
import s from "./bento.module.css";

type Che = "dong" | "mo" | "du-phong";

function coWebgl(): boolean {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

/**
 * Vợt 3D minh họa — chỉ tải three.js và dựng cảnh khi khách bấm "Xem vợt 3D". Không có WebGL, máy yếu (RAM ≤ 2GB, tiết kiệm dữ liệu), bật giảm chuyển động
 * hoặc dựng lỗi/mất ngữ cảnh GPU thì hiện hình DNA SVG thay thế kèm lý do. Đóng khung, rời trang hoặc ẩn tab thì dừng vòng lặp và giải phóng tài nguyên.
 * Mô hình là minh họa chung (không phải bản quét SKU); vòng cam chỉ đánh dấu mức định tính của điểm cân bằng.
 */
export function Vot3D({ ts, nhanPhienBan }: { ts?: ThongSoVotV | null; nhanPhienBan: string }) {
  const [che, setChe] = useState<Che>("dong");
  const [lyDo, setLyDo] = useState<string | null>(null);
  const [dangTai, setDangTai] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bac = bacCanBang(ts ?? null);

  const mo = () => {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setLyDo("Bạn đang bật giảm chuyển động nên shop không chạy cảnh 3D xoay."); setChe("du-phong"); return; }
    if (nav.connection?.saveData || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2)) { setLyDo("Thiết bị đang ở chế độ tiết kiệm nên shop không tải cảnh 3D."); setChe("du-phong"); return; }
    if (!coWebgl()) { setLyDo("Trình duyệt này không hỗ trợ WebGL."); setChe("du-phong"); return; }
    setDangTai(true); setChe("mo");
  };

  useEffect(() => {
    if (che !== "mo") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let huy = false, raf = 0, hien = true;
    let vot: import("./pdp-racket-3d").Vot3D | null = null;
    const lap = (now: number) => { raf = requestAnimationFrame(lap); vot?.render(now); };
    const bat = () => { if (!raf && vot && hien && !document.hidden) raf = requestAnimationFrame(lap); };
    const tat = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    const rutLui = (chu: string) => { tat(); vot?.dispose(); vot = null; if (!huy) { setLyDo(chu); setChe("du-phong"); setDangTai(false); } };
    const io = new IntersectionObserver(([e]) => { hien = e.isIntersecting; if (hien) bat(); else tat(); });
    const ro = new ResizeObserver(() => vot?.resize());
    const khiAn = () => { if (document.hidden) tat(); else bat(); };
    let tuX = 0, tuY = 0, keo = false;
    const xuong = (e: PointerEvent) => { keo = true; tuX = e.clientX; tuY = e.clientY; canvas.setPointerCapture?.(e.pointerId); };
    const di = (e: PointerEvent) => { if (!keo || !vot) return; vot.xoay((e.clientX - tuX) * 0.01, (e.clientY - tuY) * 0.004); tuX = e.clientX; tuY = e.clientY; };
    const len = () => { keo = false; };
    const mat = (e: Event) => { e.preventDefault(); rutLui("Trình duyệt vừa thu hồi GPU của cảnh 3D, nên shop chuyển sang hình minh họa."); };

    (async () => {
      try {
        try { await document.fonts.load(`800 100px ${fontTieuDe.style.fontFamily}`, "MINH HỌA"); } catch { /* dùng chữ dự phòng */ }
        const { taoVot3D } = await import("./pdp-racket-3d");
        if (huy) return;
        const nhe = window.matchMedia("(pointer: coarse)").matches;
        const v = taoVot3D(canvas, { bacCanBang: bac, fontFamily: fontTieuDe.style.fontFamily, nhe });
        if (huy) { v.dispose(); return; }
        vot = v;
        v.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        v.resize();
        v.render(performance.now());
        setDangTai(false);
        io.observe(canvas); ro.observe(canvas);
        document.addEventListener("visibilitychange", khiAn);
        canvas.addEventListener("pointerdown", xuong); canvas.addEventListener("pointermove", di);
        canvas.addEventListener("pointerup", len); canvas.addEventListener("pointercancel", len);
        canvas.addEventListener("webglcontextlost", mat, { once: true });
        (canvas as HTMLCanvasElement & { _vot3d?: typeof v })._vot3d = v;
        bat();
      } catch { rutLui("Không dựng được cảnh 3D trên thiết bị này."); }
    })();

    return () => {
      huy = true;
      tat();
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", khiAn);
      canvas.removeEventListener("pointerdown", xuong); canvas.removeEventListener("pointermove", di);
      canvas.removeEventListener("pointerup", len); canvas.removeEventListener("pointercancel", len);
      canvas.removeEventListener("webglcontextlost", mat);
      delete (canvas as HTMLCanvasElement & { _vot3d?: unknown })._vot3d;
      vot?.dispose();
      vot = null;
    };
  }, [che, bac]);

  const phim = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setChe("dong"); return; } // đóng được cả khi cảnh còn đang dựng
    const v = (canvasRef.current as (HTMLCanvasElement & { _vot3d?: import("./pdp-racket-3d").Vot3D }) | null)?._vot3d;
    if (!v) return;
    if (e.key === "ArrowLeft") { v.xoay(-0.25); e.preventDefault(); }
    else if (e.key === "ArrowRight") { v.xoay(0.25); e.preventDefault(); }
    else if (e.key === "ArrowUp") { v.xoay(0, -0.1); e.preventDefault(); }
    else if (e.key === "ArrowDown") { v.xoay(0, 0.1); e.preventDefault(); }
    else if (e.key === "Home") { v.datLai(); e.preventDefault(); }
  };

  if (che === "dong") {
    return (
      <div className={s.cuoc}>
        <p className={s.ghiChu}>Mô hình 3D minh họa chung của một cây vợt cầu lông, kèm vòng đánh dấu mức điểm cân bằng theo thông số của phiên bản đang chọn. Chỉ tải khi bạn bấm mở.</p>
        <div className={s.hang}><button type="button" className={s.nut} onClick={mo}>Xem vợt 3D (minh họa)</button></div>
      </div>
    );
  }
  if (che === "du-phong") {
    return (
      <div className={s.cuoc}>
        <p className={`${s.thongBao} ${s.thongBaoCanh}`} role="status">{lyDo ?? "Không hiển thị được cảnh 3D."} Dưới đây là hình DNA 2D của phiên bản đang chọn.</p>
        <DnaVot ts={ts} nhanPhienBan={nhanPhienBan} />
        <div className={s.hang}><button type="button" className={s.nut} onClick={() => { setChe("dong"); setLyDo(null); }}>Đóng</button></div>
      </div>
    );
  }
  return (
    <div className={s.cuoc}>
      <div className={s.khung3d} onKeyDown={phim} tabIndex={0} role="group" aria-label="Vợt 3D minh họa. Kéo hoặc dùng phím mũi tên để xoay, Home để đặt lại, Escape để đóng.">
        <canvas ref={canvasRef} aria-hidden="true" />
        {dangTai && <div className={s.du}>Đang dựng cảnh 3D…</div>}
        <p className={s.khung3dChu}>Mô hình minh họa chung, không phải bản quét chính xác của sản phẩm. Vòng cam đánh dấu mức điểm cân bằng theo chữ ghi trong kho (định tính, không phải số mm).</p>
      </div>
      <div className={s.hang}>
        <button type="button" className={s.nut} onClick={() => setChe("dong")}>Đóng 3D</button>
      </div>
    </div>
  );
}
