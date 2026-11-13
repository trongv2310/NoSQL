import Image from "next/image";
import Link from "next/link";
import { fontTieuDe } from "./fonts";
import { HeroScroll } from "./HeroScroll";
import s from "./landing.module.css";

/**
 * Hero hoàn toàn tĩnh: không đọc API nên luôn hiện cùng CTA, kể cả khi backend chậm hoặc lỗi.
 * Nút chính dẫn tới khu chọn lối chơi; "Xem sản phẩm" cho khách vào mua thẳng.
 * Ba lớp chữ (x1 tiêu đề, x2 vạch + giới thiệu, x3 nút) mỗi lớp có cửa sổ cuộn riêng để "hạ màn" lần lượt khi bắt đầu cuộn;
 * lớp tách riêng khỏi phần tử đang chạy animation mở màn nên hai cơ chế không giẫm lên nhau.
 */
function HeroCopy() {
  return (
    <div className={s.copy}>
      <div className={s.x1}>
        <p className={s.eyebrow}><span className={s.eyebrowDot} aria-hidden="true" />Cầu lông chính hãng</p>
        <h1 id="hero-title" className={`${s.title} ${fontTieuDe.className}`}>
          <span className={s.line}><span>Cú đánh tiếp theo.</span></span>
          <span className={`${s.line} ${s.lineAccent}`}><span>Là của bạn.</span></span>
        </h1>
      </div>
      <div className={s.x2}>
        <span className={s.rule} aria-hidden="true" />
        <p className={s.lede}>
          Chọn lối chơi của bạn, chúng tôi gợi ý đúng cây vợt. Vợt, giày, trang phục và phụ kiện chính hãng từ Yonex, <span className={s.nowrap}>Li-Ning</span>, Victor, Mizuno.
        </p>
      </div>
      <div className={s.x3}>
        <div className={s.cta}>
          <a href="#phong-cach" className={s.btnPrimary}>
            Khám phá lối chơi <span aria-hidden="true">→</span>
          </a>
          <Link href="/SanPham/Index" className={s.btnGhost}>Xem sản phẩm</Link>
        </div>
      </div>
    </div>
  );
}

/** Gợi ý cuộn ở chân hero (chỉ khi đủ chỗ). Điều hướng đã có ở menu chính nên hero không thêm lối tắt nào khác. */
function HeroFoot() {
  return (
    <div className={`container ${s.heroFoot}`}>
      <div className={s.cue}><span>Cuộn để đánh cầu</span><span className={s.cueTrack} aria-hidden="true"><i /></span></div>
    </div>
  );
}

/**
 * Hero "Match Point": quả cầu dừng sát mặt cước. Cảnh 3D (World) vẽ cận cảnh vợt và quả cầu bên phải, cuộn trang thì cú chạm cầu diễn ra.
 * Chưa có cảnh 3D (đang tải, thiết bị yếu, giảm chuyển động) thì dùng ảnh dựng sẵn của cùng khoảnh khắc đó; chữ và hai nút luôn hiện ngay.
 */
export function HeroCourt() {
  return (
    <HeroScroll id="hero" drift className={`${s.hero} ${s.heroCourt}`}>
      <div className={s.courtMask}>
        <div className={s.courtMedia}>
          <Image src="/images/landing/hero-matchpoint.webp" alt="" fill preload sizes="100vw" className={s.courtImg} />
        </div>
        <div className={s.courtShade} />
      </div>
      <div className={`container ${s.heroInner}`}><HeroCopy /></div>
      <HeroFoot />
    </HeroScroll>
  );
}
