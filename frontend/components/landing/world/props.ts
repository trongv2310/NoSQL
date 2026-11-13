import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { carbonNormalTexture, corkTextures, featherTexture, gripWrapTextures, racketPaintTextures } from "./prop-textures";
import { rng } from "./textures";

/**
 * Vật thể 3D ở tiền cảnh: vợt và quả cầu, dựng từ hình học (tiết diện quét theo đường cong, tiện, dải lông) với vật liệu vật lý
 * (vecni, vải carbon, lông vũ có sheen). Kích thước tính bằng mét rồi nhân hệ số cho vừa cảnh, tỷ lệ theo vật thật:
 * vợt dài ≈ 675 mm (đầu 290, khớp chữ T 40, trục 150, cán 190), quả cầu dài ≈ 87 mm (nút 26, váy lông 64, miệng Ø 69).
 */

export interface PropAssets {
  envMap: THREE.Texture | null;
  disposables: { dispose(): void }[];
  fontFamily: string;
  /** Thiết bị yếu: bớt phân đoạn, dùng vật liệu rẻ hơn. */
  light: boolean;
}

const track = <T extends { dispose(): void }>(a: PropAssets, x: T): T => { a.disposables.push(x); return x; };

const TAU = Math.PI * 2;
const sgn = Math.sign;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth01 = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

/** 1 mét = bao nhiêu đơn vị cảnh: vợt dài ≈ 2,3 đơn vị. */
export const RACKET_SCALE = 3.4;
/** Quả cầu thật 87 mm → ≈ 0,96 đơn vị. */
export const SHUTTLE_SCALE = 11;

/* ───────────── Môi trường phản chiếu: phòng chụp sản phẩm tối với vài đèn dải ───────────── */

/** Cảnh phản chiếu cho vật liệu bóng: nền tối, đèn dải trắng làm "vệt sáng" trên vecni, đèn cam và xanh ngọc làm viền màu. */
export function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 14, 24), new THREE.MeshBasicMaterial({ color: 0x040807, side: THREE.BackSide }));
  scene.add(room);
  const panel = (w: number, h: number, pos: [number, number, number], rgb: [number, number, number], k: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0] * k, rgb[1] * k, rgb[2] * k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel(9, 2.2, [-4, 6.3, 4], [1, 0.97, 0.92], 9); // đèn chính trên cao, hơi lệch trái
  panel(1.4, 11, [-9.5, 0.5, 1], [0.9, 1, 0.96], 5); // dải đứng bên trái → vệt dọc theo khung
  panel(1.1, 10, [9.5, 0.5, -2], [1, 0.62, 0.3], 7); // dải cam bên phải
  panel(8, 1.6, [2, -5.2, 5], [0.35, 1, 0.7], 3.2); // phản xạ sàn xanh ngọc phía dưới
  panel(6, 3, [0, 3, -10], [0.8, 0.95, 1], 2.4); // nền sau
  panel(14, 7, [0.5, 1, 10], [0.92, 1, 0.97], 1.9); // hộp sáng lớn phía sau người xem → mặt trước vợt không bị đen
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.03);
  pm.dispose();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    (m.material as THREE.Material | undefined)?.dispose();
  });
  return rt;
}

/* ───────────── Hình học dùng chung ───────────── */

interface Ring { y: number; hw: number; hd: number; n?: number }

/**
 * Quét các tiết diện (siêu elip, nửa rộng hw theo x, nửa sâu hd theo z) dọc trục y: trục vợt, cán, nút bấc.
 * v = quãng đường dọc theo hình (hoặc y nếu `vMode = "y"`), u quanh tiết diện; pháp tuyến tính lại và hàn mép nối.
 */
