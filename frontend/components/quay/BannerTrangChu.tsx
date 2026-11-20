"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { useCatalog } from "@/components/landing/CatalogProvider";
import { fontTieuDe } from "@/components/landing/fonts";
import { ProductImage } from "@/components/landing/ProductImage";
import { ngay, vnd } from "@/lib/format";
import { LOAI, chonKhuyenMai, khuyenMaiConHang, phanTramGiam, thongKeKho, type SanPhamLanding } from "@/lib/landing-data";
import s from "./banner.module.css";

const THOI_GIAN_MOI_TRANG = 7000;

/** Ảnh quảng cáo có sẵn trong public/images, mỗi ảnh gắn với sản phẩm THẬT trong kho (tìm theo tên/hãng/loại). Không tìm được món còn hàng thì bỏ trang đó. */
const ANH_QUANG_CAO: { anh: string; alt: string; tim: (sp: SanPhamLanding) => boolean; nhom?: boolean; kicker: string; thePhai?: boolean }[] = [
  {
    anh: "/images/banner3.png", alt: "Ảnh quảng cáo vợt Yonex Nanoflare 1000", kicker: "Vợt nổi bật",
    tim: (sp) => /nanoflare\s*1000/i.test(sp.tenSanPham),
  },
  {
    // Chữ lớn của ảnh nằm bên trái nên thẻ sản phẩm đặt bên phải.
    anh: "/images/banner2.png", alt: "Ảnh quảng cáo vợt Yonex Astrox 99", kicker: "Vợt nổi bật", thePhai: true,
    tim: (sp) => /astrox\s*99/i.test(sp.tenSanPham),
  },
  {
    anh: "/images/banner1.png", alt: "Ảnh quảng cáo giày cầu lông Yonex", kicker: "Giày Yonex", nhom: true,
    tim: (sp) => /yonex/i.test(sp.hang?.tenHang ?? "") && /giày|giay/i.test(sp.loai?.tenLoai ?? ""),
  },
];

const conHang = (sp: SanPhamLanding) => sp.tongTonKho > 0;
const chiTiet = (sp: SanPhamLanding) => `/Home/ChiTietSanPham/${sp.id}`;

type Trang =
  | { loai: "gioi-thieu"; khoa: string }
  | { loai: "uu-dai"; khoa: string }
  | { loai: "quang-cao"; khoa: string; anh: string; alt: string; kicker: string; ds: SanPhamLanding[]; nhom: boolean; thePhai: boolean };

/**
 * Banner đầu trang chủ: băng trình chiếu gồm trang giới thiệu shop, trang ưu đãi đang chạy và các ảnh quảng cáo gắn với sản phẩm thật.
 * Mọi con số (số sản phẩm, mẫu vợt, hãng, % giảm, giá, ngày kết thúc) đều đếm/lấy từ dữ liệu kho của trang chủ, không có số tự đặt.
 * Băng cuộn ngang bằng scroll-snap (vuốt được trên điện thoại), tự chuyển trang sau 7 giây; dừng khi rê chuột, khi một phần tử bên trong
 * đang được focus, khi tab bị ẩn, khi người dùng bấm tạm dừng, và không tự chạy nếu hệ thống bật "giảm chuyển động".
 */
