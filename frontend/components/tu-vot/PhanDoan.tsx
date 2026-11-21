"use client";

import s from "./tu-vot.module.css";

/** Điều khiển phân đoạn: một nhóm nút, nút đang chọn có aria-pressed (đơn vị căng, nơi căng, chu kỳ nhắc). */
export function PhanDoan<T extends string | number | null>({ nhan, giaTri, luaChon, onDoi, className }: {
  nhan: string; giaTri: T; luaChon: { v: T; nhan: string }[]; onDoi: (v: T) => void; className?: string;
}) {
  return (
    <div className={`${s.phan} ${className ?? ""}`} role="group" aria-label={nhan}>
      {luaChon.map((o) => (
        <button key={String(o.v)} type="button" aria-pressed={o.v === giaTri} onClick={() => onDoi(o.v)}>{o.nhan}</button>
      ))}
    </div>
  );
}