function loft(rings: Ring[], seg: number, o: { vMode?: "y"; uRep?: number; vRep?: number; capBottom?: boolean; capTop?: boolean } = {}) {
  const uRep = o.uRep ?? 1, vRep = o.vRep ?? 1;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const along: number[] = [0];
  for (let i = 1; i < rings.length; i++) along.push(along[i - 1] + Math.hypot(rings[i].y - rings[i - 1].y, rings[i].hw - rings[i - 1].hw));
  const total = along[along.length - 1] || 1;
  const yMin = rings[0].y, yMax = rings[rings.length - 1].y;
  const section = (R: Ring, k: number): [number, number] => {
    const e = 2 / (R.n ?? 2), a = (k / seg) * TAU, c = Math.cos(a), s = Math.sin(a);
    return [R.hw * sgn(c) * Math.abs(c) ** e, R.hd * sgn(s) * Math.abs(s) ** e];
  };
  rings.forEach((R, i) => {
    for (let k = 0; k <= seg; k++) {
      const [x, z] = section(R, k);
      pos.push(x, R.y, z);
      const v = o.vMode === "y" ? (R.y - yMin) / (yMax - yMin || 1) : along[i] / total;
      uv.push((k / seg) * uRep, v * vRep);
    }
  });
  const row = seg + 1;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const a = i * row + k, b = a + 1, c = a + row + 1, d = a + row;
      idx.push(a, c, b, a, d, c);
    }
  }
  const ringVerts = pos.length / 3;
  // nắp phẳng: tâm + vành riêng (pháp tuyến phẳng)
  const cap = (R: Ring, up: boolean) => {
    const base = pos.length / 3;
    pos.push(0, R.y, 0); uv.push(0.5, 0.5);
    for (let k = 0; k <= seg; k++) {
      const [x, z] = section(R, k);
      pos.push(x, R.y, z); uv.push(0.5 + 0.5 * Math.cos((k / seg) * TAU), 0.5 + 0.5 * Math.sin((k / seg) * TAU));
    }
    for (let k = 0; k < seg; k++) idx.push(base, up ? base + 1 + k : base + 2 + k, up ? base + 2 + k : base + 1 + k);
  };
  if (o.capBottom) cap(rings[0], false);
  if (o.capTop) cap(rings[rings.length - 1], true);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nr = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < rings.length; i++) { // hàn mép nối u = 0 / 1 cho liền mạch
    const p = i * row, q = p + seg;
    if (q >= ringVerts) continue;
    const x = nr.getX(p) + nr.getX(q), y = nr.getY(p) + nr.getY(q), z = nr.getZ(p) + nr.getZ(q), l = Math.hypot(x, y, z) || 1;
    nr.setXYZ(p, x / l, y / l, z / l);
    nr.setXYZ(q, x / l, y / l, z / l);
  }
  return g;
}

/** Thanh tròn nhỏ nằm trong mặt phẳng xy (dây vợt), thêm trực tiếp vào bộ đệm. Chia `segs` đoạn để sợi dây uốn được khi chạm cầu. */
function addBar(buf: { pos: number[]; nor: number[]; idx: number[] }, x0: number, y0: number, x1: number, y1: number, z: number, r: number, sides = 5, segs = 1) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  const px = -dy / l, py = dx / l; // vuông góc trong mặt phẳng xy; trục thứ hai là z
  const base = buf.pos.length / 3;
  for (let i = 0; i <= segs; i++) {
    const x = lerp(x0, x1, i / segs), y = lerp(y0, y1, i / segs);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * TAU, c = Math.cos(a), s = Math.sin(a);
      buf.pos.push(x + px * c * r, y + py * c * r, z + s * r);
      buf.nor.push(px * c, py * c, s);
    }
  }
  for (let i = 0; i < segs; i++) {
    const b0 = base + i * sides, b1 = b0 + sides;
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      buf.idx.push(b0 + k, b1 + k, b0 + k2, b0 + k2, b1 + k, b1 + k2);
    }
  }
}

/* ───────────── Vợt cầu lông ───────────── */

