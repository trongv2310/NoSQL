"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Empty, ErrorBox, Loading, ProductCard } from "@/components/Ui";
import { useApi } from "@/lib/hooks";
import { imgUrl, ngay, vnd } from "@/lib/format";
import type { SanPhamV, TinV, TranDauV } from "@/lib/types";

interface LandingData {
  thongKe: { sanPham: number; hang: number; uuDai: number };
  nganSach: { khoa: string; nhan: string; soLuong: number }[];
  danhMuc: { id: string; tenLoai: string; soSanPham: number }[];
  uuDai: SanPhamV[];
  heroSp: SanPhamV[];
  nhomSanPham?: { id: string; tenLoai: string; sanPhams: SanPhamV[] }[];
  giamToiDa: number;
  danhGia: { id: string; noiDung: string; danhGia: number; tenKhachHang: string; tenSanPham: string | null }[];
  dsNoiBat: TinV[];
  tinMoi: TinV[];
  tranMoi: TranDauV[];
}

const CAU_HINH_LOAI = [
  { anh: "landing/cat-vot.webp", mota: "Khung nhẹ, đầm tay, đủ lối chơi công thủ." },
  { anh: "landing/cat-giay.webp", mota: "Bám sân, êm chân cho từng pha di chuyển." },
  { anh: "landing/cat-aoquan.webp", mota: "Thoáng khí, co giãn, thoải mái khi vào trận." },
  { anh: "landing/cat-phukien.webp", mota: "Cầu lông, quấn cán và những món nhỏ nhưng cần thiết." },
];

const phanTramGiam = (sp: SanPhamV) => (sp.giaGoc > 0 && sp.giaSauKhuyenMai < sp.giaGoc ? Math.max(1, Math.round((1 - sp.giaSauKhuyenMai / sp.giaGoc) * 100)) : 0);

function TinDong({ t }: { t: TinV }) {
  return (
    <Link href={`/BangTin/${t.id}`} className="d-flex gap-3 text-decoration-none text-dark border-bottom py-2">
      { }
      <img src={imgUrl(t.hinhAnh)} alt="" width={96} height={64} style={{ objectFit: "cover", borderRadius: 6 }} />
      <div>
        <span className="badge bg-secondary me-2"><i className={`fa-solid ${t.iconLoai}`} /> {t.nhanLoai}</span>
        <small className="text-muted">{ngay(t.ngayDang)}</small>
        <div className="fw-semibold">{t.tieuDe}</div>
      </div>
    </Link>
  );
}

