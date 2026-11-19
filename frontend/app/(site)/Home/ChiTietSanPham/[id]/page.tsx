"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { bayVaoGio } from "@/lib/cart-motion";
import { GoiYMuaCung } from "@/components/ComboGoiY";
import { RelatedProducts } from "@/components/RelatedProducts";
import { ProductGallery } from "@/components/ProductGallery";
import { TEN_ANH_MORPH, anhDaBam } from "@/lib/morph";
import { InlineReviewForm } from "@/components/InlineReviewForm";
import { NguoiChoiGiongBan } from "@/components/product/NguoiChoiGiongBan";
import { NutHuuIch } from "@/components/product/NutHuuIch";
import { NHAN_THE, nhanNguoiDanh, type NguoiDanhCongKhai } from "@/lib/danh-gia";
import { ProductPurchaseInfo } from "@/components/ProductPurchaseInfo";
import { HoiNguoiBan } from "@/components/HoiNguoiBan";
import { ComboQuanCan } from "@/components/product/ComboQuanCan";
import { TramCangCuoc } from "@/components/product/TramCangCuoc";
import { Vot3D } from "@/components/product/Vot3D";
import { KhaySoSanh } from "@/components/so-sanh/KhaySoSanh";
import { NutSoSanh } from "@/components/so-sanh/NutSoSanh";
import { useHoSo } from "@/components/HoSoChoi";
import { NHAN_LOI_CHOI } from "@/lib/ho-so-choi";
import { khoaLoai } from "@/lib/landing-data";
import { useApp } from "@/components/AppProviders";
import { ErrorBox, Loading, Page, Stars } from "@/components/Ui";
import { api, apiPost, loiTuApi } from "@/lib/api";
import { THONG_BAO_DOI_TAI_KHOAN, laLoiSaiTaiKhoan } from "@/components/product/useThemBienThe";
import { anhChinhChiTiet } from "@/lib/anh-upload";
import { imgUrl, ngay, vnd } from "@/lib/format";
import { soLuongTrongGio, layGio, themVaoGio as themVaoGioKhach } from "@/lib/gio-khach";
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
  danhGias: {
    id: string; noiDung: string; danhGia: number; ngayPhanHoi: string; tenKhachHang: string;
    nguoiDanh?: NguoiDanhCongKhai | null; the?: string[]; soHuuIch?: number; daMuaHang?: boolean; phienBan?: string | null; laDuLieuMau?: boolean;
  }[];
  /** null khi chưa có đánh giá đã xác minh. */
  trungBinhDanhGia: number | null;
  soDanhGia: number;
  giaBanThucTe: number;
}

