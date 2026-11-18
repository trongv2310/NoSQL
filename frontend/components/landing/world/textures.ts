import * as THREE from "three";

/**
 * Mọi texture của thế giới 3D đều vẽ bằng canvas lúc chạy: không tải ảnh nào, không phụ thuộc mạng.
 * Ánh sáng được "nướng" sẵn vào texture (vệt đèn trên sàn, độ tối mép) nên vật liệu cảnh dùng MeshBasic: rẻ và ổn định.
 */

export const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

export function toTexture(c: HTMLCanvasElement, opts: { srgb?: boolean; repeat?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = opts.aniso ?? 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Số ngẫu nhiên có hạt giống: cùng một cảnh mỗi lần tải. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kích thước thật của sân đôi (mét), dùng chung cho texture và hình học. */
export const COURT = { len: 13.4, wid: 6.1, margin: 1.2, singles: 5.18, shortService: 1.98, longServiceDoubles: 0.76 } as const;

/**
 * Mặt sân nhìn từ trên xuống: nền xanh ngọc, vạch trắng đúng kích thước, vũng sáng của các dải đèn trần và mép tối dần.
 * Sàn được vẽ bóng (có phản chiếu) nên texture chỉ mang màu và vệt sáng "nướng sẵn"; phản chiếu do shader sàn lo.
 * Trục canvas: x = bề ngang sân (wid + 2*margin), y = chiều dài (len + 2*margin), y = 0 là đầu xa (−z).
 */
export function courtTexture(maxAniso: number, ppm = 150) {
  const W = COURT.wid + COURT.margin * 2;
  const L = COURT.len + COURT.margin * 2;
  const c = canvas(Math.round(W * ppm), Math.round(L * ppm));
  const g = c.getContext("2d")!;
  const X = (m: number) => (m + W / 2) * ppm; // m: mét từ trục giữa
  const Y = (m: number) => (m + L / 2) * ppm; // m: mét từ tâm sân (âm = đầu xa)

  // nền: viền ngoài xanh đen, vùng đánh xanh ngọc đậm dần về giữa
  g.fillStyle = "#04221a";
  g.fillRect(0, 0, c.width, c.height);
  const inner = g.createLinearGradient(0, Y(-COURT.len / 2), 0, Y(COURT.len / 2));
  inner.addColorStop(0, "#08543b");
  inner.addColorStop(0.5, "#0c6a49");
  inner.addColorStop(1, "#08543b");
  g.fillStyle = inner;
  g.fillRect(X(-COURT.wid / 2), Y(-COURT.len / 2), COURT.wid * ppm, COURT.len * ppm);

  // hạt sàn PU
  const r = rng(7);
  for (let i = 0; i < Math.round(30000 * (ppm / 150) ** 2); i++) {
    g.fillStyle = `rgba(255,255,255,${(r() * 0.03).toFixed(3)})`;
    g.fillRect(r() * c.width, r() * c.height, 1 + r() * 2, 1 + r() * 2);
  }

  // vũng sáng dưới ba hàng đèn trần (cộng sáng)
  g.globalCompositeOperation = "lighter";
  for (const x of [-2.4, 0, 2.4]) {
    const lg = g.createLinearGradient(X(x - 1.5), 0, X(x + 1.5), 0);
    lg.addColorStop(0, "rgba(150,240,200,0)");
    lg.addColorStop(0.5, "rgba(150,240,200,0.12)");
    lg.addColorStop(1, "rgba(150,240,200,0)");
    g.fillStyle = lg;
    g.fillRect(X(x - 1.5), 0, 3 * ppm, c.height);
  }
  for (const x of [-2.4, 0, 2.4]) {
    for (let z = -18; z <= 14; z += 3.4) {
      if (Math.abs(z) > L / 2 + 3) continue;
      const rg = g.createRadialGradient(X(x), Y(z), 0, X(x), Y(z), 2.3 * ppm);
      rg.addColorStop(0, "rgba(200,255,228,0.30)");
      rg.addColorStop(0.5, "rgba(120,220,180,0.10)");
      rg.addColorStop(1, "rgba(120,220,180,0)");
      g.fillStyle = rg;
      g.fillRect(X(x) - 2.3 * ppm, Y(z) - 2.3 * ppm, 4.6 * ppm, 4.6 * ppm);
    }
  }
  g.globalCompositeOperation = "source-over";

  // vạch sân (rộng 4 cm), hơi phát sáng
  const line = (x1: number, z1: number, x2: number, z2: number) => {
    g.beginPath();
    g.moveTo(X(x1), Y(z1));
    g.lineTo(X(x2), Y(z2));
    g.stroke();
  };
  g.lineCap = "butt";
  g.shadowColor = "rgba(190,255,225,0.9)";
  g.shadowBlur = 8;
  g.strokeStyle = "#f4faf6";
  g.lineWidth = 0.05 * ppm;
  const hl = COURT.len / 2, hw = COURT.wid / 2, hs = COURT.singles / 2;
  g.strokeRect(X(-hw), Y(-hl), COURT.wid * ppm, COURT.len * ppm); // biên đôi
  line(-hs, -hl, -hs, hl); line(hs, -hl, hs, hl); // biên đơn
  line(-hw, -hl + COURT.longServiceDoubles, hw, -hl + COURT.longServiceDoubles); // cuối sân đôi (giao cầu)
  line(-hw, hl - COURT.longServiceDoubles, hw, hl - COURT.longServiceDoubles);
  line(-hw, -COURT.shortService, hw, -COURT.shortService); // đường giao cầu ngắn
  line(-hw, COURT.shortService, hw, COURT.shortService);
  line(0, -hl, 0, -COURT.shortService); // đường giữa (nửa xa)
  line(0, COURT.shortService, 0, hl);
  g.shadowBlur = 0;

  // tối dần ra mép để sàn tan vào bóng tối của nhà thi đấu
  const vg = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.14, c.width / 2, c.height / 2, c.height * 0.62);
  vg.addColorStop(0, "rgba(2,12,9,0)");
  vg.addColorStop(1, "rgba(2,12,9,0.82)");
  g.fillStyle = vg;
  g.fillRect(0, 0, c.width, c.height);

  return { texture: toTexture(c, { aniso: maxAniso }), width: W, length: L };
}

/** Sàn nhà thi đấu bao quanh sân (rất tối, chỉ để mặt đất không "hết"). */
export function apronTexture() {
  const c = canvas(256, 256);
  const g = c.getContext("2d")!;
  g.fillStyle = "#04150f";
  g.fillRect(0, 0, 256, 256);
  const r = rng(11);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(120,200,170,${(r() * 0.05).toFixed(3)})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }
  return toTexture(c, { repeat: true });
}

