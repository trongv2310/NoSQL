"use client";

import Link from "next/link";
import { imgUrl, ngay, vnd } from "@/lib/format";
import type { SanPhamV, TinV, TranDauV } from "@/lib/types";

export function TinCard({ t }: { t: TinV }) {
  const laSanPham = t.loaiTin === "san-pham-hot" || t.loaiTin === "san-pham-moi";
  return (
    <Link href={`/BangTin/${t.id}`} className="tin-card">
      <span className={`tin-card-thumb${laSanPham ? " is-product" : ""}`}>
        { }
        <img src={imgUrl(t.hinhAnh)} alt="" loading="lazy" />
      </span>
      <span className="tin-card-body">
        <span className="tin-card-top">
          <span className="badge bg-secondary"><i className={`fa-solid ${t.iconLoai}`} /> {t.nhanLoai}</span>
          <small className="text-muted">{ngay(t.ngayDang)} · {t.luotXem} lượt xem</small>
        </span>
        <span className="tin-card-title">{t.tieuDe}</span>
        {t.tomTat && <small className="tin-card-sum text-muted">{t.tomTat}</small>}
      </span>
    </Link>
  );
}

const laSanPham = (t: TinV) => t.loaiTin === "san-pham-hot" || t.loaiTin === "san-pham-moi";

/** Bài nổi bật: ảnh phủ kín, chữ nằm trên lớp phủ gradient. */
export function NewsLead({ t }: { t: TinV }) {
  return (
    <Link href={`/BangTin/${t.id}`} className={`nw-lead sf-reveal${laSanPham(t) ? " is-product" : ""}`}>
      { }
      <img src={imgUrl(t.hinhAnh)} alt="" loading="eager" />
      <span className="nw-lead-body">
        <span className="nw-tag"><i className={`fa-solid ${t.iconLoai}`} aria-hidden="true" /> {t.nhanLoai}</span>
        <strong>{t.tieuDe}</strong>
        {t.tomTat && <small>{t.tomTat}</small>}
        <span className="nw-meta"><i className="fa-regular fa-calendar" aria-hidden="true" /> {ngay(t.ngayDang)} <i className="fa-regular fa-eye" aria-hidden="true" /> {t.luotXem} lượt xem</span>
      </span>
    </Link>
  );
}

/** Thẻ bài viết dọc cho lưới 2 cột. */
export function NewsCard({ t }: { t: TinV }) {
  return (
    <Link href={`/BangTin/${t.id}`} className="nw-card sf-reveal">
      <span className={`nw-card-img${laSanPham(t) ? " is-product" : ""}`}>
        { }
        <img src={imgUrl(t.hinhAnh)} alt="" loading="lazy" />
        <span className="nw-tag"><i className={`fa-solid ${t.iconLoai}`} aria-hidden="true" /> {t.nhanLoai}</span>
      </span>
      <span className="nw-card-body">
        <span className="nw-card-title">{t.tieuDe}</span>
        {t.tomTat && <span className="nw-card-sum">{t.tomTat}</span>}
        <span className="nw-meta"><i className="fa-regular fa-calendar" aria-hidden="true" /> {ngay(t.ngayDang)} <i className="fa-regular fa-eye" aria-hidden="true" /> {t.luotXem}</span>
      </span>
    </Link>
  );
}

/** Bảng kết quả: đội thắng được tô đậm kèm cúp, tỉ số tách thành từng set. */
export function BangDiem({ ds, tieuDe }: { ds: TranDauV[]; tieuDe: string }) {
  return (
    <section className="nw-board">
      <h3 className="nw-side-title"><span><i className="fa-solid fa-trophy" aria-hidden="true" /></span>{tieuDe}</h3>
      {ds.length === 0 ? <p className="text-muted small">Chưa có kết quả.</p> : ds.map((t) => (
        <article key={t.id} className="nw-match sf-reveal">
          <header><b>{t.tenGiaiDau}</b><small>{t.vong} · {t.noiDung} · {ngay(t.ngayThiDau)}</small></header>
          {(["A", "B"] as const).map((k) => (
            <div key={k} className={`nw-team${t.doiThang === k ? " is-win" : ""}`}>
              <span>{k === "A" ? t.doiA : t.doiB}</span>
              {t.doiThang === k && <i className="fa-solid fa-trophy" aria-label="Đội thắng" />}
            </div>
          ))}
          {t.tiSo && <div className="nw-sets">{t.tiSo.split(",").map((set) => <b key={set}>{set.trim()}</b>)}</div>}
        </article>
      ))}
    </section>
  );
}

/** Sản phẩm gọn cho cột phụ: ảnh nhỏ, tên, giá. */
export function SpMini({ sp }: { sp: SanPhamV }) {
  const giam = sp.dangGiamGia && sp.giaGoc > sp.giaSauKhuyenMai;
  return (
    <Link href={`/Home/ChiTietSanPham/${sp.id}`} className="nw-mini sf-reveal">
      { }
      <img src={imgUrl(sp.hinhAnhDaiDien)} alt="" loading="lazy" />
      <span><small>{sp.hang?.tenHang ?? "Hãng khác"}</small><b>{sp.tenSanPham}</b><em>{vnd(sp.giaSauKhuyenMai)}{giam && <s>{vnd(sp.giaGoc)}</s>}</em></span>
    </Link>
  );
}
