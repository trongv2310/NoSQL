import Link from "next/link";
import Image from "next/image";
import { layNoiDungLanding } from "@/lib/server-api";
import { fontTieuDe } from "./fonts";
import { HeroScroll } from "./HeroScroll";
import { OpenChatButton } from "./OpenChatButton";
import { RvHeading } from "./Words";
import s from "./trust.module.css";

/** Đánh giá quá ngắn (vd. "ok") không giúp người đọc quyết định nên không đưa lên trang chủ. */
const DO_DAI_TOI_THIEU = 20;

const HANG = [
  { ten: "Yonex", slug: "yonex", q: "Yonex" },
  { ten: "Li-Ning", slug: "lining", q: "Lining" },
  { ten: "Victor", slug: "victor", q: "Victor" },
  { ten: "Mizuno", slug: "mizuno", q: "Mizuno" },
] as const;

/** Đánh giá thật từ khách (không có đánh giá phù hợp thì bỏ cả khối) và thương hiệu đang bán. */
export async function Reviews() {
  const nd = await layNoiDungLanding();
  const ds = (nd?.danhGia ?? []).filter((r) => r.noiDung.trim().length >= DO_DAI_TOI_THIEU);
  if (ds.length === 0) return null;
  const [dau, ...con] = ds;
  return (
    <section id="danh-gia" className={s.reviews} aria-labelledby="danh-gia-title">
      <div className="container">
        <RvHeading id="danh-gia-title" className={`${s.title} ${fontTieuDe.className}`} text="Khách hàng nói gì" />
        <div className={s.grid}>
          {[dau, ...con].map((r, i) => (
            <figure key={r.id} className={i === 0 ? s.quoteMain : s.quote} data-rv="up">
              <p className={s.stars} aria-label={`${r.danhGia} trên 5 sao`}>
                <span aria-hidden="true">{"★".repeat(r.danhGia)}<i>{"★".repeat(5 - r.danhGia)}</i></span>
              </p>
              <blockquote>{r.noiDung}</blockquote>
              <figcaption><b>{r.tenKhachHang}</b>{r.tenSanPham && <span>{r.tenSanPham}</span>}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Brands() {
  return (
    <section className={s.brands} aria-label="Thương hiệu đang bán">
      <div className={`container ${s.brandRow}`}>
        <span className={s.brandLabel} data-rv="up">Đang bán</span>
        <ul className={s.logos}>
          {HANG.map((h) => (
            <li key={h.slug} data-rv="up">
              <Link href={`/SanPham/Index?hang=${h.q}`} className={s.logo} aria-label={`Xem sản phẩm ${h.ten}`}>
                {/* SVG tĩnh nhỏ: dùng thẻ img thường (next/image không tối ưu SVG). */}
                <img src={`/images/brands/${h.slug}.svg`} alt={h.ten} height={28} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <HeroScroll as="section" id="ket-thuc" mode="pass" className={s.final} aria-labelledby="cta-title">
      <div className={s.finalWorld} aria-hidden="true">
        <Image src="/images/landing/hero-court.webp" alt="" fill sizes="100vw" className={s.finalImg} />
      </div>
      <div className={`container ${s.finalInner}`}>
        <RvHeading id="cta-title" className={`${s.finalTitle} ${fontTieuDe.className}`} text="Chọn xong dụng cụ, ra sân thôi." />
        <div className={s.finalActions} data-rv="up">
          <Link href="/SanPham/Index" className={s.btnPrimary}>Xem sản phẩm <span aria-hidden="true">→</span></Link>
          <OpenChatButton className={s.btnGhost}>Hỏi trợ lý tư vấn</OpenChatButton>
        </div>
      </div>
    </HeroScroll>
  );
}
