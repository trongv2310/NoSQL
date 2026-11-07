import Image from "next/image";
import Link from "next/link";
import { ngay, imgUrl } from "@/lib/format";
import { layNoiDungLanding } from "@/lib/server-api";
import type { TinV } from "@/lib/types";
import { fontTieuDe } from "./fonts";
import { HeroScroll } from "./HeroScroll";
import s from "./story.module.css";

/**
 * "Câu chuyện trên sân": một khoảng nghỉ giữa hai khu mua sắm. Ba câu chữ sáng dần theo cuộn (desktop, có khung dính),
 * rồi bài viết nổi bật hiện ra. Trên điện thoại hoặc khi giảm chuyển động: bố cục dọc, không ghim, mọi thứ hiện sẵn.
 * Ảnh nền tạm dùng lại ảnh sân của hero ở vị trí cắt khác, chờ bộ ảnh giữa trang riêng (PLAN §8).
 */
export async function Story() {
  const nd = await layNoiDungLanding();
  const ds = [...(nd?.dsNoiBat ?? []), ...(nd?.tinMoi ?? [])];
  const chinh: TinV | undefined = ds[0];
  const them = ds.slice(1, 3);

  return (
    <HeroScroll as="section" id="cau-chuyen" mode="section" className={s.story} aria-label="Câu chuyện trên sân">
      <div className={s.stage}>
        <div className={s.media}>
          <Image src="/images/landing/hero-court.webp" alt="" fill sizes="100vw" className={s.img} />
        </div>
        <div className={s.shade} />
        <div className={`container ${s.inner}`}>
          <p className={`${s.beats} ${fontTieuDe.className}`}>
            <span>Cầu bay nhanh.</span>
            <span>Một bước chân, một cú đổi hướng.</span>
            <span className={s.beatEnd}>Dụng cụ nên theo kịp bạn.</span>
          </p>
          <div className={s.side}>
            {chinh ? (
              <article className={s.article}>
                <span className={s.articleThumb}>
                  <Image src={imgUrl(chinh.hinhAnh)} alt="" fill sizes="(max-width: 767px) 40vw, 160px" className={s.articleImg} unoptimized={imgUrl(chinh.hinhAnh).startsWith("/uploads/")} />
                </span>
                <div className={s.articleBody}>
                  <span className={s.meta}>{chinh.nhanLoai} · {ngay(chinh.ngayDang)}</span>
                  <h3 className={s.articleTitle}><Link href={`/BangTin/${chinh.id}`}>{chinh.tieuDe}</Link></h3>
                  {chinh.tomTat && <p className={s.summary}>{chinh.tomTat}</p>}
                  {them.length > 0 && (
                    <ul className={s.more}>
                      {them.map((t) => <li key={t.id}><Link href={`/BangTin/${t.id}`}>{t.tieuDe}</Link></li>)}
                    </ul>
                  )}
                  <Link href="/BangTin" className={s.all}>Xem Bảng tin <span aria-hidden="true">→</span></Link>
                </div>
              </article>
            ) : (
              <div className={s.article}>
                <div className={s.articleBody}>
                  <h3 className={s.articleTitle}>Tin và bài hướng dẫn</h3>
                  <p className={s.summary}>Bài viết đang được cập nhật. Xem các tin mới nhất ở Bảng tin.</p>
                  <Link href="/BangTin" className={s.all}>Xem Bảng tin <span aria-hidden="true">→</span></Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </HeroScroll>
  );
}