/** Lưới cầu: mắt lưới trắng mảnh trên nền trong suốt, băng trắng ở mép trên. */
export function netTexture() {
  const c = canvas(1024, 160);
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = "rgba(235,246,240,0.55)";
  g.lineWidth = 1.2;
  for (let x = 0; x <= c.width; x += 10) { g.beginPath(); g.moveTo(x, 22); g.lineTo(x, c.height); g.stroke(); }
  for (let y = 22; y <= c.height; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.fillStyle = "#f4faf7";
  g.fillRect(0, 0, c.width, 22); // băng trên
  g.fillStyle = "rgba(255,255,255,0.25)";
  g.fillRect(0, 22, c.width, 4);
  return toTexture(c, { aniso: 8 });
}

/** Bảng quảng cáo ven sân: nền tối, chữ thương hiệu trắng, vạch nhấn cam. */
export function adBoardTexture(text: string, fontFamily: string, accent: string) {
  const c = canvas(1024, 256);
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0, "#0a1f18");
  bg.addColorStop(1, "#04100c");
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = accent;
  g.fillRect(0, 0, 1024, 14);
  g.fillStyle = "#eef7f2";
  g.font = `800 150px ${fontFamily}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text.toUpperCase(), 512, 138);
  return toTexture(c, { aniso: 8 });
}

/** Vầng sáng tròn mềm dùng cho đèn, bụi, tia lửa. */
export function glowTexture(rgb = "255,236,200") {
  const c = canvas(128, 128);
  const g = c.getContext("2d")!;
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, `rgba(${rgb},1)`);
  rg.addColorStop(0.25, `rgba(${rgb},0.45)`);
  rg.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  return toTexture(c);
}

/** Tia sáng dưới đèn: sáng ở đầu trên, tan dần xuống và mờ hai bên. */
export function beamTexture() {
  const c = canvas(64, 256);
  const g = c.getContext("2d")!;
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, "rgba(255,245,225,0.9)");
  v.addColorStop(0.5, "rgba(255,245,225,0.22)");
  v.addColorStop(1, "rgba(255,245,225,0)");
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = "destination-in";
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, "rgba(0,0,0,0)");
  h.addColorStop(0.5, "rgba(0,0,0,1)");
  h.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 256);
  return toTexture(c);
}

/** Tường cuối nhà thi đấu / khán đài: tối, có dải sáng ngang mờ. */
export function wallTexture() {
  const c = canvas(512, 512);
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, "#02100b");
  bg.addColorStop(0.55, "#07241a");
  bg.addColorStop(1, "#03140f");
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(160,230,200,0.05)";
  for (let y = 40; y < 512; y += 64) g.fillRect(0, y, 512, 3);
  const r = rng(23);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,230,190,${(0.15 + r() * 0.35).toFixed(2)})`;
    g.fillRect(r() * 512, 120 + r() * 200, 3, 3); // đèn xa lấp lánh
  }
  return toTexture(c);
}

