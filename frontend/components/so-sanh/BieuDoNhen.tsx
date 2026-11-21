import { useId } from "react";
import { GHI_CHU_THANG, taoRadar, type KetQuaTruc } from "@/lib/so-sanh-bieu-do";
import { MauNet, NET_VE, nhanVot, DauVot, type VotBieuDo } from "./chung";
import s from "./so-sanh.module.css";

const RONG = 340, CAO = 292, TAM = { x: 170, y: 165 }, BAN_KINH = 92;

/** Tách nhãn trục thành tối đa hai dòng ngắn ("Điểm cân bằng" → "Điểm" / "cân bằng"). */
function chiaDong(ten: string): string[] {
  const t = ten.split(" ");
  if (t.length <= 1) return [ten];
  const giua = Math.ceil(t.length / 2);
  return [t.slice(0, giua).join(" "), t.slice(giua).join(" ")];
}

/**
 * Biểu đồ nhện (SVG thuần) của 2–3 vợt trên 5 thông số ghi trong kho, theo thang minh họa. Trục vợt nào thiếu dữ liệu thì bỏ khỏi đa giác của vợt đó
 * (không đặt giá trị thay) và được ghi chú dưới biểu đồ. Mỗi vợt khác màu, khác hình điểm và khác nét. `minhHoa` = khung trống chỉ để mời chọn vợt.
 */
