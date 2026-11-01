"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHero, ProductGridSkeleton } from "@/components/PageHero";
import { ErrorBox, Empty, Page, Pagination, ProductCard } from "@/components/Ui";
import { useApi } from "@/lib/hooks";
import type { SanPhamV, Trang } from "@/lib/types";

interface ListData extends Trang<SanPhamV> {
  tieuDe: string;
  boLoc: {
    dsHang: { id: string; tenHang: string }[];
    dsLoai: { id: string; tenLoai: string }[];
    khoangGiaGoiY: string[];
    locGiaTu: number | null; locGiaDen: number | null; locHang: string[]; locKhoang: string | null; sapXep: string; dangLoc: boolean;
  };
}

const NHAN_KHOANG: Record<string, string> = {
  "0-1000000": "Dưới 1 triệu", "1000000-2000000": "1 – 2 triệu", "2000000-3000000": "2 – 3 triệu",
  "3000000-5000000": "3 – 5 triệu", "5000000-": "Trên 5 triệu",
};

/** Danh sách sản phẩm có bộ lọc; trạng thái lọc nằm hoàn toàn trên query string để chia sẻ/quay lại được. */
export function ProductListing() {
  const sp = useSearchParams();
  const router = useRouter();
  const query = sp.toString();
  const { data, error, loading } = useApi<ListData>(`/san-pham${query ? `?${query}` : ""}`);
  const [giaTu, setGiaTu] = useState(sp.get("gia_tu") ?? "");
  const [giaDen, setGiaDen] = useState(sp.get("gia_den") ?? "");
  const [moLoc, setMoLoc] = useState(false);

  useEffect(() => {
    // Đồng bộ ô nhập giá khi URL đổi (ví dụ bấm "Xóa bộ lọc").
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGiaTu(sp.get("gia_tu") ?? "");
    setGiaDen(sp.get("gia_den") ?? "");
  }, [sp]);

  const cap = (fn: (q: URLSearchParams) => void) => {
    const q = new URLSearchParams(sp.toString());
    fn(q);
    q.delete("page");
    const path = q.get("keyword") ? "/SanPham/TimKiem" : "/SanPham/Index";
    router.push(`${path}?${q.toString()}`);
  };
  const dat = (k: string, v: string | null) => cap((q) => (v ? q.set(k, v) : q.delete(k)));
  const hangs = sp.getAll("hangs");
  const boLoc = data?.boLoc;
  const hangDangChon = boLoc?.locHang ?? hangs;

  // Các bộ lọc đang áp dụng, hiện thành chip để gỡ từng cái mà không phải mở lại sidebar.
  const chips: { nhan: string; go: () => void }[] = [];
  const loaiId = sp.get("loai");
  if (loaiId) chips.push({ nhan: boLoc?.dsLoai.find((l) => l.id === loaiId)?.tenLoai ?? loaiId, go: () => dat("loai", null) });
  if (sp.get("keyword")) chips.push({ nhan: `“${sp.get("keyword")}”`, go: () => dat("keyword", null) });
  hangDangChon.forEach((id) => chips.push({ nhan: boLoc?.dsHang.find((h) => h.id === id)?.tenHang ?? id, go: () => cap((q) => { q.delete("hangs"); q.delete("hang"); hangDangChon.filter((x) => x !== id).forEach((x) => q.append("hangs", x)); }) }));
  const khoang = sp.get("khoang");
  if (khoang) chips.push({ nhan: NHAN_KHOANG[khoang] ?? khoang, go: () => dat("khoang", null) });
  if (sp.get("gia_tu") || sp.get("gia_den")) chips.push({ nhan: `${sp.get("gia_tu") || "0"} – ${sp.get("gia_den") || "∞"} đ`, go: () => cap((q) => { q.delete("gia_tu"); q.delete("gia_den"); }) });
  const SAP_XEP = [["moi", "Mới nhất"], ["gia_tang", "Giá tăng"], ["gia_giam", "Giá giảm"], ["ten", "Tên A–Z"]] as const;

  return (
    <>
      <PageHero compact tone="green" kicker="Dụng cụ cho trận đấu của bạn"
        crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Sản phẩm", href: "/SanPham/Index" }, ...(data?.tieuDe && data.tieuDe !== "Danh sách sản phẩm" ? [{ nhan: data.tieuDe }] : [])]}
        title={data?.tieuDe ?? "Danh sách sản phẩm"}
        sub={data ? `${data.total} sản phẩm · Chọn theo hãng, ngân sách và nhu cầu` : "Đang tìm sản phẩm…"} />
    <Page className="ls-wrap">
      <div className="ls-toolbar">
        <button type="button" className="ls-filter-toggle" aria-expanded={moLoc} onClick={() => setMoLoc((v) => !v)}><i className="fa-solid fa-sliders" aria-hidden="true" /> Bộ lọc{chips.length > 0 && <b>{chips.length}</b>}</button>
        <div className="catalog-shortcuts" aria-label="Lọc nhanh">
          {[{ key: "", label: "Tất cả sản phẩm" }, { key: "giam_gia", label: "Đang giảm giá" }, { key: "con_hang", label: "Còn hàng" }].map((m) => <button type="button" key={m.key} aria-pressed={m.key ? sp.get(m.key) === "1" : !sp.get("giam_gia") && !sp.get("con_hang")} onClick={() => cap((q) => { if (!m.key) { q.delete("giam_gia"); q.delete("con_hang"); } else { if (q.has(m.key)) q.delete(m.key); else q.set(m.key, "1"); } })}>{m.label}</button>)}
        </div>
        <div className="ls-sort" role="group" aria-label="Sắp xếp">
          <span>Sắp xếp</span>
          {SAP_XEP.map(([k, nhan]) => <button type="button" key={k} aria-pressed={(sp.get("sap_xep") ?? "moi") === k} onClick={() => dat("sap_xep", k)}>{nhan}</button>)}
        </div>
      </div>
      {chips.length > 0 && (
        <div className="ls-chips" aria-label="Bộ lọc đang áp dụng">
          {chips.map((c, i) => <button type="button" key={`${c.nhan}-${i}`} onClick={c.go} aria-label={`Bỏ lọc ${c.nhan}`}>{c.nhan} <i className="fa-solid fa-xmark" aria-hidden="true" /></button>)}
          <Link href="/SanPham/Index" className="ls-chips-clear">Xóa tất cả</Link>
        </div>
      )}
      <div className="row g-4">
        <aside className={`col-lg-3 ls-side${moLoc ? " is-open" : ""}`}>
          <div className="card catalog-filters"><div className="card-body"><div className="catalog-filter-heading"><i className="fa-solid fa-sliders" aria-hidden="true" /> Bộ lọc sản phẩm</div>
            <h6 className="fw-bold">Loại sản phẩm</h6>
            <div className="d-flex flex-column gap-1 mb-3">
              <button className={`btn btn-sm text-start ${!sp.get("loai") ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => dat("loai", null)}>Tất cả</button>
              {boLoc?.dsLoai.map((l) => (
                <button key={l.id} className={`btn btn-sm text-start ${sp.get("loai") === l.id ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => dat("loai", l.id)}>{l.tenLoai}</button>
              ))}
            </div>
            <h6 className="fw-bold">Khoảng giá</h6>
            <div className="d-flex flex-column gap-1 mb-2">
              {boLoc?.khoangGiaGoiY.map((k) => (
                <label key={k} className="form-check"><input type="radio" className="form-check-input" name="khoang" checked={sp.get("khoang") === k} onChange={() => cap((q) => { q.set("khoang", k); q.delete("gia_tu"); q.delete("gia_den"); })} /> <span className="form-check-label">{NHAN_KHOANG[k] ?? k}</span></label>
              ))}
            </div>
            <form className="d-flex gap-1 mb-3" onSubmit={(e) => { e.preventDefault(); cap((q) => {
            q.delete("khoang");
            if (giaTu) q.set("gia_tu", giaTu); else q.delete("gia_tu");
            if (giaDen) q.set("gia_den", giaDen); else q.delete("gia_den");
          }); }}>
              <input type="number" min={0} className="form-control form-control-sm" placeholder="Từ" value={giaTu} onChange={(e) => setGiaTu(e.target.value)} />
              <input type="number" min={0} className="form-control form-control-sm" placeholder="Đến" value={giaDen} onChange={(e) => setGiaDen(e.target.value)} />
              <button className="btn btn-sm btn-primary" type="submit">Lọc</button>
            </form>
            <h6 className="fw-bold">Hãng</h6>
            <div className="mb-3">
              {boLoc?.dsHang.map((h) => (
                <label key={h.id} className="form-check d-block">
                  <input type="checkbox" className="form-check-input" checked={hangDangChon.includes(h.id)} onChange={() => cap((q) => {
                    const cur = new Set(hangDangChon);
                    if (cur.has(h.id)) cur.delete(h.id); else cur.add(h.id);
                    q.delete("hangs"); q.delete("hang"); cur.forEach((id) => q.append("hangs", id));
                  })} /> <span className="form-check-label">{h.tenHang}</span>
                </label>
              ))}
            </div>
            <label className="form-check d-block"><input type="checkbox" className="form-check-input" checked={sp.get("giam_gia") === "1"} onChange={(e) => dat("giam_gia", e.target.checked ? "1" : null)} /> <span className="form-check-label">Đang giảm giá</span></label>
            <label className="form-check d-block mb-3"><input type="checkbox" className="form-check-input" checked={sp.get("con_hang") === "1"} onChange={(e) => dat("con_hang", e.target.checked ? "1" : null)} /> <span className="form-check-label">Còn hàng</span></label>
            {(boLoc?.dangLoc || sp.get("loai") || sp.get("ten")) && <Link href="/SanPham/Index" className="btn btn-outline-secondary btn-sm w-100">Xóa bộ lọc</Link>}
          </div></div>
        </aside>
        <div className="col-lg-9">
          {loading && !data ? <ProductGridSkeleton n={9} /> : error ? <ErrorBox message={error} /> : data && data.items.length === 0 ? (
            <Empty message="Không tìm thấy sản phẩm phù hợp." linkUrl="/SanPham/Index" linkText="Xem tất cả sản phẩm" />
          ) : data && (
            <>
              <div className={`row g-3 ls-grid${loading ? " is-loading" : ""}`}>{data.items.map((s) => <div key={s.id} className="col-6 col-md-4"><ProductCard sp={s} /></div>)}</div>
              <Pagination trang={data} />
            </>
          )}
        </div>
      </div>
    </Page>
    </>
  );
}
