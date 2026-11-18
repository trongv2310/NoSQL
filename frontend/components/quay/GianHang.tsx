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
const MO_TA_LOAI: Record<KhoaLoai, string> = {
  vot: "Chọn theo lối chơi, độ cân bằng, độ cứng",
  giay: "Giày cầu lông theo size và màu",
  aoquan: "Áo, quần cầu lông theo size",
  phukien: "Cầu, quấn cán và đồ dùng đi kèm",
};

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
                  <span className={s.manhMoTa}>{MO_TA_LOAI[khoa]}</span>
                  {ok && d.so > 0 && (
                    <span className={s.manhSo}>
                      <span>{d.so} sản phẩm</span>
                      {d.giaTu !== null && <span>từ {vnd(d.giaTu)}</span>}
                      {d.soDangGiam > 0 && <span className={s.manhGiam}>{d.soDangGiam} đang giảm</span>}
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
    <Khu id="tam-gia" nen="xam" kicker="Theo ngân sách" tieuDe="Vợt còn hàng theo tầm giá" moTa="Số vợt đếm từ kho theo giá đang bán (đã trừ khuyến mãi). Bấm vào một tầm để xem danh sách đã lọc giá.">
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
                    ? <>{t.so} vợt còn hàng, giá từ {vnd(t.giaThapNhat)}{t.giaCaoNhat !== t.giaThapNhat ? <> đến {vnd(t.giaCaoNhat)}</> : null}.</>
                    : "Hiện chưa có vợt còn hàng trong tầm giá này."}
                </p>
                {t.so > 0 && <Link href={lienKetVotTheoGia(t.ns)} className={s.bacLienKet}>Xem vợt {t.ns.nhan.toLocaleLowerCase("vi")} <span aria-hidden="true">→</span></Link>}
              </li>
            ))}
          </ol>
        )}
      </DuLieuKhu>
    </Khu>
  );
}

const MAU_LOAI: Record<KhoaLoai, string> = { vot: "#8fe0bd", giay: "#ff8a2a", aoquan: "#f1e6c8", phukien: "#5d8a75" };

/** Thương hiệu trong kho: tên hãng, số sản phẩm và cơ cấu theo loại đếm từ dữ liệu. Chữ thương hiệu là tên hãng dạng chữ, không dùng logo. */
export function ThuongHieu() {
  const kho = useCatalog();
  const hang = useMemo(() => demTheoHang(kho.items), [kho.items]);
  return (
    <Khu id="thuong-hieu" nen="toi" kicker="Thương hiệu" tieuDe="Các hãng đang có trong kho" moTa="Tên hãng và số sản phẩm đếm từ danh sách đang bán. Bấm vào một hãng để xem sản phẩm của hãng đó.">
      <DuLieuKhu>
        {() => hang.length === 0 ? null : (
          <ul className={s.hang}>
            {hang.map((h) => {
              const loai = THU_TU_LOAI.filter((k) => h.theoLoai[k]);
              return (
                <li key={h.ten} className={`${s.hangO} sf-reveal`}>
                  <Link href={lienKetHang(h.ten)} className={s.hangLienKet} aria-label={`${h.ten}: ${h.soSanPham} sản phẩm`}>
                    <span className={`${s.hangTen} ${fontTieuDe.className}`}>{h.ten}</span>
                    <span className={s.hangSo}><b className={fontTieuDe.className}>{h.soSanPham}</b> sản phẩm</span>
                    <span className={s.coCau} aria-hidden="true">
                      {loai.map((k) => <i key={k} style={{ flexGrow: h.theoLoai[k], background: MAU_LOAI[k] }} />)}
                    </span>
                    <span className={s.chuThich}>{loai.map((k) => <span key={k}><i style={{ background: MAU_LOAI[k] }} aria-hidden="true" />{LOAI[k].tenNgan} {h.theoLoai[k]}</span>)}</span>
                    <span className={s.hangChan}>
                      <span>Từ {vnd(h.giaTu)}</span>
                      {h.soDangGiam > 0 && <span className={s.hangGiam}>{h.soDangGiam} đang giảm</span>}
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
