import * as THREE from "three";
import { createPost, type Post } from "./post";
import { buildRacket, buildShuttleParts, RACKET_SCALE, studioEnvironment, type PropAssets, type RacketStrings } from "./props";
import { hazeTexture } from "./scene-textures";
import { adBoardTexture, apronTexture, beamTexture, courtTexture, glowTexture, netTexture, rng, wallTexture } from "./textures";

/**
 * Thế giới 3D phía sau trang chủ: một sân cầu lông về đêm. Mở đầu là cú chạm cầu (Match Point): cận cảnh quả cầu dừng sát mặt cước,
 * cuộn trang thì cước võng, cầu bật đi sâu vào sân. Sang khu "chọn lối chơi", camera lùi ra nhìn ngang sân và một quả cầu bay lại
 * theo quỹ đạo của lối chơi đang chọn (đập cầu, đánh nhanh, bỏ nhỏ), kèm vệt sáng và màu nhấn của lối chơi đó. Phần còn lại camera chạy dọc
 * một đường cong qua các "chương" theo tiến độ cuộn; vợt 3D ở tiền cảnh; cảnh vẽ vào bộ đệm HDR rồi qua bloom, chỉnh màu, vignette và
 * hạt phim (xem post.ts). Mọi thứ dựng từ hình học và canvas, không tải tài nguyên ngoài.
 */

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  fontFamily: string;
  brands: string[];
  /** Màn hình cảm ứng/nhỏ: bớt hạt, giảm phân đoạn hình học, tắt khử răng cưa, bloom ít mức hơn. */
  light: boolean;
  /** Bỏ qua cảnh mở màn (đứng yên ở trạng thái cuối): dùng khi kiểm tra bằng ?gl=force. */
  skipIntro?: boolean;
  onContextLost: () => void;
}

/** Ba lối chơi (khớp `LoiChoi` ở lib/landing-data): mỗi lối một quỹ đạo cầu và một màu nhấn. */
export type StyleKey = "cong" | "toc" | "toan";

export interface World {
  /** Vẽ một khung hình. `prog` là chỉ số chương (0 … số chương − 1, có phần lẻ); `mx`,`my` ∈ [-1,1]; `hit` ∈ [0,1] là tiến độ cú chạm cầu ở hero. */
  render(nowMs: number, prog: number, mx: number, my: number, hit: number): void;
  /** Chọn lối chơi (null = chưa chọn: xem lần lượt cả ba). Đổi lối chơi thì quả cầu đánh lại từ đầu. */
  setStyle(k: StyleKey | null): void;
  resize(): void;
  setPixelRatio(r: number): void;
  readonly pixelRatio: number;
  dispose(): void;
}

/**
 * Điểm dừng của camera theo chương: vị trí, điểm nhìn, góc mở.
 * 0 hero · 1 chọn lối chơi · 2 danh mục · 3 tìm vợt · 4 sản phẩm · 5 câu chuyện · 6 kết thúc. Phải khớp CHUONG trong World.tsx.
 */
const WAY = [
  { p: [0.3, 1.35, 3.2], t: [0.7, 1.9, -10], fov: 44 },
  { p: [-5.2, 1.85, -2.4], t: [0.2, 1.35, -8.6], fov: 46 },
  { p: [-1.6, 1.25, 3.6], t: [1.4, 0.9, -9], fov: 50 },
  { p: [-2.1, 1.75, -0.2], t: [1.2, 1.35, -13], fov: 48 },
  { p: [3.4, 3.4, -3.0], t: [-0.6, 0.6, -11], fov: 44 },
  { p: [4.9, 2.6, -10.8], t: [-1.2, 1.15, -8.6], fov: 46 },
  { p: [0.6, 1.35, -1.8], t: [0, 1.3, -13], fov: 46 },
] as const;

/**
 * Vợt ở tiền cảnh: vị trí/góc xoay trong hệ tọa độ camera, theo chương (nội suy giữa các chương).
 * Hero: cận cảnh nhìn từ sau lưng người đánh, mặt cước quay vào sân; đầu vợt lệch phải, cán chạy chéo ra góc dưới phải.
 * Khu chọn lối chơi: vợt rời khung để quỹ đạo cầu là tâm điểm.
 */
const RACKET = [
  { x: 0.5, y: -0.12, z: -2.3, rx: 0.1, ry: 2.05, rz: -0.72, s: 1.02 },
  { x: 6.2, y: -2.2, z: -3.4, rx: 0.15, ry: 2.2, rz: -0.9, s: 0.9 },
  { x: -4.3, y: -0.7, z: -3.6, rx: 0.15, ry: 0.6, rz: -0.9, s: 0.78 },
  { x: 4.0, y: -1.0, z: -3.5, rx: 0.1, ry: -0.7, rz: 1.1, s: 0.8 },
  { x: 4.5, y: 0.2, z: -3.8, rx: 0.2, ry: -0.6, rz: 1.0, s: 0.72 },
  { x: 4.3, y: -0.15, z: -3.8, rx: 0.2, ry: -0.6, rz: 0.9, s: 0.74 }, // câu chuyện: lệch về phía thẻ bài viết, không đè lên dòng chữ bên trái
  { x: 0.2, y: -0.35, z: -3.3, rx: 0.1, ry: 0.35, rz: -0.75, s: 0.82 },
] as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const TAU = Math.PI * 2;

/** Nhường luồng chính để việc dựng cảnh không thành một tác vụ dài làm đơ trang. */
const nhuong = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Sàn bóng: màu từ texture, vạch sân được đẩy sáng (HDR) để tỏa sáng, độ trong suốt tăng khi nhìn thoải (Fresnel kiểu cách)
 * nên phần phản chiếu của bản sao lật ngược phía dưới lộ ra mạnh dần về phía xa.
 */
