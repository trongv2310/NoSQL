"use client";

import Link from "next/link";
import { useMemo } from "react";
import anhAoQuan from "@/assets/trang-chu/danh-muc-trang-phuc.webp";
import anhGiay from "@/assets/trang-chu/danh-muc-giay.webp";
import anhPhuKien from "@/assets/trang-chu/danh-muc-phu-kien.webp";
import anhVot from "@/assets/trang-chu/danh-muc-vot.webp";
import { useCatalog } from "@/components/landing/CatalogProvider";
import { fontTieuDe } from "@/components/landing/fonts";
import { vnd } from "@/lib/format";
import { LOAI, demTheoHang, demTheoLoai, lienKetHang, lienKetVotTheoGia, votTheoTamGia, type KhoaLoai } from "@/lib/landing-data";
import { DuLieuKhu, Khu } from "./KhuChung";
import { TheDieuHuong } from "./TheDieuHuong";
import s from "./gian-hang.module.css";

const THU_TU_LOAI: KhoaLoai[] = ["vot", "giay", "aoquan", "phukien"];
const ANH_LOAI = { vot: anhVot, giay: anhGiay, aoquan: anhAoQuan, phukien: anhPhuKien };

/** Số sản phẩm và giá thấp nhất trong từng danh mục dùng dữ liệu kho. */
export function DanhMucBento() {
  const kho = useCatalog();
  const dem = useMemo(() => demTheoLoai(kho.items), [kho.items]);
  const ok = kho.trangThai === "ok";
  return (
    <Khu id="danh-muc" kicker="Danh mục" tieuDe="Bốn nhóm hàng của shop" lienKet={{ href: "/SanPham/Index", nhan: "Xem tất cả sản phẩm" }}>
      <ul className={s.danhMuc} role="list">
        {THU_TU_LOAI.map((khoa) => {
          const d = dem[khoa];
          return (
            <li key={khoa} className="sf-reveal">
              <TheDieuHuong href={`/SanPham/Index?loai=${LOAI[khoa].slug}`} tieuDe={LOAI[khoa].ten}
                anh={ANH_LOAI[khoa]} sizes="(max-width: 991px) 50vw, 25vw">
                {ok && d.so > 0 && (
                  <>
                    <span>{d.so} sản phẩm</span>
                    {d.giaTu !== null && <strong>từ {vnd(d.giaTu)}</strong>}
                  </>
                )}
              </TheDieuHuong>
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
