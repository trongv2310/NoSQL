"use client";

import Link from "next/link";
import { useMemo } from "react";
import { datHoSo, useHoSo, xoaHoSo } from "@/components/HoSoChoi";
import { useCatalog } from "@/components/landing/CatalogProvider";
import { fontTieuDe } from "@/components/landing/fonts";
import { ProductCard } from "@/components/product/ProductCard";
import { KINH_NGHIEM, LOAI, NGAN_SACH_VOT, PHONG_CACH, votTheoHoSo, type GoiYVot } from "@/lib/landing-data";
import { NHAN_LOI_CHOI, hoSoTrong, type HoSo } from "@/lib/ho-so-choi";
import s from "./quay.module.css";

const SO_VOT = 3;

/** Liên kết danh sách vợt đã lọc theo hồ sơ: lối chơi (lọc theo thông số ở backend) và tầm giá. */
export function lienKetVotTheoHoSo(h: Pick<HoSo, "lc" | "ns">): string {
  const q = new URLSearchParams({ loai: LOAI.vot.slug });
  if (h.lc) q.set("loi_choi", h.lc);
  const ns = NGAN_SACH_VOT.find((n) => n.khoa === h.ns);
  if (ns) {
    if (ns.tu > 0) q.set("gia_tu", String(ns.tu));
    if (Number.isFinite(ns.den)) q.set("gia_den", String(ns.den - 1));
  }
  return `/SanPham/Index?${q.toString()}`;
}

function Nhom({ so, tieuDe, children }: { so: string; tieuDe: string; children: React.ReactNode }) {
  return (
    <div className={s.nhom} role="group" aria-label={tieuDe}>
      <span className={s.legend} aria-hidden="true"><span className={`${s.buoc} ${fontTieuDe.className}`}>{so}</span><span className={s.tenNhom}>{tieuDe}</span></span>
      {children}
    </div>
  );
}

function CauVot({ x, nhan }: { x: GoiYVot; nhan?: string }) {
  return <li className={s.o}><ProductCard sp={x.sp} lyDo={x.lyDo[0]} nhan={nhan} dung themNhanh /></li>;
}

/**
 * Màn hình đầu "Quầy tư vấn": chọn lối chơi, trình độ, ngân sách (bấm là có kết quả ngay, không chặn điều hướng) và đúng 3 cây vợt còn hàng
 * dựng đứng với giá, tồn kho, dải thông số và lý do tính từ thông số thật. Chưa chọn gì: 3 vợt nổi bật mua được ngay. Ít hơn 3 vợt khớp thì nói
 * rõ và tách "gần khớp" riêng. Dữ liệu chưa về/lỗi thì phần chọn và các nút vẫn dùng được.
 */