function floorMaterial(map: THREE.Texture, base: number, max: number, repeat: [number, number] = [1, 1]) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    map: { value: map }, uBase: { value: base }, uMax: { value: max }, uRepeat: { value: new THREE.Vector2(...repeat) },
  }]);
  return new THREE.ShaderMaterial({
    uniforms, fog: true, transparent: true, depthWrite: false,
    vertexShader:
      "varying vec2 vUv; varying vec3 vW;\n#include <fog_pars_vertex>\n" +
      "void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;\n" +
      " vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}",
    fragmentShader:
      "uniform sampler2D map; uniform float uBase, uMax; uniform vec2 uRepeat;\nvarying vec2 vUv; varying vec3 vW;\n#include <fog_pars_fragment>\n" +
      "void main(){\n vec4 c = texture2D(map, vUv * uRepeat);\n" +
      " vec3 v = normalize(cameraPosition - vW);\n float fr = pow(1.0 - clamp(v.y, 0.0, 1.0), 2.2);\n" +
      " float refl = clamp(uBase + (uMax - uBase) * fr, 0.0, 1.0);\n" +
      " float lum = dot(c.rgb, vec3(0.333));\n vec3 col = c.rgb * (1.0 + 1.3 * smoothstep(0.55, 0.95, lum));\n" +
      " gl_FragColor = vec4(col, 1.0 - refl);\n#include <fog_fragment>\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
  });
}

/**
 * Vệt sáng: một dãy đốm sáng cộng màu (additive) xếp dọc đường bay. Vị trí, độ mờ, cỡ do engine ghi mỗi khung hình
 * (hàm của thời điểm nên không giữ trạng thái), màu nhấn đổi qua `uCol`.
 */
