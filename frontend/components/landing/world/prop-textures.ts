import * as THREE from "three";
import { canvas, rng, toTexture } from "./textures";

/**
 * Texture cho vợt và quả cầu, vẽ canvas lúc chạy (không tải ảnh ngoài). Vẻ "nhựa" của bản cũ đến từ việc vật liệu
 * phẳng, không có chi tiết bề mặt; ở đây mỗi bộ phận có lớp riêng: vải carbon dưới lớp vecni, nhũ kim loại, quấn cán
 * có lỗ thoáng, lông vũ có sống lông và tơ, da bọc nút bấc có vân.
 */

const linear = (t: THREE.Texture) => { t.colorSpace = THREE.NoColorSpace; return t; };

/** Bản đồ chiều cao của vải carbon dệt chéo 2/2 (xám); dùng để sinh normal map. */
function weaveHeight(size = 96, cell = 6) {
  const c = canvas(size, size);
  const g = c.getContext("2d")!;
  const im = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      const lx = (x % cell) / cell, ly = (y % cell) / cell;
      const warp = (cx + cy) % 4 < 2; // sợi dọc nổi hay sợi ngang nổi
      const round = warp ? Math.sin(lx * Math.PI) : Math.sin(ly * Math.PI); // sợi tròn: giữa cao, mép thấp
      const v = 90 + 120 * round * (warp ? 1 : 0.88);
      const i = (y * size + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

/** Sobel trên bản đồ chiều cao → normal map (lặp biên để tile liền mạch). */
function normalFromHeight(h: HTMLCanvasElement, strength: number) {
  const w = h.width, ht = h.height;
  const src = h.getContext("2d")!.getImageData(0, 0, w, ht).data;
  const c = canvas(w, ht);
  const g = c.getContext("2d")!;
  const out = g.createImageData(w, ht);
  const at = (x: number, y: number) => src[(((y + ht) % ht) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < ht; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  return c;
}

/** Normal map vải carbon (lặp). Lớp vecni bóng phía trên không dùng map này nên vân hiện ra "dưới lớp sơn". */
export function carbonNormalTexture(strength = 3.2) {
  return linear(toTexture(normalFromHeight(weaveHeight(), strength), { srgb: false, repeat: true, aniso: 8 }));
}

/**
 * Sơn thân vợt. u chạy dọc khung từ đáy, ngược chiều kim đồng hồ; v quanh tiết diện (mặt trước ở v = 0,25):
 * nền than chì ngả xanh ngọc ánh kim, nhũ li ti, vệt cam ở cung trên, chữ in dọc hai cạnh.
 */
export function racketPaintTextures(fontFamily: string, label: string) {
  const W = 2048, H = 256;
  const c = canvas(W, H);
  const g = c.getContext("2d")!;
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#07130f");
  base.addColorStop(0.25, "#0f4a35");
  base.addColorStop(0.5, "#05100c");
  base.addColorStop(0.75, "#0f4a35");
  base.addColorStop(1, "#07130f");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const pearl = g.createLinearGradient(0, 0, W, 0);
  pearl.addColorStop(0, "rgba(10,60,42,0)");
  pearl.addColorStop(0.2, "rgba(30,170,112,0.7)");
  pearl.addColorStop(0.5, "rgba(10,60,42,0.15)");
  pearl.addColorStop(0.8, "rgba(30,170,112,0.7)");
  pearl.addColorStop(1, "rgba(10,60,42,0)");
  g.fillStyle = pearl;
  g.fillRect(0, 0, W, H);
  const r = rng(91);
  for (let i = 0; i < 5200; i++) {
    const a = 0.08 + r() * 0.35;
    g.fillStyle = r() < 0.18 ? `rgba(255,170,90,${a})` : `rgba(190,255,225,${a})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 1.6, 1 + r() * 1.6);
  }
  const stripe = (x0: number, x1: number, y0: number, y1: number, col: string) => {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, "rgba(244,105,26,0)");
    gr.addColorStop(0.08, col);
    gr.addColorStop(0.92, col);
    gr.addColorStop(1, "rgba(244,105,26,0)");
    g.fillStyle = gr;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  stripe(W * 0.3, W * 0.7, H * 0.17, H * 0.33, "rgba(244,105,26,0.95)");
  stripe(W * 0.3, W * 0.7, H * 0.67, H * 0.83, "rgba(244,105,26,0.95)");
  stripe(W * 0.34, W * 0.66, H * 0.36, H * 0.4, "rgba(255,255,255,0.85)");
  g.fillStyle = "rgba(238,247,242,0.96)";
  g.textBaseline = "middle";
  g.font = `800 ${Math.round(H * 0.17)}px ${fontFamily}`;
  g.textAlign = "left";
  g.fillText(label, W * 0.075, H * 0.25);
  g.save();
  g.translate(W * 0.925, H * 0.25);
  g.rotate(Math.PI);
  g.textAlign = "left";
  g.fillText(label, 0, 0);
  g.restore();
  g.fillStyle = "rgba(244,105,26,0.98)";
  g.font = `700 ${Math.round(H * 0.1)}px ${fontFamily}`;
  g.textAlign = "left";
  g.fillText("CARBON  ·  5U  ·  G5", W * 0.075, H * 0.405);
  const map = toTexture(c, { aniso: 8 });

  const rc = canvas(256, 64);
  const rg = rc.getContext("2d")!;
  rg.fillStyle = "rgb(70,70,70)";
  rg.fillRect(0, 0, 256, 64);
  const r2 = rng(5);
  for (let i = 0; i < 900; i++) { const v = 40 + r2() * 90; rg.fillStyle = `rgb(${v},${v},${v})`; rg.fillRect(r2() * 256, r2() * 64, 2 + r2() * 3, 2 + r2() * 3); }
  const rough = linear(toTexture(rc, { srgb: false, aniso: 4 }));
  return { map, rough };
}

/** Quấn cán: nền đen mờ có lỗ thoáng, dải xoắn cam mảnh; lặp theo chiều dài (xoắn là đường chéo nên liền mạch). */
export function gripWrapTextures() {
  const S = 128;
  const c = canvas(S, S);
  const g = c.getContext("2d")!;
  g.fillStyle = "#101614";
  g.fillRect(0, 0, S, S);
  const r = rng(33);
  for (let i = 0; i < 800; i++) { g.fillStyle = `rgba(255,255,255,${(r() * 0.05).toFixed(3)})`; g.fillRect(r() * S, r() * S, 1, 1); }
  g.fillStyle = "rgba(0,0,0,0.55)";
  for (let y = 4; y < S; y += 16) for (let x = (y / 16) % 2 ? 4 : 12; x < S; x += 16) { g.beginPath(); g.arc(x, y, 2.1, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#f4691a";
  for (const k of [0, S * 0.5]) {
    g.beginPath();
    g.moveTo(0, k); g.lineTo(S, k + S * 0.5); g.lineTo(S, k + S * 0.5 + 8); g.lineTo(0, k + 8);
    g.closePath();
    g.fill();
  }
  const map = toTexture(c, { repeat: true, aniso: 8 });
  const hc = canvas(S, S);
  const hg = hc.getContext("2d")!;
  hg.fillStyle = "rgb(150,150,150)";
  hg.fillRect(0, 0, S, S);
  hg.fillStyle = "rgb(60,60,60)";
  for (let y = 4; y < S; y += 16) for (let x = (y / 16) % 2 ? 4 : 12; x < S; x += 16) { hg.beginPath(); hg.arc(x, y, 2.6, 0, Math.PI * 2); hg.fill(); }
  const bump = linear(toTexture(hc, { srgb: false, repeat: true, aniso: 4 }));
  return { map, bump };
}

/**
 * Một chiếc lông vũ (u ngang bản lông, v từ gốc lên ngọn): ngà ấm ở gốc, trắng ở ngọn, sống lông và tơ xiên về ngọn.
 * Hình dáng lông do hình học quyết định, texture chỉ lo chi tiết bề mặt.
 */
export function featherTexture() {
  const W = 256, H = 512;
  const c = canvas(W, H);
  const g = c.getContext("2d")!;
  const base = g.createLinearGradient(0, H, 0, 0);
  base.addColorStop(0, "#e6d6ac");
  base.addColorStop(0.35, "#f3ead0");
  base.addColorStop(1, "#fffdf6");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const r = rng(61);
  g.lineCap = "round";
  for (let i = 0; i < 520; i++) {
    const y = r() * H;
    const side = r() < 0.5 ? -1 : 1;
    const len = 40 + r() * 100;
    const ang = 0.55 + r() * 0.35;
    const x0 = W / 2 + side * (r() * 6);
    const x1 = x0 + side * Math.sin(ang) * len;
    const y1 = y - Math.cos(ang) * len;
    g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.25 + r() * 0.35})` : `rgba(140,118,76,${0.06 + r() * 0.12})`;
    g.lineWidth = 0.6 + r() * 1.1;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y1); g.stroke();
  }
  const edge = g.createLinearGradient(0, 0, W, 0);
  edge.addColorStop(0, "rgba(255,255,255,0.45)");
  edge.addColorStop(0.12, "rgba(255,255,255,0)");
  edge.addColorStop(0.88, "rgba(255,255,255,0)");
  edge.addColorStop(1, "rgba(255,255,255,0.45)");
  g.fillStyle = edge;
  g.fillRect(0, 0, W, H);
  const rg = g.createLinearGradient(0, H, 0, 0);
  rg.addColorStop(0, "rgba(176,142,82,0.95)");
  rg.addColorStop(1, "rgba(214,196,150,0.7)");
  g.strokeStyle = rg;
  for (let y = 0; y < H; y += 4) {
    g.lineWidth = 2.2 + (1 - y / H) * 3.2;
    g.beginPath(); g.moveTo(W / 2, y); g.lineTo(W / 2, y + 4.5); g.stroke();
  }
  return toTexture(c, { aniso: 8 });
}

/** Da bọc nút bấc: kem ngà, vân da, đường may dọc, dải đen quanh miệng. `band` = đoạn dải đen theo chiều cao nút (0..1). */
export function corkTextures(band: [number, number]) {
  const W = 256, H = 128;
  const c = canvas(W, H);
  const g = c.getContext("2d")!;
  const base = g.createLinearGradient(0, H, 0, 0);
  base.addColorStop(0, "#e4cfa0");
  base.addColorStop(1, "#f1e4c4");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const r = rng(77);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,248,226,${(r() * 0.28).toFixed(3)})` : `rgba(120,92,50,${(r() * 0.2).toFixed(3)})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2.2, 1 + r() * 1.6);
  }
  g.fillStyle = "rgba(110,84,46,0.5)";
  g.fillRect(0, 0, 2, H);
  g.fillRect(W - 2, 0, 2, H);
  g.fillStyle = "#15120f";
  g.fillRect(0, H * (1 - band[1]), W, H * (band[1] - band[0]));
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.fillRect(0, H * (1 - band[1]), W, 2);
  const map = toTexture(c, { repeat: true, aniso: 8 });
  const hc = canvas(W, H);
  const hg = hc.getContext("2d")!;
  hg.fillStyle = "rgb(140,140,140)";
  hg.fillRect(0, 0, W, H);
  const r2 = rng(78);
  for (let i = 0; i < 3200; i++) { const v = 80 + r2() * 120; hg.fillStyle = `rgb(${v},${v},${v})`; hg.fillRect(r2() * W, r2() * H, 1 + r2() * 2, 1 + r2() * 2); }
  const bump = linear(toTexture(hc, { srgb: false, repeat: true, aniso: 4 }));
  return { map, bump };
}
