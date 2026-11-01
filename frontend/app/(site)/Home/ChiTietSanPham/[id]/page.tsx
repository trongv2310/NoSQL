"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { bayVaoGio } from "@/lib/cart-motion";
import { ProductPurchaseInfo } from "@/components/ProductPurchaseInfo";
import { useApp } from "@/components/AppProviders";
import { ErrorBox, Loading, Page, Stars } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { imgUrl, ngay, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { BienTheV, SanPhamV } from "@/lib/types";

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

  if (loading) return <Page><Loading /></Page>;
  if (error || !data) return <Page><ErrorBox message={error ?? "Không tìm thấy sản phẩm."} /></Page>;
  const { sanPham: sp } = data;
  const gia = bienThe?.giaThucTe ?? data.giaBanThucTe;
  const coGiam = sp.dangGiamGia && gia < (bienThe?.giaBan ?? sp.giaGoc);
  const giaGocHienThi = bienThe?.giaBan ?? sp.giaGoc;
  const conHang = !!bienThe && bienThe.soLuongTon > 0;
  const vuotTon = !!bienThe && soLuong > bienThe.soLuongTon;
  const anh = imgUrl(bienThe?.hinhAnh ?? sp.hinhAnhDaiDien);

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
      if (!muaNgay) await bayVaoGio(anhSanPham.current && anhSanPham.current.getBoundingClientRect().bottom > 0 ? anhSanPham.current : nutThem.current, anh);
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
      <div className="row g-4 product-detail-layout">
        <div className="col-lg-6">
          <div className="product-detail-gallery">
            { }
            <img ref={anhSanPham} src={anh} alt={sp.tenSanPham} className="img-fluid"  onError={(e) => { const img = e.currentTarget; img.onerror = null; if (!img.src.endsWith("/images/default-product.jpg")) img.src = "/images/default-product.jpg"; }} />
          </div>
        </div>
        <div className="col-lg-6 product-detail-content">
          <div className="text-muted text-uppercase small">{sp.hang?.tenHang ?? "Hãng khác"}</div>
          <h1 className="h3">{sp.tenSanPham}</h1>
          <div className="d-flex align-items-center gap-2 mb-2"><Stars value={data.trungBinhDanhGia} /><span className="text-muted small">({data.soDanhGia} đánh giá)</span></div>
          {sp.moTa && <div className="product-brief"><p>{sp.moTa}</p><a href="#product-description">Đọc mô tả đầy đủ <span aria-hidden="true">↗</span></a></div>}
          <div className="mb-3 product-detail-price">
            <span className="h3 text-danger me-2">{vnd(gia)}</span>
            {coGiam && <><span className="text-muted text-decoration-line-through me-2">{vnd(giaGocHienThi)}</span><span className="badge bg-danger">-{Math.round((giaGocHienThi - gia) / giaGocHienThi * 100)}%</span></>}
          </div>

          {data.mauSacs.length > 0 && (
            <div className="mb-3">
              <div className="fw-semibold mb-1">Màu sắc</div>
              <div className="d-flex flex-wrap gap-2">
                {data.mauSacs.map((m) => <button key={m.id} type="button" className={`btn btn-sm ${mauId === m.id ? "btn-primary" : "btn-outline-secondary"}`} aria-pressed={mauId === m.id} onClick={() => setMauId(m.id)}>{m.tenMau}</button>)}
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

          <div className="mb-3 small">
            {bienThe ? (conHang ? <span className="text-success"><i className="fa-solid fa-circle-check" /> Còn {bienThe.soLuongTon} sản phẩm · SKU {bienThe.sku}</span> : <span className="text-danger"><i className="fa-solid fa-circle-xmark" /> Hết hàng</span>)
              : <span className="text-warning">Phiên bản này hiện không có, vui lòng chọn phiên bản khác.</span>}
          </div>

          {vuotTon && <p className="text-danger small" role="alert">Phiên bản này chỉ còn {bienThe?.soLuongTon} sản phẩm. Vui lòng giảm số lượng hoặc chọn phiên bản khác.</p>}
          <div className="product-purchase-total" aria-live="polite" aria-atomic="true">
            <span>Tạm tính · {soLuong} sản phẩm</span><strong>{bienThe ? vnd(gia * soLuong) : "—"}</strong>
            {coGiam && bienThe && <small>Tiết kiệm {vnd((giaGocHienThi - gia) * soLuong)}</small>}
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-center product-purchase-actions">
            <input type="number" min={1} max={Math.min(100, bienThe?.soLuongTon || 100)} className="form-control" style={{ width: 90 }} value={soLuong}
              onChange={(e) => setSoLuong(Math.max(1, Math.min(100, Math.floor(Number(e.target.value)) || 1)))} aria-label="Số lượng" />
            <button ref={nutThem} className="btn btn-primary product-add-btn" aria-busy={dangThem} disabled={!conHang || vuotTon || dangThem} onClick={() => themVaoGio(false)}><i className={`fa-solid ${dangThem ? "fa-spinner fa-spin" : "fa-cart-plus"}`} aria-hidden="true" /> {dangThem ? "Đang thêm…" : "Thêm vào giỏ"}</button>
            <button className="btn btn-danger" disabled={!conHang || vuotTon || dangThem} onClick={() => themVaoGio(true)}>Mua ngay</button>
          </div>
          <div className="product-purchase-support">
            <div><i className="fa-solid fa-wallet" aria-hidden="true" /><span><strong>COD hoặc MoMo</strong>Chọn phương thức ở bước thanh toán</span></div>
            <Link href="/Home/Contact"><i className="fa-regular fa-comments" aria-hidden="true" /><span><strong>Cần tư vấn thêm?</strong>Liên hệ để chọn size / phiên bản</span><span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </div>

      <div className="product-information-grid">
        <section id="product-description" className="product-description">
          <h2>Về sản phẩm này</h2>
          <p className="product-section-caption">Thông tin từ cửa hàng</p>
          <p className="product-description-text">{sp.moTa || "Cửa hàng đang cập nhật mô tả sản phẩm. Vui lòng liên hệ để được tư vấn thêm."}</p>
        </section>
        <ProductPurchaseInfo bienThe={bienThe} />
      </div>

      <section className="mt-5">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">Đánh giá ({data.soDanhGia})</h4>
          <Link href={`/ThemPhanHoiSP/ReviewForm/${sp.id}`} className="btn btn-outline-primary btn-sm">Viết đánh giá</Link>
        </div>
        {data.danhGias.length === 0 ? <p className="text-muted">Chưa có đánh giá nào cho sản phẩm này.</p> : data.danhGias.map((r) => (
          <div key={r.id} className="border rounded p-3 mb-2 bg-white">
            <div className="d-flex justify-content-between"><strong>{r.tenKhachHang}</strong><small className="text-muted">{ngay(r.ngayPhanHoi)}</small></div>
            <div className="text-warning">{"★".repeat(r.danhGia)}<span className="text-muted">{"★".repeat(5 - r.danhGia)}</span></div>
            <div>{r.noiDung}</div>
          </div>
        ))}
      </section>
    </Page>
  );
}
