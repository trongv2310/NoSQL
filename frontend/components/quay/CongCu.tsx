"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useCatalog } from "@/components/landing/CatalogProvider";
import { fontTieuDe } from "@/components/landing/fonts";
import { ProductImage } from "@/components/landing/ProductImage";
import { laVot, thongKeKho, votCoSucCang, type SanPhamLanding } from "@/lib/landing-data";
import { Khu } from "./KhuChung";
import { SoDem } from "./SoDem";
import s from "./cong-cu.module.css";

/** Dải số liệu ngay dưới màn hình đầu: mọi con số đếm từ danh sách sản phẩm đang bán (xem `thongKeKho`), không số nào tự đặt. */
export function DaiSoLieu() {
  const kho = useCatalog();
  const t = useMemo(() => thongKeKho(kho.items), [kho.items]);
  if (kho.trangThai === "error") return null;
  if (kho.trangThai === "loading") return <div className={s.dai} aria-hidden="true"><div className={`container ${s.daiTrong}`} /></div>;
  if (t.soSanPham === 0) return null;
  const muc = [
    { so: t.soSanPham, nhan: "sản phẩm" },
    { so: t.soVot, nhan: "mẫu vợt" },
    { so: t.soHang, nhan: "thương hiệu" },
    { so: t.soDangGiam, nhan: "đang giảm giá" },
  ];
  return (
    <section className={s.dai} aria-label="Số liệu cửa hàng lúc này">
      <div className={`container ${s.daiTrong}`}>
        <dl className={s.daiLuoi}>
          {muc.map((m) => (
            <div key={m.nhan} className={`${s.soLieu} sf-reveal`}>
              <dt className={s.soNhan}>{m.nhan}</dt>
              <dd className={s.soGiaTri}><SoDem den={m.so} className={fontTieuDe.className} /></dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Một ô công cụ: ảnh thật phủ kín ô, chữ ngắn đặt trên lớp phủ tối ở đáy ảnh. Cả ô là một liên kết. */
function O({ cls, href, tieuDe, dong, hinh, nhan }: { cls: string; href: string; tieuDe: string; dong: string; hinh: React.ReactNode; nhan?: React.ReactNode }) {
  const trong = href.startsWith("#");
  return (
    <li className={`${s.o} ${cls} sf-reveal`}>
      <div className={s.anh} aria-hidden="true">{hinh}</div>
      {nhan}
      <div className={s.chu}>
        <h3 className={`${s.oTen} ${fontTieuDe.className}`}>
          {trong ? <a href={href} className={s.oLienKet}>{tieuDe}</a> : <Link href={href} className={s.oLienKet}>{tieuDe}</Link>}
        </h3>
        <p className={s.oDong}>{dong} <i aria-hidden="true">→</i></p>
      </div>
    </li>
  );
}

const anh = (src: string, viTri: string, sizes: string) => (
  <Image src={src} alt="" fill sizes={sizes} className={s.anhImg} style={{ objectPosition: viTri }} />
);

/**
 * Năm công cụ của shop, mỗi ô là ảnh thật + tên + một dòng (ảnh căng cước: Wikimedia Commons, xem public/images/CREDITS.txt). Ô "So sánh vợt" ghép ảnh 3 cây vợt còn hàng thật trong kho; ô "Trạm căng cước"
 * dẫn tới một cây vợt thật có ghi sức căng và hiện đúng khoảng căng đó.
 */
export function CongCu() {
  const kho = useCatalog();
  const vot = useMemo(() => votCoSucCang(kho.items), [kho.items]);
  const baVot = useMemo(
    () => kho.items.filter((sp) => laVot(sp) && sp.tongTonKho > 0 && sp.hinhAnhDaiDien).sort((a, b) => b.giaSauKhuyenMai - a.giaSauKhuyenMai).slice(0, 3),
    [kho.items],
  );
  const lienKetCang = (sp: SanPhamLanding | null) => (sp ? `/Home/ChiTietSanPham/${sp.id}` : "/SanPham/Index?loai=Vot");
  return (
    <Khu id="cong-cu" nen="xam" kicker="Công cụ của shop" tieuDe="Chọn đúng vợt trước khi mua">
      <ul className={s.luoi}>
        <O cls={s.o1} href="#quay-tu-van" tieuDe="Chọn vợt theo lối chơi" dong="3 cây hợp bạn, còn hàng"
          hinh={anh("/images/landing/hero-matchpoint.webp", "62% 45%", "(max-width: 767px) 100vw, 42vw")} />
        <O cls={s.o2} href="/so-sanh" tieuDe="So sánh vợt" dong="Đặt 2–3 cây cạnh nhau"
          hinh={baVot.length === 3
            ? <span className={s.baVot}>{baVot.map((sp) => <span key={sp.id} className={s.motVot}><ProductImage src={sp.hinhAnhDaiDien} alt="" sizes="160px" hoaNen /></span>)}</span>
            : anh("/images/landing/hero-poster.webp", "75% 50%", "(max-width: 767px) 100vw, 34vw")} />
        <O cls={s.o3} href="/tu-vot" tieuDe="Tủ vợt của tôi" dong="Nhớ ngày căng, nhắc căng lại"
          hinh={anh("/images/landing/cat-vot.webp", "50% 22%", "(max-width: 767px) 100vw, 25vw")} />
        <O cls={s.o4} href={lienKetCang(vot)} tieuDe="Trạm căng cước" dong="Căng đúng mức nhà sản xuất cho phép"
          hinh={anh("/images/thuc-te/cang-cuoc.webp", "50% 55%", "(max-width: 767px) 100vw, 58vw")}
          nhan={vot?.thongSoVot?.sucCang ? <span className={s.nhanCang}>{vot.thongSoVot.sucCang}</span> : undefined} />
        <O cls={s.o5} href="#hoi-nguoi-ban" tieuDe="Hỏi người bán" dong="Hỏi giá, tồn kho, khuyến mãi"
          hinh={anh("/images/landing/cat-aoquan.webp", "50% 18%", "(max-width: 767px) 100vw, 42vw")} />
      </ul>
    </Khu>
  );
}