export function BannerTrangChu() {
  const { site } = useApp();
  const kho = useCatalog();
  const thongKe = useMemo(() => thongKeKho(kho.items), [kho.items]);
  const { chuongTrinh, giamToiDa } = useMemo(() => khuyenMaiConHang(kho.items), [kho.items]);
  const spGiam = useMemo(() => chonKhuyenMai(kho.items, 3), [kho.items]);

  const trang = useMemo<Trang[]>(() => {
    const ds: Trang[] = [{ loai: "gioi-thieu", khoa: "gioi-thieu" }];
    if (kho.trangThai !== "ok") return ds;
    if (spGiam.length) ds.push({ loai: "uu-dai", khoa: "uu-dai" });
    for (const a of ANH_QUANG_CAO) {
      const khop = kho.items.filter((sp) => a.tim(sp) && conHang(sp)).sort((x, y) => y.giaSauKhuyenMai - x.giaSauKhuyenMai);
      if (khop.length) ds.push({ loai: "quang-cao", khoa: a.anh, anh: a.anh, alt: a.alt, kicker: a.kicker, ds: khop, nhom: !!a.nhom, thePhai: !!a.thePhai });
    }
    return ds;
  }, [kho.items, kho.trangThai, spGiam.length]);

  const bang = useRef<HTMLDivElement>(null);
  const [viTri, setHienTai] = useState(0);
  // Số trang có thể giảm khi dữ liệu về: giới hạn ngay lúc render, không cần effect.
  const hienTai = Math.min(viTri, Math.max(0, trang.length - 1));
  const [tamDung, setTamDung] = useState(false);
  const [dangTuongTac, setDangTuongTac] = useState(false);
  const [giamChuyenDong, setGiamChuyenDong] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const capNhat = () => setGiamChuyenDong(mq.matches);
    capNhat();
    mq.addEventListener("change", capNhat);
    return () => mq.removeEventListener("change", capNhat);
  }, []);

  const den = useCallback((i: number) => {
    const el = bang.current;
    if (!el || !trang.length) return;
    const dich = (i + trang.length) % trang.length;
    el.scrollTo({ left: dich * el.clientWidth, behavior: giamChuyenDong ? "auto" : "smooth" });
  }, [trang.length, giamChuyenDong]);

  // Trang đang hiện = vị trí cuộn chia bề rộng (đúng cả khi người dùng tự vuốt).
  useEffect(() => {
    const el = bang.current;
    if (!el) return;
    let khung = 0;
    const khiCuon = () => {
      cancelAnimationFrame(khung);
      khung = requestAnimationFrame(() => setHienTai(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener("scroll", khiCuon, { passive: true });
    return () => { el.removeEventListener("scroll", khiCuon); cancelAnimationFrame(khung); };
  }, []);

  const tuChay = trang.length > 1 && !tamDung && !dangTuongTac && !giamChuyenDong;
  useEffect(() => {
    if (!tuChay) return;
    const hen = window.setTimeout(() => { if (document.visibilityState === "visible") den(hienTai + 1); }, THOI_GIAN_MOI_TRANG);
    return () => window.clearTimeout(hen);
  }, [tuChay, hienTai, den]);

  const khiPhim = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); den(hienTai + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); den(hienTai - 1); }
  };

  return (
    <section className={s.banner} aria-roledescription="carousel" aria-label="Giới thiệu và ưu đãi của shop"
      onMouseEnter={() => setDangTuongTac(true)} onMouseLeave={() => setDangTuongTac(false)}
      onFocus={() => setDangTuongTac(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDangTuongTac(false); }}>
      <div className="container">
        <div className={s.khung}>
          <div ref={bang} className={s.bang} tabIndex={0} onKeyDown={khiPhim} aria-live={tuChay ? "off" : "polite"}
            aria-label={`Trang ${hienTai + 1} trên ${trang.length}. Dùng phím mũi tên trái, phải để chuyển trang.`}>
            {trang.map((t, i) => (
              <div key={t.khoa} className={s.trang} role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${trang.length}`} aria-hidden={i !== hienTai} inert={i !== hienTai}>
                {t.loai === "gioi-thieu" && <TrangGioiThieu tenSite={site.tenSite} thongKe={kho.trangThai === "ok" ? thongKe : null} uuTien />}
                {t.loai === "uu-dai" && <TrangUuDai giamToiDa={giamToiDa} chuongTrinh={chuongTrinh.slice(0, 3)} ds={spGiam} />}
                {t.loai === "quang-cao" && <TrangQuangCao t={t} />}
              </div>
            ))}
          </div>

          {trang.length > 1 && (
            <>
              <button type="button" className={`${s.mui} ${s.muiTrai}`} onClick={() => den(hienTai - 1)} aria-label="Trang trước"><span aria-hidden="true">‹</span></button>
              <button type="button" className={`${s.mui} ${s.muiPhai}`} onClick={() => den(hienTai + 1)} aria-label="Trang sau"><span aria-hidden="true">›</span></button>
              <div className={s.dieuKhien}>
                {!giamChuyenDong && (
                  <button type="button" className={s.dung} onClick={() => setTamDung((v) => !v)} aria-pressed={tamDung}
                    aria-label={tamDung ? "Tiếp tục tự chuyển trang" : "Tạm dừng tự chuyển trang"}>
                    <span aria-hidden="true">{tamDung ? "▶" : "❚❚"}</span>
                  </button>
                )}
                <div className={s.cham} role="group" aria-label="Chọn trang">
                  {trang.map((t, i) => (
                    <button key={t.khoa} type="button" className={s.chamNut} aria-current={i === hienTai ? "true" : undefined}
                      aria-label={`Đến trang ${i + 1}`} onClick={() => den(i)}>
                      {i === hienTai && tuChay && <span key={`tien-${hienTai}`} className={s.tien} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function TrangGioiThieu({ tenSite, thongKe, uuTien }: { tenSite: string; thongKe: ReturnType<typeof thongKeKho> | null; uuTien?: boolean }) {
  return (
    <div className={s.gioiThieu}>
      <Image src="/images/landing/hero-court.webp" alt="" fill priority={uuTien} sizes="(max-width: 1320px) 100vw, 1290px" className={s.nenAnh} />
      <div className={s.gioiThieuNoiDung}>
        <p className={s.kicker}>{tenSite}</p>
        <p className={`${s.tieuDe} ${fontTieuDe.className}`}>Đồ cầu lông chọn theo đúng lối chơi của bạn</p>
        <p className={s.moTa}>Vợt, giày, trang phục và phụ kiện. Giá và tồn kho lấy thẳng từ kho của shop; thêm vào giỏ không cần đăng nhập.</p>
        {thongKe && (
          <ul className={s.soLieu} aria-label="Trong kho hôm nay">
            <li><b>{thongKe.soSanPham}</b><span>sản phẩm</span></li>
            <li><b>{thongKe.soVot}</b><span>mẫu vợt</span></li>
            <li><b>{thongKe.soHang}</b><span>thương hiệu</span></li>
          </ul>
        )}
        <div className={s.nut}>
          <a href="#quay-tu-van" className={s.nutChinh}>Chọn vợt theo lối chơi</a>
          <Link href="/SanPham/Index" className={s.nutPhu}>Xem tất cả sản phẩm</Link>
        </div>
      </div>
    </div>
  );
}

function TrangUuDai({ giamToiDa, chuongTrinh, ds }: { giamToiDa: number; chuongTrinh: ReturnType<typeof khuyenMaiConHang>["chuongTrinh"]; ds: SanPhamLanding[] }) {
  return (
    <div className={s.uuDai}>
      <div className={s.uuDaiChu}>
        <p className={`${s.kicker} ${s.kickerAm}`}>Ưu đãi đang chạy</p>
        <p className={`${s.tieuDe} ${s.tieuDeAm} ${fontTieuDe.className}`}>Giảm tới <span>{giamToiDa}%</span></p>
        <ul className={s.chuongTrinh}>
          {chuongTrinh.map((c) => (
            <li key={c.id}><b>{c.ten}</b> · giảm tới {c.giamToiDa}%{c.ngayKetThuc ? ` · đến ${ngay(c.ngayKetThuc)}` : ""}</li>
          ))}
        </ul>
        <div className={s.nut}>
          <Link href="/KhuyenMai/Index" className={s.nutChinh}>Xem tất cả ưu đãi</Link>
        </div>
      </div>
      <ul className={s.uuDaiSp}>
        {ds.map((sp) => (
          <li key={sp.id}>
            <Link href={chiTiet(sp)} className={s.theSp}>
              <span className={s.theAnh}><ProductImage src={sp.hinhAnhDaiDien} alt={sp.tenSanPham} sizes="160px" hoaNen /></span>
              <span className={s.nhanGiam}>-{phanTramGiam(sp)}%</span>
              <span className={s.theTen}>{sp.tenSanPham}</span>
              <span className={s.theGia}><b>{vnd(sp.giaSauKhuyenMai)}</b><s>{vnd(sp.giaGoc)}</s></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrangQuangCao({ t }: { t: Extract<Trang, { loai: "quang-cao" }> }) {
  const dau = t.ds[0];
  const giaThap = Math.min(...t.ds.map((sp) => sp.giaSauKhuyenMai));
  const href = t.nhom ? `/SanPham/Index?loai=${LOAI.giay.slug}&hang=Yonex` : chiTiet(dau);
  return (
    <div className={s.quangCao}>
      {/* Lớp nền là chính ảnh đó phóng to và làm mờ: ảnh có tỉ lệ khác khung vẫn lấp đầy mà không bị cắt mất chữ. */}
      <Image src={t.anh} alt="" fill sizes="(max-width: 1320px) 100vw, 1290px" className={s.qcNen} aria-hidden="true" />
      <Image src={t.anh} alt={t.alt} fill sizes="(max-width: 1320px) 100vw, 1290px" className={s.qcAnh} />
      <Link href={href} className={`${s.qcThe} ${t.thePhai ? s.qcThePhai : ""}`}>
        <span className={s.qcKicker}>{t.kicker}</span>
        {t.nhom
          ? <><span className={s.qcTen}>{t.ds.length} mẫu giày Yonex còn hàng</span><span className={s.qcGia}>Từ <b>{vnd(giaThap)}</b></span></>
          : <><span className={s.qcTen}>{dau.tenSanPham}</span>
            <span className={s.qcGia}><b>{vnd(dau.giaSauKhuyenMai)}</b>{dau.giaSauKhuyenMai < dau.giaGoc && <s>{vnd(dau.giaGoc)}</s>}</span></>}
        <span className={s.qcXem}>{t.nhom ? "Xem giày Yonex" : "Xem sản phẩm"} <span aria-hidden="true">→</span></span>
      </Link>
    </div>
  );
}
