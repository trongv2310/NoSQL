"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { bayVaoGio } from "@/lib/cart-motion";
import { RelatedProducts } from "@/components/RelatedProducts";
import { ProductGallery } from "@/components/ProductGallery";
import { TEN_ANH_MORPH, anhDaBam } from "@/lib/morph";
import { InlineReviewForm } from "@/components/InlineReviewForm";
import { ProductPurchaseInfo } from "@/components/ProductPurchaseInfo";
import { useApp } from "@/components/AppProviders";
import { ErrorBox, Loading, Page, Stars } from "@/components/Ui";
import { api, apiPost, loiTuApi } from "@/lib/api";
import { imgUrl, ngay, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { BienTheV, SanPhamV } from "@/lib/types";

const CAC_TAB = ["mo-ta", "thong-so", "danh-gia"] as const;
type TabSanPham = typeof CAC_TAB[number];

interface ChiTiet {
  sanPham: SanPhamV;
  bienThes: BienTheV[];
  mauSacs: { id: string; tenMau: string }[];
  sizes: { id: string; tenSize: string; loaiSize: string }[];
  thongSoVot: BienTheV["thongSo"];
  danhGias: { id: string; noiDung: string; danhGia: number; ngayPhanHoi: string; tenKhachHang: string }[];
  trungBinhDanhGia: number;
  soDanhGia: number;
  giaBanThucTe: number;
}

export default function ChiTietSanPhamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, setCartCount, flash } = useApp();
  const { data, error, loading } = useApi<ChiTiet>(`/san-pham/${id}`);
  const [mauId, setMauId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [soLuong, setSoLuong] = useState(1);
  const anhSanPham = useRef<HTMLImageElement>(null);
  const nutThem = useRef<HTMLButtonElement>(null);
  const [dangThem, setDangThem] = useState(false);
  const [tab, setTab] = useState<TabSanPham>("mo-ta");
  const nutTab = useRef<(HTMLButtonElement | null)[]>([]);
  const [anhXem, setAnhXem] = useState<{ sanPhamId: string; bienTheId?: string; url: string } | null>(null);
  const [moDanhGia, setMoDanhGia] = useState(false);
  const [dangGuiDanhGia, setDangGuiDanhGia] = useState(false);
  const [danhGiaMoi, setDanhGiaMoi] = useState<(Pick<ChiTiet, "danhGias" | "trungBinhDanhGia" | "soDanhGia"> & { sanPhamId: string }) | null>(null);

  useEffect(() => {
    if (data) {
      document.title = `${data.sanPham.tenSanPham} - Cửa Hàng Cầu Lông`;
      const dau = data.bienThes.find((b) => b.soLuongTon > 0) ?? data.bienThes[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMauId(dau?.mau?.id ?? null);
      setSizeId(dau?.size?.id ?? null);
    }
  }, [data]);

  const bienThe = useMemo(
    () => data?.bienThes.find((b) => (b.mau?.id ?? null) === mauId && (b.size?.id ?? null) === sizeId) ?? null,
    [data, mauId, sizeId],
  );

  useEffect(() => {
    const docHash = () => setTab(window.location.hash === "#product-reviews" ? "danh-gia" : window.location.hash === "#product-specifications" ? "thong-so" : "mo-ta");
    docHash();
    window.addEventListener("hashchange", docHash);
    return () => window.removeEventListener("hashchange", docHash);
  }, [id]);

  if (loading) {
    // Dựng sẵn khung ảnh từ thẻ vừa bấm để ảnh "bay" sang đây (View Transitions) thay vì nháy trắng.
    const anhTam = anhDaBam(id);
    return (
      <Page>
        {anhTam ? (
          <div className="row g-4 pdp-layout"><div className="col-lg-5"><div className="pdp-gallery"><div className="product-detail-gallery"><span className="pdp-image-open">
            { }
            <img src={anhTam} alt="" width={640} height={640} style={{ viewTransitionName: TEN_ANH_MORPH }} />
          </span></div></div></div></div>
        ) : <Loading />}
      </Page>
    );
  }
  if (error || !data) return <Page><ErrorBox message={error ?? "Không tìm thấy sản phẩm."} /></Page>;
  const { sanPham: sp } = data;
  const phanHoi = danhGiaMoi?.sanPhamId === id ? danhGiaMoi : data;
  const capNhatDanhGia = async () => {
    const moi = await api<ChiTiet>(`/san-pham/${id}`);
    setDanhGiaMoi({ sanPhamId: id, danhGias: moi.danhGias, trungBinhDanhGia: moi.trungBinhDanhGia, soDanhGia: moi.soDanhGia });
  };
  const gia = bienThe?.giaThucTe ?? data.giaBanThucTe;
  const coGiam = sp.dangGiamGia && gia < (bienThe?.giaBan ?? sp.giaGoc);
  const giaGocHienThi = bienThe?.giaBan ?? sp.giaGoc;
  const conHang = !!bienThe && bienThe.soLuongTon > 0;
  const vuotTon = !!bienThe && soLuong > bienThe.soLuongTon;
  const anh = imgUrl(bienThe?.hinhAnh ?? sp.hinhAnhDaiDien);
  const anhHienThi = anhXem?.sanPhamId === id && anhXem.bienTheId === bienThe?.id ? anhXem.url : anh;
  const cacAnh = [...new Set([imgUrl(sp.hinhAnhDaiDien), ...data.bienThes.map((b) => imgUrl(b.hinhAnh || sp.hinhAnhDaiDien))])];
  const chonTab = (moi: TabSanPham) => setTab(moi);

  const themVaoGio = async (muaNgay: boolean) => {
    if (!user) {
      router.push(`/TaiKhoan/DangNhap?returnUrl=${encodeURIComponent(`/Home/ChiTietSanPham/${id}`)}`);
      return;
    }
    if (!bienThe) {
      flash("danger", "Vui lòng chọn phiên bản (màu/size) sản phẩm.");
      return;
    }
    if (!conHang || vuotTon) {
      flash("danger", "Số lượng đã chọn vượt quá tồn kho của phiên bản này.");
      return;
    }
    setDangThem(true);
    try {
      const r = await apiPost<{ message: string; cartCount: number }>("/gio-hang", { chiTietId: bienThe.id, quantity: soLuong });
      if (!muaNgay) await bayVaoGio(anhSanPham.current && anhSanPham.current.getBoundingClientRect().bottom > 0 ? anhSanPham.current : nutThem.current, anhHienThi);
      setCartCount(r.cartCount);
      flash("success", r.message);
      if (muaNgay) router.push("/Home/ViewCart");
    } catch (e) {
      flash("danger", loiTuApi(e));
    } finally {
      setDangThem(false);
    }
  };

  return (
    <Page>
      <nav className="mb-3 small text-muted">
        <Link href="/">Trang chủ</Link> / <Link href="/SanPham/Index">Sản phẩm</Link>
        {sp.loai && <> / <Link href={`/SanPham/Index?loai=${sp.loai.id}`}>{sp.loai.tenLoai}</Link></>} / {sp.tenSanPham}
      </nav>
      <div className="row g-4 product-detail-layout pdp-layout">
        <div className="col-lg-5">
          <ProductGallery images={cacAnh} selected={anhHienThi} name={sp.tenSanPham} imageRef={anhSanPham} onSelect={(url) => setAnhXem({ sanPhamId: id, bienTheId: bienThe?.id, url })} />
        </div>
        <div className="col-lg-7 product-detail-content">
          <div className="product-buy-panel">
          <div className="text-muted text-uppercase small">{sp.hang?.tenHang ?? "Hãng khác"}</div>
          <h1 className="h3">{sp.tenSanPham}</h1>
          <div className="pdp-meta"><span className={`pdp-stock ${conHang ? "" : "is-empty"}`}><i className={`fa-solid ${conHang ? "fa-circle-check" : "fa-circle-xmark"}`} aria-hidden="true" /> {conHang ? "Còn hàng" : bienThe ? "Hết hàng" : "Chọn phiên bản"}</span><span className="pdp-sku">SKU: {bienThe?.sku ?? "—"}</span></div>
          <div className="d-flex align-items-center gap-2 mb-2 pdp-rating"><Stars value={phanHoi.soDanhGia ? phanHoi.trungBinhDanhGia : 0} /><span className="text-muted small">({phanHoi.soDanhGia} đánh giá)</span></div>
          <div className="mb-3 product-detail-price">
            <span className="h3 text-danger me-2">{vnd(gia)}</span>
            {coGiam && <><span className="text-muted text-decoration-line-through me-2">{vnd(giaGocHienThi)}</span><span className="badge bg-danger">-{Math.round((giaGocHienThi - gia) / giaGocHienThi * 100)}%</span></>}
            {coGiam && <p className="pdp-promo-caption"><i className="fa-solid fa-tags" aria-hidden="true" /> {sp.khuyenMai?.tenChuongTrinh || "Giá ưu đãi"} · Tiết kiệm {vnd(giaGocHienThi - gia)} / sản phẩm</p>}
          </div>
          {bienThe?.thongSo && <dl className="pdp-quick-specs">{([["doCanBang", "Cân bằng"], ["trongLuong", "Trọng lượng"], ["doCung", "Độ cứng"]] as const).filter(([key]) => bienThe.thongSo?.[key]).map(([key, title]) => <div key={key}><dt>{title}</dt><dd>{bienThe.thongSo?.[key]}</dd></div>)}</dl>}
          <div className="pdp-choose-heading"><span>Chọn phiên bản của bạn</span><button type="button" onClick={() => { chonTab("thong-so"); document.getElementById("product-tabs")?.scrollIntoView({ block: "start" }); }}>Xem thông số ↗</button></div>
          {data.mauSacs.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold mb-1">Màu sắc</div>
              <div className="d-flex flex-wrap gap-2">
                {data.mauSacs.map((m) => <button key={m.id} type="button" className={`btn btn-sm ${mauId === m.id ? "btn-primary" : "btn-outline-secondary"}`} aria-pressed={mauId === m.id} onClick={() => {
                  setMauId(m.id);
                  const cacMau = data.bienThes.filter((b) => b.mau?.id === m.id);
                  const tiep = cacMau.find((b) => b.size?.id === sizeId && b.soLuongTon > 0) ?? cacMau.find((b) => b.soLuongTon > 0) ?? cacMau[0];
                  setSizeId(tiep?.size?.id ?? null);
                }}>{m.tenMau}</button>)}
              </div>
            </div>
          )}
          {data.sizes.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold mb-1">Kích cỡ</div>
              <div className="d-flex flex-wrap gap-2">
                {data.sizes.map((s) => {
                  const co = data.bienThes.some((b) => b.size?.id === s.id && (data.mauSacs.length === 0 || b.mau?.id === mauId));
                  return <button key={s.id} type="button" disabled={!co} aria-pressed={sizeId === s.id} className={`btn btn-sm ${sizeId === s.id ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setSizeId(s.id)}>{s.tenSize}</button>;
                })}
              </div>
            </div>
          )}

          <p className={`pdp-stock-note ${conHang ? "" : "is-empty"}`}>{bienThe ? conHang ? `${bienThe.soLuongTon} sản phẩm có sẵn cho phiên bản này` : "Phiên bản này đã hết hàng. Bạn có thể chọn màu / size khác hoặc liên hệ cửa hàng." : "Phiên bản này không có. Vui lòng chọn màu / size khác."}</p>

          {vuotTon && <p className="text-danger small" role="alert">Phiên bản này chỉ còn {bienThe?.soLuongTon} sản phẩm. Vui lòng giảm số lượng hoặc chọn phiên bản khác.</p>}
          <div className="product-purchase-total" aria-live="polite" aria-atomic="true">
            <span>Tạm tính · {soLuong} sản phẩm</span><strong>{bienThe ? vnd(gia * soLuong) : "—"}</strong>
            {coGiam && bienThe && <small>Tiết kiệm {vnd((giaGocHienThi - gia) * soLuong)}</small>}
          </div>
          <div className="product-purchase-actions">
            <div className="pdp-quantity"><button type="button" aria-label="Giảm số lượng" disabled={soLuong <= 1 || dangThem || !conHang} onClick={() => setSoLuong((v) => Math.max(1, v - 1))}>−</button><input type="number" min={1} max={Math.min(100, bienThe?.soLuongTon || 100)} value={soLuong} disabled={dangThem || !conHang}
              onChange={(e) => setSoLuong(Math.max(1, Math.min(100, Math.floor(Number(e.target.value)) || 1)))} aria-label="Số lượng" /><button type="button" aria-label="Tăng số lượng" disabled={soLuong >= Math.min(100, bienThe?.soLuongTon || 100) || dangThem || !conHang} onClick={() => setSoLuong((v) => Math.min(100, bienThe?.soLuongTon || 100, v + 1))}>+</button></div>
            <button ref={nutThem} className="btn product-add-btn pdp-add-to-cart" aria-busy={dangThem} disabled={!conHang || vuotTon || dangThem} onClick={() => themVaoGio(false)}><i className={`fa-solid ${dangThem ? "fa-spinner fa-spin" : "fa-cart-plus"}`} aria-hidden="true" /> {dangThem ? "Đang thêm…" : "Thêm vào giỏ"}</button>
            <button className="btn pdp-buy-now" disabled={!conHang || vuotTon || dangThem} onClick={() => themVaoGio(true)}>Mua ngay</button>
          </div>
          <div className="product-purchase-support">
            <div><i className="fa-solid fa-wallet" aria-hidden="true" /><span><strong>COD hoặc MoMo</strong>Chọn phương thức ở bước thanh toán</span></div>
            <Link href="/Home/Contact"><i className="fa-regular fa-comments" aria-hidden="true" /><span><strong>Cần tư vấn thêm?</strong>Liên hệ để chọn size / phiên bản</span><span aria-hidden="true">↗</span></Link>
          </div>
          </div>
        </div>
      </div>

      <div id="product-tabs" className="product-tabs pdp-tabs" role="tablist" aria-label="Nội dung sản phẩm">
        {CAC_TAB.map((khoa, i) => <button key={khoa} id={`tab-${khoa}`} type="button" role="tab" ref={(el) => { nutTab.current[i] = el; }} aria-selected={tab === khoa} aria-controls={`panel-${khoa}`} tabIndex={tab === khoa ? 0 : -1}
          onClick={() => chonTab(khoa)} onKeyDown={(e) => {
            let viTri = i;
            if (e.key === "ArrowRight") viTri = (i + 1) % CAC_TAB.length;
            else if (e.key === "ArrowLeft") viTri = (i + CAC_TAB.length - 1) % CAC_TAB.length;
            else if (e.key === "Home") viTri = 0;
            else if (e.key === "End") viTri = CAC_TAB.length - 1;
            else return;
            e.preventDefault(); chonTab(CAC_TAB[viTri]); nutTab.current[viTri]?.focus();
          }}>{khoa === "mo-ta" ? "Mô tả sản phẩm" : khoa === "thong-so" ? "Thông số kỹ thuật" : <>Đánh giá <span>{phanHoi.soDanhGia}</span></>}</button>)}
      </div>
      <div id="panel-mo-ta" role="tabpanel" aria-labelledby="tab-mo-ta" hidden={tab !== "mo-ta"} tabIndex={0}>
        <section id="product-description" className="product-description product-section-card">
          <div className="product-card-heading"><span className="product-heading-icon" aria-hidden="true"><i className="fa-regular fa-file-lines" /></span><div><h2>Mô tả sản phẩm</h2><p className="product-section-caption">Tìm hiểu trước khi lựa chọn</p></div></div>
          <p className="product-description-text">{sp.moTa || "Cửa hàng đang cập nhật mô tả sản phẩm. Vui lòng liên hệ để được tư vấn thêm."}</p>
        </section>
      </div>
      <div id="panel-thong-so" role="tabpanel" aria-labelledby="tab-thong-so" hidden={tab !== "thong-so"} tabIndex={0}>
        <ProductPurchaseInfo bienThe={bienThe} />
      </div>
      <div id="panel-danh-gia" role="tabpanel" aria-labelledby="tab-danh-gia" hidden={tab !== "danh-gia"} tabIndex={0}>
      <section id="product-reviews" className="product-reviews product-section-card" aria-labelledby="product-reviews-title">
        <div className="product-review-heading">
          <div className="product-card-heading"><span className="product-heading-icon" aria-hidden="true"><i className="fa-regular fa-star" /></span><div><h2 id="product-reviews-title">Đánh giá sản phẩm</h2><p className="product-section-caption">Chia sẻ trải nghiệm cùng người chơi cầu lông</p></div></div>
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={dangGuiDanhGia} aria-expanded={moDanhGia} aria-controls="product-inline-review" onClick={() => setMoDanhGia((v) => !v)}>{moDanhGia ? "Đóng form" : "Viết đánh giá"}</button>
        </div>
        <div id="product-inline-review">
          {moDanhGia && <InlineReviewForm key={id} sanPhamId={id} onBusyChange={setDangGuiDanhGia} onSent={capNhatDanhGia} onClose={() => setMoDanhGia(false)} />}
        </div>
        <div className="product-review-layout">
          <div className="product-rating-summary">
            <strong>{phanHoi.soDanhGia > 0 ? phanHoi.trungBinhDanhGia.toFixed(1) : "—"}<small>/ 5</small></strong>
            <Stars value={phanHoi.soDanhGia ? phanHoi.trungBinhDanhGia : 0} />
            <p>{phanHoi.soDanhGia > 0 ? `Từ ${phanHoi.soDanhGia} đánh giá` : "Chưa có đánh giá"}</p>
          </div>
          <div className="product-review-list">
            {phanHoi.danhGias.length === 0 ? <div className="product-review-empty"><span aria-hidden="true"><i className="fa-regular fa-comment-dots" /></span><h3>Bạn đã trải nghiệm sản phẩm này?</h3><p>Hãy chia sẻ cảm nhận để giúp những người chơi khác chọn sản phẩm phù hợp.</p></div> : phanHoi.danhGias.map((r) => (
              <article key={r.id} className="product-review-item">
                <div className="product-review-author"><span className="product-review-avatar" aria-hidden="true">{r.tenKhachHang?.trim().charAt(0).toLocaleUpperCase('vi') || "K"}</span><div><strong>{r.tenKhachHang}</strong><time dateTime={r.ngayPhanHoi}>{ngay(r.ngayPhanHoi)}</time></div></div>
                <div className="text-warning" aria-label={`${r.danhGia} trên 5 sao`}><span aria-hidden="true">{"★".repeat(r.danhGia)}<span className="text-muted">{"★".repeat(5 - r.danhGia)}</span></span></div>
                <p>{r.noiDung}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      </div>
      {sp.loai && <RelatedProducts key={sp.id} sanPhamId={sp.id} loai={sp.loai} />}
    </Page>
  );
}
