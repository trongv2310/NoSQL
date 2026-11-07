import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildRacket, buildShuttle, type PropAssets } from "./props";
import {
  adBoardTexture, apronTexture, beamTexture, courtTexture, glowTexture, netTexture, rng, wallTexture, wordmarkTexture,
} from "./textures";

/**
 * Thế giới 3D phía sau trang chủ: một sân cầu lông về đêm. Camera chạy dọc một đường cong qua các "chương" (hero, tìm vợt,
 * câu chuyện, kết thúc) theo tiến độ cuộn; chữ CẦU LÔNG khổng lồ đứng trên sân; vợt 3D trồi lên ở tiền cảnh; quả cầu rơi
 * chậm như lá phong ở thế giới Kage. Mọi thứ dựng từ hình học và canvas, không tải tài nguyên ngoài.
 */

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  fontFamily: string;
  brands: string[];
  wordmark: string;
  /** Màn hình cảm ứng/nhỏ: bớt hạt, bớt quả cầu rơi, tắt khử răng cưa. */
  light: boolean;
  onContextLost: () => void;
}

export interface World {
  /** Vẽ một khung hình. `prog` là chỉ số chương (0 … số chương − 1, có phần lẻ); `mx`,`my` ∈ [-1,1]. */
  render(nowMs: number, prog: number, mx: number, my: number): void;
  resize(): void;
  setPixelRatio(r: number): void;
  readonly pixelRatio: number;
  dispose(): void;
}

/** Điểm dừng của camera theo chương: vị trí, điểm nhìn, góc mở. Chương 0 hero · 1 tìm vợt · 2 câu chuyện · 3 kết thúc. */
const WAY = [
  { p: [0.4, 1.75, 7.8], t: [0.9, 1.3, -10], fov: 48 },
  { p: [-2.1, 1.75, -0.2], t: [1.2, 1.35, -13], fov: 48 },
  { p: [4.9, 2.6, -10.8], t: [-1.2, 1.15, -8.6], fov: 46 },
  { p: [0.6, 1.35, -1.8], t: [0, 1.3, -13], fov: 46 },
] as const;

/** Vợt ở tiền cảnh: vị trí/góc xoay trong hệ tọa độ camera, theo chương (nội suy giữa các chương). */
const RACKET = [
  { x: 1.7, y: -0.7, z: -3.5, rx: 0.15, ry: -0.5, rz: 0.95, s: 1.25 },
  { x: 4.2, y: -1.2, z: -3.5, rx: 0.1, ry: -0.7, rz: 1.1, s: 1.1 },
  { x: -4.4, y: 0.4, z: -3.8, rx: 0.2, ry: 0.6, rz: -0.9, s: 1.0 },
  { x: 0.2, y: -0.45, z: -3.3, rx: 0.1, ry: 0.35, rz: -0.75, s: 1.15 },
] as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ease = (t: number) => t * t * (3 - 2 * t);

/** Nhường luồng chính để việc dựng cảnh không thành một tác vụ dài làm đơ trang. */
const nhuong = () => new Promise<void>((r) => setTimeout(r, 0));

