"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { fontTieuDe } from "@/components/landing/fonts";
import { apiPost, loiTuApi } from "@/lib/api";
import { PhanDoan } from "./PhanDoan";
import s from "./tu-vot.module.css";

export interface KhungGio { ngay: string; sucChua: number; conTrong: number }
export interface LichCuaToi { _id: string; ngay: string; datCho: { _id: string; tenVot?: string; giaTriNhap: number; donViNhap: "kg" | "lbs"; mucCangLbs: number; tenDay?: string; trangThai: "cho" | "xong" | "huy" } }

const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const LBS_MOI_KG = 2.20462262;
const p2 = (n: number) => String(n).padStart(2, "0");
/** Giờ Việt Nam của một mốc ISO, bất kể múi giờ máy (shop ở Việt Nam). */
const vn = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000);

/** "T7 21/11 17:00" theo giờ Việt Nam (dùng cả ở trang admin). */
export function nhanKhung(iso: string): string {
  const d = vn(iso);
  return `${THU[d.getUTCDay()]} ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)} ${p2(d.getUTCHours())}:00`;
}
const khoaNgay = (iso: string) => { const d = vn(iso); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; };

/**
 * Đặt lịch căng tại shop cho một cây vợt: chọn ngày → chọn giờ (mỗi giờ ghi số chỗ còn) → mức căng.
 * Shop chặn mức vượt tối đa nhà sản xuất; khung kín thì máy chủ báo ngay (giữ chỗ là một lệnh có điều kiện ở MongoDB).
 */
export function DatLichCang({ votId, toiDaLbs, khung, onXong, onDong }: { votId: string; toiDaLbs?: number; khung: KhungGio[]; onXong: () => void; onDong: () => void }) {
  const { flash } = useApp();
  const theoNgay = useMemo(() => {
    const m = new Map<string, KhungGio[]>();
    for (const k of khung.filter((x) => x.conTrong > 0)) m.set(khoaNgay(k.ngay), [...(m.get(khoaNgay(k.ngay)) ?? []), k]);
    return [...m.entries()];
  }, [khung]);
  const [ngayChon, setNgayChon] = useState(theoNgay[0]?.[0] ?? "");
  const [f, setF] = useState({ ngay: theoNgay[0]?.[1][0]?.ngay ?? "", giaTri: "", donVi: "lbs" as "kg" | "lbs", tenDay: "" });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);
  const gioTrongNgay = theoNgay.find(([k]) => k === ngayChon)?.[1] ?? [];
  const so = Number(f.giaTri.replace(",", "."));
  const lbs = f.donVi === "kg" ? so * LBS_MOI_KG : so;
  const vuot = toiDaLbs !== undefined && f.giaTri !== "" && Number.isFinite(so) && lbs > toiDaLbs;

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true); setLoi(null);
    try {
      const r = await apiPost<{ message: string }>("/lich-cang", { ngay: f.ngay, votCaNhanId: votId, giaTri: so, donVi: f.donVi, ...(f.tenDay.trim() ? { tenDay: f.tenDay.trim() } : {}) });
      flash("success", `${r.message} (${nhanKhung(f.ngay)})`);
      onXong();
    } catch (err) { setLoi(loiTuApi(err)); } finally { setDang(false); }
  };

  if (!theoNgay.length) return <p className={s.dongTrong}>7 ngày tới đã kín lịch căng tại shop.</p>;
  return (
    <form onSubmit={gui} className={s.form} aria-label="Đặt lịch căng tại shop">
      <div className={`${s.truong} ${s.truongRong}`}>
        <span id={`ngay-${votId}`}>Chọn ngày</span>
        <div className={s.chonNgay} role="group" aria-labelledby={`ngay-${votId}`}>
          {theoNgay.map(([k, ds]) => {
            const d = vn(ds[0].ngay);
            return (
              <button key={k} type="button" className={s.ngayNut} aria-pressed={k === ngayChon}
                onClick={() => { setNgayChon(k); setF((x) => ({ ...x, ngay: ds[0].ngay })); }}>
                <span>{THU[d.getUTCDay()]}</span><b className={fontTieuDe.className}>{p2(d.getUTCDate())}/{p2(d.getUTCMonth() + 1)}</b>
              </button>
            );
          })}
        </div>
      </div>
      <div className={`${s.truong} ${s.truongRong}`}>
        <span id={`gio-${votId}`}>Chọn giờ</span>
        <div className={s.chonGio} role="group" aria-labelledby={`gio-${votId}`}>
          {gioTrongNgay.map((k) => (
            <button key={k.ngay} type="button" className={s.gioNut} aria-pressed={k.ngay === f.ngay} onClick={() => setF({ ...f, ngay: k.ngay })}>
              <b className={fontTieuDe.className}>{p2(vn(k.ngay).getUTCHours())}:00</b><span>còn {k.conTrong}/{k.sucChua} chỗ</span>
            </button>
          ))}
        </div>
      </div>
      <div className={s.truong}>
        <label htmlFor={`dl-${votId}`}>Mức căng muốn căng</label>
        <div className={s.nhapSo}>
          <input id={`dl-${votId}`} className={s.nhap} inputMode="decimal" required value={f.giaTri} onChange={(e) => setF({ ...f, giaTri: e.target.value })} placeholder={f.donVi === "lbs" ? "ví dụ 25" : "ví dụ 11"} aria-describedby={`dl-goiy-${votId}`} />
          <PhanDoan nhan="Đơn vị" giaTri={f.donVi} luaChon={[{ v: "lbs", nhan: "lbs" }, { v: "kg", nhan: "kg" }]} onDoi={(v) => setF({ ...f, donVi: v })} />
        </div>
        {toiDaLbs !== undefined && !(vuot && loi) && <small id={`dl-goiy-${votId}`} className={`${s.goiY} ${vuot ? s.goiYCanh : ""}`}>
          {vuot ? `Vượt mức tối đa ${toiDaLbs} lbs: shop sẽ không nhận mức này.` : `Shop căng tối đa ${toiDaLbs} lbs (${(toiDaLbs / LBS_MOI_KG).toFixed(1)} kg) cho cây này.`}
        </small>}
      </div>
      <label className={s.truong}>Dây cước (tuỳ chọn)<input className={s.nhap} maxLength={60} value={f.tenDay} onChange={(e) => setF({ ...f, tenDay: e.target.value })} placeholder="Ví dụ Yonex BG80" /></label>
      {loi && <p className={s.loi} role="alert"><i className="fa-solid fa-circle-exclamation" aria-hidden="true" />{loi}</p>}
      <div className={s.formCuoi}>
        <button className={`${s.nut} ${s.nutChinh}`} disabled={dang || !f.ngay}>{dang ? "Đang đặt…" : <>Đặt lịch {f.ngay && <span className={fontTieuDe.className}>{nhanKhung(f.ngay)}</span>}</>}</button>
        <button type="button" className={`${s.nut} ${s.nutChu}`} onClick={onDong}>Đóng</button>
      </div>
    </form>
  );
}

