import * as THREE from "three";
import { featherTexture, gripTexture, stringsTexture } from "./textures";

/** Vật thể 3D ở tiền cảnh (vợt, quả cầu): dựng hoàn toàn từ hình học cơ bản, không tải mô hình ngoài. */

export interface PropAssets {
  envMap: THREE.Texture | null;
  disposables: { dispose(): void }[];
}

const track = <T extends { dispose(): void }>(a: PropAssets, x: T): T => { a.disposables.push(x); return x; };

/** Vợt cầu lông: khung than chì có vạch cam, mắt vợt, hai nhánh cổ, cán và quấn cán. Dài ≈ 2,3 đơn vị, đầu vợt ở +y. */
export function buildRacket(a: PropAssets) {
  const g = new THREE.Group();
  const frameMat = track(a, new THREE.MeshStandardMaterial({ color: 0x151d1a, metalness: 0.55, roughness: 0.34, envMap: a.envMap, envMapIntensity: 1.1 }));
  const accentMat = track(a, new THREE.MeshStandardMaterial({ color: 0xf4691a, metalness: 0.2, roughness: 0.4, emissive: 0x5a2000, envMap: a.envMap }));
  const rx = 0.5, ry = 0.66, cy = 0.62;

  // khung đầu vợt: ống chạy theo hình elip
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(t) * rx, cy + Math.sin(t) * ry, 0));
  }
  const ring = new THREE.CatmullRomCurve3(pts, true);
  g.add(new THREE.Mesh(track(a, new THREE.TubeGeometry(ring, 160, 0.03, 12, true)), frameMat));

  // vạch cam trên cung trên của khung
  const arc: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = Math.PI * (0.18 + (i / 40) * 0.64);
    arc.push(new THREE.Vector3(Math.cos(t) * rx, cy + Math.sin(t) * ry, 0));
  }
  g.add(new THREE.Mesh(track(a, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 60, 0.0335, 12, false)), accentMat));

  // mắt vợt: hình elip phủ texture lưới
  const shape = new THREE.Shape();
  shape.absellipse(0, cy, rx - 0.03, ry - 0.03, 0, Math.PI * 2, false, 0);
  const sg = track(a, new THREE.ShapeGeometry(shape, 48));
  const pos = sg.attributes.position as THREE.BufferAttribute;
  const uv = sg.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + rx) / (2 * rx), (pos.getY(i) - cy + ry) / (2 * ry));
  const stringsTex = track(a, stringsTexture());
  g.add(new THREE.Mesh(sg, track(a, new THREE.MeshBasicMaterial({ map: stringsTex, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }))));

  // cổ vợt (hai nhánh chụm lại) + trục + cán
  const throat = (sx: number) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(sx * 0.2, cy - ry + 0.03, 0),
    new THREE.Vector3(sx * 0.13, cy - ry - 0.18, 0),
    new THREE.Vector3(0, cy - ry - 0.42, 0),
  ]);
  g.add(new THREE.Mesh(track(a, new THREE.TubeGeometry(throat(1), 24, 0.024, 10)), frameMat));
  g.add(new THREE.Mesh(track(a, new THREE.TubeGeometry(throat(-1), 24, 0.024, 10)), frameMat));
  const shaftTop = cy - ry - 0.42;
  const shaft = new THREE.Mesh(track(a, new THREE.CylinderGeometry(0.014, 0.014, 0.62, 12)), frameMat);
  shaft.position.y = shaftTop - 0.31;
  g.add(shaft);
  const gripTex = track(a, gripTexture());
  gripTex.repeat.set(1, 3);
  const grip = new THREE.Mesh(track(a, new THREE.CylinderGeometry(0.03, 0.026, 0.52, 18)), track(a, new THREE.MeshStandardMaterial({ map: gripTex, roughness: 0.8, metalness: 0 })));
  grip.position.y = shaftTop - 0.62 - 0.26;
  g.add(grip);
  const cap = new THREE.Mesh(track(a, new THREE.SphereGeometry(0.032, 12, 8)), frameMat);
  cap.position.y = shaftTop - 0.62 - 0.52;
  g.add(cap);

  // căn gốc về tâm khung để xoay/đặt cho dễ
  g.children.forEach((c) => { c.position.y -= cy; });
  return g;
}

/** Quả cầu lông (phóng to ≈ 9 lần): nút bấc có băng đen, váy 16 thớ lông, vòng chỉ ở miệng. Nút ở −y, miệng váy ở +y. */
export function buildShuttle(a: PropAssets) {
  const g = new THREE.Group();
  const corkMat = track(a, new THREE.MeshStandardMaterial({ color: 0xefe4cd, roughness: 0.55, metalness: 0, envMap: a.envMap, envMapIntensity: 0.6 }));
  const cork = new THREE.Mesh(track(a, new THREE.SphereGeometry(0.1, 24, 16)), corkMat);
  cork.scale.set(1, 0.86, 1);
  cork.position.y = -0.3;
  g.add(cork);
  const band = new THREE.Mesh(track(a, new THREE.CylinderGeometry(0.1, 0.1, 0.03, 24, 1, true)), track(a, new THREE.MeshStandardMaterial({ color: 0x111413, roughness: 0.7 })));
  band.position.y = -0.2;
  g.add(band);

  const feather = track(a, featherTexture());
  const skirt = new THREE.Mesh(
    track(a, new THREE.CylinderGeometry(0.34, 0.095, 0.62, 48, 1, true)),
    track(a, new THREE.MeshStandardMaterial({ map: feather, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, envMap: a.envMap, envMapIntensity: 0.5 })),
  );
  skirt.position.y = 0.01;
  g.add(skirt);

  const thread = new THREE.Mesh(track(a, new THREE.TorusGeometry(0.34, 0.006, 6, 64)), track(a, new THREE.MeshBasicMaterial({ color: 0xe9dfc4 })));
  thread.rotation.x = Math.PI / 2;
  thread.position.y = 0.32;
  g.add(thread);
  return g;
}