export default function ChiTietSanPhamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, ready, setCartCount, flash, taiKhoanHienTai, refreshUser } = useApp();
  const hoSo = useHoSo();
  const { data, error, loading } = useApi<ChiTiet>(`/san-pham/${id}`);
  const [mauId, setMauId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  // Khách đã tự bấm chọn màu/size (khác với biến thể được chọn sẵn ở effect dưới). Gắn với đúng đợt dữ liệu `data`, nên đổi sản phẩm hoặc tải lại dữ liệu thì tự về "chưa chọn" mà không cần effect.
  const [daChonTren, setDaChonTren] = useState<ChiTiet | null>(null);
  const [soLuong, setSoLuong] = useState(1);
  const anhSanPham = useRef<HTMLImageElement>(null);
  const nutThem = useRef<HTMLButtonElement>(null);
  const [dangThem, setDangThem] = useState(false);
  const khuMua = useRef<HTMLDivElement>(null);
  const [hienThanhMua, setHienThanhMua] = useState(false);
  const [tab, setTab] = useState<TabSanPham>("mo-ta");
  const nutTab = useRef<(HTMLButtonElement | null)[]>([]);
  const [anhXem, setAnhXem] = useState<{ sanPhamId: string; bienTheId?: string; url: string } | null>(null);
  const [moDanhGia, setMoDanhGia] = useState(false);
  const [dangGuiDanhGia, setDangGuiDanhGia] = useState(false);
  const [danhGiaMoi, setDanhGiaMoi] = useState<(Pick<ChiTiet, "danhGias" | "trungBinhDanhGia" | "soDanhGia"> & { sanPhamId: string }) | null>(null);

  // Ghi một lượt xem vào time series luotxems; cùng trình duyệt mở lại sản phẩm trong 30 phút thì không tính thêm.
  useEffect(() => {
    if (!id) return;
    const khoa = `luot-xem:${id}`;
    try {
      const truoc = Number(sessionStorage.getItem(khoa) ?? 0);
      if (Date.now() - truoc < 30 * 60_000) return;
      sessionStorage.setItem(khoa, String(Date.now()));
    } catch { /* trình duyệt chặn sessionStorage: vẫn ghi */ }
    fetch(`/api/san-pham/${encodeURIComponent(id)}/luot-xem`, { method: "POST", keepalive: true }).catch(() => {});
  }, [id]);

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

  // Thanh mua dính (chỉ hiện ở màn hình hẹp, xem storefront-shop.css): hiện khi cụm nút mua chính không nằm trong khung nhìn.
  // Đặt thuộc tính trên <body> để nút chat nâng lên khỏi thanh này thay vì đè lên nút mua.
  useEffect(() => {
    const el = khuMua.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const quanSat = new IntersectionObserver(([e]) => setHienThanhMua(!e.isIntersecting));
    quanSat.observe(el);
    return () => quanSat.disconnect();
  }, [data]);
  useEffect(() => {
    if (hienThanhMua) document.body.dataset.stickyBuy = "1";
    else delete document.body.dataset.stickyBuy;
    return () => { delete document.body.dataset.stickyBuy; };
  }, [hienThanhMua]);

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
  const daChonPhienBan = daChonTren === data;
  const anh = imgUrl(anhChinhChiTiet({ anhDaiDien: sp.hinhAnhDaiDien, anhBienThe: bienThe?.hinhAnh, daChonPhienBan }));
  const anhHienThi = anhXem?.sanPhamId === id && anhXem.bienTheId === bienThe?.id ? anhXem.url : anh;
  const cacAnh = [...new Set([imgUrl(sp.hinhAnhDaiDien), ...data.bienThes.map((b) => imgUrl(b.hinhAnh || sp.hinhAnhDaiDien))])];
  const chonTab = (moi: TabSanPham) => setTab(moi);
  const laVot = !!sp.thongSoVot || Object.keys(sp.thongSoKhacNhau ?? {}).length > 0 || data.bienThes.some((b) => !!b.thongSo);
  const nhanPhienBan = [bienThe?.mau?.tenMau, bienThe?.size?.tenSize].filter(Boolean).join(" / ") || "tiêu chuẩn";

  const themVaoGio = async (muaNgay: boolean) => {
    if (!ready) {
      flash("danger", "Đang kiểm tra phiên đăng nhập, vui lòng thử lại sau giây lát.");
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
    if (!user) {
      // Khách chưa đăng nhập: giữ giỏ trên trình duyệt (chỉ id biến thể + số lượng); giá và tồn kho do server tính lại ở giỏ hàng.
      if (soLuongTrongGio(layGio(), bienThe.id) + soLuong > Math.min(100, bienThe.soLuongTon)) {
        flash("danger", `Giỏ hàng đã có ${soLuongTrongGio(layGio(), bienThe.id)} sản phẩm này, thêm ${soLuong} nữa sẽ vượt tồn kho hoặc giới hạn 100.`);
        return;
      }
      const kq = themVaoGioKhach(bienThe.id, soLuong);
      if (!kq.ok) {
        flash("danger", kq.lyDo === "tran-dong" ? "Giỏ hàng chưa đăng nhập chỉ chứa tối đa 50 sản phẩm khác nhau." : "Không thêm được sản phẩm này vào giỏ hàng.");
        return;
      }
      if (!muaNgay) await bayVaoGio(anhSanPham.current && anhSanPham.current.getBoundingClientRect().bottom > 0 ? anhSanPham.current : nutThem.current, anhHienThi);
      flash("success", "Đã thêm sản phẩm vào giỏ hàng.");
      if (muaNgay) router.push("/Home/ViewCart");
      return;
    }
    setDangThem(true);
    // Danh tính đọc đồng bộ lúc bấm và gửi kèm: máy chủ từ chối 403 trước khi ghi nếu phiên đã đổi sang tài khoản khác (đăng nhập ở thẻ khác).
    const nguoi = taiKhoanHienTai() ?? user.id;
    try {
      const r = await apiPost<{ message: string; cartCount: number }>("/gio-hang", { chiTietId: bienThe.id, quantity: soLuong, taiKhoanDuKien: nguoi });
      if (taiKhoanHienTai() !== nguoi) {
        flash("danger", "Tài khoản đăng nhập đã đổi trong lúc thêm. Sản phẩm vừa rồi nằm trong giỏ của tài khoản trước, không phải tài khoản hiện tại.");
        return;
      }
      if (!muaNgay) await bayVaoGio(anhSanPham.current && anhSanPham.current.getBoundingClientRect().bottom > 0 ? anhSanPham.current : nutThem.current, anhHienThi);
      setCartCount(r.cartCount);
      flash("success", r.message);
      if (muaNgay) router.push("/Home/ViewCart");
    } catch (e) {
      if (laLoiSaiTaiKhoan(e)) { void refreshUser(); flash("danger", THONG_BAO_DOI_TAI_KHOAN); }
      else flash("danger", loiTuApi(e));
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
          {phanHoi.soDanhGia > 0 && phanHoi.trungBinhDanhGia !== null && <div className="d-flex align-items-center gap-2 mb-2 pdp-rating"><Stars value={phanHoi.trungBinhDanhGia} /><span className="text-muted small">({phanHoi.soDanhGia} đánh giá)</span></div>}
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
                  setDaChonTren(data);
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
                  return <button key={s.id} type="button" disabled={!co} aria-pressed={sizeId === s.id} className={`btn btn-sm ${sizeId === s.id ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => { setDaChonTren(data); setSizeId(s.id); }}>{s.tenSize}</button>;
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
          <div className="product-purchase-actions" ref={khuMua}>
            <div className="pdp-quantity"><button type="button" aria-label="Giảm số lượng" disabled={soLuong <= 1 || dangThem || !conHang} onClick={() => setSoLuong((v) => Math.max(1, v - 1))}>−</button><input type="number" min={1} max={Math.min(100, bienThe?.soLuongTon || 100)} value={soLuong} disabled={dangThem || !conHang}
              onChange={(e) => setSoLuong(Math.max(1, Math.min(100, Math.floor(Number(e.target.value)) || 1)))} aria-label="Số lượng" /><button type="button" aria-label="Tăng số lượng" disabled={soLuong >= Math.min(100, bienThe?.soLuongTon || 100) || dangThem || !conHang} onClick={() => setSoLuong((v) => Math.min(100, bienThe?.soLuongTon || 100, v + 1))}>+</button></div>
            <button ref={nutThem} className="btn product-add-btn pdp-add-to-cart" aria-busy={dangThem} disabled={!conHang || vuotTon || dangThem || !ready} onClick={() => themVaoGio(false)}><i className={`fa-solid ${dangThem ? "fa-spinner fa-spin" : "fa-cart-plus"}`} aria-hidden="true" /> {dangThem ? "Đang thêm…" : "Thêm vào giỏ"}</button>
            <button className="btn pdp-buy-now" disabled={!conHang || vuotTon || dangThem || !ready} onClick={() => themVaoGio(true)}>Mua ngay</button>
          </div>
          <div className="product-purchase-support">
            <div><i className="fa-solid fa-wallet" aria-hidden="true" /><span><strong>COD hoặc MoMo</strong>Chọn phương thức ở bước thanh toán</span></div>
            <Link href="/Home/Contact"><i className="fa-regular fa-comments" aria-hidden="true" /><span><strong>Cần tư vấn thêm?</strong>Liên hệ để chọn size / phiên bản</span><span aria-hidden="true">↗</span></Link>
          </div>
          {laVot && (
            <div className="pdp-tools" role="group" aria-label="Công cụ cho vợt">
              <NutSoSanh sanPhamId={sp.id} ten={sp.tenSanPham} bienTheId={bienThe?.id ?? null} kieu="chu" />
              <Link href={`/tu-vot?them=${sp.id}${bienThe ? `&bien=${bienThe.id}` : ""}`} className="pdp-tool-link"><i className="fa-solid fa-box-archive" aria-hidden="true" /> Thêm vào tủ vợt</Link>
            </div>
          )}
          {laVot && <KhaySoSanh />}
          <p className="pdp-policy-links">
            <Link href="/ChinhSach/bao-hanh">Bảo hành</Link><Link href="/ChinhSach/doi-tra">Đổi trả</Link><Link href="/ChinhSach/giao-hang">Giao hàng</Link>
            <small>Nội dung chính sách đang được cửa hàng cập nhật.</small>
          </p>
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
        <ProductPurchaseInfo bienThe={bienThe} khacNhau={sp.thongSoKhacNhau} />
      </div>
      <div id="panel-danh-gia" role="tabpanel" aria-labelledby="tab-danh-gia" hidden={tab !== "danh-gia"} tabIndex={0}>
      <section id="product-reviews" className="product-reviews product-section-card" aria-labelledby="product-reviews-title">
        <div className="product-review-heading">
          <div className="product-card-heading"><span className="product-heading-icon" aria-hidden="true"><i className="fa-regular fa-star" /></span><div><h2 id="product-reviews-title">Đánh giá sản phẩm</h2><p className="product-section-caption">Chia sẻ trải nghiệm cùng người chơi cầu lông</p></div></div>
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={dangGuiDanhGia} aria-expanded={moDanhGia} aria-controls="product-inline-review" onClick={() => setMoDanhGia((v) => !v)}>{moDanhGia ? "Đóng form" : "Viết đánh giá"}</button>
        </div>
        <div id="product-inline-review">
          {moDanhGia && <InlineReviewForm key={id} sanPhamId={id} bienTheId={bienThe?.id ?? null} tenPhienBan={bienThe?.size?.tenSize ?? null} onBusyChange={setDangGuiDanhGia} onSent={capNhatDanhGia} onClose={() => setMoDanhGia(false)} />}
        </div>
        <NguoiChoiGiongBan sanPhamId={id} lanTai={phanHoi.soDanhGia} />
        <div className="product-review-layout">
          <div className="product-rating-summary">
            <strong>{phanHoi.soDanhGia > 0 && phanHoi.trungBinhDanhGia !== null ? phanHoi.trungBinhDanhGia.toFixed(1) : "—"}{phanHoi.soDanhGia > 0 && <small>/ 5</small>}</strong>
            {phanHoi.soDanhGia > 0 && phanHoi.trungBinhDanhGia !== null && <Stars value={phanHoi.trungBinhDanhGia} />}
            <p>{phanHoi.soDanhGia > 0 ? `Từ ${phanHoi.soDanhGia} đánh giá` : "Chưa có đánh giá"}</p>
          </div>
          <div className="product-review-list">
            {phanHoi.danhGias.length === 0 ? <div className="product-review-empty"><span aria-hidden="true"><i className="fa-regular fa-comment-dots" /></span><h3>Bạn đã trải nghiệm sản phẩm này?</h3><p>Hãy chia sẻ cảm nhận để giúp những người chơi khác chọn sản phẩm phù hợp.</p></div> : phanHoi.danhGias.map((r) => (
              <article key={r.id} className="product-review-item">
                <div className="product-review-author"><span className="product-review-avatar" aria-hidden="true">{r.tenKhachHang?.trim().charAt(0).toLocaleUpperCase('vi') || "K"}</span><div><strong>{r.tenKhachHang}</strong><time dateTime={r.ngayPhanHoi}>{ngay(r.ngayPhanHoi)}</time></div></div>
                <div className="text-warning" aria-label={`${r.danhGia} trên 5 sao`}><span aria-hidden="true">{"★".repeat(r.danhGia)}<span className="text-muted">{"★".repeat(5 - r.danhGia)}</span></span></div>
                {(nhanNguoiDanh(r.nguoiDanh) || r.daMuaHang || r.phienBan) && (
                  <div className="d-flex flex-wrap gap-1 small mb-1">
                    {nhanNguoiDanh(r.nguoiDanh) && <span className="badge rounded-pill text-bg-light border"><i className="fa-solid fa-user" aria-hidden="true" /> {nhanNguoiDanh(r.nguoiDanh)}</span>}
                    {r.phienBan && <span className="badge rounded-pill text-bg-light border">Dùng bản {r.phienBan}</span>}
                    {r.daMuaHang && <span className="badge rounded-pill text-bg-success"><i className="fa-solid fa-circle-check" aria-hidden="true" /> Đã mua tại shop</span>}
                    {r.laDuLieuMau && <span className="badge rounded-pill text-bg-warning">Dữ liệu mẫu</span>}
                  </div>
                )}
                <p>{r.noiDung}</p>
                {!!r.the?.length && <div className="d-flex flex-wrap gap-1 mb-1">{r.the.map((t) => <span key={t} className="badge rounded-pill text-bg-light border fw-normal">{NHAN_THE[t] ?? t}</span>)}</div>}
                <NutHuuIch danhGiaId={r.id} soBanDau={r.soHuuIch ?? 0} />
              </article>
            ))}
          </div>
        </div>
      </section>
      </div>
      {laVot && (
        <div className="pdp-cong-cu">
          <section id="tram-cang" className="product-section-card" aria-labelledby="tram-cang-tieu-de">
            <div className="product-card-heading"><span className="product-heading-icon" aria-hidden="true"><i className="fa-solid fa-ruler-horizontal" /></span><div><h2 id="tram-cang-tieu-de">Trạm căng cước</h2><p className="product-section-caption">Chọn mức căng trong khoảng nhà sản xuất ghi · tham khảo</p></div></div>
            <TramCangCuoc bienThe={bienThe} tenVot={sp.tenSanPham} />
          </section>
          <section id="combo-quan-can" className="product-section-card" aria-labelledby="combo-tieu-de">
            <div className="product-card-heading"><span className="product-heading-icon" aria-hidden="true"><i className="fa-solid fa-bag-shopping" /></span><div><h2 id="combo-tieu-de">Vợt + quấn cán</h2><p className="product-section-caption">Hai món đang bán, thêm vào giỏ cùng lúc</p></div></div>
            <ComboQuanCan bienVot={bienThe} tenVot={sp.tenSanPham} />
          </section>
          <section id="vot-3d" className="product-section-card" aria-labelledby="vot-3d-tieu-de">
            <div className="product-card-heading"><span className="product-heading-icon" aria-hidden="true"><i className="fa-solid fa-cube" /></span><div><h2 id="vot-3d-tieu-de">Xem vợt 3D</h2><p className="product-section-caption">Mô hình minh họa, chỉ tải khi bạn mở</p></div></div>
            <Vot3D ts={bienThe?.thongSo} nhanPhienBan={nhanPhienBan} />
          </section>
        </div>
      )}
      <HoiNguoiBan id="hoi-nguoi-ban" tieuDe="Hỏi người bán về sản phẩm này"
        mota={`Hỏi về ${sp.tenSanPham}: phiên bản, tồn kho, giao hàng hay có hợp với bạn không. Người bán trả lời dựa trên dữ liệu cửa hàng.`}
        goiY={[
          khoaLoai(sp.loai?.tenLoai) === "vot" && hoSo.lc ? `${sp.tenSanPham} có hợp lối chơi ${NHAN_LOI_CHOI[hoSo.lc]} không?` : `${sp.tenSanPham} phù hợp với ai?`,
          "Phiên bản nào đang còn hàng?",
          "Phí giao hàng và đổi trả thế nào?",
        ]} />
      <GoiYMuaCung key={`goi-y-${sp.id}`} sanPhamId={sp.id} />
      {sp.loai && <RelatedProducts key={sp.id} sanPhamId={sp.id} loai={sp.loai} />}
      <div className={`pdp-sticky-buy${hienThanhMua ? " is-on" : ""}`} role="region" aria-label="Mua nhanh" hidden={!hienThanhMua}>
        <div className="pdp-sticky-price">
          <strong>{bienThe ? vnd(gia * soLuong) : vnd(data.giaBanThucTe)}</strong>
          <small>{bienThe ? [bienThe.mau?.tenMau, bienThe.size?.tenSize].filter(Boolean).join(" · ") || sp.tenSanPham : "Chọn phiên bản"}</small>
        </div>
        <button type="button" className="btn pdp-sticky-add" disabled={!conHang || vuotTon || dangThem || !ready} onClick={() => themVaoGio(false)}><i className="fa-solid fa-cart-plus" aria-hidden="true" /> Thêm vào giỏ</button>
        <button type="button" className="btn pdp-sticky-now" disabled={!conHang || vuotTon || dangThem || !ready} onClick={() => themVaoGio(true)}>Mua ngay</button>
      </div>
    </Page>
  );
}
