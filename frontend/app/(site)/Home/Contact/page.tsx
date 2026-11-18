"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProviders";
import { PageHero } from "@/components/PageHero";
import { Page } from "@/components/Ui";

/**
 * Thông tin liên hệ chỉ lấy từ cấu hình thật của cửa hàng (API /site, xem backend/src/common/lien-he.ts).
 * Mục nào chưa có thì không hiển thị; chưa có mục nào thì nói rõ là đang cập nhật, không dùng số hay địa chỉ mẫu.
 */
export default function LienHePage() {
  const { site, ready } = useApp();
  const lh = site.lienHe;
  const the = [
    lh?.diaChi && { icon: "fa-location-dot", nhan: "Địa chỉ cửa hàng", gt: lh.diaChi, tone: "brand" },
    lh?.dienThoai && { icon: "fa-phone-volume", nhan: "Hotline tư vấn", gt: lh.dienThoai, href: `tel:${lh.dienThoai.replace(/[^0-9+]/g, "")}`, tone: "hot" },
    lh?.email && { icon: "fa-envelope", nhan: "Email", gt: lh.email, href: `mailto:${lh.email}`, tone: "navy" },
    lh?.gioMoCua && { icon: "fa-clock", nhan: "Giờ mở cửa", gt: lh.gioMoCua, tone: "plum" },
  ].filter((t): t is { icon: string; nhan: string; gt: string; href?: string; tone: string } => !!t);
  const diaChi = lh?.diaChi ?? null;

  return (
    <>
      <PageHero compact tone="green" kicker="Liên hệ" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Liên hệ" }]}
        title={<>Liên hệ <em>cửa hàng</em></>} sub="Thông tin liên hệ của cửa hàng." />
      <Page className="cn-wrap">
        <div className={diaChi ? "cn-grid" : undefined}>
          <div className="cn-tiles">
            {the.map((t) => {
              const noiDung = (
                <>
                  <span className={`cn-icon tone-${t.tone}`}><i className={`fa-solid ${t.icon}`} aria-hidden="true" /></span>
                  <span className="cn-text"><small>{t.nhan}</small><b>{t.gt}</b></span>
                </>
              );
              return t.href
                ? <a key={t.nhan} href={t.href} className="cn-tile sf-reveal">{noiDung}</a>
                : <div key={t.nhan} className="cn-tile sf-reveal">{noiDung}</div>;
            })}
            {ready && the.length === 0 && (
              <div className="cn-empty" role="status">
                <b>Thông tin liên hệ đang được cập nhật</b>
                <p>Cửa hàng chưa công bố địa chỉ, số điện thoại, email và giờ mở cửa. Trong lúc này bạn vẫn có thể hỏi trợ lý tư vấn ở góc phải màn hình hoặc xem sản phẩm.</p>
              </div>
            )}
            <div className="cn-actions sf-reveal">
              {diaChi && <a href={`https://www.google.com/maps?q=${encodeURIComponent(diaChi)}`} target="_blank" rel="noreferrer" className="cn-btn is-solid"><i className="fa-solid fa-diamond-turn-right" aria-hidden="true" /> Chỉ đường</a>}
              <Link href="/SanPham/Index" className="cn-btn is-ghost">Xem sản phẩm <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
            </div>
          </div>
          {diaChi && (
            <div className="cn-map sf-reveal">
              <iframe title="Bản đồ cửa hàng" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps?q=${encodeURIComponent(diaChi)}&output=embed`} />
            </div>
          )}
        </div>
      </Page>
    </>
  );
}
