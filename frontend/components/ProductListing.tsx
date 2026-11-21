"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import productBanner from "@/assets/banners/san-pham-victor-xanh.webp";
import { datHoSo, useHoSo } from "@/components/HoSoChoi";
import { HoiNguoiBan } from "@/components/HoiNguoiBan";
import { KhaySoSanh } from "@/components/so-sanh/KhaySoSanh";
import { PageHero, ProductGridSkeleton } from "@/components/PageHero";
import { ErrorBox, Empty, Page, Pagination, ProductCard } from "@/components/Ui";
import { vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { LOAI, khoaLoai } from "@/lib/landing-data";
import { LOI_CHOI_HOP_LE, NHAN_LOI_CHOI, hoSoTrong, type LoiChoiKhoa } from "@/lib/ho-so-choi";
import type { SanPhamV, Trang } from "@/lib/types";

interface ListData extends Trang<SanPhamV> {
  tieuDe: string;
  /** Có từ khoá: tầng tìm đã dùng (text index / tiền tố / gần đúng) và từ khoá đã sửa khi phải tìm gần đúng. */
  timKiem?: { cheDo: "van-ban" | "tien-to" | "gan-dung" | "trong"; goiY: string | null };
  boLoc: {
    dsHang: { id: string; tenHang: string }[];
    dsLoai: { id: string; tenLoai: string }[];
    khoangGiaGoiY: string[];
    locThongSo?: { loiChoi: string[]; canBang: string[]; trongLuong: string[]; doCung: string[] };
    locGiaTu: number | null; locGiaDen: number | null; locHang: string[]; locKhoang: string | null; sapXep: string; dangLoc: boolean;
    /** Đếm bằng $facet trong MongoDB: nếu chọn hãng / khoảng giá này (giữ các bộ lọc khác) sẽ ra bao nhiêu sản phẩm. */
    demTheoHang?: Record<string, number>;
    demTheoKhoang?: Record<string, number>;
  };
}

/** Số sản phẩm cạnh lựa chọn lọc; lựa chọn ra 0 sản phẩm được làm mờ (vẫn bấm được). */
function SoDem({ so }: { so?: number }) {
  return so === undefined ? null : <span className="text-muted small ms-1">({so})</span>;
}

const NHAN_KHOANG: Record<string, string> = {
  "0-1000000": "Dưới 1 triệu", "1000000-2000000": "1 – 2 triệu", "2000000-3000000": "2 – 3 triệu",
  "3000000-5000000": "3 – 5 triệu", "5000000-": "Trên 5 triệu",
};

/** Nhóm thông số vợt lọc được ở backend (`vot-thong-so.ts`); nhãn nói rõ phân loại theo thông số ghi trong kho. */
const FACET_VOT = [
  { param: "can_bang", nhan: "Điểm cân bằng", giaTri: [["nang", "Nặng đầu"], ["can-bang", "Cân bằng"], ["nhe", "Nhẹ đầu"]] },
  { param: "trong_luong", nhan: "Trọng lượng", giaTri: [["3u", "3U"], ["4u", "4U"], ["5u", "5U"]] },
  { param: "do_cung", nhan: "Độ cứng thân", giaTri: [["mem", "Mềm"], ["vua", "Trung bình"], ["cung", "Cứng"]] },
] as const;
const NHAN_FACET: Record<string, string> = Object.fromEntries(FACET_VOT.flatMap((f) => f.giaTri.map(([k, v]) => [`${f.param}:${k}`, v])));
const FACET_PARAMS = ["loi_choi", "can_bang", "trong_luong", "do_cung"];

/** Tên loại để hiện trên chip: `loai` có thể là id hoặc slug (Vot, Giay…), tên "Vot" phải hiện là "Vợt". */
function tenLoaiChip(loai: string, ds?: { id: string; tenLoai: string }[]): string {
  const theoId = ds?.find((l) => l.id === loai)?.tenLoai;
  if (theoId) return theoId;
  const slug = Object.values(LOAI).find((l) => l.slug.toLowerCase() === loai.toLowerCase());
  return slug ? slug.tenNgan : loai;
}

/** Chip khoảng giá đọc được ("Từ 4.500.000 đ", "Đến 1.000.000 đ") thay vì số thô; giá trị không phải số thì giữ nguyên. */
function giaChip(tu: string | null, den: string | null): string {
  const dinhDang = (v: string) => (Number.isFinite(Number(v)) ? vnd(Number(v)) : v);
  if (tu && den) return `${dinhDang(tu)} – ${dinhDang(den)}`;
  return tu ? `Từ ${dinhDang(tu)}` : `Đến ${dinhDang(den ?? "")}`;
}

/** Danh sách sản phẩm có bộ lọc; trạng thái lọc nằm hoàn toàn trên query string để chia sẻ/quay lại được. */
export function ProductListing() {
  const sp = useSearchParams();
  const router = useRouter();
  const query = sp.toString();
  const { data, error, loading } = useApi<ListData>(`/san-pham${query ? `?${query}` : ""}`);
  const [giaTu, setGiaTu] = useState(sp.get("gia_tu") ?? "");
  const [giaDen, setGiaDen] = useState(sp.get("gia_den") ?? "");
  const [moLoc, setMoLoc] = useState(false);
  const hs = useHoSo();

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
  /** Bật/tắt một giá trị của nhóm lọc thông số (nhiều giá trị cùng nhóm = hoặc). Lối chơi đồng bộ về hồ sơ người chơi để header/trang chủ khớp. */
  const datFacet = (k: string, v: string) => {
    const hienTai = Array.from(new Set(sp.getAll(k).flatMap((x) => x.split(",")).map((x) => x.trim().toLowerCase()).filter(Boolean)));
    const moi = hienTai.includes(v) ? hienTai.filter((x) => x !== v) : [...hienTai, v];
    cap((q) => { q.delete(k); moi.forEach((x) => q.append(k, x)); });
    if (k === "loi_choi") {
      const mot = moi.filter((x): x is LoiChoiKhoa => (LOI_CHOI_HOP_LE as readonly string[]).includes(x));
      datHoSo({ lc: mot.length === 1 ? mot[0] : null }, false);
    }
  };
  const apDungHoSo = () => hs.lc && cap((q) => { q.set("loi_choi", hs.lc as string); });
  const hangs = sp.getAll("hangs");
  const boLoc = data?.boLoc;
  const hangDangChon = boLoc?.locHang ?? hangs;

  // Các bộ lọc đang áp dụng, hiện thành chip để gỡ từng cái mà không phải mở lại sidebar.
  const chips: { nhan: string; go: () => void }[] = [];
  const loaiId = sp.get("loai");
  if (loaiId) chips.push({ nhan: tenLoaiChip(loaiId, boLoc?.dsLoai), go: () => dat("loai", null) });
  if (sp.get("keyword")) chips.push({ nhan: `“${sp.get("keyword")}”`, go: () => dat("keyword", null) });
  hangDangChon.forEach((id) => chips.push({ nhan: boLoc?.dsHang.find((h) => h.id === id)?.tenHang ?? id, go: () => cap((q) => { q.delete("hangs"); q.delete("hang"); hangDangChon.filter((x) => x !== id).forEach((x) => q.append("hangs", x)); }) }));
  const khoang = sp.get("khoang");
  if (khoang) chips.push({ nhan: NHAN_KHOANG[khoang] ?? khoang, go: () => dat("khoang", null) });
  if (sp.get("gia_tu") || sp.get("gia_den")) chips.push({ nhan: giaChip(sp.get("gia_tu"), sp.get("gia_den")), go: () => cap((q) => { q.delete("gia_tu"); q.delete("gia_den"); }) });
  const dsFacet = (k: string) => Array.from(new Set(sp.getAll(k).flatMap((v) => v.split(",")).map((v) => v.trim().toLowerCase()).filter(Boolean)));
  const loiChoiChon = dsFacet("loi_choi").filter((v): v is LoiChoiKhoa => (LOI_CHOI_HOP_LE as readonly string[]).includes(v));
  const laVot = (() => {
    if (!loaiId) return false;
    const ten = boLoc?.dsLoai.find((l) => l.id === loaiId)?.tenLoai ?? tenLoaiChip(loaiId);
    return khoaLoai(ten) === "vot" || loaiId.toLowerCase() === LOAI.vot.slug.toLowerCase();
  })();
  // `loai` trên URL có thể là id hoặc slug (Vot, Giay…): quy về id của loại tương ứng để dropdown hiện đúng lựa chọn.
  const loaiChon = !loaiId ? "" : boLoc?.dsLoai.find((l) => l.id === loaiId)?.id
    ?? boLoc?.dsLoai.find((l) => khoaLoai(l.tenLoai) !== null && khoaLoai(l.tenLoai) === khoaLoai(tenLoaiChip(loaiId)))?.id
    ?? loaiId;
  const coFacet = FACET_PARAMS.some((k) => sp.has(k));
  const hienFacet = laVot || coFacet;
  loiChoiChon.forEach((v) => chips.push({ nhan: `Lối chơi ${NHAN_LOI_CHOI[v]}`, go: () => datFacet("loi_choi", v) }));
  FACET_VOT.forEach((f) => dsFacet(f.param).forEach((v) => chips.push({ nhan: NHAN_FACET[`${f.param}:${v}`] ?? v, go: () => datFacet(f.param, v) })));
  const SAP_XEP = [["moi", "Mới nhất"], ["gia_tang", "Giá tăng"], ["gia_giam", "Giá giảm"], ["ten", "Tên A–Z"]] as const;

  return (
    <>
      <PageHero
        banner={{ image: productBanner, alt: "Bộ sưu tập tinh tuyển VICTOR. Tối giản mà táo bạo." }}
        crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Sản phẩm", href: "/SanPham/Index" }, ...(data?.tieuDe && data.tieuDe !== "Danh sách sản phẩm" ? [{ nhan: data.tieuDe }] : [])]}
        title={data?.tieuDe ?? "Danh sách sản phẩm"}
        sub={data ? `${data.total} sản phẩm` : "Đang tìm sản phẩm…"} />
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
      <KhaySoSanh />
      {data?.timKiem?.cheDo === "gan-dung" && data.timKiem.goiY && (
        <p className="alert alert-light border small mb-3" role="status">
          Không có sản phẩm khớp đúng “{sp.get("keyword")}”. Đang hiện kết quả gần đúng, có phải bạn muốn tìm{" "}
          <Link href={`/SanPham/TimKiem?keyword=${encodeURIComponent(data.timKiem.goiY)}`} className="fw-semibold">{data.timKiem.goiY}</Link>?
        </p>
      )}
      {laVot && !hoSoTrong(hs) && hs.lc && !loiChoiChon.length && (
        <div className="ls-profile" role="region" aria-label="Hồ sơ người chơi">
          <span>Hồ sơ của bạn: lối chơi {NHAN_LOI_CHOI[hs.lc]}.</span>
          <button type="button" onClick={apDungHoSo}>Lọc vợt hợp lối chơi này</button>
        </div>
      )}
      {chips.length > 0 && (
        <div className="ls-chips" aria-label="Bộ lọc đang áp dụng">
          {chips.map((c, i) => <button type="button" key={`${c.nhan}-${i}`} onClick={c.go} aria-label={`Bỏ lọc ${c.nhan}`}>{c.nhan} <i className="fa-solid fa-xmark" aria-hidden="true" /></button>)}
          <Link href="/SanPham/Index" className="ls-chips-clear">Xóa tất cả</Link>
        </div>
      )}
      <div className="row g-4">
        <aside className={`col-lg-3 ls-side${moLoc ? " is-open" : ""}`}>
          <div className="card catalog-filters"><div className="card-body"><div className="catalog-filter-heading"><i className="fa-solid fa-sliders" aria-hidden="true" /> Bộ lọc sản phẩm</div>
            <h6 className="fw-bold"><label htmlFor="loc-loai" className="m-0">Loại sản phẩm</label></h6>
            {/* Dropdown thay cho danh sách nút: danh sách loại dài làm thanh lọc (dính khi cuộn) cao hơn màn hình, phần dưới không xem được. */}
            <select id="loc-loai" className="form-select form-select-sm rounded-3 mb-3" value={loaiChon} onChange={(e) => dat("loai", e.target.value || null)}>
              <option value="">Tất cả</option>
              {boLoc?.dsLoai.map((l) => <option key={l.id} value={l.id}>{l.tenLoai}</option>)}
              {loaiId && !boLoc?.dsLoai.some((l) => l.id === loaiChon) && <option value={loaiId}>{tenLoaiChip(loaiId)}</option>}
            </select>
            {hienFacet && (
              <div aria-label="Lọc theo thông số vợt">
                <fieldset className="ls-facet">
                  <legend>Lối chơi</legend>
                  <div className="ls-facet-chips">
                    {LOI_CHOI_HOP_LE.map((k) => <button type="button" key={k} aria-pressed={loiChoiChon.includes(k)} onClick={() => datFacet("loi_choi", k)}>{NHAN_LOI_CHOI[k]}</button>)}
                  </div>
                </fieldset>
                {FACET_VOT.map((f) => (
                  <fieldset className="ls-facet" key={f.param}>
                    <legend>{f.nhan}</legend>
                    <div className="ls-facet-chips">
                      {f.giaTri.map(([k, nhan]) => <button type="button" key={k} aria-pressed={dsFacet(f.param).includes(k)} onClick={() => datFacet(f.param, k)}>{nhan}</button>)}
                    </div>
                  </fieldset>
                ))}
                <p className="small text-muted">Phân loại theo thông số ghi trong kho; vợt thiếu thông số sẽ không xuất hiện khi lọc.</p>
              </div>
            )}
            <h6 className="fw-bold">Khoảng giá</h6>
            <div className="d-flex flex-column gap-1 mb-2">
              {boLoc?.khoangGiaGoiY.map((k) => (
                <label key={k} className="form-check"><input type="radio" className="form-check-input" name="khoang" checked={sp.get("khoang") === k} onChange={() => cap((q) => { q.set("khoang", k); q.delete("gia_tu"); q.delete("gia_den"); })} /> <span className={`form-check-label${boLoc.demTheoKhoang?.[k] === 0 && sp.get("khoang") !== k ? " text-muted" : ""}`}>{NHAN_KHOANG[k] ?? k}</span><SoDem so={boLoc.demTheoKhoang?.[k]} /></label>
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
                  })} /> <span className={`form-check-label${boLoc.demTheoHang && !boLoc.demTheoHang[h.id] && !hangDangChon.includes(h.id) ? " text-muted" : ""}`}>{h.tenHang}</span>
                  {boLoc.demTheoHang && <SoDem so={boLoc.demTheoHang[h.id] ?? 0} />}
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
            <div>
              <Empty message="Không tìm thấy sản phẩm phù hợp." linkUrl="/SanPham/Index" linkText="Xóa bộ lọc, xem tất cả sản phẩm" />
              <div className="ls-empty-help">
                <ul aria-label="Gợi ý khác">
                  <li><Link href={`/#quay-tu-van`}>Chọn vợt theo lối chơi</Link></li>
                  {chips.length > 0 && <li><Link href="/SanPham/Index">Bỏ hết bộ lọc</Link></li>}
                </ul>
                <HoiNguoiBan id="hoi-nguoi-ban-danh-sach" tieuDe="Không thấy món cần tìm? Hỏi người bán" mota="Mô tả món bạn cần, người bán gợi ý từ những gì đang có trong kho."
                  goiY={[sp.get("keyword") ? `Shop có ${sp.get("keyword")} không?` : "Shop còn vợt nào trong tầm giá của mình?", "Mình nên chọn vợt thế nào?"]} />
              </div>
            </div>
          ) : data && (
            <>
              <div className={`row g-3 ls-grid${loading ? " is-loading" : ""}`}>{data.items.map((s, i) => <div key={s.id} className="col-6 col-md-4"><ProductCard sp={s} uuTien={i < 2} /></div>)}</div>
              <Pagination trang={data} />
            </>
          )}
        </div>
      </div>
    </Page>
    </>
  );
}
