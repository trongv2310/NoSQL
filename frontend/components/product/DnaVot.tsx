"use client";

import { useId, useState } from "react";
import { bacCanBang, bacDoCung } from "@/lib/landing-data";
import type { ThongSoVotV } from "@/lib/types";
import s from "./bento.module.css";

type Che = "can-bang" | "do-cung";

/** Vị trí chấm trên thân vợt (viewBox 120×300): đầu vợt ở trên, cán ở dưới. Mức định tính từ chữ ghi trong kho, KHÔNG phải mm. */
const yCanBang = (bac: number) => Math.round(215 - (Math.max(-2, Math.min(3, bac)) + 2) * 28);
/** Độ lệch ngang của trục khi uốn minh họa: mềm → cong nhiều, cứng → cong ít. Chỉ là hình minh họa mức độ, không đo lực. */
const doLech = (bac: number) => Math.round((3 - Math.max(0, Math.min(3, bac)) + 1) * 4.5);

const NHAN_CAN_BANG: Record<number, string> = { [-2]: "Rất nhẹ đầu", [-1]: "Nhẹ đầu", 0: "Cân bằng", 1: "Hơi nặng đầu", 2: "Nặng đầu", 3: "Rất nặng đầu" };

/**
 * Racket DNA: hình vợt đứng tối giản có chấm điểm cân bằng và minh họa độ cứng thân, đều tính từ chữ ghi trong kho cho đúng phiên bản đang chọn.
 * Hai nút chuyển chế độ (bàn phím/cảm ứng đều dùng được); chuyển động tắt khi người dùng chọn giảm chuyển động. Không có số mm, gram hay điểm "năng lực".
 * Thiếu dữ liệu thì hình chỉ vẽ phần có và chú thích nói rõ phần chưa có thông tin.
 */
export function DnaVot({ ts, nhanPhienBan }: { ts?: ThongSoVotV | null; nhanPhienBan: string }) {
  const [che, setChe] = useState<Che>("can-bang");
  const moTaId = useId();
  const bacCb = bacCanBang(ts ?? null);
  const bacDc = bacDoCung(ts ?? null);
  const co = che === "can-bang" ? bacCb !== null : bacDc !== null;
  const y = bacCb !== null ? yCanBang(bacCb) : null;
  const lech = bacDc !== null ? doLech(bacDc) : null;

  const moTa = che === "can-bang"
    ? bacCb === null ? "Chưa có thông tin điểm cân bằng cho phiên bản này nên chưa vẽ chấm."
      : `Điểm cân bằng ghi trong kho: ${ts?.doCanBang}. Chấm nằm càng gần đầu vợt thì vợt càng nặng đầu, gần cán thì nhẹ đầu. Vị trí chấm là mức định tính, không phải số đo mm.`
    : bacDc === null ? "Chưa có thông tin độ cứng cho phiên bản này nên chưa vẽ."
      : `Độ cứng ghi trong kho: ${ts?.doCung}. Đường nét đứt minh họa thân vợt uốn nhiều hay ít: càng cứng càng ít cong. Đây là hình minh họa mức độ, không phải số đo lực.`;

  return (
    <figure className={s.dna} aria-label={`Racket DNA, ${nhanPhienBan}`}>
      <div className={s.dnaChon} role="group" aria-label="Xem theo">
        <button type="button" aria-pressed={che === "can-bang"} onClick={() => setChe("can-bang")}>Điểm cân bằng</button>
        <button type="button" aria-pressed={che === "do-cung"} onClick={() => setChe("do-cung")}>Độ cứng thân</button>
      </div>
      <svg className={s.dnaHinh} viewBox="0 0 120 300" role="img" aria-describedby={moTaId} aria-label="Hình vợt đứng minh họa">
        <ellipse cx="60" cy="78" rx="38" ry="58" className={s.khung} />
        <path d="M24 60h72M22 78h76M24 96h72M42 28v100M60 20v116M78 28v100" className={s.day} />
        <path d="M60 136v56" className={s.truc} />
        <rect x="54" y="190" width="12" height="90" rx="5" className={s.can} />
        {/* thang nhẹ đầu → nặng đầu dọc thân vợt */}
        <line x1="104" y1="215" x2="104" y2="75" className={`${s.thang} ${che === "can-bang" ? s.thangBat : ""}`} />
        <text x="108" y="79" className={s.thangNhan}>nặng</text>
        <text x="108" y="219" className={s.thangNhan}>nhẹ</text>
        {che === "do-cung" && lech !== null && (
          <path key={lech} d={`M60 140 Q ${60 + lech} 166 60 192`} className={s.uon} />
        )}
        {che === "can-bang" && y !== null && (
          <g key={y} className={s.chamNhom}>
            <line x1="60" y1={y} x2="100" y2={y} className={s.chamDay} />
            <circle cx="60" cy={y} r="7" className={s.cham} />
          </g>
        )}
      </svg>
      <figcaption id={moTaId} className={s.dnaMoTa} aria-live="polite">
        {moTa}
        {!co && <span> Hỏi người bán nếu bạn cần biết thêm.</span>}
      </figcaption>
      {bacCb !== null && che === "can-bang" && <p className={s.dnaNhan}><span aria-hidden="true">●</span> {NHAN_CAN_BANG[bacCb]}</p>}
    </figure>
  );
}
