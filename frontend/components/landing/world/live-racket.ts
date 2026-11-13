import * as THREE from "three";
import { buildRacket, studioEnvironment, type PropAssets } from "./props";

/**
 * Cửa sổ 3D nhỏ cho ô "Vợt cầu lông": một cây vợt trên nền trong suốt (CSS lo phần nền), nghiêng theo con trỏ,
 * đung đưa nhẹ khi đứng yên và nhích lại gần khi rê chuột vào ô. Có renderer riêng nên độc lập với thế giới 3D phía sau trang.
 */
export interface LiveRacket {
  /** `nx`, `ny` ∈ [-1, 1]: vị trí con trỏ so với tâm ô (0 khi con trỏ ở xa). */
  setPointer(nx: number, ny: number): void;
  setHover(h: boolean): void;
  render(nowMs: number): void;
  resize(): void;
  setPixelRatio(r: number): void;
  dispose(): void;
}

export function createLiveRacket(canvas: HTMLCanvasElement, fontFamily: string, light: boolean): LiveRacket {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  camera.position.set(0, 0, 5.4);

  const disposables: { dispose(): void }[] = [];
  const env = studioEnvironment(renderer);
  disposables.push(env);
  const props: PropAssets = { envMap: env.texture, disposables, fontFamily, light };

  scene.add(new THREE.HemisphereLight(0xe2ece8, 0x06120e, 0.8));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0xf4691a, 12, 12, 1.6);
  rim.position.set(2.6, 0.4, 1.4);
  scene.add(rim);
  const teal = new THREE.PointLight(0x5fe3b4, 6, 10, 1.6);
  teal.position.set(-2.4, -1.6, 1.8);
  scene.add(teal);

  const pivot = new THREE.Group();
  pivot.add(buildRacket(props));
  scene.add(pivot);

  const st = { px: 0, py: 0, sx: 0, sy: 0, hover: 0, wantHover: 0, last: 0 };
  const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

  return {
    setPointer(nx, ny) { st.px = nx; st.py = ny; },
    setHover(h) { st.wantHover = h ? 1 : 0; },
    render(now) {
      const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0.016;
      st.last = now;
      const t = now / 1000;
      st.sx = damp(st.sx, st.px, 4, dt);
      st.sy = damp(st.sy, st.py, 4, dt);
      st.hover = damp(st.hover, st.wantHover, 5, dt);
      pivot.position.set(st.sx * 0.12, 0.58 + Math.sin(t * 0.9) * 0.035 - st.sy * 0.05, st.hover * 0.5);
      pivot.rotation.set(
        0.14 + st.sy * 0.3 + Math.sin(t * 0.7) * 0.03,
        -0.55 + st.sx * 0.65 + Math.sin(t * 0.45) * 0.1,
        0.42 + Math.sin(t * 0.6) * 0.03,
      );
      pivot.scale.setScalar(1 + st.hover * 0.04);
      renderer.render(scene, camera);
    },
    resize() {
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // khung hẹp (điện thoại, ô cao) thì lùi camera để cây vợt không bị cắt
      camera.position.z = w / h < 0.9 ? 6.2 : 5.2;
      camera.updateProjectionMatrix();
    },
    setPixelRatio(r) { renderer.setPixelRatio(r); },
    dispose() {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
      });
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