/** Đường viền đầu vợt (mét), bắt đầu ở đáy, đi ngược chiều kim đồng hồ: siêu elip hơi vuông ở trên, thon dần xuống khớp chữ T. */
function headOutline(n: number, a: number, b: number) {
  const e = 2 / 2.35;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i / n) * TAU;
    const c = Math.cos(ang), s = Math.sin(ang);
    let x = a * sgn(c) * Math.abs(c) ** e;
    const y = b * sgn(s) * Math.abs(s) ** e;
    if (y < 0) { const k = -y / b; x *= 1 - 0.26 * k * k; }
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Vợt: khung đầu thon liền một khối với khớp chữ T, trục đi thẳng từ khớp xuống cán (không có hai nhánh chữ V).
 * Có ống cao su cam ở cung trên, mắt vợt 20 × 24 sợi bằng hình học thật, núm xỏ dây, quấn cán có lỗ thoáng, nắp cuối cán.
 * Gốc tọa độ ở tâm đầu vợt, đầu vợt ở +y, mặt vợt nằm trong mặt phẳng xy.
 */
export interface RacketStrings {
  /** Tâm điểm chạm (mét, hệ tọa độ vợt), độ lõm hiện tại (mét; dương = mặt cước võng ra phía sau) và bán kính ảnh hưởng. */
  uniforms: { uHit: { value: THREE.Vector2 }; uDent: { value: number }; uSig: { value: number } };
}

/** `matte`: vật liệu mờ (bớt bóng nhựa) cho trang chi tiết; `nhan`: chữ minh họa trên khung (mặc định dành cho cảnh cũ). */
export interface RacketOpts { matte?: boolean; nhan?: string }

