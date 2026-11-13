import { canvas, rng, toTexture } from "./textures";

/** Texture của cảnh phần mới: sương mù, phông phòng chụp. Vẽ canvas lúc chạy. */

/** Mảng sương mềm (nhiều đốm chồng nhau) cho các lớp khói bay ngang trên sân. */
export function hazeTexture() {
  const c = canvas(256, 128);
  const g = c.getContext("2d")!;
  const r = rng(13);
  for (let i = 0; i < 26; i++) {
    const x = r() * 256, y = 24 + r() * 80, rad = 24 + r() * 46;
    const rg = g.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, `rgba(190,235,215,${0.12 + r() * 0.12})`);
    rg.addColorStop(1, "rgba(190,235,215,0)");
    g.fillStyle = rg;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = "destination-in";
  const m = g.createRadialGradient(128, 64, 10, 128, 64, 128);
  m.addColorStop(0, "rgba(0,0,0,1)");
  m.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = m;
  g.fillRect(0, 0, 256, 128);
  return toTexture(c);
}