export async function createWorld(opts: WorldOptions): Promise<World> {
  const { canvas } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.light, powerPreference: "high-performance", alpha: false, stencil: false });
  renderer.setClearColor(0x03120d, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04140e, 0.036);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 140);
  scene.add(camera);

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  // môi trường phản chiếu nhỏ cho vợt/quả cầu (cảnh nền dùng vật liệu Basic nên không cần)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envRT = pmrem.fromScene(envScene, 0.04);
  envScene.dispose();
  pmrem.dispose();
  keep(envRT);
  const props: PropAssets = { envMap: envRT.texture, disposables };

  // ───────────── sàn, lưới, nhà thi đấu
  const zNet = -8;
  await nhuong();
  const court = courtTexture(maxAniso, opts.light ? 80 : 150);
  keep(court.texture);
  const courtMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(court.width, court.length)), new THREE.MeshBasicMaterial({ map: court.texture }));
  courtMesh.rotation.x = -Math.PI / 2;
  courtMesh.position.set(0, 0, zNet);
  scene.add(courtMesh);

  const apron = apronTexture();
  apron.repeat.set(24, 32);
  keep(apron);
  const apronMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(60, 80)), new THREE.MeshBasicMaterial({ map: apron }));
  apronMesh.rotation.x = -Math.PI / 2;
  apronMesh.position.set(0, -0.02, -12);
  scene.add(apronMesh);

  const postMat = keep(new THREE.MeshBasicMaterial({ color: 0xdfeee6 }));
  const postGeo = keep(new THREE.CylinderGeometry(0.035, 0.035, 1.55, 10));
  for (const x of [-3.05, 3.05]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, 0.775, zNet);
    scene.add(post);
  }
  const netTex = keep(netTexture());
  const net = new THREE.Mesh(keep(new THREE.PlaneGeometry(6.1, 0.76)), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  net.position.set(0, 1.17, zNet);
  scene.add(net);

  await nhuong();
  const wall = keep(wallTexture());
  const wallMat = new THREE.MeshBasicMaterial({ map: wall });
  const back = new THREE.Mesh(keep(new THREE.PlaneGeometry(60, 18)), wallMat);
  back.position.set(0, 8, -29);
  scene.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(keep(new THREE.PlaneGeometry(70, 18)), wallMat);
    side.rotation.y = -sx * Math.PI / 2;
    side.position.set(sx * 20, 8, -12);
    scene.add(side);
  }
  const ceiling = new THREE.Mesh(keep(new THREE.PlaneGeometry(60, 70)), new THREE.MeshBasicMaterial({ color: 0x010906 }));
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

  // bảng quảng cáo ven sân: bốn thương hiệu shop đang bán
  const brandTex = opts.brands.map((b) => keep(adBoardTexture(b, opts.fontFamily, "#f4691a")));
  const boardGeo = keep(new THREE.PlaneGeometry(2.1, 0.52));
  let bi = 0;
  for (const sx of [-1, 1]) {
    for (let z = -13.4; z < -1.8; z += 2.25) {
      const m = new THREE.Mesh(boardGeo, new THREE.MeshBasicMaterial({ map: brandTex[bi++ % brandTex.length] }));
      m.rotation.y = sx * Math.PI / 2 * -1;
      m.position.set(sx * 4.7, 0.3, z);
      disposables.push(m.material as THREE.Material);
      scene.add(m);
    }
  }

  await nhuong();
  // dải đèn trần + vầng sáng + tia sáng
  const barGeo = keep(new THREE.BoxGeometry(0.28, 0.08, 3.0));
  const barMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 1.8), toneMapped: false, fog: false }));
  const barPos: THREE.Vector3[] = [];
  for (const x of [-2.4, 0, 2.4]) for (let z = -26; z <= 6; z += 3.4) barPos.push(new THREE.Vector3(x, 8.6, z));
  const bars = new THREE.InstancedMesh(barGeo, barMat, barPos.length);
  const mtx = new THREE.Matrix4();
  barPos.forEach((p, i) => { mtx.makeTranslation(p.x, p.y, p.z); bars.setMatrixAt(i, mtx); });
  scene.add(bars);
  const glow = keep(glowTexture("255,238,205"));
  const glowGeo = keep(new THREE.BufferGeometry().setFromPoints(barPos));
  scene.add(new THREE.Points(glowGeo, keep(new THREE.PointsMaterial({ map: glow, size: 4.2, sizeAttenuation: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))));
  const beamTex = keep(beamTexture());
  const beamGeo = keep(new THREE.CylinderGeometry(0.2, 1.7, 8.6, 20, 1, true));
  const beamMat = keep(new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  for (const [x, z] of [[0, -3], [0, -9.8], [-2.4, -6.4], [2.4, -6.4], [0, -16.6], [-2.4, -13.2], [2.4, -13.2]] as const) {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.position.set(x, 4.3, z);
    scene.add(b);
  }

  // chữ khổng lồ đứng trên sân + vệt sáng dưới chân chữ
  await nhuong();
  const wmTex = keep(wordmarkTexture(opts.wordmark, opts.fontFamily, opts.light ? 0.5 : 1));
  const wmH = 2.9;
  const wordmark = new THREE.Mesh(keep(new THREE.PlaneGeometry(wmH * 4, wmH)), new THREE.MeshBasicMaterial({ map: wmTex, transparent: true, alphaTest: 0.02, depthWrite: true, fog: false, toneMapped: false }));
  wordmark.position.set(2.45, wmH / 2 - 0.18, -4.4);
  scene.add(wordmark);
  const wordmarkMat = wordmark.material as THREE.MeshBasicMaterial;
  const footGlow = new THREE.Mesh(keep(new THREE.PlaneGeometry(14, 3.2)), new THREE.MeshBasicMaterial({ map: glow, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x8ff0c8 }));
  const footMat = footGlow.material as THREE.MeshBasicMaterial;
  footGlow.rotation.x = -Math.PI / 2;
  footGlow.position.set(2.45, 0.015, -4.4);
  scene.add(footGlow);

  await nhuong();
  // ───────────── ánh sáng cho vật thể 3D (vợt, quả cầu)
  const hemi = new THREE.HemisphereLight(0xa8f0d0, 0x04140e, 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  key.position.set(-3, 6, 4);
  key.target.position.set(0, -1, -5);
  camera.add(key, key.target);
  const rim = new THREE.PointLight(0xf4691a, 14, 14, 1.6);
  rim.position.set(2.5, 0.5, -1);
  camera.add(rim);

  // vợt tiền cảnh gắn vào camera
  const racket = buildRacket(props);
  camera.add(racket);

  // quả cầu rơi chậm
  const shuttleCount = opts.light ? 8 : 16;
  const rand = rng(41);
  const shuttleProto = buildShuttle(props);
  const shuttles = Array.from({ length: shuttleCount }, (_, i) => {
    const m = i === 0 ? shuttleProto : shuttleProto.clone(true);
    const sc = 0.55 + rand() * 1.0;
    m.scale.setScalar(sc);
    scene.add(m);
    return {
      m,
      x: (rand() - 0.5) * 16, y: rand() * 9, z: -22 + rand() * 28,
      vy: 0.28 + rand() * 0.34, ph: rand() * 6.28, sp: 0.15 + rand() * 0.4, sw: 0.25 + rand() * 0.2,
    };
  });

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
  scene.add(new THREE.Points(dustGeo, keep(new THREE.PointsMaterial({ map: dustGlow, size: 0.1, sizeAttenuation: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))));
  const emberN = opts.light ? 30 : 70;
  const ember = new Float32Array(emberN * 3);
  for (let i = 0; i < emberN; i++) { ember[i * 3] = (rand() - 0.5) * 9; ember[i * 3 + 1] = rand() * 8; ember[i * 3 + 2] = -20 + rand() * 24; }
  const emberGeo = keep(new THREE.BufferGeometry());
  emberGeo.setAttribute("position", new THREE.BufferAttribute(ember, 3));
  const emberGlow = keep(glowTexture("255,150,70"));
  scene.add(new THREE.Points(emberGeo, keep(new THREE.PointsMaterial({ map: emberGlow, size: 0.2, sizeAttenuation: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))));

  // ───────────── camera
  const curveP = new THREE.CatmullRomCurve3(WAY.map((w) => new THREE.Vector3(...w.p)), false, "catmullrom", 0.42);
  const curveT = new THREE.CatmullRomCurve3(WAY.map((w) => new THREE.Vector3(...w.t)), false, "catmullrom", 0.42);
  const cp = new THREE.Vector3(), ct = new THREE.Vector3(), dir = new THREE.Vector3();
  const state = { smooth: 0, mx: 0, my: 0, intro: 0, last: 0, t0: 0 };
  let width = 1, height = 1;

  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    width = w; height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render(now: number, prog: number, mx: number, my: number) {
    if (!state.t0) { state.t0 = now; state.last = now; }
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    const t = (now - state.t0) / 1000;

    const N = WAY.length - 1;
    const target = clamp(prog, 0, N);
    state.smooth += (target - state.smooth) * (1 - Math.exp(-dt * 4.2));
    state.mx += (mx - state.mx) * (1 - Math.exp(-dt * 3));
    state.my += (my - state.my) * (1 - Math.exp(-dt * 3));
    state.intro = Math.min(1, state.intro + dt / 2.4);
    const introE = 1 - Math.pow(1 - state.intro, 3);

    const u = clamp(state.smooth / N, 0, 1);
    curveP.getPoint(u, cp);
    curveT.getPoint(u, ct);
    const i = clamp(Math.floor(state.smooth), 0, N - 1);
    const f = clamp(state.smooth - i, 0, 1);
    let fov = lerp(WAY[i].fov, WAY[i + 1].fov, ease(f));

    // màn hình dọc: lùi camera dọc trục nhìn và mở góc để khung không cắt mất cảnh
    const wmShow = 1 - ease(clamp(state.smooth / 0.6, 0, 1)); // chỉ canh theo chữ khi còn ở hero
    const aspect = width / height;
    const tall = clamp((1.55 - aspect) / 1.0, 0, 1);
    if (tall > 0) { dir.subVectors(cp, ct).normalize(); cp.addScaledVector(dir, tall * 5.5); cp.y += tall * 0.9; ct.y += tall * 5.6; cp.x += tall * 1.0 * wmShow; ct.x += tall * 1.0 * wmShow; fov *= 1 + tall * 0.35; }

    // cú dolly mở màn: ống kính dài lùi từ xa vào
    cp.z += (1 - introE) * 5.5; cp.y += (1 - introE) * 0.5; fov += (1 - introE) * 9;

    // trôi nhẹ theo con trỏ, giảm dần khi đã cuộn xa khỏi hero
    const par = 1 - ease(clamp(state.smooth / 1.6, 0, 1)) * 0.55;
    cp.x += state.mx * 0.55 * par; cp.y += state.my * -0.3 * par;
    ct.x -= state.mx * 0.18 * par; ct.y -= state.my * -0.1 * par;

    camera.position.copy(cp);
    camera.lookAt(ct);
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }

    // màn hình dọc hẹp: thu nhỏ chữ cho vừa khung (giữ chân chữ trên mặt sân)
    const wmScale = 1 - tall * 0.42;
    wordmark.scale.set(wmScale, wmScale, 1);
    wordmark.position.y = (wmH / 2 - 0.18) * wmScale;
    footGlow.scale.set(wmScale, wmScale, 1);

    // chữ khổng lồ chỉ thuộc cảnh mở màn: mờ dần khi camera rời hero để không thành khối chắn tầm nhìn khi bay sát qua
    const wm = 1 - ease(clamp((state.smooth - 0.08) / 0.55, 0, 1));
    wordmarkMat.opacity = wm;
    wordmark.visible = wm > 0.01;
    footMat.opacity = 0.35 * wm;
    footGlow.visible = wm > 0.01;

    // vợt tiền cảnh: nội suy vị trí theo chương, lắc nhẹ, trồi lên lúc mở màn
    const a = RACKET[i], b = RACKET[i + 1], fe = ease(f);
    const rise = 1 - introE;
    racket.position.set(
      lerp(a.x, b.x, fe) + state.mx * -0.18,
      lerp(a.y, b.y, fe) + Math.sin(t * 0.9) * 0.05 - rise * 2.4 + state.my * 0.1,
      lerp(a.z, b.z, fe),
    );
    racket.rotation.set(lerp(a.rx, b.rx, fe) + Math.sin(t * 0.7) * 0.03, lerp(a.ry, b.ry, fe) + t * 0.0 + state.mx * 0.15, lerp(a.rz, b.rz, fe) + Math.sin(t * 0.6) * 0.025);
    racket.scale.setScalar(lerp(a.s, b.s, fe));

    // quả cầu rơi
    for (const s of shuttles) {
      s.y -= s.vy * dt;
      if (s.y < -0.4) { s.y = 9.2; s.x = (rand() - 0.5) * 16; s.z = -22 + rand() * 28; }
      s.m.position.set(s.x + Math.sin(t * s.sw + s.ph) * 0.4, s.y, s.z);
      s.m.rotation.set(Math.sin(t * s.sw + s.ph) * 0.32, t * s.sp + s.ph, Math.cos(t * s.sw * 1.3 + s.ph) * 0.32);
    }

    // bụi trôi, tia lửa bay lên
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

    renderer.render(scene, camera);
  }

  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); opts.onContextLost(); }, { once: true });

  resize();
  return {
    render,
    resize,
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
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
