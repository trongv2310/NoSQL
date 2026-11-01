import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { Page } from "@/components/Ui";

const DIA_CHI = "140 Lê Trọng Tấn, Tây Thạnh, Tân Phú, TP.HCM";
const BAN_DO = `https://www.google.com/maps?q=${encodeURIComponent("140 Lê Trọng Tấn, Tây Thạnh, Tân Phú")}`;

const THE: { icon: string; nhan: string; gt: string; href?: string; tone: string }[] = [
  { icon: "fa-location-dot", nhan: "Địa chỉ cửa hàng", gt: DIA_CHI, tone: "brand" },
  { icon: "fa-phone-volume", nhan: "Hotline tư vấn", gt: "0123456789", href: "tel:0123456789", tone: "hot" },
  { icon: "fa-envelope", nhan: "Email", gt: "HUIT@gmail.com", href: "mailto:HUIT@gmail.com", tone: "navy" },
  { icon: "fa-clock", nhan: "Giờ mở cửa", gt: "8:00 – 21:00 mỗi ngày", tone: "plum" },
];

export default function LienHePage() {
  return (
    <>
      <PageHero compact tone="green" kicker="Liên hệ" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Liên hệ" }]}
        title={<>Ghé cửa hàng, <em>thử dụng cụ</em> tại chỗ</>} sub="Đến xem và cầm thử vợt, giày, trang phục — hoặc gọi hotline để được tư vấn chọn đúng món." />
      <Page className="cn-wrap">
        <div className="cn-grid">
          <div className="cn-tiles">
            {THE.map((t) => {
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
            <div className="cn-actions sf-reveal">
              <a href={BAN_DO} target="_blank" rel="noreferrer" className="cn-btn is-solid"><i className="fa-solid fa-diamond-turn-right" aria-hidden="true" /> Chỉ đường</a>
              <Link href="/SanPham/Index" className="cn-btn is-ghost">Xem sản phẩm <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
            </div>
          </div>
          <div className="cn-map sf-reveal">
            <iframe title="Bản đồ cửa hàng" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              src="https://www.google.com/maps?q=140+L%C3%AA+Tr%E1%BB%8Dng+T%E1%BA%A5n,+T%C3%A2y+Th%E1%BA%A1nh,+T%C3%A2n+Ph%C3%BA&output=embed" />
          </div>
        </div>
      </Page>
    </>
  );
}
