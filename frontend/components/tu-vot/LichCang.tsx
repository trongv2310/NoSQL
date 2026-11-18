"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProviders";
import s from "@/components/product/bento.module.css";
import { apiPost, loiTuApi } from "@/lib/api";

export interface KhungGio { ngay: string; sucChua: number; conTrong: number }
export interface LichCuaToi { _id: string; ngay: string; datCho: { _id: string; tenVot?: string; giaTriNhap: number; donViNhap: "kg" | "lbs"; mucCangLbs: number; tenDay?: string; trangThai: "cho" | "xong" | "huy" } }

const THU = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
/** Hiển thị theo giờ Việt Nam bất kể múi giờ máy (shop ở Việt Nam). */
export function nhanKhung(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${THU[d.getUTCDay()]} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:00`;
}

/** Đặt lịch căng tại shop cho một cây vợt. Shop chặn mức vượt tối đa nhà sản xuất; khung kín thì báo ngay (giữ chỗ là một lệnh có điều kiện ở MongoDB). */
export function DatLichCang({ votId, toiDaLbs, khung, onXong }: { votId: string; toiDaLbs?: number; khung: KhungGio[]; onXong: () => void }) {
  const { flash } = useApp();
  const conCho = khung.filter((k) => k.conTrong > 0);
  const [f, setF] = useState({ ngay: conCho[0]?.ngay ?? "", giaTri: "", donVi: "kg" as "kg" | "lbs", tenDay: "" });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);
  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true); setLoi(null);
    try {
      const r = await apiPost<{ message: string }>("/lich-cang", { ngay: f.ngay, votCaNhanId: votId, giaTri: Number(f.giaTri.replace(",", ".")), donVi: f.donVi, ...(f.tenDay.trim() ? { tenDay: f.tenDay.trim() } : {}) });
      flash("success", `${r.message} (${nhanKhung(f.ngay)})`);
      onXong();
    } catch (err) { setLoi(loiTuApi(err)); } finally { setDang(false); }
  };
  if (!conCho.length) return <p className={s.thongBao}>7 ngày tới đã kín lịch căng tại shop.</p>;
  return (
    <form onSubmit={gui} className={s.luoiForm} aria-label="Đặt lịch căng tại shop">
      <label className={s.truong}>Khung giờ
        <select className={s.nhap} value={f.ngay} onChange={(e) => setF({ ...f, ngay: e.target.value })}>
          {conCho.map((k) => <option key={k.ngay} value={k.ngay}>{nhanKhung(k.ngay)} · còn {k.conTrong}/{k.sucChua} chỗ</option>)}
        </select>
      </label>
      <div className={s.truong}>
        <label htmlFor={`dl-${votId}`}>Mức căng muốn căng</label>
        <div className={s.hang}>
          <input id={`dl-${votId}`} className={`${s.nhap} ${s.nhapNho}`} inputMode="decimal" required value={f.giaTri} onChange={(e) => setF({ ...f, giaTri: e.target.value })} placeholder="ví dụ 11" />
          <select className={`${s.nhap} ${s.nhapNho}`} aria-label="Đơn vị" value={f.donVi} onChange={(e) => setF({ ...f, donVi: e.target.value as "kg" | "lbs" })}><option value="kg">kg</option><option value="lbs">lbs</option></select>
        </div>
        {toiDaLbs !== undefined && <small className="text-muted">Shop không căng quá {toiDaLbs} lbs ({(toiDaLbs / 2.20462262).toFixed(1)} kg) cho cây vợt này</small>}
      </div>
      <label className={s.truong}>Dây cước (tuỳ chọn)<input className={s.nhap} maxLength={60} value={f.tenDay} onChange={(e) => setF({ ...f, tenDay: e.target.value })} /></label>
      {loi && <p className={s.loi} role="alert">{loi}</p>}
      <div className={s.hang}><button className={`${s.nut} ${s.nutChinh}`} disabled={dang}>{dang ? "Đang đặt…" : "Đặt lịch"}</button></div>
    </form>
  );
}

/** Danh sách lịch căng của khách; lịch còn chờ và chưa tới giờ thì huỷ được. */
export function LichCuaToiDs({ ds, onDoi }: { ds: LichCuaToi[]; onDoi: () => void }) {
  const { flash } = useApp();
  // Mốc "bây giờ" lấy một lần khi mở trang (render phải thuần); server vẫn tự chặn huỷ khung đã bắt đầu.
  const [bayGio] = useState(() => Date.now());
  const huy = async (l: LichCuaToi) => {
    if (!window.confirm(`Huỷ lịch căng ${nhanKhung(l.ngay)}?`)) return;
    try { const r = await apiPost<{ message: string }>(`/lich-cang/${l._id}/${l.datCho._id}/huy`); flash("success", r.message); onDoi(); } catch (err) { flash("danger", loiTuApi(err)); }
  };
  if (!ds.length) return null;
  const NHAN = { cho: "Đang chờ", xong: "Đã căng xong", huy: "Đã huỷ" } as const;
  return (
    <div className={s.the} style={{ marginTop: 12 }}>
      <h2 className="h5" style={{ margin: 0 }}>Lịch căng tại shop</h2>
      <ul className="list-unstyled small mb-0">
        {ds.map((l) => (
          <li key={l.datCho._id} className="d-flex flex-wrap align-items-center gap-2 py-1 border-bottom">
            <b>{nhanKhung(l.ngay)}</b> · {l.datCho.tenVot} · {l.datCho.giaTriNhap} {l.datCho.donViNhap}{l.datCho.tenDay ? ` · ${l.datCho.tenDay}` : ""}
            <span className={`badge rounded-pill ${l.datCho.trangThai === "xong" ? "text-bg-success" : l.datCho.trangThai === "huy" ? "text-bg-secondary" : "text-bg-warning"}`}>{NHAN[l.datCho.trangThai]}</span>
            {l.datCho.trangThai === "cho" && new Date(l.ngay).getTime() > bayGio && <button type="button" className={s.nut} onClick={() => huy(l)}>Huỷ</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