function makeTrail(n: number, tex: THREE.Texture, px: { value: number }) {
  const pos = new Float32Array(n * 3), al = new Float32Array(n), sz = new Float32Array(n);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aA", new THREE.BufferAttribute(al, 1));
  geo.setAttribute("aS", new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex }, uPx: px, uCol: { value: new THREE.Color(1, 1, 1) } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    vertexShader: "attribute float aA; attribute float aS; uniform float uPx; varying float vA;\nvoid main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uPx * aS / max(-mv.z, 0.2); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform sampler2D uTex; uniform vec3 uCol; varying float vA;\nvoid main(){ if (vA <= 0.002) discard; vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uCol * 2.6, t.a * vA); }",
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 4;
  return {
    points, pos, al, sz, n,
    set(k: number, x: number, y: number, z: number, a: number, size: number) { pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; al[k] = a; sz[k] = size; },
    flush() { geo.attributes.position.needsUpdate = true; geo.attributes.aA.needsUpdate = true; geo.attributes.aS.needsUpdate = true; },
    color: mat.uniforms.uCol.value as THREE.Color,
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

/**
 * Ba quỹ đạo cầu (hệ tọa độ sân: -z là đầu sân xa, lưới ở z = -8, mặt lưới cao ≈ 1,55): đường đi theo u ∈ [0,1],
 * thời lượng `T` giây, màu nhấn, cỡ vệt. Đập cầu: từ cao, dốc đứng, nhanh. Đánh nhanh: bay thẳng sát lưới, rất nhanh, sâu về cuối sân.
 * Bỏ nhỏ: bổng nhẹ qua lưới rồi rơi sát lưới bên kia, chậm, cầu lộn nhẹ.
 */
interface Shot {
  T: number;
  color: THREE.Color;
  size: number;
  trail: number;
  path(u: number, out: THREE.Vector3): THREE.Vector3;
}
const SHOTS: Record<StyleKey, Shot> = {
  cong: {
    T: 0.62, color: new THREE.Color(1.0, 0.44, 0.1), size: 0.2, trail: 0.42,
    path: (u, o) => o.set(lerp(-0.9, 0.8, u), lerp(3.0, 0, u ** 1.35), lerp(-3.6, -11.2, u)),
  },
  toc: {
    T: 0.5, color: new THREE.Color(0.2, 1.0, 0.7), size: 0.12, trail: 0.5,
    path: (u, o) => o.set(lerp(-1.1, 1.1, u), lerp(1.55, 0, u ** 2.4) + 0.4 * Math.sin(Math.PI * u) * (1 - u), lerp(-3.2, -13.6, u)),
  },
  toan: {
    T: 1.7, color: new THREE.Color(1.0, 0.93, 0.76), size: 0.12, trail: 0.3,
    path: (u, o) => {
      const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u), w = 1 - e;
      return o.set(-0.7 * w * w + 2 * -0.1 * w * e + 0.55 * e * e, 1.6 * w * w + 2 * 4.3 * w * e, -5.8 * w * w + 2 * -7.5 * w * e + -9.3 * e * e);
    },
  },
};
const SHOT_ORDER: StyleKey[] = ["cong", "toc", "toan"];
const SHOT_PAUSE = 1.1;

/** Cú chạm cầu ở hero theo tiến độ `hit`: lại gần (0 → HIT_C), cước võng (HIT_C → HIT_R), cầu bật đi (HIT_R → 1). */
const HIT_C = 0.3;
const HIT_R = 0.355;

export async function createWorld(opts: WorldOptions): Promise<World> {
  const { canvas } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", alpha: false, stencil: false });
  renderer.setClearColor(0x03120d, 1);
  renderer.autoClear = false;
  renderer.localClippingEnabled = true;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04140e, 0.034);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 140);
  scene.add(camera);

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  // hậu kỳ HDR; thiết bị không hỗ trợ bộ đệm float thì vẽ thẳng ra màn hình với ACES
  let post: Post | null = createPost(renderer, 4, 4, opts.light);
  if (!post) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; }

  const envRT = keep(studioEnvironment(renderer));
  const props: PropAssets = { envMap: envRT.texture, disposables, fontFamily: opts.fontFamily, light: opts.light };

  /** Phản chiếu: các vật "nổi" trên sân được thêm một bản sao lật qua mặt sàn (chung hình học và vật liệu). */
  const mirror = new THREE.Group();
  mirror.scale.y = -1;
  scene.add(mirror);
  const reflect = <T extends THREE.Object3D>(o: T) => { const c = o.clone(); mirror.add(c); return c; };

  // ───────────── sàn, lưới, nhà thi đấu
  const zNet = -8;
  await nhuong();
  const court = courtTexture(maxAniso, opts.light ? 80 : 150);
  keep(court.texture);
  const courtMat = keep(floorMaterial(court.texture, 0.07, 0.42));
  const courtMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(court.width, court.length)), courtMat);
  courtMesh.rotation.x = -Math.PI / 2;
  courtMesh.position.set(0, 0, zNet);
  courtMesh.renderOrder = 1;
  scene.add(courtMesh);

  const apron = apronTexture();
  keep(apron);
  const apronMat = keep(floorMaterial(apron, 0.1, 0.4, [24, 32]));
  const apronMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(60, 80)), apronMat);
  apronMesh.rotation.x = -Math.PI / 2;
  apronMesh.position.set(0, -0.02, -12);
  apronMesh.renderOrder = 1;
  scene.add(apronMesh);

  const postMat = keep(new THREE.MeshBasicMaterial({ color: 0xdfeee6 }));
  const postGeo = keep(new THREE.CylinderGeometry(0.035, 0.035, 1.55, 10));
  for (const x of [-3.05, 3.05]) {
    const post3 = new THREE.Mesh(postGeo, postMat);
    post3.position.set(x, 0.775, zNet);
    scene.add(post3);
    reflect(post3);
  }
  const netTex = keep(netTexture());
  const net = new THREE.Mesh(keep(new THREE.PlaneGeometry(6.1, 0.76)), keep(new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false })));
  net.position.set(0, 1.17, zNet);
  net.renderOrder = 2;
  scene.add(net);
  reflect(net);

  await nhuong();
  const wall = keep(wallTexture());
  const wallMat = keep(new THREE.MeshBasicMaterial({ map: wall }));
  const back = new THREE.Mesh(keep(new THREE.PlaneGeometry(60, 18)), wallMat);
  back.position.set(0, 8, -29);
  scene.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(keep(new THREE.PlaneGeometry(70, 18)), wallMat);
    side.rotation.y = -sx * Math.PI / 2;
    side.position.set(sx * 20, 8, -12);
    scene.add(side);
  }
  const ceiling = new THREE.Mesh(keep(new THREE.PlaneGeometry(60, 70)), keep(new THREE.MeshBasicMaterial({ color: 0x010906 })));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 9.6, -12);
  scene.add(ceiling);

  // khán đài tối hai bên: các bậc hộp, viền sáng mờ để còn thấy hình khối
  const standMat = keep(new THREE.MeshBasicMaterial({ color: 0x041510 }));
  const edgeMat = keep(new THREE.LineBasicMaterial({ color: 0x2a6a52, transparent: true, opacity: 0.55 }));
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const h = 0.7 + k * 0.7;
      const geo = keep(new THREE.BoxGeometry(1.7, h, 30));
      const m = new THREE.Mesh(geo, standMat);
      m.position.set(sx * (7.4 + k * 1.7), h / 2, -11);
      scene.add(m);
      const e = new THREE.LineSegments(keep(new THREE.EdgesGeometry(geo)), edgeMat);
      e.position.copy(m.position);
      scene.add(e);
    }
  }

  // bảng quảng cáo ven sân: bốn thương hiệu shop đang bán; sáng hơn 1 nên tỏa sáng nhẹ
  const brandTex = opts.brands.map((b) => keep(adBoardTexture(b, opts.fontFamily, "#f4691a")));
  const boardGeo = keep(new THREE.PlaneGeometry(2.1, 0.52));
  let bi = 0;
  for (const sx of [-1, 1]) {
    for (let z = -13.4; z < -1.8; z += 2.25) {
      const mat = keep(new THREE.MeshBasicMaterial({ map: brandTex[bi++ % brandTex.length], color: new THREE.Color(1.7, 1.7, 1.7) }));
      const m = new THREE.Mesh(boardGeo, mat);
      m.rotation.y = sx * Math.PI / 2 * -1;
      m.position.set(sx * 4.7, 0.3, z);
      scene.add(m);
      reflect(m);
    }
  }

  await nhuong();
  // dải đèn trần (HDR: bloom tự tạo quầng) + vầng sáng + tia sáng
  const barGeo = keep(new THREE.BoxGeometry(0.28, 0.08, 3.0));
  const barMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 3.3, 2.8), fog: false }));
  const barPos: THREE.Vector3[] = [];
  for (const x of [-2.4, 0, 2.4]) for (let z = -26; z <= 6; z += 3.4) barPos.push(new THREE.Vector3(x, 8.6, z));
  const bars = new THREE.InstancedMesh(barGeo, barMat, barPos.length);
  const mtx = new THREE.Matrix4();
  barPos.forEach((p, i) => { mtx.makeTranslation(p.x, p.y, p.z); bars.setMatrixAt(i, mtx); });
  scene.add(bars);
  const barsM = new THREE.InstancedMesh(barGeo, barMat, barPos.length);
  barsM.instanceMatrix = bars.instanceMatrix;
  mirror.add(barsM);
  const glow = keep(glowTexture("255,238,205"));
  const glowGeo = keep(new THREE.BufferGeometry().setFromPoints(barPos));
  const glowMat = keep(new THREE.PointsMaterial({ map: glow, size: 4.2, sizeAttenuation: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const glowPts = new THREE.Points(glowGeo, glowMat);
  glowPts.renderOrder = 3;
  scene.add(glowPts);
  const beamTex = keep(beamTexture());
  const beamGeo = keep(new THREE.CylinderGeometry(0.2, 1.7, 8.6, 20, 1, true));
  const beamMat = keep(new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  for (const [x, z] of [[0, -3], [0, -9.8], [-2.4, -6.4], [2.4, -6.4], [0, -16.6], [-2.4, -13.2], [2.4, -13.2]] as const) {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.position.set(x, 4.3, z);
    b.renderOrder = 3;
    scene.add(b);
  }

  // sương trôi ngang trên sân
  const hazeTex = keep(hazeTexture());
  const hazeGeo = keep(new THREE.PlaneGeometry(18, 6));
  const haze = ([[-2, 1.6, -3, 0.06], [2, 2.4, -8.5, 0.05], [-1, 1.3, -14, 0.07], [3, 2.2, -19, 0.06]] as const).map(([x, y, z, sp], i) => {
    const m = new THREE.Mesh(hazeGeo, new THREE.MeshBasicMaterial({ map: hazeTex, color: new THREE.Color(0.8, 1.15, 1), transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    disposables.push(m.material as THREE.Material);
    m.position.set(x, y, z);
    m.renderOrder = 3;
    scene.add(m);
    return { m, x0: x, sp, ph: i * 1.7 };
  });

  await nhuong();
  // ───────────── ánh sáng cho vật thể 3D (vợt, quả cầu)
  const hemi = new THREE.HemisphereLight(0xdfe9e5, 0x04140e, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  key.position.set(-3, 6, 4);
  key.target.position.set(0, -1, -5);
  camera.add(key, key.target);
  const rim = new THREE.PointLight(0xf4691a, 14, 14, 1.6);
  rim.position.set(2.5, 0.5, -1);
  camera.add(rim);
  // đèn ngược sáng sau quả cầu: bắt sáng mép lông vũ
  const backLight = new THREE.PointLight(0xcfeee0, 26, 11, 1.5);
  backLight.position.set(3.2, 1.4, -5.2);
  camera.add(backLight);

  // vợt tiền cảnh gắn vào camera; vợt có tỷ lệ riêng, engine chỉ co giãn qua nút bọc ngoài
  const racket = new THREE.Group();
  const racketModel = buildRacket(props);
  const strings = (racketModel.userData.strings as RacketStrings).uniforms;
  racket.add(racketModel);
  camera.add(racket);

  // quả cầu cận cảnh ở hero (con của vợt: cùng nghiêng, cùng lắc) và quả cầu bay trong sân ở khu chọn lối chơi
  const parts = buildShuttleParts(props);
  const SH = 5.4; // lớn hơn thật ≈ 1,6 lần so với vợt để mắt bắt được lông vũ
  const CORK = 0.0437 * SH; // tâm → đầu nút bấc
  const heroShuttle = new THREE.Mesh(parts.geometry, parts.materials);
  heroShuttle.scale.setScalar(SH);
  racket.add(heroShuttle);
  const rally = new THREE.Mesh(parts.geometry, parts.materials);
  rally.scale.setScalar(5.2);
  rally.visible = false;
  scene.add(rally);
  const rallyM = new THREE.Mesh(parts.geometry, parts.materials);
  rallyM.scale.copy(rally.scale);
  rallyM.visible = false;
  mirror.add(rallyM);
  const rand = rng(41);

  const pxU = { value: 900 };
  const trailTex = keep(glowTexture("255,255,255"));
  const heroTrail = makeTrail(16, trailTex, pxU);
  racket.add(heroTrail.points);
  const rallyTrail = makeTrail(72, trailTex, pxU);
  scene.add(rallyTrail.points);
  disposables.push({ dispose() { heroTrail.dispose(); rallyTrail.dispose(); } });

  // tia chớp khi chạm cầu (một đốm sáng luôn hướng về camera) + tia lửa tỏa theo mặt cước
  const flashPts = makeTrail(1, trailTex, pxU);
  flashPts.color.set(1, 0.9, 0.7);
  racket.add(flashPts.points);
  disposables.push({ dispose() { flashPts.dispose(); } });
  const SPARK_N = 22;
  const sparkDir = Array.from({ length: SPARK_N }, () => { const a = rand() * TAU; return { x: Math.cos(a), y: Math.sin(a), v: 0.6 + rand() * 1.5, z: 0.15 + rand() * 0.5 }; });
  const sparks = makeTrail(SPARK_N, trailTex, pxU);
  racket.add(sparks.points);
  disposables.push({ dispose() { sparks.dispose(); } });

  // chỗ cầu đáp xuống sân: vòng sáng loang trên mặt sàn
  const landMat = keep(new THREE.MeshBasicMaterial({ map: trailTex, color: new THREE.Color(1, 1, 1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const land = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), landMat);
  land.rotation.x = -Math.PI / 2;
  land.renderOrder = 3;
  land.visible = false;
  scene.add(land);

  await nhuong();
  // bụi sáng trôi + tia lửa cam bay lên
  const dustN = opts.light ? 220 : 520;
  const dust = new Float32Array(dustN * 3);
  const dseed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    dust[i * 3] = (rand() - 0.5) * 18; dust[i * 3 + 1] = rand() * 9; dust[i * 3 + 2] = -24 + rand() * 32;
    dseed[i] = rand() * 6.28;
  }
  const dustGeo = keep(new THREE.BufferGeometry());
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dust, 3));
  const dustGlow = keep(glowTexture("200,255,226"));
  const dustPts = new THREE.Points(dustGeo, keep(new THREE.PointsMaterial({ map: dustGlow, size: 0.1, sizeAttenuation: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  dustPts.renderOrder = 3;
  scene.add(dustPts);
  const emberN = opts.light ? 12 : 30;
  const ember = new Float32Array(emberN * 3);
  for (let i = 0; i < emberN; i++) { ember[i * 3] = (rand() - 0.5) * 9; ember[i * 3 + 1] = rand() * 8; ember[i * 3 + 2] = -20 + rand() * 24; }
  const emberGeo = keep(new THREE.BufferGeometry());
  emberGeo.setAttribute("position", new THREE.BufferAttribute(ember, 3));
  const emberGlow = keep(glowTexture("255,150,70"));
  const emberPts = new THREE.Points(emberGeo, keep(new THREE.PointsMaterial({ map: emberGlow, color: new THREE.Color(1.8, 1.3, 0.9), size: 0.15, sizeAttenuation: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  emberPts.renderOrder = 3;
  scene.add(emberPts);

  // vệt sáng theo con trỏ: các hạt nhỏ trong không gian camera, sinh theo quãng đường di chuyển
  const WISP_D = 3.4;
  const wispN = opts.light ? 0 : 90;
  const wisps = Array.from({ length: wispN }, () => ({ life: 1, max: 1, vx: 0, vy: 0, sz: 0, ph: 0 }));
  const wPos = new Float32Array(wispN * 3), wA = new Float32Array(wispN), wS = new Float32Array(wispN);
  const wGeo = keep(new THREE.BufferGeometry());
  wGeo.setAttribute("position", new THREE.BufferAttribute(wPos, 3));
  wGeo.setAttribute("aA", new THREE.BufferAttribute(wA, 1));
  wGeo.setAttribute("aS", new THREE.BufferAttribute(wS, 1));
  const wispGlow = keep(glowTexture("190,255,225"));
  const wMat = keep(new THREE.ShaderMaterial({
    uniforms: { uTex: { value: wispGlow }, uPx: { value: 900 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false,
    vertexShader: "attribute float aA; attribute float aS; uniform float uPx; varying float vA;\nvoid main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uPx * aS / max(-mv.z, 0.4); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform sampler2D uTex; varying float vA;\nvoid main(){ if (vA <= 0.0) discard; vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(t.rgb * 2.2, t.a * vA); }",
  }));
  const wispPts = new THREE.Points(wGeo, wMat);
  wispPts.frustumCulled = false;
  wispPts.renderOrder = 9;
  if (wispN) camera.add(wispPts);

  // Vật thể chính (vợt, quả cầu cận cảnh, vệt sáng, vệt theo con trỏ) ở lớp 1, hậu cảnh ở lớp 0: ở hero hậu cảnh được làm mờ rồi vật thể mới vẽ
  // lên trên (xem render). Đèn phải bật cả hai lớp mới chiếu được vào cả hai lượt vẽ.
  const LAYER_MAIN = 1;
  racket.traverse((o) => o.layers.set(LAYER_MAIN));
  wispPts.layers.set(LAYER_MAIN);
  [hemi, key, rim, backLight].forEach((l) => l.layers.enable(LAYER_MAIN));
  const wst = { i: 0, acc: 0, ex: 0, ey: 0, lx: 0, ly: 0, idle: 0, seen: false };

  // ───────────── camera
  const curveP = new THREE.CatmullRomCurve3(WAY.map((w) => new THREE.Vector3(...w.p)), false, "catmullrom", 0.42);
  const curveT = new THREE.CatmullRomCurve3(WAY.map((w) => new THREE.Vector3(...w.t)), false, "catmullrom", 0.42);
  const cp = new THREE.Vector3(), ct = new THREE.Vector3(), dir = new THREE.Vector3();
  const skip = !!opts.skipIntro;
  const state = { smooth: 0, mx: 0, my: 0, intro: skip ? 1 : 0, reveal: skip ? 99 : 0, last: 0, t0: 0, clock: 0, tRel: -99, hitPrev: -1, shake: 0 };
  /** Lối chơi đang chọn: `t0` là lúc bắt đầu đánh; `col` bám dần màu nhấn đích, `amt` là mức nhuộm màu lên đèn trần. */
  const RIM = new THREE.Color(0.96, 0.41, 0.1);
  const style = { key: null as StyleKey | null, t0: 0, col: RIM.clone(), amt: 0 };
  let width = 1, height = 1;
  const sz = new THREE.Vector2();

  const qBase = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); // nút bấc về phía -z (mặt cước)
  const qTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0.22, 0));
  const qFlip = new THREE.Quaternion();
  const axX = new THREE.Vector3(1, 0, 0), axY = new THREE.Vector3(0, -1, 0);
  const AIM_Y = 0.05; // điểm chạm cầu trên mặt cước (đơn vị cảnh, hệ vợt)
  const G0 = 0.2; // khoảng hở lúc đứng chờ, từ đầu nút bấc tới mặt cước
  const DEPTH = 0.1; // độ võng sâu nhất của mặt cước
  const pose = { x: 0, y: AIM_Y, z: 0, flip: 0 };
  /** Vị trí tâm quả cầu (hệ vợt) và góc lật theo tiến độ chạm cầu `h`: chờ → ép vào cước → bật ngược ra xa, lật nút bấc quay đầu. */
  function heroPose(h: number, t: number) {
    pose.x = 0; pose.y = AIM_Y; pose.flip = 0;
    if (h < HIT_C) {
      const e = ease(h / HIT_C), l = 1 - e;
      pose.z = CORK + G0 * l + Math.sin(t * 1.4) * 0.012 * l;
      pose.x = Math.sin(t * 0.8) * 0.012 * l;
      pose.y = AIM_Y + Math.cos(t * 0.6) * 0.01 * l;
    } else if (h < HIT_R) {
      pose.z = CORK - DEPTH * Math.sin(((h - HIT_C) / (HIT_R - HIT_C)) * Math.PI / 2);
    } else {
      const q = (h - HIT_R) / (1 - HIT_R);
      pose.z = CORK - DEPTH + 10 * q ** 1.7;
      pose.x = 1.0 * q ** 1.3;
      pose.y = AIM_Y + 0.5 * q + 0.9 * q * q;
      pose.flip = Math.PI * ease(clamp(q / 0.07, 0, 1));
    }
    return pose;
  }

  const sv = new THREE.Vector3(), sv2 = new THREE.Vector3(), sv3 = new THREE.Vector3();
  /** Quả cầu bay trong sân + vệt sáng + vòng sáng chỗ cầu đáp. Ẩn khi camera không nhìn vào khu chọn lối chơi. */
  function rallyFrame(t: number, show: boolean) {
    rally.visible = rallyM.visible = rallyTrail.points.visible = land.visible = false;
    if (!show) return;
    const keys = style.key ? [style.key] : SHOT_ORDER;
    const total = keys.reduce((a, k) => a + SHOTS[k].T + SHOT_PAUSE, 0);
    let tau = Math.max(0, t - style.t0) % total, cur = keys[0];
    for (const k of keys) { const d = SHOTS[k].T + SHOT_PAUSE; if (tau < d) { cur = k; break; } tau -= d; }
    const sh = SHOTS[cur];
    const flying = tau < sh.T;
    rallyTrail.color.copy(sh.color);
    rallyTrail.points.visible = true;
    const after = Math.max(0, tau - sh.T);
    const fade = Math.exp(-after / 0.3);
    const n = rallyTrail.n, dtk = (sh.T * sh.trail) / n;
    for (let k = 0; k < n; k++) {
      const tk = tau - k * dtk;
      if (tk < 0 || fade < 0.01) { rallyTrail.set(k, 0, -9, 0, 0, 0); continue; }
      sh.path(clamp(tk / sh.T, 0, 1), sv);
      rallyTrail.set(k, sv.x, sv.y, sv.z, (1 - k / n) ** 1.5 * fade * 0.85, sh.size * (1 - 0.55 * k / n));
    }
    rallyTrail.flush();
    if (flying) {
      const u = tau / sh.T;
      sh.path(u, sv);
      sh.path(Math.min(1, u + 0.015), sv2);
      sh.path(Math.max(0, u - 0.015), sv3);
      sv2.sub(sv3).normalize();
      rally.position.copy(sv);
      rally.quaternion.setFromUnitVectors(axY, sv2);
      qFlip.setFromAxisAngle(sv2, cur === "toan" ? tau * 5 : tau * 12);
      rally.quaternion.premultiply(qFlip);
      rallyM.position.copy(rally.position);
      rallyM.quaternion.copy(rally.quaternion);
      rally.visible = rallyM.visible = true;
    }
    if (after > 0 && fade > 0.01) {
      sh.path(1, sv);
      land.position.set(sv.x, 0.02, sv.z);
      const grow = (cur === "cong" ? 1.9 : cur === "toc" ? 1.2 : 0.9) * (1.2 + after * 3);
      land.scale.set(grow, grow, 1);
      landMat.color.copy(sh.color).multiplyScalar(cur === "cong" ? 2.6 : 1.6);
      landMat.opacity = fade * 0.9;
      land.visible = true;
      if (cur === "cong") state.shake = Math.max(state.shake, fade * (after < 0.05 ? 1 : 0.7));
    }
  }

  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(sz);
    if (post) post.setSize(sz.x, sz.y);
    wMat.uniforms.uPx.value = sz.y;
    pxU.value = sz.y;
  }

  function render(now: number, prog: number, mx: number, my: number, hitIn: number) {
    if (!state.t0) { state.t0 = now; state.last = now; }
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    state.clock += dt;
    const t = state.clock;
    const hit = clamp(hitIn, 0, 1);

    const N = WAY.length - 1;
    const target = clamp(prog, 0, N);
    state.smooth += (target - state.smooth) * (1 - Math.exp(-dt * 4.2));
    state.mx = damp(state.mx, mx, 3, dt);
    state.my = damp(state.my, my, 3, dt);
    state.intro = Math.min(1, state.intro + dt / 2.4);
    state.reveal += dt;
    const introE = 1 - Math.pow(1 - state.intro, 3);
    // cú chạm cầu: ghi lại thời điểm vừa vượt điểm bật (để cước rung tắt dần theo giây, không theo cuộn)
    if (state.hitPrev >= 0 && state.hitPrev < HIT_R && hit >= HIT_R) state.tRel = t;
    if (hit < HIT_R) state.tRel = -99;
    state.hitPrev = hit;
    const tau = t - state.tRel;
    const kick = Math.exp(-tau / 0.16);

    const u = clamp(state.smooth / N, 0, 1);
    curveP.getPoint(u, cp);
    curveT.getPoint(u, ct);
    const i = clamp(Math.floor(state.smooth), 0, N - 1);
    const f = clamp(state.smooth - i, 0, 1);
    let fov = lerp(WAY[i].fov, WAY[i + 1].fov, ease(f));

    // màn hình dọc: lùi camera dọc trục nhìn và mở góc để khung không cắt mất cảnh
    const aspect = width / height;
    const tall = clamp((1.55 - aspect) / 1.0, 0, 1);
    if (tall > 0) { dir.subVectors(cp, ct).normalize(); cp.addScaledVector(dir, tall * 4.5); cp.y += tall * 0.8; ct.y += tall * 3.4; fov *= 1 + tall * 0.3; }

    // cú dolly mở màn: ống kính dài lùi từ xa vào
    cp.z += (1 - introE) * 5.5; cp.y += (1 - introE) * 0.5; fov += (1 - introE) * 9;
    // ép vào mặt cước: ống kính nhích gần, rồi nhả khi cầu bật
    fov -= 3.5 * ease(clamp(hit / HIT_R, 0, 1)) * (1 - ease(clamp((state.smooth - 0.4) / 0.4, 0, 1)));

    // trôi nhẹ theo con trỏ, giảm dần khi đã cuộn xa khỏi hero
    const par = 1 - ease(clamp(state.smooth / 1.6, 0, 1)) * 0.55;
    cp.x += state.mx * 0.55 * par; cp.y += state.my * -0.3 * par;
    ct.x -= state.mx * 0.18 * par; ct.y -= state.my * -0.1 * par;

    // rung máy khi đập cầu đáp xuống sân (khu chọn lối chơi) và khi chạm cầu ở hero
    state.shake = Math.max(0, state.shake - dt * 2.6);
    const shk = state.shake * 0.05 + kick * 0.03 * (hit >= HIT_R ? 1 : 0);
    if (shk > 0.0005) { cp.y += Math.sin(t * 90) * shk; cp.x += Math.cos(t * 77) * shk * 0.6; }

    camera.position.copy(cp);
    camera.lookAt(ct);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }

    // màn hình dọc: đèn trần chiếm khung lớn hơn nên hạ độ sáng để vật thể phía trước đọc được
    const lamp = 1 - 0.8 * tall;
    // màu nhấn của lối chơi: đèn rọi viền, đèn trần và bụi sáng ngả dần về màu đó
    const tgt = style.key ? SHOTS[style.key].color : RIM;
    style.col.r = damp(style.col.r, tgt.r, 4, dt); style.col.g = damp(style.col.g, tgt.g, 4, dt); style.col.b = damp(style.col.b, tgt.b, 4, dt);
    style.amt = damp(style.amt, style.key ? 0.2 : 0, 3, dt);
    rim.color.copy(style.col);
    barMat.color.setRGB(lerp(3.6, style.col.r * 3.6, style.amt) * lamp, lerp(3.3, style.col.g * 3.3, style.amt) * lamp, lerp(2.8, style.col.b * 2.8, style.amt) * lamp);
    (dustPts.material as THREE.PointsMaterial).color.setRGB(lerp(1, style.col.r, style.amt * 1.6), lerp(1, style.col.g, style.amt * 1.6), lerp(1, style.col.b, style.amt * 1.6));
    glowMat.opacity = 0.28 * (1 - 0.65 * tall);
    beamMat.opacity = 0.085 * (1 - 0.55 * tall);

    // vợt tiền cảnh: nội suy vị trí theo chương, lắc nhẹ, trồi lên lúc mở màn. Ở hero vợt đứng yên cho tới khi cầu đã bật đi.
    const A0 = RACKET[0];
    // màn hình dọc: vợt về giữa, thấp hơn (chữ chiếm nửa trên), dựng đứng hơn để vừa bề ngang
    const a = i === 0 ? { x: lerp(A0.x, -0.05, tall), y: lerp(A0.y, -0.6, tall), z: lerp(A0.z, -2.6, tall), rx: A0.rx, ry: A0.ry, rz: lerp(A0.rz, -0.45, tall), s: lerp(A0.s, 1.0, tall) } : RACKET[i];
    const b = RACKET[i + 1];
    // ở hero vợt chỉ rời khung sau khi cầu đã bật đi (cầu là con của vợt nên bay cùng hệ tọa độ), dùng `hitIn` chưa bị chặn trên
    const fe = ease(i === 0 ? clamp((hitIn - 0.95) / 0.8, 0, 1) : f);
    const rise = 1 - introE;
    racket.position.set(
      lerp(a.x, b.x, fe) + state.mx * -0.18,
      lerp(a.y, b.y, fe) + Math.sin(t * 0.9) * 0.04 - rise * 2.4 + state.my * 0.1,
      lerp(a.z, b.z, fe) - 0.06 * kick,
    );
    racket.rotation.set(lerp(a.rx, b.rx, fe) + Math.sin(t * 0.7) * 0.02 + 0.03 * kick * Math.cos(tau * 40), lerp(a.ry, b.ry, fe) + state.mx * 0.12, lerp(a.rz, b.rz, fe) + Math.sin(t * 0.6) * 0.02);
    racket.scale.setScalar(lerp(a.s, b.s, fe));

    // quả cầu cận cảnh, cước võng, tia chớp, tia lửa, vệt sáng khi cầu bật
    const showHero = hit < 0.985 && state.smooth < 1.2;
    heroShuttle.visible = heroTrail.points.visible = sparks.points.visible = flashPts.points.visible = showHero;
    if (showHero) {
      const p = heroPose(hit, t);
      heroShuttle.position.set(p.x, p.y, p.z);
      heroShuttle.quaternion.copy(qBase).premultiply(qTilt);
      if (p.flip > 0) { qFlip.setFromAxisAngle(axX, p.flip); heroShuttle.quaternion.premultiply(qFlip); }

      // mặt cước võng theo độ ép của cầu; sau khi bật thì rung tắt dần theo thời gian
      const dentU = hit < HIT_C ? 0 : hit < HIT_R ? DEPTH * Math.sin(((hit - HIT_C) / (HIT_R - HIT_C)) * Math.PI / 2) : DEPTH * Math.exp(-tau / 0.11) * Math.cos(tau * 56);
      strings.uDent.value = dentU / RACKET_SCALE;
      strings.uHit.value.set(0, AIM_Y / RACKET_SCALE);

      // vệt sáng sau quả cầu đang bay đi
      const fadeOut = 1 - ease(clamp((hit - 0.9) / 0.1, 0, 1));
      for (let k = 0; k < heroTrail.n; k++) {
        const hh = hit - k * 0.0085;
        if (hh < HIT_R + 0.004) { heroTrail.set(k, 0, 0, 5, 0, 0); continue; }
        const q = heroPose(hh, t);
        heroTrail.set(k, q.x, q.y, q.z, (1 - k / heroTrail.n) ** 1.4 * 0.75 * fadeOut, 0.2 * (1 - 0.5 * k / heroTrail.n));
      }
      heroTrail.color.set(1, 0.93, 0.8);
      heroTrail.flush();

      // tia chớp tại điểm chạm + tia lửa tỏa theo mặt cước
      const I = Math.exp(-(((hit - HIT_R) / 0.03) ** 2));
      flashPts.set(0, 0, AIM_Y, 0.03, I * 0.8, 0.45 + I * 0.3);
      flashPts.flush();
      const q = clamp((hit - HIT_R) / 0.22, 0, 1);
      for (let k = 0; k < SPARK_N; k++) {
        const d = sparkDir[k], dd = Math.max(0, hit - HIT_R) ** 0.65 * 1.6;
        sparks.set(k, d.x * d.v * dd, AIM_Y + d.y * d.v * dd, 0.04 + d.z * dd, hit > HIT_R ? (1 - q) ** 2 * 0.9 : 0, 0.05);
      }
      sparks.color.set(1, 0.72, 0.4);
      sparks.flush();
    }
    rallyFrame(t, state.smooth > 0.5 && state.smooth < 2.6);

    // độ mờ hậu cảnh: đủ mờ ở hero, hết dần khi camera rời hero
    const blur = 0.92 * (1 - ease(clamp((state.smooth - 0.25) / 0.45, 0, 1)));

    // sương trôi, bụi trôi, tia lửa bay lên
    haze.forEach((h) => { h.m.position.x = h.x0 + Math.sin(t * h.sp + h.ph) * 4.5; });
    const dp = dustGeo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < dustN; k++) {
      dust[k * 3 + 1] += dt * (0.06 + (k % 5) * 0.012);
      if (dust[k * 3 + 1] > 9) dust[k * 3 + 1] = 0;
      dust[k * 3] += Math.sin(t * 0.3 + dseed[k]) * dt * 0.06;
    }
    dp.needsUpdate = true;
    const ep = emberGeo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < emberN; k++) {
      ember[k * 3 + 1] += dt * (0.35 + (k % 4) * 0.12);
      ember[k * 3] += Math.sin(t * 0.8 + k) * dt * 0.1;
      if (ember[k * 3 + 1] > 8.5) ember[k * 3 + 1] = 0;
    }
    ep.needsUpdate = true;

    // vệt sáng theo con trỏ
    if (wispN) {
      const hh = Math.tan(camera.fov * Math.PI / 360) * WISP_D;
      const px = mx * hh * camera.aspect, py = -my * hh;
      if (!wst.seen) { wst.ex = wst.lx = px; wst.ey = wst.ly = py; wst.seen = true; }
      wst.ex = damp(wst.ex, px, 16, dt); wst.ey = damp(wst.ey, py, 16, dt);
      const dx = wst.ex - wst.lx, dy = wst.ey - wst.ly, moved = Math.hypot(dx, dy);
      const spawn = (x: number, y: number, ang: number, weak: boolean) => {
        const k = wst.i; wst.i = (wst.i + 1) % wispN;
        const w = wisps[k];
        wPos[k * 3] = x + (Math.random() + Math.random() - 1) * 0.3;
        wPos[k * 3 + 1] = y + (Math.random() + Math.random() - 1) * 0.3;
        wPos[k * 3 + 2] = -WISP_D + (Math.random() - 0.5) * 0.9;
        w.life = 0; w.max = (weak ? 2.1 : 1.45) + Math.random() * 1.3;
        w.vx = -Math.cos(ang) * 0.09 + (Math.random() - 0.5) * 0.38;
        w.vy = -Math.sin(ang) * 0.09 + (Math.random() - 0.5) * 0.32 + 0.02;
        w.sz = (weak ? 0.02 : 0.026) + Math.random() * 0.028;
        w.ph = Math.random() * TAU;
      };
      wst.acc += moved;
      const ang = moved > 1e-5 ? Math.atan2(dy, dx) : 0;
      let guard = 0;
      while (wst.acc >= 0.05 && guard++ < 12) {
        wst.acc -= 0.05;
        const q = moved > 1e-6 ? Math.min(1, guard * 0.05 / moved) : 0;
        spawn(wst.lx + dx * q, wst.ly + dy * q, ang, false);
      }
      wst.idle += dt;
      if (wst.idle > 0.45) { wst.idle = 0; spawn(wst.ex, wst.ey, Math.random() * TAU, true); }
      wst.lx = wst.ex; wst.ly = wst.ey;
      for (let k = 0; k < wispN; k++) {
        const w = wisps[k];
        if (w.life >= w.max) { wA[k] = 0; continue; }
        w.life += dt;
        const q = w.life / w.max;
        wPos[k * 3] += (w.vx + Math.sin(t * 1.3 + w.ph) * 0.17) * dt;
        wPos[k * 3 + 1] += (w.vy + Math.cos(t * 1.1 + w.ph * 1.7) * 0.14) * dt;
        w.vx *= 1 - 0.5 * dt; w.vy = w.vy * (1 - 0.5 * dt) + 0.022 * dt;
        wA[k] = ease(clamp(q / 0.12, 0, 1)) * (1 - ease(clamp((q - 0.22) / 0.78, 0, 1))) * 0.9;
        wS[k] = w.sz * (1 + q * 0.55);
      }
      (wGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (wGeo.attributes.aA as THREE.BufferAttribute).needsUpdate = true;
      (wGeo.attributes.aS as THREE.BufferAttribute).needsUpdate = true;
    }

    if (post) {
      renderer.setRenderTarget(post.scene);
      renderer.clear(true, true, false);
      if (blur > 0.01) {
        // cận cảnh: hậu cảnh vẽ trước rồi làm mờ, vật thể chính vẽ sau nên giữ nguyên độ nét
        camera.layers.set(0);
        renderer.render(scene, camera);
        post.blurBackground(blur);
        renderer.setRenderTarget(post.scene);
        camera.layers.set(LAYER_MAIN);
        renderer.render(scene, camera);
        camera.layers.enableAll();
      } else {
        renderer.render(scene, camera);
      }
      post.render({ time: t, fade: clamp(state.reveal / 0.9, 0, 1) });
    } else {
      renderer.setRenderTarget(null);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
    }
  }

  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); opts.onContextLost(); }, { once: true });

  resize();
  return {
    render,
    resize,
    setStyle(k) { style.key = k; style.t0 = state.clock; },
    setPixelRatio(r) { renderer.setPixelRatio(r); resize(); },
    get pixelRatio() { return renderer.getPixelRatio(); },
    dispose() {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
      });
      disposables.forEach((d) => d.dispose());
      post?.dispose();
      post = null;
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