export function buildRacket(a: PropAssets, opts: RacketOpts = {}) {
  const g = new THREE.Group();
  const light = a.light;
  const matte = !!opts.matte;

  const HA = 0.1085, HB = 0.1385; // nửa rộng / nửa cao đường tâm khung
  const near = (u: number) => 1 - smooth01(Math.min(u, 1 - u) / 0.1);
  const aF = (u: number) => 0.0068 + 0.003 * near(u); // nửa dày trong mặt phẳng
  const bF = (u: number) => 0.0105 - 0.0012 * near(u); // nửa sâu (vuông góc mặt vợt)
  const N = light ? 140 : 220;
  const outline = headOutline(N, HA, HB);

  // pháp tuyến hướng ra ngoài tại mỗi điểm đường tâm
  const nx: number[] = [], ny: number[] = [];
  for (let i = 0; i < N; i++) {
    const p = outline[(i + N - 1) % N], q = outline[(i + 1) % N];
    const tx = q.x - p.x, ty = q.y - p.y, l = Math.hypot(tx, ty) || 1;
    nx.push(ty / l); ny.push(-tx / l);
  }

  /** Quét tiết diện elip dọc đường khung; phi0..phi1 chọn cung tiết diện, u0..u1 chọn đoạn khung (theo chỉ số). */
  const sweep = (i0: number, i1: number, segPhi: number, phi0: number, phi1: number, grow = 1, growZ = 1) => {
    const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
    const rowsN = i1 - i0 + 1;
    for (let i = i0; i <= i1; i++) {
      const j = ((i % N) + N) % N, u = i / N;
      const p = outline[j];
      const A = aF(((u % 1) + 1) % 1) * grow, B = bF(((u % 1) + 1) % 1) * growZ;
      for (let k = 0; k <= segPhi; k++) {
        const ph = lerp(phi0, phi1, k / segPhi);
        const c = Math.cos(ph), s = Math.sin(ph);
        pos.push(p.x + nx[j] * A * c, p.y + ny[j] * A * c, B * s);
        const qx = (nx[j] * c) / A, qy = (ny[j] * c) / A, qz = s / B, l = Math.hypot(qx, qy, qz) || 1;
        nor.push(qx / l, qy / l, qz / l);
        uv.push(u, ph / TAU);
      }
    }
    const row = segPhi + 1;
    for (let i = 0; i < rowsN - 1; i++) for (let k = 0; k < segPhi; k++) {
      const p = i * row + k, q = p + 1, r = p + row + 1, s = p + row;
      idx.push(p, q, r, p, r, s);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    return geo;
  };

  // ── vật liệu
  const paint = racketPaintTextures(a.fontFamily, opts.nhan ?? "SHOP CẦU LÔNG");
  track(a, paint.map); track(a, paint.rough);
  const weave = track(a, carbonNormalTexture());
  const weaveFrame = weave.clone();
  weaveFrame.repeat.set(70, 5);
  weaveFrame.needsUpdate = true;
  const weaveShaft = weave.clone();
  weaveShaft.repeat.set(5, 26);
  weaveShaft.needsUpdate = true;
  track(a, weaveFrame); track(a, weaveShaft);
  const Phys = light ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const frameMat = track(a, new Phys({
    map: paint.map, roughnessMap: paint.rough, roughness: matte ? 0.84 : 0.62, metalness: matte ? 0.06 : 0.28,
    normalMap: weaveFrame, normalScale: new THREE.Vector2(0.55, 0.55),
    envMap: a.envMap, envMapIntensity: matte ? 0.7 : 1.5,
    ...(light || matte ? {} : { clearcoat: 1, clearcoatRoughness: 0.05 }),
  } as THREE.MeshStandardMaterialParameters));
  const carbonMat = track(a, new Phys({
    color: 0x0c1411, roughness: matte ? 0.72 : 0.34, metalness: matte ? 0.18 : 0.55,
    normalMap: weaveShaft, normalScale: new THREE.Vector2(0.5, 0.5),
    envMap: a.envMap, envMapIntensity: matte ? 0.6 : 1.4,
    ...(light || matte ? {} : { clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  } as THREE.MeshStandardMaterialParameters));
  const bumperMat = track(a, new THREE.MeshStandardMaterial({ color: 0xf4691a, roughness: 0.46, metalness: 0.05, emissive: 0x3d1400, envMap: a.envMap, envMapIntensity: 0.9 }));
  const stringMat = track(a, new THREE.MeshStandardMaterial({ color: 0xdff3e6, roughness: 0.3, metalness: 0.0, emissive: 0x16241c, envMap: a.envMap, envMapIntensity: 1.2 }));
  // Mặt cước võng quanh điểm chạm cầu: đẩy đỉnh ra sau theo đường cong Gauss. Giá trị do engine ghi mỗi khung hình.
  const dent = { uHit: { value: new THREE.Vector2(0, 0.004) }, uDent: { value: 0 }, uSig: { value: 0.042 } };
  stringMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, dent);
    sh.vertexShader = "uniform vec2 uHit; uniform float uDent; uniform float uSig;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n vec2 dh = position.xy - uHit; transformed.z -= uDent * exp(-dot(dh, dh) / (uSig * uSig));",
    );
  };
  g.userData.strings = { uniforms: dent } satisfies RacketStrings;

  // ── khung đầu vợt (khép kín, u chạy từ đáy)
  const frame = new THREE.Mesh(track(a, sweep(0, N, light ? 10 : 16, 0, TAU)), frameMat);
  g.add(frame);
  // ống cao su ở cung trên: bọc mặt ngoài khung, nổi hơn một chút
  const bump = new THREE.Mesh(track(a, sweep(Math.round(N * 0.335), Math.round(N * 0.665), 12, -1.45, 1.45, 1.1, 1.1)), bumperMat);
  g.add(bump);

  // ── khớp chữ T liền với đáy khung rồi thu nhỏ thành trục
  const yJoin = -HB + 0.004, yEnd = -HB - 0.0092 - 0.04;
  const tj: Ring[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, y = lerp(yJoin, yEnd, t);
    tj.push({ y, hw: 0.0043 + (0.015 - 0.0043) * (1 - t) ** 2.2, hd: 0.0043 + (0.0098 - 0.0043) * (1 - t) ** 1.6, n: lerp(2.7, 2, t) });
  }
  g.add(new THREE.Mesh(track(a, loft(tj, light ? 14 : 22)), carbonMat));

  // ── trục
  const shaft = loft([{ y: yEnd, hw: 0.0043, hd: 0.0043 }, { y: -0.34, hw: 0.0041, hd: 0.0041 }], 16);
  g.add(new THREE.Mesh(track(a, shaft), carbonMat));

  // ── mắt vợt: dây dọc/ngang bằng hình học thật, cắt theo đường viền trong của khung
  const inner = headOutline(N, HA - 0.0074, HB - 0.0074 - 0.003);
  const hits = (axis: "x" | "y", v: number) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < inner.length; i++) {
      const p = inner[i], q = inner[(i + 1) % inner.length];
      const [p0, q0, p1, q1] = axis === "x" ? [p.x, q.x, p.y, q.y] : [p.y, q.y, p.x, q.x];
      if ((p0 - v) * (q0 - v) > 0 || p0 === q0) continue;
      const w = (v - p0) / (q0 - p0), o = lerp(p1, q1, w);
      lo = Math.min(lo, o); hi = Math.max(hi, o);
    }
    return lo < hi ? [lo, hi] as const : null;
  };
  const sb = { pos: [] as number[], nor: [] as number[], idx: [] as number[] };
  const ends: [number, number][] = [];
  const MAINS = 20, CROSS = 24, ySh = 0.004, rS = 0.0007, ext = 0.0016;
  for (let i = 0; i < MAINS; i++) {
    const x = (i - (MAINS - 1) / 2) * 0.0098, h = hits("x", x);
    if (!h) continue;
    addBar(sb, x, h[0] - ext, x, h[1] + ext, i % 2 ? 0.0005 : -0.0005, rS, light ? 4 : 6, light ? 8 : 18);
    ends.push([x, h[0]], [x, h[1]]);
  }
  for (let j = 0; j < CROSS; j++) {
    const y = ySh + (j - (CROSS - 1) / 2) * 0.0105, h = hits("y", y);
    if (!h) continue;
    addBar(sb, h[0] - ext, y, h[1] + ext, y, j % 2 ? -0.0005 : 0.0005, rS, light ? 4 : 6, light ? 8 : 18);
    ends.push([h[0], y], [h[1], y]);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(sb.pos, 3));
  sg.setAttribute("normal", new THREE.Float32BufferAttribute(sb.nor, 3));
  sg.setIndex(sb.idx);
  g.add(new THREE.Mesh(track(a, sg), stringMat));

  // núm xỏ dây dọc mép trong khung
  const eye = new THREE.InstancedMesh(track(a, new THREE.SphereGeometry(0.0013, 6, 4)), bumperMat, ends.length);
  const m4 = new THREE.Matrix4();
  ends.forEach(([x, y], i) => { m4.makeScale(1, 1, 2.2).setPosition(x, y, 0); eye.setMatrixAt(i, m4); });
  g.add(eye);

  // ── cán: quấn cán tròn góc (bát giác bo), nắp cuối
  const wrap = gripWrapTextures();
  track(a, wrap.map); track(a, wrap.bump);
  const gripMat = track(a, new THREE.MeshStandardMaterial({ map: wrap.map, bumpMap: wrap.bump, bumpScale: 1.2, roughness: 0.82, metalness: 0, envMap: a.envMap, envMapIntensity: 0.5 }));
  const gr: Ring[] = [
    { y: -0.327, hw: 0.0046, hd: 0.0046, n: 2 },
    { y: -0.338, hw: 0.0102, hd: 0.0094, n: 3 },
    { y: -0.4, hw: 0.0128, hd: 0.0112, n: 3.2 },
    { y: -0.48, hw: 0.0143, hd: 0.0122, n: 3.2 },
    { y: -0.515, hw: 0.0157, hd: 0.0133, n: 3.2 },
    { y: -0.5235, hw: 0.0163, hd: 0.0138, n: 3.2 },
  ];
  g.add(new THREE.Mesh(track(a, loft(gr, 24, { uRep: 3, vRep: 7 })), gripMat));
  const cap = loft([
    { y: -0.5235, hw: 0.0166, hd: 0.0141, n: 3.2 },
    { y: -0.5275, hw: 0.0168, hd: 0.0143, n: 3.2 },
    { y: -0.5305, hw: 0.0152, hd: 0.0129, n: 3 },
  ], 24, { capBottom: true });
  g.add(new THREE.Mesh(track(a, cap), carbonMat));

  g.scale.setScalar(RACKET_SCALE);
  return g;
}

