import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import s from "./the-dieu-huong.module.css";

export function TheDieuHuong({ href, anh, sizes, tieuDe, nhan, gonTrenDienThoai, children }: {
  href: string;
  anh: StaticImageData;
  sizes: string;
  tieuDe: string;
  nhan?: string;
  gonTrenDienThoai?: boolean;
  children?: ReactNode;
}) {
  const LienKet = href.startsWith("#") ? "a" : Link;

  return (
    <LienKet href={href} className={s.the} data-gon={gonTrenDienThoai || undefined}>
      <div className={s.khungAnh}>
        <Image src={anh} alt="" fill sizes={sizes} className={s.anh} />
        {nhan && <span className={s.nhan}>{nhan}</span>}
      </div>
      <div className={s.noiDung}>
        <div className={s.chu}>
          <h3 className={s.ten}>{tieuDe}</h3>
          {children && <div className={s.moTa}>{children}</div>}
        </div>
        <span className={s.muiTen} aria-hidden="true">→</span>
      </div>
    </LienKet>
  );
}
