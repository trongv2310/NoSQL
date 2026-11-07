import Image from "next/image";
import Link from "next/link";
import { fontTieuDe } from "./fonts";
import { HeroScroll } from "./HeroScroll";
import s from "./landing.module.css";

/**
 * Hero hoàn toàn tĩnh: không đọc API nên luôn hiện cùng CTA, kể cả khi backend chậm hoặc lỗi.
 * Ba lớp chữ (x1 tiêu đề, x2 vạch + giới thiệu, x3 nút) mỗi lớp có cửa sổ cuộn riêng để "hạ màn" lần lượt khi bắt đầu cuộn;
 * lớp tách riêng khỏi phần tử đang chạy animation mở màn nên hai cơ chế không giẫm lên nhau.
 */
function HeroCopy() {
  return (
    <div className={s.copy}>
      <div className={s.x1}>
        <h1 id="hero-title" className={`${s.title} ${fontTieuDe.className}`}>
          <span className={s.line}><span>Đúng vợt.</span></span>
          <span className={s.line}><span>Đúng giày.</span></span>
          <span className={`${s.line} ${s.lineAccent}`}><span>Vào trận.</span></span>
        </h1>
      </div>
      <div className={s.x2}>
        <span className={s.rule} aria-hidden="true" />
        <p className={s.lede}>
          Vợt, giày, trang phục và phụ kiện từ Yonex, <span className={s.nowrap}>Li-Ning</span>, Victor, Mizuno. Lọc theo ngân sách, xem tồn kho trước khi đặt.
        </p>
      </div>
      <div className={s.x3}>
        <div className={s.cta}>
          <Link href="/SanPham/Index" className={s.btnPrimary}>
            Xem sản phẩm <span aria-hidden="true">→</span>
          </Link>
          <a href="#tim-vot" className={s.btnGhost}>Tìm vợt phù hợp</a>
        </div>
      </div>
    </div>
  );
}

/** Hero: ảnh sân toàn khung, chữ đặt trên nền tối. Ảnh trôi nhẹ theo chuột và lùi chậm hơn chữ khi cuộn. */
export function HeroCourt() {
  return (
    <HeroScroll id="hero" drift className={`${s.hero} ${s.heroCourt}`}>
      <div className={s.courtMask}>
        <div className={s.courtMedia}>
          <Image src="/images/landing/hero-court.webp" alt="" fill preload sizes="100vw" className={s.courtImg} />
        </div>
        <div className={s.courtShade} />
      </div>
      <div className={`container ${s.heroInner}`}><HeroCopy /></div>
    </HeroScroll>
  );
}