/* ───────────── Quả cầu lông ───────────── */

export interface ShuttleParts { geometry: THREE.BufferGeometry; materials: THREE.Material[] }

/**
 * Quả cầu: nút bấc bọc da (có dải đen), 16 lông vũ xếp chồng như vảy (mỗi lông cong theo mặt nón, nghiêng quanh sống lông),
 * sống lông nổi, hai vòng chỉ buộc đan qua các sống. Nút ở −y, miệng váy ở +y, gốc tọa độ giữa chiều cao.
 * Trả hình học gộp 4 nhóm (nút, lông, sống lông, chỉ) + vật liệu để dùng cho Mesh hoặc InstancedMesh.
 */
export function buildShuttleParts(a: PropAssets): ShuttleParts {
  const light = a.light;
  const rand = rng(17);
  const Y0 = 0.0204, Y1 = 0.0875, R0 = 0.0108, R1 = 0.0345; // gốc/ngọn lông (m)
  const NF = 16, NS = light ? 9 : 14, NC = 6;

  // nút bấc
  const corkTop = 0.0204;
  const corkRings: Ring[] = [[0, 0.0002], [0.0008, 0.005], [0.0025, 0.009], [0.0055, 0.012], [0.01, 0.0134], [0.015, 0.0136], [0.0185, 0.0128], [corkTop, 0.0118]]
    .map(([y, r]) => ({ y, hw: r, hd: r }));
  const cork = loft(corkRings, light ? 16 : 28, { vMode: "y", uRep: 2, vRep: 1, capTop: true });

  // lông vũ
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const rpos: THREE.CatmullRomCurve3[] = [];
  const BETA = 0.42; // độ võng ngang của bản lông
  for (let f = 0; f < NF; f++) {
    const th = (f / NF) * TAU + (rand() - 0.5) * 0.05;
    const tilt = 0.5 + (rand() - 0.5) * 0.08;
    const wmax = 0.0092 * (0.94 + rand() * 0.12);
    const lenK = 0.985 + rand() * 0.03;
    const radial = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
    const tang0 = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
    const base = pos.length / 3;
    const center: THREE.Vector3[] = [];
    for (let i = 0; i <= NS; i++) {
      const s = i / NS;
      const r = R0 + (R1 - R0) * s ** 1.18;
      const y = Y0 + (Y1 - Y0) * s * lenK;
      const dr = (R1 - R0) * 1.18 * s ** 0.18, dy = (Y1 - Y0) * lenK;
      const Tg = new THREE.Vector3().addScaledVector(radial, dr).add(new THREE.Vector3(0, dy, 0)).normalize();
      const W = tang0.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(new THREE.Vector3().crossVectors(Tg, tang0), Math.sin(tilt)).normalize();
      const Nn = new THREE.Vector3().crossVectors(Tg, W).normalize();
      const P = new THREE.Vector3(radial.x * r, y, radial.z * r);
      center.push(P.clone().addScaledVector(Nn, 0.0004));
      const grow = 0.06 + 0.94 * Math.sin(Math.min(s / 0.7, 1) * Math.PI / 2) ** 1.5;
      const t = Math.max(0, (s - 0.86) / 0.14);
      const tip = t >= 1 ? 0 : (1 - t ** 2.1) ** (1 / 2.1);
      const w = wmax * grow * tip;
      for (let j = 0; j < NC; j++) {
        const e = -1 + (2 * j) / (NC - 1);
        const q = P.clone().addScaledVector(W, w * e).addScaledVector(Nn, -BETA * w * e * e);
        pos.push(q.x, q.y, q.z);
        const n = Nn.clone().addScaledVector(W, 2 * BETA * e).normalize();
        nor.push(n.x, n.y, n.z);
        uv.push((e + 1) / 2, s);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NC - 1; j++) {
      const p = base + i * NC + j, q = p + 1, r = p + NC + 1, s2 = p + NC;
      idx.push(p, r, q, p, s2, r);
    }
    rpos.push(new THREE.CatmullRomCurve3(center));
  }
  const feathers = new THREE.BufferGeometry();
  feathers.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  feathers.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  feathers.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  feathers.setIndex(idx);

  // sống lông
  const quills = mergeGeometries(rpos.map((c) => new THREE.TubeGeometry(c, NS * 2, 0.00042, 4, false)));
  // hai vòng chỉ buộc: đan trong/ngoài qua từng sống lông
  const ring = (sFrac: number, rad: number) => {
    const r = R0 + (R1 - R0) * sFrac ** 1.18, y = Y0 + (Y1 - Y0) * sFrac;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < NF * 2; k++) {
      const ang = (k / (NF * 2)) * TAU + Math.PI / NF * 0; // 2 điểm mỗi lông: trên sống (ngoài) và giữa hai sống (trong)
      const rr = r + (k % 2 === 0 ? 0.0026 : -0.0010);
      pts.push(new THREE.Vector3(Math.cos(ang) * rr, y, Math.sin(ang) * rr));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, "centripetal"), NF * 8, rad, 5, true);
  };
  const threads = mergeGeometries([ring(0.86, 0.0007), ring(0.34, 0.00066)]);

  const merged = mergeGeometries([cork, feathers, quills, threads], true);
  [cork, feathers, quills, threads].forEach((x) => x.dispose());
  merged.translate(0, -0.0437, 0);
  track(a, merged);

  // vật liệu
  const ct = corkTextures([0.74, 0.9]);
  const ft = featherTexture();
  track(a, ct.map); track(a, ct.bump); track(a, ft);
  const Phys = light ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const corkMat = track(a, new THREE.MeshStandardMaterial({ map: ct.map, bumpMap: ct.bump, bumpScale: 0.6, roughness: 0.48, metalness: 0, envMap: a.envMap, envMapIntensity: 0.8 }));
  const featherMat = track(a, new Phys({
    map: ft, bumpMap: ft, bumpScale: 0.9, side: THREE.DoubleSide, roughness: 0.58, metalness: 0, emissive: 0x2a2316, emissiveIntensity: 0.55,
    envMap: a.envMap, envMapIntensity: 0.65,
    ...(light ? {} : { sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xfff2d8) }),
  } as THREE.MeshStandardMaterialParameters));
  const quillMat = track(a, new THREE.MeshStandardMaterial({ color: 0xe6d6a2, roughness: 0.36, metalness: 0, envMap: a.envMap, envMapIntensity: 0.8 }));
  const threadMat = track(a, new THREE.MeshStandardMaterial({ color: 0xf4ecd4, roughness: 0.6, metalness: 0, emissive: 0x2a2418, envMap: a.envMap, envMapIntensity: 0.5 }));
  return { geometry: merged, materials: [corkMat, featherMat, quillMat, threadMat] };
}

export function buildShuttle(a: PropAssets) {
  const p = buildShuttleParts(a);
  const m = new THREE.Mesh(p.geometry, p.materials);
  m.scale.setScalar(SHUTTLE_SCALE);
  return m;
}
