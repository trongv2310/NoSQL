import { Fragment, type CSSProperties } from "react";
import s from "./landing.module.css";

/**
 * Tiêu đề trồi từng từ khi cuộn tới (hiệu ứng do `LandingMotion` bật bằng `data-rv="words"`). Mỗi từ nằm trong một khung cắt
 * có chừa chỗ cho dấu tiếng Việt; chữ gốc là nhãn truy cập của tiêu đề, các từ tách ra chỉ để trình bày.
 */
export function RvHeading({ as: Tag = "h2", text, id, className }: { as?: "h2" | "h3"; text: string; id?: string; className?: string }) {
  const tu = text.split(" ");
  return (
    <Tag id={id} className={className} data-rv="words" aria-label={text}>
      {tu.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <span className={s.wm} aria-hidden="true"><span className={s.w} style={{ "--w": i } as CSSProperties}>{w}</span></span>
        </Fragment>
      ))}
    </Tag>
  );
}