export default function LandingPage() {
  const { data, error, loading } = useApi<LandingData>("/landing");

  useEffect(() => {
    document.title = "Khám phá cửa hàng cầu lông - Cửa Hàng Cầu Lông";
  }, []);

  if (loading) return <div className="container my-5"><Loading /></div>;
  if (error || !data) return <div className="container my-5"><ErrorBox message={error ?? "Không tải được dữ liệu."} /></div>;

  const noiBat = data.dsNoiBat.length ? data.dsNoiBat : data.tinMoi.slice(0, 1);
  const tinPhu = data.dsNoiBat.length ? data.tinMoi : data.tinMoi.slice(1);

  return (
    <>
      <link href="/css/landing.css" rel="stylesheet" />
      <link href="/css/bangtin.css" rel="stylesheet" />

      <section className="l-hero bg-court" id="lHero">
        <div className="container l-hero-inner">
          <div className="l-hero-copy">
            <span className="l-kicker light">Cửa hàng cầu lông trực tuyến</span>
            <h1>Chọn đúng dụng cụ,<br /><em>chơi cầu thăng hoa.</em></h1>
            <p>Vợt, giày, trang phục và phụ kiện chính hãng từ Yonex, Li-Ning, Victor, Mizuno. Lọc theo ngân sách, hãng và ưu đãi để tìm đúng món bạn cần.</p>
            <div className="l-cta">
              <Link href="/SanPham/Index" className="btn btn-light btn-lg">Vào xem sản phẩm <i className="fa-solid fa-arrow-right ms-1" /></Link>
              <Link href="/KhuyenMai/Index" className="btn btn-outline-light btn-lg">Xem khuyến mãi</Link>
            </div>
            <dl className="l-stats">
              <div><dt>{data.thongKe.sanPham}</dt><dd>Sản phẩm</dd></div>
              <div><dt>{data.thongKe.hang}</dt><dd>Thương hiệu</dd></div>
              <div><dt>{data.thongKe.uuDai}</dt><dd>Ưu đãi đang chạy</dd></div>
            </dl>
          </div>
          <div className="l-hero-visual">
            {data.heroSp.map((sp, i) => {
              const pt = phanTramGiam(sp);
              return (
                <Link key={sp.id} href={`/Home/ChiTietSanPham/${sp.id}`} className={`l-hero-card c${i + 1}`}>
                  {pt > 0 && <span className="badge-promo">-{pt}%</span>}
                  { }
                  <img src={imgUrl(sp.hinhAnhDaiDien)} alt={sp.tenSanPham} width={320} height={320} />
                  <div className="l-hero-card-info"><small>{sp.hang?.tenHang ?? "Hãng khác"}</small><b>{sp.tenSanPham}</b><span>{vnd(sp.giaSauKhuyenMai)}</span></div>
                </Link>
              );
            })}
            <span className="l-hero-chip chip-a"><i className="fa-solid fa-tags" /> Giảm đến {data.giamToiDa}%</span>
            <span className="l-hero-chip chip-b"><i className="fa-solid fa-shield-halved" /> {data.thongKe.hang} thương hiệu chính hãng</span>
          </div>
        </div>
      </section>

      <section className="l-section">
        <div className="container">
          <div className="l-head"><span className="l-kicker">Theo ngân sách</span><h2>Bạn định chi bao nhiêu?</h2><p>Chọn mức giá, chúng tôi lọc sẵn các sản phẩm phù hợp (đã tính khuyến mãi).</p></div>
          <div className="l-budgets">
            {data.nganSach.map((m) => (
              <Link key={m.khoa} href={`/SanPham/Index?khoang=${m.khoa}`} className="l-budget"><strong>{m.nhan}</strong><span>{m.soLuong} sản phẩm</span><i className="fa-solid fa-arrow-right" /></Link>
            ))}
          </div>
        </div>
      </section>

      <section className="l-section l-tint">
        <div className="container">
          <div className="l-head"><span className="l-kicker">Danh mục</span><h2>Mua sắm theo nhu cầu</h2></div>
          <div className="l-cats">
            {data.danhMuc.map((dm) => {
              const ten = dm.tenLoai.toLocaleLowerCase("vi");
              const cfg = CAU_HINH_LOAI[ten.includes("vợt") ? 0 : ten.includes("giày") ? 1 : ten.includes("áo") || ten.includes("quần") ? 2 : 3];
              return (
                <Link key={dm.id} href={`/SanPham/Index?loai=${dm.id}`} className="l-cat">
                  {cfg ? (  <img src={`/images/${cfg.anh}`} alt={dm.tenLoai} loading="lazy" width={360} height={450} />) : <i className="fa-solid fa-bag-shopping l-cat-icon" />}
                  <div className="l-cat-info"><h3>{dm.tenLoai}</h3><span>{dm.soSanPham} sản phẩm</span><p>{cfg?.mota}</p></div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="l-section">
        <div className="container">
          <div className="l-head l-head-row">
            <div><span className="l-kicker">Ưu đãi</span><h2>Đang giảm giá</h2></div>
            <Link href="/KhuyenMai/Index" className="btn-xem-tat-ca">Xem tất cả ưu đãi <i className="fa-solid fa-arrow-right ms-1" /></Link>
          </div>
          {data.uuDai.length ? <div className="l-products">{data.uuDai.map((sp) => <ProductCard key={sp.id} sp={sp} />)}</div> : <Empty message="Hiện chưa có ưu đãi nào." />}
        </div>
      </section>

      {(data.nhomSanPham ?? []).filter((n) => n.sanPhams.length > 0).map((nhom) => {
        const ten = nhom.tenLoai.toLocaleLowerCase("vi");
        const cfg = CAU_HINH_LOAI[ten.includes("vợt") ? 0 : ten.includes("giày") ? 1 : ten.includes("áo") || ten.includes("quần") ? 2 : 3];
        return <section className="l-section shop-category-section" key={nhom.id}>
          <div className="container">
            <div className="l-head l-head-row"><div><span className="l-kicker">Khám phá bộ sưu tập</span><h2>{nhom.tenLoai}</h2></div><Link href={`/SanPham/Index?loai=${nhom.id}`} className="btn-xem-tat-ca">Xem tất cả <span aria-hidden="true">↗</span></Link></div>
            <div className="shop-category-row">
              <Link href={`/SanPham/Index?loai=${nhom.id}`} className="shop-category-banner">
                <img src={`/images/${cfg.anh}`} alt="" loading="lazy" width={360} height={450} />
                <div><span>Dụng cụ cho trận đấu tiếp theo</span><h3>{nhom.tenLoai}</h3><p>{cfg.mota}</p><b>Khám phá ngay <span aria-hidden="true">→</span></b></div>
              </Link>
              <div className="shop-category-products">{nhom.sanPhams.map((sp) => <ProductCard sp={sp} key={sp.id} />)}</div>
            </div>
          </div>
        </section>;
      })}

      <section className="l-section l-tint">
        <div className="container">
          <div className="l-head"><span className="l-kicker">Hướng dẫn nhanh</span><h2>Chọn vợt theo lối chơi</h2><p>Điểm cân bằng của vợt quyết định cảm giác đánh. Bắt đầu từ ba dòng vợt Yonex phổ biến để so sánh.</p></div>
          <div className="l-guides">
            {[
              ["fa-bolt", "Thiên về tấn công", "Vợt đầu nặng cho cú đập mạnh và lực mạnh từ cuối sân. Phù hợp người chơi chủ động dồn điểm.", "Astrox"],
              ["fa-feather", "Nhanh và linh hoạt", "Vợt đầu nhẹ, vung nhanh, thuận lợi cho các pha phản tạt và đánh đôi ở lưới.", "Nanoflare"],
              ["fa-scale-balanced", "Cân bằng, dễ kiểm soát", "Điểm cân bằng ở giữa, cảm giác cầu ổn định, dễ làm quen cho người mới và người chơi toàn diện.", "Arcsaber"],
            ].map(([icon, tieuDe, mota, ten]) => (
              <article className="l-guide" key={ten}>
                <span className="l-guide-icon"><i className={`fa-solid ${icon}`} /></span><h3>{tieuDe}</h3><p>{mota}</p>
                <Link href={`/SanPham/Index?loai=Vot&ten=${ten}`}>Xem dòng {ten} <i className="fa-solid fa-arrow-right" /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {(noiBat.length > 0 || tinPhu.length > 0 || data.tranMoi.length > 0) && (
        <section className="l-section l-news-sec" id="tin-tuc" aria-label="Tin tức và sự kiện cầu lông">
          <div className="container">
            <div className="row g-4">
              <div className="col-lg-8">
                <div className="bt-column-heading"><h3>Bài viết nổi bật</h3><Link href="/BangTin">Tất cả bài viết <span aria-hidden="true">↗</span></Link></div>
                {noiBat.length === 0 && tinPhu.length === 0 && <p className="bt-empty-feed">Bài viết đang được cập nhật.</p>}
                {[...noiBat, ...tinPhu].map((t) => <TinDong key={t.id} t={t} />)}
              </div>
              <aside className="col-lg-4">
                <div className="bt-column-heading"><h3>Kết quả thi đấu</h3></div>
                {data.tranMoi.map((t) => (
                  <div key={t.id} className="border rounded p-2 mb-2 bg-white">
                    <small className="text-muted">{t.tenGiaiDau} · {t.vong} · {ngay(t.ngayThiDau)}</small>
                    <div className={t.doiThang === "A" ? "fw-bold" : ""}>{t.doiA}</div>
                    <div className={t.doiThang === "B" ? "fw-bold" : ""}>{t.doiB}</div>
                    {t.tiSo && <small className="text-success">{t.tiSo}</small>}
                  </div>
                ))}
              </aside>
            </div>
          </div>
        </section>
      )}

      {data.danhGia.length > 0 && (
        <section className="l-section">
          <div className="container">
            <div className="l-head"><span className="l-kicker">Khách hàng nói gì</span><h2>Đánh giá gần đây</h2></div>
            <div className="l-reviews">
              {data.danhGia.map((dg) => (
                <figure className="l-review" key={dg.id}>
                  <div className="l-stars" aria-label={`${dg.danhGia} trên 5 sao`}>{[1, 2, 3, 4, 5].map((i) => <i key={i} className={`fa-solid fa-star ${i <= dg.danhGia ? "" : "off"}`} />)}</div>
                  <blockquote>{dg.noiDung}</blockquote>
                  <figcaption><strong>{dg.tenKhachHang}</strong>{dg.tenSanPham && <span> · {dg.tenSanPham}</span>}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={`l-section ${data.danhGia.length ? "l-tint" : ""}`}>
        <div className="container">
          <div className="l-head text-center"><span className="l-kicker">Thương hiệu</span><h2>Đồng hành cùng các hãng hàng đầu</h2></div>
          <div className="l-brands">
            {[["Yonex", "yonex", "Yonex"], ["Li-Ning", "lining", "Lining"], ["Victor", "victor", "Victor"], ["Mizuno", "mizuno", "Mizuno"]].map(([ten, slug, q]) => (
              <Link key={slug} href={`/SanPham/Index?hang=${q}`} className="l-brand" title={ten}>
                { }
                <img src={`/images/brands/${slug}.svg`} alt={`Logo ${ten}`} loading="lazy" onError={(e) => { const el = e.target as HTMLImageElement; el.replaceWith(Object.assign(document.createElement("span"), { textContent: ten })); }} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="l-final bg-court">
        <div className="container text-center">
          <h2>Sẵn sàng ra sân?</h2>
          <p>Chọn vợt, giày và trang phục phù hợp ngay hôm nay, nhận ưu đãi dành cho thành viên.</p>
          <div className="l-cta justify-content-center"><Link href="/SanPham/Index" className="btn btn-light btn-lg">Bắt đầu mua sắm</Link></div>
        </div>
      </section>
    </>
  );
}