const TRANG_THAI = { cho: { nhan: "Đang chờ", cls: s.ttCho }, xong: { nhan: "Đã căng xong", cls: s.ttXong }, huy: { nhan: "Đã huỷ", cls: s.ttHuy } } as const;

/** Lịch căng tại shop của khách (mới nhất trước); lịch còn chờ và chưa tới giờ thì huỷ được. */
export function LichCuaToiDs({ ds, onDoi }: { ds: LichCuaToi[]; onDoi: () => void }) {
  const { flash } = useApp();
  // Mốc "bây giờ" lấy một lần khi mở trang (render phải thuần); máy chủ vẫn tự chặn huỷ khung đã bắt đầu.
  const [bayGio] = useState(() => Date.now());
  const huy = async (l: LichCuaToi) => {
    if (!window.confirm(`Huỷ lịch căng ${nhanKhung(l.ngay)}?`)) return;
    try { const r = await apiPost<{ message: string }>(`/lich-cang/${l._id}/${l.datCho._id}/huy`); flash("success", r.message); onDoi(); } catch (err) { flash("danger", loiTuApi(err)); }
  };
  const [xemCu, setXemCu] = useState(false);
  // Lịch đang chờ: gần nhất trước. Lịch đã xong / đã huỷ: gom lại, bấm mới hiện (mới nhất trước).
  const cho = ds.filter((l) => l.datCho.trangThai === "cho").sort((a, b) => a.ngay.localeCompare(b.ngay));
  const daQua = ds.filter((l) => l.datCho.trangThai !== "cho");
  const hien = [...cho, ...(xemCu ? daQua.slice(0, 6) : [])];
  return (
    <section className={s.khoi} aria-labelledby="lich-tieu-de">
      <h2 id="lich-tieu-de" className={s.khoiTieuDe}>Lịch căng tại shop {ds.length > 0 && <small>{cho.length} đang chờ</small>}</h2>
      {!cho.length && <p className={s.lichTrong}>Không có lịch đang chờ. Bấm <b>Đặt lịch tại shop</b> ở một cây vợt để giữ chỗ (mỗi khung 2 chỗ).</p>}
      {hien.length > 0 && (
        <ul className={s.lichDs}>
          {hien.map((l) => {
            const d = vn(l.ngay);
            const tt = TRANG_THAI[l.datCho.trangThai];
            return (
              <li key={l.datCho._id} className={s.lichMuc}>
                <div className={`${s.lichNgay} ${l.datCho.trangThai === "cho" ? "" : s.lichNgayXong}`} aria-hidden="true">
                  <span>{THU[d.getUTCDay()]}</span><b className={fontTieuDe.className}>{p2(d.getUTCDate())}</b><span>Th{d.getUTCMonth() + 1}</span>
                </div>
                <div>
                  <p className={s.lichTen}>{l.datCho.tenVot ?? "Vợt"}</p>
                  <p className={s.lichPhu}><span className="visually-hidden">{nhanKhung(l.ngay)} · </span><b className={fontTieuDe.className}>{p2(d.getUTCHours())}:00</b> · {l.datCho.giaTriNhap} {l.datCho.donViNhap}{l.datCho.tenDay ? ` · ${l.datCho.tenDay}` : ""}</p>
                  <div className={s.lichDuoi}>
                    <span className={`${s.trangThai} ${tt.cls}`}>{tt.nhan}</span>
                    {l.datCho.trangThai === "cho" && new Date(l.ngay).getTime() > bayGio && <button type="button" className={`${s.nut} ${s.nutChu} ${s.nutNho}`} onClick={() => huy(l)}>Huỷ lịch</button>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {daQua.length > 0 && <button type="button" className={`${s.nut} ${s.nutChu} ${s.nutNho} ${s.lichThem}`} aria-expanded={xemCu} onClick={() => setXemCu((x) => !x)}>
        {xemCu ? "Ẩn lịch đã qua" : `Lịch đã qua (${daQua.length})`}<i className={`fa-solid ${xemCu ? "fa-chevron-up" : "fa-chevron-down"}`} aria-hidden="true" />
      </button>}
    </section>
  );
}
