"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useCatalog } from "@/components/landing/CatalogProvider";
import { fontTieuDe } from "@/components/landing/fonts";
import { vnd } from "@/lib/format";
import { LOAI, demTheoHang, demTheoLoai, lienKetHang, lienKetVotTheoGia, votTheoTamGia, type KhoaLoai } from "@/lib/landing-data";
import { DuLieuKhu, Khu } from "./KhuChung";
import s from "./gian-hang.module.css";

const THU_TU_LOAI: KhoaLoai[] = ["vot", "giay", "aoquan", "phukien"];
const ANH_LOAI: Record<KhoaLoai, string> = { vot: "cat-vot", giay: "cat-giay", aoquan: "cat-aoquan", phukien: "cat-phukien" };

/** Danh mục dạng mosaic: vợt là ô lớn. Số sản phẩm, số còn hàng, số đang giảm và giá thấp nhất đều đếm từ dữ liệu. */
export function DanhMucBento() {
  const kho = useCatalog();
  const dem = useMemo(() => demTheoLoai(kho.items), [kho.items]);
  const ok = kho.trangThai === "ok";
  return (
    <Khu id="danh-muc" kicker="Danh mục" tieuDe="Bốn nhóm hàng của shop" lienKet={{ href: "/SanPham/Index", nhan: "Xem tất cả sản phẩm" }}>
      <ul className={s.mosaic}>
        {THU_TU_LOAI.map((khoa, i) => {
          const d = dem[khoa];
          return (
            <li key={khoa} className={`${s.manh} ${i === 0 ? s.manhLon : ""} ${i === 3 ? s.manhRong : ""} sf-reveal`}>
              <Link href={`/SanPham/Index?loai=${LOAI[khoa].slug}`} className={s.manhLienKet}>
                <Image src={`/images/landing/${ANH_LOAI[khoa]}.webp`} alt="" fill sizes={i === 0 ? "(max-width: 767px) 100vw, 50vw" : "(max-width: 767px) 50vw, 25vw"} className={s.manhAnh} />
                <span className={s.manhPhu} aria-hidden="true" />
                <span className={s.manhChu}>
                  <b className={`${s.manhTen} ${fontTieuDe.className}`}>{LOAI[khoa].ten}</b>
                  {ok && d.so > 0 && (
                    <span className={s.manhSo}>
                      <span>{d.so} sản phẩm</span>
                      {d.giaTu !== null && <span>từ {vnd(d.giaTu)}</span>}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Khu>
  );
}

/** Vợt theo tầm giá: ba bậc thang theo ba mốc của bộ chọn vợt; chiều cao cột tỉ lệ với số vợt còn hàng thật trong tầm. */
export function TamGia() {
  const kho = useCatalog();
  const tam = useMemo(() => votTheoTamGia(kho.items), [kho.items]);
  const max = Math.max(1, ...tam.map((t) => t.so));
  return (
    <Khu id="tam-gia" nen="xam" kicker="Theo ngân sách" tieuDe="Vợt còn hàng theo tầm giá">
      <DuLieuKhu>
        {() => (
          <ol className={s.thang}>
            {tam.map((t, i) => (
              <li key={t.ns.khoa} className={`${s.bac} sf-reveal`}>
                <div className={s.cotTrack}>
                  <div className={s.cot} style={{ height: `${t.so === 0 ? 8 : Math.max(26, Math.round((t.so / max) * 100))}%` }} data-bac={i}>
                    <span className={`${s.cotSo} ${fontTieuDe.className}`}>{t.so}</span>
                  </div>
                </div>
                <h3 className={`${s.bacTen} ${fontTieuDe.className}`}>{t.ns.nhan}</h3>
                <p className={s.bacMoTa}>
                  {t.so > 0 && t.giaThapNhat !== null && t.giaCaoNhat !== null
                    ? <>Từ {vnd(t.giaThapNhat)}</>
                    : "Chưa có vợt còn hàng"}
                </p>
                {t.so > 0 && <Link href={lienKetVotTheoGia(t.ns)} className={s.bacLienKet}>Xem {t.so} vợt <span aria-hidden="true">→</span><span className="visually-hidden"> {t.ns.nhan.toLocaleLowerCase("vi")}</span></Link>}
              </li>
            ))}
          </ol>
        )}
      </DuLieuKhu>
    </Khu>
  );
}

/** Logo SVG có sẵn trong public/images/brands, theo tên hãng viết thường bỏ dấu cách. Hãng chưa có logo thì hiện tên dạng chữ. */
const CO_LOGO = new Set(["lining", "mizuno", "victor", "yonex"]);
const logoHang = (ten: string) => { const k = ten.toLowerCase().replace(/[^a-z]/g, ""); return CO_LOGO.has(k) ? `/images/brands/${k}.svg` : null; };

/** Thương hiệu trong kho: logo hãng, số sản phẩm và giá thấp nhất, đếm từ dữ liệu đang bán. */
export function ThuongHieu() {
  const kho = useCatalog();
  const hang = useMemo(() => demTheoHang(kho.items), [kho.items]);
  return (
    <Khu id="thuong-hieu" nen="toi" kicker="Thương hiệu" tieuDe="Các hãng đang có trong kho">
      <DuLieuKhu>
        {() => hang.length === 0 ? null : (
          <ul className={s.hang}>
            {hang.map((h) => {
              const logo = logoHang(h.ten);
              return (
                <li key={h.ten} className={`${s.hangO} sf-reveal`}>
                  <Link href={lienKetHang(h.ten)} className={s.hangLienKet} aria-label={`${h.ten}: ${h.soSanPham} sản phẩm, từ ${vnd(h.giaTu)}`}>
                    <span className={s.hangLogo}>
                      {/* SVG tĩnh: thẻ img thường (next/image không tối ưu SVG). */}
                      {logo ? <img src={logo} alt="" /> : <span className={`${s.hangTen} ${fontTieuDe.className}`}>{h.ten}</span>}
                    </span>
                    <span className={s.hangChan}>
                      <span><b className={fontTieuDe.className}>{h.soSanPham}</b> sản phẩm</span>
                      <span>từ {vnd(h.giaTu)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DuLieuKhu>
    </Khu>
  );
}
