import * as THREE from "three";
import { buildRacket, studioEnvironment, type PropAssets } from "@/components/landing/world/props";

/**
 * Vợt 3D minh họa cho trang chi tiết (dựng lại từ RacketLive/buildRacket, chỉ nạp khi khách bấm mở). Đây là mô hình TỔNG QUÁT của một cây vợt cầu lông
 * (khung đầu thon liền khớp chữ T, một trục nối xuống cán), KHÔNG phải bản quét chính xác của SKU đang xem; chữ trên khung ghi "MINH HỌA".
 * Vòng cam trên thân chỉ ĐÁNH DẤU MỨC định tính của điểm cân bằng theo chữ ghi trong kho (nhẹ đầu → gần cán, nặng đầu → gần đầu), không phải số mm.
 */
export interface Vot3D {
  render(nowMs: number): void;
  resize(): void;
  setPixelRatio(r: number): void;
  /** Xoay thêm (radian) quanh trục dọc và nghiêng nhẹ; dùng cho kéo chuột/vuốt và phím mũi tên. */
  xoay(dy: number, dx?: number): void;
  datLai(): void;
  dispose(): void;
}

/** Vị trí y của vòng đánh dấu trong hệ tọa độ vợt (mét): dải từ gần cán (rất nhẹ đầu) đến gần khớp T (rất nặng đầu). */
export const yVongCanBang = (bac: number) => -0.31 + ((Math.max(-2, Math.min(3, bac)) + 2) / 5) * 0.15;

export function taoVot3D(canvas: HTMLCanvasElement, opts: { bacCanBang: number | null; fontFamily: string; nhe: boolean }): Vot3D {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "default" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  camera.position.set(0, 0, 6.4);

  const disposables: { dispose(): void }[] = [];
  const env = studioEnvironment(renderer);
  disposables.push(env);
  const props: PropAssets = { envMap: env.texture, disposables, fontFamily: opts.fontFamily, light: opts.nhe };

  scene.add(new THREE.HemisphereLight(0xf2f7f4, 0x9db3a9, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(-3, 4, 5);
  scene.add(key);

  const pivot = new THREE.Group();
  const vot = buildRacket(props, { matte: true, nhan: "MINH HỌA" });
  if (opts.bacCanBang !== null) {
    const vong = new THREE.Mesh(
      new THREE.TorusGeometry(0.02, 0.0028, 10, 36),
      new THREE.MeshStandardMaterial({ color: 0xb83c0a, emissive: 0x5c1a02, roughness: 0.5, metalness: 0 }),
    );
    vong.rotation.x = Math.PI / 2;
    vong.position.y = yVongCanBang(opts.bacCanBang);
    vot.add(vong);
  }
  pivot.add(vot);
  pivot.position.y = 0.65; // gốc tọa độ ở tâm đầu vợt; nâng lên cho cả cây vợt nằm giữa khung
  scene.add(pivot);

  const st = { ry: -0.5, rx: 0.08, tuQuay: true, last: 0 };

  return {
    render(now) {
      const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0.016;
      st.last = now;
      if (st.tuQuay) st.ry += dt * 0.35;
      pivot.rotation.set(st.rx, st.ry, 0);
      renderer.render(scene, camera);
    },
    resize() {
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = w / h < 1 ? 7.4 : 6.4;
      camera.updateProjectionMatrix();
    },
    setPixelRatio(r) { renderer.setPixelRatio(r); },
    xoay(dy, dx = 0) {
      st.tuQuay = false; // người dùng đã tự xoay thì không tự quay nữa
      st.ry += dy;
      st.rx = Math.max(-0.5, Math.min(0.5, st.rx + dx));
    },
    datLai() { st.ry = -0.5; st.rx = 0.08; st.tuQuay = true; },
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