export function QuayTuVan() {
  const kho = useCatalog();
  const hs = useHoSo();
  const kq = useMemo(() => votTheoHoSo(kho.items, hs, SO_VOT), [kho.items, hs]);
  const dang = kho.trangThai === "loading";
  const loi = kho.trangThai === "error";
  const chonLoiChoi = (k: NonNullable<HoSo["lc"]>) => datHoSo({ lc: hs.lc === k ? null : k });
  const lienKet = lienKetVotTheoHoSo(hs);

  let trangThai: React.ReactNode = null;
  if (dang) trangThai = "Đang tải vợt còn hàng…";
  else if (loi) trangThai = <>Chưa tải được danh sách vợt. <button type="button" className={s.lienKetNut} onClick={kho.thuLai}>Thử lại</button> hoặc <Link href="/SanPham/Index?loai=Vot">xem tất cả vợt</Link>.</>;
  else if (kq.cheDo === "noi-bat") trangThai = kq.ds.length ? `${kq.ds.length} vợt nổi bật còn hàng · chọn lối chơi để lọc` : "Hiện chưa có vợt còn hàng kèm thông số để gợi ý.";
  else if (kq.cheDo === "khop") trangThai = `${kq.ds.length} vợt khớp lựa chọn, theo thông số trong kho`;
  else if (kq.cheDo === "it-khop") trangThai = `Chỉ ${kq.ds.length} vợt khớp: shop không nới điều kiện cho đủ ${SO_VOT}`;
  else trangThai = `Chưa có vợt còn hàng khớp. Thử đổi ngân sách hoặc lối chơi.`;

  return (
    <section id="quay-tu-van" className={s.quay} aria-labelledby="quay-tieu-de">
      <div className={`container ${s.trong}`}>
        <header className={s.dau}>
          <p className={s.kicker}>Quầy tư vấn</p>
          <h1 id="quay-tieu-de" className={s.h1}>Bạn chơi thế nào? <span>Shop chọn giúp 3 cây vợt.</span></h1>
        </header>

        <div className={s.luoi}>
          <div className={s.dieuKhien}>
            <Nhom so="01" tieuDe="Lối chơi">
              <div className={s.loiChoi}>
                {PHONG_CACH.map((p) => (
                  <button key={p.khoa} type="button" className={s.the} aria-pressed={hs.lc === p.khoa} onClick={() => chonLoiChoi(p.khoa)}>
                    <b>{p.ten}</b>
                    <span>{p.mota}</span>
                    <em>{p.dacTrung}</em>
                  </button>
                ))}
              </div>
            </Nhom>
            <Nhom so="02" tieuDe="Trình độ">
              <div className={s.chon}>
                {KINH_NGHIEM.map((k) => (
                  <button key={k.khoa} type="button" className={s.chip} aria-pressed={hs.kn === k.khoa} onClick={() => datHoSo({ kn: hs.kn === k.khoa ? null : k.khoa })} title={k.mota}>{k.nhan}</button>
                ))}
              </div>
            </Nhom>
            <Nhom so="03" tieuDe="Ngân sách">
              <div className={`${s.chon} ${s.chonCuon}`}>
                <button type="button" className={s.chip} aria-pressed={!hs.ns} onClick={() => datHoSo({ ns: null })}>Mọi tầm giá</button>
                {NGAN_SACH_VOT.map((n) => (
                  <button key={n.khoa} type="button" className={s.chip} aria-pressed={hs.ns === n.khoa} onClick={() => datHoSo({ ns: hs.ns === n.khoa ? null : n.khoa })}>{n.nhan}</button>
                ))}
              </div>
            </Nhom>
          </div>

          <div className={s.ketQua}>
            <p className={s.trangThai} role="status" aria-live="polite" aria-busy={dang}>{trangThai}</p>
            {dang ? (
              <ul className={s.ds} aria-hidden="true">{[0, 1, 2].map((i) => <li key={i} className={`${s.o} ${s.khung}`}><div /></li>)}</ul>
            ) : (
              <>
                {kq.ds.length > 0 && (
                  <ul className={s.ds} tabIndex={0} aria-label={`${kq.ds.length} vợt gợi ý`} key={`${hs.lc}-${hs.kn}-${hs.ns}`}>
                    {kq.ds.map((x) => <CauVot key={x.sp.id} x={x} />)}
                  </ul>
                )}
                {kq.ganKhop.length > 0 && (
                  <div className={s.gan}>
                    <h2 className={s.ganTieuDe}>Gần với lựa chọn của bạn, chưa khớp đủ</h2>
                    <ul className={s.ds} aria-label="Vợt gần khớp">{kq.ganKhop.map((x) => <CauVot key={x.sp.id} x={x} nhan="Gần khớp" />)}</ul>
                  </div>
                )}
              </>
            )}
          </div>
          <div className={s.chan}>
            {!hoSoTrong(hs) && <button type="button" className={s.xoa} onClick={xoaHoSo}>Xóa lựa chọn</button>}
            <Link href={lienKet} className={s.tatCa}>Xem tất cả vợt{hs.lc ? ` hợp lối chơi ${NHAN_LOI_CHOI[hs.lc]}` : ""} <span aria-hidden="true">→</span></Link>
            <a href="#hoi-nguoi-ban" className={s.hoi}>Hỏi người bán</a>
          </div>
        </div>
      </div>
    </section>
  );
}