export function BieuDoNhen({ vot, truc, moTa, minhHoa = false }: { vot: VotBieuDo[]; truc: KetQuaTruc[]; moTa: string; minhHoa?: boolean }) {
  const id = useId();
  const radar = taoRadar(truc, vot.length, TAM, BAN_KINH);
  // Bố cục nhãn trục tính trước để khung SVG luôn đủ cao/rộng cho mọi nhãn (nhãn phụ "chưa có thông tin" thêm dòng, không được đè chú giải bên dưới).
  const nhan = radar.dauTruc.map((p, k) => {
    const g = Math.atan2(p.y - TAM.y, p.x - TAM.x);
    const cx = Math.cos(g), cy = Math.sin(g);
    const neo: "start" | "end" | "middle" = cx > 0.3 ? "start" : cx < -0.3 ? "end" : "middle";
    const dong = chiaDong(truc[k].ten);
    const mo = !minhHoa && truc[k].trong;
    // Nhãn phụ chia dòng ngắn: dòng dài ở trục bên trái (neo "end") sẽ bị cắt khỏi mép khung trên mobile.
    const dsDong = mo ? [...dong, ...(truc[k].trangThai === "khac-don-vi" ? ["khác đơn vị,", "chưa vẽ"] : ["chưa có", "thông tin"])] : dong;
    const px = p.x + cx * 12, py = p.y + cy * 12;
    const y0 = cy < -0.5 ? py - 4 - (dsDong.length - 1) * 14 : cy > 0.5 ? py + 12 : py + 4 - ((dsDong.length - 1) * 14) / 2;
    return { khoa: truc[k].khoa, neo, dong, mo, dsDong, px, y0 };
  });
  const yTren = Math.min(0, ...nhan.map((n) => n.y0 - 14)), yDuoi = Math.max(CAO, ...nhan.map((n) => n.y0 + (n.dsDong.length - 1) * 14 + 8));
  return (
    <div className={s.radarBoc}>
      <svg className={s.radar} viewBox={`0 ${yTren} ${RONG} ${yDuoi - yTren}`} role="img" aria-label={minhHoa ? "Khung biểu đồ nhện trống, chưa có vợt" : `Biểu đồ nhện so sánh ${vot.length} vợt`} aria-describedby={minhHoa ? undefined : `${id}-mo-ta`}>
        {radar.vong.map((d, k) => <path key={k} d={d} className={`${s.vong} ${k === radar.vong.length - 1 ? s.vongNgoai : ""}`} />)}
        {radar.dauTruc.map((p, k) => <line key={k} x1={TAM.x} y1={TAM.y} x2={p.x} y2={p.y} className={`${s.truc} ${!minhHoa && truc[k].trong ? s.trucMo : ""}`} />)}
        {nhan.map((n) => (
          <text key={n.khoa} x={n.px} y={n.y0} textAnchor={n.neo} className={s.nhanTruc}>
            {n.dsDong.map((tx, j) => <tspan key={j} x={n.px} dy={j ? 14 : 0} className={n.mo && j >= n.dong.length ? s.nhanTrucMo : undefined}>{tx}</tspan>)}
          </text>
        ))}
        {!minhHoa && radar.vot.map((v, k) => {
          const b = vot[k];
          if (!b || v.soDiem === 0) return null;
          return (
            <g key={`${b.i}-${v.duong}-${v.diem.map((p) => (p ? `${p.x},${p.y}` : "-")).join(" ")}`} className={`${s.daGiac} ${s[`v${b.i % 3}`]}`} style={{ ["--k" as string]: k }}>
              {v.duong && <path d={v.duong} fill="var(--mau)" fillOpacity={v.soDiem >= 3 ? 0.13 : 0} stroke="var(--mau)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={NET_VE[b.i % 3]} />}
              {v.diem.map((p, ti) => p && <DiemVe key={ti} i={b.i} x={p.x} y={p.y} chu={`${nhanVot(b.i)} · ${truc[ti].ten}: ${truc[ti].diem[k]?.chu ?? ""}`} />)}
            </g>
          );
        })}
      </svg>
      <div className={s.radarBen}>
      {!minhHoa && <p id={`${id}-mo-ta`} className="visually-hidden">{moTa}</p>}
      {!minhHoa && (
        <ul className={s.chuThichRadar} aria-label="Chú giải biểu đồ">
          {vot.map((b) => <li key={b.i}><MauNet i={b.i} /><DauVot i={b.i} /><span><b>{nhanVot(b.i)}</b> · {b.ngan}</span></li>)}
        </ul>
      )}
      {!minhHoa && (
        <ul className={s.thieuRadar} aria-label="Thông số chưa vẽ trên biểu đồ">
          {radar.vot.map((v, k) => (v.thieu.length > 0 || v.khacDonVi.length > 0) && vot[k] && (
            <li key={vot[k].i}>
              <b>{nhanVot(vot[k].i)}</b>
              {v.thieu.length > 0 && <> chưa có thông tin: {v.thieu.map((t) => t.toLowerCase()).join(", ")}.</>}
              {v.khacDonVi.length > 0 && <> có số liệu nhưng khác đơn vị với vợt khác nên chưa vẽ chung một thang: {v.khacDonVi.map((t) => t.toLowerCase()).join(", ")} (số vẫn ghi ở thước đo bên cạnh).</>}
              {" "}{v.soDiem < 3 ? "Chưa đủ trục để khép thành hình." : "Hình bỏ các trục này (không đặt giá trị thay)."}
            </li>
          ))}
        </ul>
      )}
      {!minhHoa && (
        <details className={s.huongDoc}>
          <summary>Cách đọc biểu đồ</summary>
          <ul>
            {truc.map((t) => <li key={t.khoa}><b>{t.ten}</b>: {t.huongDoc}</li>)}
          </ul>
        </details>
      )}
      <p className={s.ghiChuThang}>{GHI_CHU_THANG}</p>
      </div>
    </div>
  );
}

/** Điểm trên đa giác: tròn (vợt 1), vuông (vợt 2), thoi (vợt 3). */
function DiemVe({ i, x, y, chu }: { i: number; x: number; y: number; chu: string }) {
  const r = 5.2;
  return (
    <g>
      <title>{chu}</title>
      {i % 3 === 0 && <circle cx={x} cy={y} r={r} fill="var(--mau)" stroke="#fff" strokeWidth={2} />}
      {i % 3 === 1 && <rect x={x - r + 0.4} y={y - r + 0.4} width={2 * r - 0.8} height={2 * r - 0.8} rx={1.5} fill="var(--mau)" stroke="#fff" strokeWidth={2} />}
      {i % 3 === 2 && <path d={`M${x},${y - r - 1.6} L${x + r + 1.6},${y} L${x},${y + r + 1.6} L${x - r - 1.6},${y} Z`} fill="var(--mau)" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />}
    </g>
  );
}
