"use client";

import Link from "next/link";
import { imgUrl, ngay } from "@/lib/format";
import type { TinV, TranDauV } from "@/lib/types";

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

export function BangDiem({ ds, tieuDe }: { ds: TranDauV[]; tieuDe: string }) {
  return (
    <div className="mb-4">
      <h5>{tieuDe}</h5>
      {ds.length === 0 ? <p className="text-muted small">Chưa có kết quả.</p> : ds.map((t) => (
        <div key={t.id} className="border rounded bg-white p-2 mb-2">
          <small className="text-muted">{t.tenGiaiDau} · {t.vong} · {t.noiDung} · {ngay(t.ngayThiDau)}</small>
          <div className={t.doiThang === "A" ? "fw-bold" : ""}>{t.doiA}</div>
          <div className={t.doiThang === "B" ? "fw-bold" : ""}>{t.doiB}</div>
          {t.tiSo && <small className="text-success">{t.tiSo}</small>}
        </div>
      ))}
    </div>
  );
}
