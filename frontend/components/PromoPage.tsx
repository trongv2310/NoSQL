"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Countdown, CountUp, Tilt } from "@/components/Motion";
import { PageHero, ProductGridSkeleton } from "@/components/PageHero";
import { Empty, ErrorBox, ProductCard } from "@/components/Ui";
import { imgUrl, ngay, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { KhuyenMaiV, SanPhamV } from "@/lib/types";

interface Nhom { km: KhuyenMaiV; sps: SanPhamV[]; tietKiemMax: number; spNoiBat: SanPhamV | null }

const NGAY_MS = 86_400_000;
/** Bốn bảng màu xoay vòng cho từng chương trình để trang không bị đơn điệu. */
const TONE = ["hot", "brand", "navy", "plum"] as const;

const phanTram = (km: KhuyenMaiV) => Math.round(km.phanTramGiam);
const tietKiem = (s: SanPhamV) => Math.max(0, s.giaGoc - s.giaSauKhuyenMai);

/** Chip "Còn N ngày" — tính ở client sau khi mount để không lệch múi giờ/SSR. */
function ConLai({ den }: { den: string | null }) {
  const [ngayCon, setNgayCon] = useState<number | null>(null);
  useEffect(() => {
    if (!den) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNgayCon(Math.ceil((new Date(den).getTime() - Date.now()) / NGAY_MS));
  }, [den]);
  if (ngayCon === null) return null;
  const gap = ngayCon <= 7;
  return <span className={`pm-chip ${gap ? "is-urgent" : ""}`}><i className={`fa-solid ${gap ? "fa-bolt" : "fa-hourglass-half"}`} aria-hidden="true" /> {ngayCon <= 0 ? "Hôm nay là ngày cuối" : `Còn ${ngayCon.toLocaleString("vi-VN")} ngày`}</span>;
}

/** Trang khuyến mãi dùng chung cho /KhuyenMai/Index và /SanPham/KhuyenMai. */
export function PromoPage() {
  const { data, error, loading } = useApi<{ khuyenMais: KhuyenMaiV[]; sanPhams: SanPhamV[] }>("/san-pham/khuyen-mai");
  const [dangXem, setDangXem] = useState<string | null>(null);

  const nhoms = useMemo<Nhom[]>(() => {
    if (!data) return [];
    return data.khuyenMais.map((km) => {
      const sps = data.sanPhams.filter((s) => s.khuyenMai?.id === km.id);
      const spNoiBat = [...sps].sort((a, b) => tietKiem(b) - tietKiem(a))[0] ?? null;
      return { km, sps, tietKiemMax: spNoiBat ? tietKiem(spNoiBat) : 0, spNoiBat };
    });
  }, [data]);

  const coHang = useMemo(() => nhoms.filter((n) => n.sps.length > 0), [nhoms]);
  const sapCo = useMemo(() => nhoms.filter((n) => n.sps.length === 0), [nhoms]);
  const lonNhat = useMemo(() => [...coHang].sort((a, b) => b.km.phanTramGiam - a.km.phanTramGiam)[0] ?? null, [coHang]);
  const ketThucSom = useMemo(() => {
    const ds = nhoms.filter((n) => n.km.ngayKetThuc).sort((a, b) => new Date(a.km.ngayKetThuc as string).getTime() - new Date(b.km.ngayKetThuc as string).getTime());
    return ds[0] ?? null;
  }, [nhoms]);
  const giamToiDa = nhoms.reduce((m, n) => Math.max(m, phanTram(n.km)), 0);
  const tongSp = new Set(nhoms.flatMap((n) => n.sps.map((s) => s.id))).size;

  // Tô sáng chương trình đang xem trên thanh điều hướng dính.
  useEffect(() => {
    if (!coHang.length) return;
    const quanSat = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setDangXem(e.target.id.replace("km-", ""));
    }, { rootMargin: "-35% 0px -60% 0px" });
    coHang.forEach((n) => { const el = document.getElementById(`km-${n.km.id}`); if (el) quanSat.observe(el); });
    return () => quanSat.disconnect();
  }, [coHang]);

  const nhay = (id: string) => document.getElementById(`km-${id}`)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

  useEffect(() => { document.title = "Khuyến mãi & ưu đãi - Cửa Hàng Cầu Lông"; }, []);

  const aside = ketThucSom?.km.ngayKetThuc ? (
    <div className="pm-hero-timer">
      <span><i className="fa-solid fa-stopwatch" aria-hidden="true" /> Ưu đãi kết thúc sớm nhất</span>
      <b>{ketThucSom.km.tenChuongTrinh}</b>
      <Countdown den={ketThucSom.km.ngayKetThuc} />
    </div>
  ) : null;

  return (
    <>
      <PageHero tone="orange" kicker="Săn deal cầu lông" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Khuyến mãi" }]}
        title={<>Ưu đãi <em>nóng hổi</em>,<br />chốt ngay kẻo lỡ</>}
        sub="Giá đã được trừ sẵn khuyến mãi trên từng sản phẩm. Chọn chương trình bên dưới và xem ngay món bạn cần."
        stats={data ? [{ value: <CountUp to={nhoms.length} />, nhan: "Chương trình" }, { value: <>{giamToiDa > 0 ? <>đến <CountUp to={giamToiDa} />%</> : "—"}</>, nhan: "Mức giảm cao nhất" }, { value: <CountUp to={tongSp} />, nhan: "Sản phẩm đang giảm" }] : undefined}
        aside={aside} />

      {nhoms.length > 0 && (
        <div className="pm-ribbon" aria-hidden="true">
          <div className="pm-ribbon-track">
            {[0, 1].map((k) => (
              <div key={k} className="pm-ribbon-set">
                {nhoms.map((n) => <span key={`${k}-${n.km.id}`}><i className="fa-solid fa-fire" /> GIẢM {phanTram(n.km)}% · {n.km.tenChuongTrinh.toUpperCase()}</span>)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="container pm-wrap">
        {loading && !data ? <ProductGridSkeleton n={8} cot="col-6 col-lg-3" />
          : error || !data ? <ErrorBox message={error ?? "Lỗi tải dữ liệu"} />
          : nhoms.length === 0 ? <Empty message="Hiện chưa có chương trình khuyến mãi nào đang diễn ra." linkUrl="/SanPham/Index" linkText="Xem sản phẩm" />
          : (
            <>
              {coHang.length > 1 && (
                <nav className="pm-tabs" aria-label="Chọn chương trình khuyến mãi">
                  {coHang.map((n, i) => (
                    <button key={n.km.id} type="button" className={`pm-tab tone-${TONE[i % TONE.length]}${dangXem === n.km.id ? " is-on" : ""}`} aria-current={dangXem === n.km.id ? "true" : undefined} onClick={() => nhay(n.km.id)}>
                      <b>-{phanTram(n.km)}%</b><span>{n.km.tenChuongTrinh}</span>
                    </button>
                  ))}
                </nav>
              )}

              {lonNhat?.spNoiBat && (
                <div className="pm-feature sf-reveal">
                  <Tilt className="pm-feature-card" max={5}>
                    <div className="pm-feature-copy">
                      <span className="pm-flag"><i className="fa-solid fa-crown" aria-hidden="true" /> Deal lớn nhất hôm nay</span>
                      <h2>{lonNhat.km.tenChuongTrinh}</h2>
                      <p>{lonNhat.km.moTa || "Ưu đãi dành cho các sản phẩm chọn lọc."}</p>
                      <div className="pm-feature-price">
                        <span>{lonNhat.spNoiBat.tenSanPham}</span>
                        <strong>{vnd(lonNhat.spNoiBat.giaSauKhuyenMai)}</strong>
                        <s>{vnd(lonNhat.spNoiBat.giaGoc)}</s>
                        <em>Tiết kiệm {vnd(tietKiem(lonNhat.spNoiBat))}</em>
                      </div>
                      <div className="pm-feature-actions">
                        <Link href={`/Home/ChiTietSanPham/${lonNhat.spNoiBat.id}`} className="pm-btn is-solid">Xem sản phẩm <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
                        <button type="button" className="pm-btn is-ghost" onClick={() => nhay(lonNhat.km.id)}>Xem cả chương trình</button>
                      </div>
                    </div>
                    <div className="pm-feature-art">
                      <span className="pm-burst" aria-hidden="true">-{phanTram(lonNhat.km)}%</span>
                      { }
                      <img src={imgUrl(lonNhat.spNoiBat.hinhAnhDaiDien)} alt={lonNhat.spNoiBat.tenSanPham} loading="eager" />
                    </div>
                  </Tilt>
                </div>
              )}

              {coHang.map((n, i) => (
                <section key={n.km.id} id={`km-${n.km.id}`} className={`pm-block tone-${TONE[i % TONE.length]}`}>
                  <header className="pm-head sf-reveal">
                    <span className="pm-medal" aria-label={`Giảm ${phanTram(n.km)} phần trăm`}><b>-{phanTram(n.km)}%</b><small>GIẢM</small></span>
                    <div className="pm-head-text">
                      <h2>{n.km.tenChuongTrinh}</h2>
                      {n.km.moTa && <p>{n.km.moTa}</p>}
                      <div className="pm-chips">
                        <span className="pm-chip"><i className="fa-regular fa-calendar" aria-hidden="true" /> {ngay(n.km.ngayBatDau)} – {ngay(n.km.ngayKetThuc)}</span>
                        <ConLai den={n.km.ngayKetThuc} />
                        {n.km.giamToiDa ? <span className="pm-chip"><i className="fa-solid fa-circle-info" aria-hidden="true" /> Giảm tối đa {vnd(n.km.giamToiDa)}</span> : null}
                        <span className="pm-chip is-ok"><i className="fa-solid fa-boxes-stacked" aria-hidden="true" /> {n.sps.length} sản phẩm</span>
                      </div>
                    </div>
                  </header>
                  <div className="row g-3 pm-grid">
                    {n.sps.map((s) => <div key={s.id} className="col-6 col-md-4 col-lg-3"><ProductCard sp={s} /></div>)}
                    {n.sps.length < 4 && (
                      <div className={`col-12 col-md-${n.sps.length === 1 ? 8 : 4} col-lg-${(4 - n.sps.length) * 3}`}>
                        <Link href="/SanPham/Index?giam_gia=1" className="pm-more sf-reveal">
                          <span className="pm-more-icon"><i className="fa-solid fa-bag-shopping" aria-hidden="true" /></span>
                          <strong>Còn nhiều ưu đãi khác đang chờ bạn</strong>
                          <small>Xem toàn bộ sản phẩm đang giảm giá và chọn món hợp lối chơi.</small>
                          <b>Xem sản phẩm giảm giá <i className="fa-solid fa-arrow-right" aria-hidden="true" /></b>
                        </Link>
                      </div>
                    )}
                  </div>
                </section>
              ))}

              {sapCo.length > 0 && (
                <section className="pm-soon sf-reveal" aria-label="Chương trình sắp có sản phẩm">
                  <h3><i className="fa-regular fa-clock" aria-hidden="true" /> Đang cập nhật sản phẩm</h3>
                  <p>Các chương trình này đã mở nhưng chưa gán sản phẩm. Quay lại sau hoặc <Link href="/SanPham/Index">xem toàn bộ sản phẩm</Link>.</p>
                  <ul>
                    {sapCo.map((n) => <li key={n.km.id}><b>-{phanTram(n.km)}%</b><span>{n.km.tenChuongTrinh}</span><small>đến {ngay(n.km.ngayKetThuc)}</small></li>)}
                  </ul>
                </section>
              )}
            </>
          )}
      </div>
    </>
  );
}
