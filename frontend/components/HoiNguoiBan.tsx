"use client";

import { useEffect, useId, useRef } from "react";
import { datKhuChat, hoiNguoiBan } from "./khu-chat";
import s from "./hoi-nguoi-ban.module.css";

/**
 * "Hỏi người bán" nhúng trong trang: một khung để chatbot duy nhất của site vẽ vào (xem khu-chat.ts), kèm các câu hỏi gợi ý dựng từ
 * dữ liệu thật của trang (hồ sơ người chơi, sản phẩm đang xem, từ khóa tìm kiếm). Chỉ đặt MỘT khung trên mỗi trang.
 */
export function HoiNguoiBan({ tieuDe = "Hỏi người bán", mota, goiY, id }: { tieuDe?: string; mota: string; goiY: string[]; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const tieuDeId = useId();
  useEffect(() => {
    datKhuChat(ref.current);
    return () => datKhuChat(null);
  }, []);
  return (
    <section id={id} className={s.hnb} aria-labelledby={tieuDeId}>
      <div className={s.loi}>
        <h2 id={tieuDeId} className={s.tieuDe}>{tieuDe}</h2>
        <p className={s.mota}>{mota}</p>
        {goiY.length > 0 && (
          <div className={s.goiY} role="group" aria-label="Câu hỏi gợi ý">
            {goiY.slice(0, 4).map((g) => <button key={g} type="button" className={s.chip} onClick={() => hoiNguoiBan(g)}>{g}</button>)}
          </div>
        )}
      </div>
      <div ref={ref} className={s.khung} />
    </section>
  );
}
