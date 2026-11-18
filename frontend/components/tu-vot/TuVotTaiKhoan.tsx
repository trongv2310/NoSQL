"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { Page } from "@/components/Ui";
import s from "@/components/product/bento.module.css";
import { api, apiDelete, apiPost, loiTuApi } from "@/lib/api";
import { homNayDiaPhuong, loiNhac, tinhNhac } from "@/lib/tu-vot";
import { DatLichCang, LichCuaToiDs, type KhungGio, type LichCuaToi } from "./LichCang";
import { docTu, xoaHanTu } from "./tu-vot-store";

/** Hộ chiếu cây vợt (votcanhans) như API trả về. Ngày là ISO; ngày căng lưu 00:00 UTC của ngày lịch người dùng chọn. */
interface LanCang { _id: string; ngay: string; mucCangLbs: number; giaTriNhap: number; donViNhap: "kg" | "lbs"; tenDay?: string; noiCang: "shop" | "ngoai"; vuotMucNSX?: boolean }
interface HoChieu {
  _id: string; ten: string; nguon: "mua-tai-shop" | "tu-nhap" | "chuyen-tu-trinh-duyet";
  sanPham?: string; bienThe?: string; soSerial?: string; ngayMua?: string;
  thongSoChup?: { sucCangMinLbs?: number; sucCangMaxLbs?: number; trongLuongU?: number };
  chuKyNhacNgay?: number; lanCangGanNhat?: LanCang; hanNhacLuc?: string; soLanCang: number; lichSuCang: LanCang[]; ghiChu?: string;
}

const NHAN_NGUON: Record<HoChieu["nguon"], string> = { "mua-tai-shop": "Mua tại shop", "tu-nhap": "Tự thêm", "chuyen-tu-trinh-duyet": "Chuyển từ trình duyệt" };
const ngayISO = (iso?: string) => (iso ? iso.slice(0, 10) : null);
const fmt = (iso?: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const CHU_KY_NHANH = [14, 30, 45, 60];

function FormLanCang({ vot, onXong }: { vot: HoChieu; onXong: (thongBao: string) => void }) {
  const [f, setF] = useState({ ngay: homNayDiaPhuong(), giaTri: "", donVi: "kg" as "kg" | "lbs", tenDay: "", noiCang: "ngoai" as "shop" | "ngoai" });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);
  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true); setLoi(null);
    try {
      const r = await apiPost<{ message: string }>(`/tu-vot/${vot._id}/lan-cang`, { ...f, giaTri: Number(String(f.giaTri).replace(",", ".")) });
      onXong(r.message);
    } catch (err) { setLoi(loiTuApi(err)); } finally { setDang(false); }
  };
  const max = vot.thongSoChup?.sucCangMaxLbs;
  return (
    <form onSubmit={gui} className={s.luoiForm} aria-label={`Ghi lần căng cho ${vot.ten}`}>
      <label className={s.truong}>Ngày căng<input className={s.nhap} type="date" value={f.ngay} max={homNayDiaPhuong()} required onChange={(e) => setF({ ...f, ngay: e.target.value })} /></label>
      <div className={s.truong}>
        <label htmlFor={`cang-${vot._id}`}>Số căng</label>
        <div className={s.hang}>
          <input id={`cang-${vot._id}`} className={`${s.nhap} ${s.nhapNho}`} inputMode="decimal" required value={f.giaTri} onChange={(e) => setF({ ...f, giaTri: e.target.value })} placeholder="ví dụ 11" />
          <select className={`${s.nhap} ${s.nhapNho}`} aria-label="Đơn vị" value={f.donVi} onChange={(e) => setF({ ...f, donVi: e.target.value as "kg" | "lbs" })}><option value="kg">kg</option><option value="lbs">lbs</option></select>
        </div>
        {max !== undefined && <small className="text-muted">Nhà sản xuất ghi tối đa {max} lbs ({(max / 2.20462262).toFixed(1)} kg)</small>}
      </div>
      <label className={s.truong}>Dây cước (tuỳ chọn)<input className={s.nhap} maxLength={60} value={f.tenDay} onChange={(e) => setF({ ...f, tenDay: e.target.value })} placeholder="Tên dây bạn dùng" /></label>
      <label className={s.truong}>Căng ở đâu
        <select className={s.nhap} value={f.noiCang} onChange={(e) => setF({ ...f, noiCang: e.target.value as "shop" | "ngoai" })}><option value="ngoai">Ở ngoài</option><option value="shop">Tại shop</option></select>
      </label>
      {loi && <p className={s.loi} role="alert">{loi}</p>}
      <div className={s.hang}><button className={`${s.nut} ${s.nutChinh}`} disabled={dang}>{dang ? "Đang ghi…" : "Ghi lần căng"}</button></div>
    </form>
  );
}

/**
 * Tủ vợt của khách đã đăng nhập: mỗi cây vợt là một "hộ chiếu" lưu trong MongoDB (votcanhans), sổ căng đầy đủ ở lancangs.
 * Dùng chung luật nhắc theo lịch với bản trình duyệt (lib/tu-vot.ts: tinhNhac, loiNhac): chỉ đếm số ngày so với chu kỳ người dùng chọn.
 */
export function TuVotTaiKhoan() {
  const { flash } = useApp();
  const sp = useSearchParams();
  const [ds, setDs] = useState<HoChieu[] | null>(null);
  const [coTransaction, setCoTransaction] = useState<boolean | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [moGhi, setMoGhi] = useState<string | null>(null);
  const [moLichSu, setMoLichSu] = useState<{ id: string; ds: LanCang[] } | null>(null);
  const [moDatLich, setMoDatLich] = useState<string | null>(null);
  const [khung, setKhung] = useState<KhungGio[]>([]);
  const [lichCuaToi, setLichCuaToi] = useState<LichCuaToi[]>([]);
  const [form, setForm] = useState({ ten: "", soSerial: "", chuKy: "", sanPhamId: null as string | null, bienTheId: null as string | null });
  const [soVotTrinhDuyet, setSoVotTrinhDuyet] = useState(0);
  const [dangChuyen, setDangChuyen] = useState(false);
  const homNay = homNayDiaPhuong();

  const tai = useCallback(async () => {
    try {
      const r = await api<{ vot: HoChieu[]; coTransaction: boolean }>("/tu-vot");
      setDs(r.vot); setCoTransaction(r.coTransaction); setLoi(null);
      const [k, l] = await Promise.all([api<KhungGio[]>("/lich-cang/khung"), api<{ lich: LichCuaToi[] }>("/lich-cang/cua-toi")]);
      setKhung(k); setLichCuaToi(l.lich);
    } catch (e) { setLoi(loiTuApi(e)); }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void tai();
    try { setSoVotTrinhDuyet(docTu().ds.length); } catch { /* không đọc được thì thôi */ }
  }, [tai]);

  // Điền sẵn từ trang chi tiết vợt: /tu-vot?them=<id sản phẩm>&bien=<id phiên bản>
  const them = sp.get("them"), bien = sp.get("bien");
  useEffect(() => {
    if (!them || !/^[0-9a-f]{24}$/.test(them)) return;
    let huy = false;
    api<{ sanPham: { id: string; tenSanPham: string }; bienThes: { id: string; size?: { tenSize: string } | null }[] }>(`/san-pham/${them}`).then((ct) => {
      if (huy) return;
      const b = bien ? ct.bienThes.find((x) => x.id === bien) : undefined;
      setForm((f) => ({ ...f, ten: ct.sanPham.tenSanPham + (b?.size ? ` ${b.size.tenSize}` : ""), sanPhamId: ct.sanPham.id, bienTheId: b?.id ?? null }));
    }).catch(() => { /* nhập tay */ });
    return () => { huy = true; };
  }, [them, bien]);

  const denHan = useMemo(() => (ds ?? []).filter((v) => tinhNhac({ ngayCang: ngayISO(v.lanCangGanNhat?.ngay), chuKyNgay: v.chuKyNhacNgay ?? null }, homNay).loai === "den-han"), [ds, homNay]);

  const themVot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await apiPost<{ message: string }>("/tu-vot", {
        ten: form.ten.trim(), ...(form.sanPhamId ? { sanPhamId: form.sanPhamId } : {}), ...(form.bienTheId ? { bienTheId: form.bienTheId } : {}),
        ...(form.soSerial.trim() ? { soSerial: form.soSerial.trim() } : {}), ...(form.chuKy ? { chuKyNhacNgay: Number(form.chuKy) } : {}),
      });
      flash("success", r.message);
      setForm({ ten: "", soSerial: "", chuKy: "", sanPhamId: null, bienTheId: null });
      await tai();
    } catch (err) { flash("danger", loiTuApi(err)); }
  };
  const doiChuKy = async (v: HoChieu, chuKy: number | null) => {
    try { await api(`/tu-vot/${v._id}`, { method: "PATCH", body: { chuKyNhacNgay: chuKy } }); await tai(); } catch (err) { flash("danger", loiTuApi(err)); }
  };
  const xoa = async (v: HoChieu) => {
    if (!window.confirm(`Xoá "${v.ten}" khỏi tủ? Lịch sử căng vẫn được giữ.`)) return;
    try { const r = await apiDelete<{ message: string }>(`/tu-vot/${v._id}`); flash("success", r.message); await tai(); } catch (err) { flash("danger", loiTuApi(err)); }
  };
  const xemLichSu = async (v: HoChieu) => {
    if (moLichSu?.id === v._id) { setMoLichSu(null); return; }
    try { const r = await api<{ lanCang: LanCang[] }>(`/tu-vot/${v._id}/lan-cang`); setMoLichSu({ id: v._id, ds: r.lanCang }); } catch (err) { flash("danger", loiTuApi(err)); }
  };
  const chuyenTuTrinhDuyet = async () => {
    setDangChuyen(true);
    try {
      const r = await apiPost<{ them: number; daCo: number; loi: string[] }>("/tu-vot/chuyen-tu-trinh-duyet", { vot: docTu().ds });
      flash(r.loi.length ? "danger" : "success", `Đã chuyển ${r.them} vợt vào tài khoản${r.daCo ? `, ${r.daCo} vợt đã có từ trước` : ""}${r.loi.length ? `; ${r.loi.length} vợt lỗi: ${r.loi.join("; ")}` : ""}.`);
      await tai();
    } catch (err) { flash("danger", loiTuApi(err)); } finally { setDangChuyen(false); }
  };
  const boBanTrinhDuyet = () => {
    if (!window.confirm("Xoá tủ vợt lưu trên trình duyệt này? Vợt đã chuyển vào tài khoản vẫn còn.")) return;
    const kq = xoaHanTu();
    if (kq.ok) { setSoVotTrinhDuyet(0); window.dispatchEvent(new Event("tu-vot:doi")); }
  };

  return (
    <Page>
      <nav className="mb-3 small text-muted"><Link href="/">Trang chủ</Link> / Tủ vợt của tôi</nav>
      <h1 className="h3">Tủ vợt của tôi</h1>
      <p className={s.ghiChu}>Mỗi cây vợt có một <strong>hộ chiếu</strong> lưu trong tài khoản: khoảng căng nhà sản xuất của đúng phiên bản, sổ căng cước và lịch nhắc bạn tự chọn. Vợt mua tại shop được tự thêm khi đơn hoàn thành. Nhắc chỉ đếm số ngày theo chu kỳ bạn đặt, không đo độ căng còn lại.</p>

      {soVotTrinhDuyet > 0 && (
        <div className={`${s.thongBao} ${s.thongBaoCanh}`} role="status">
          Trình duyệt này đang lưu {soVotTrinhDuyet} vợt từ trước khi bạn đăng nhập.{" "}
          <button type="button" className={`${s.nut} ${s.nutChinh}`} disabled={dangChuyen} onClick={chuyenTuTrinhDuyet}>{dangChuyen ? "Đang chuyển…" : "Chuyển vào tài khoản"}</button>{" "}
          <button type="button" className={s.nut} onClick={boBanTrinhDuyet}>Xoá bản trên trình duyệt</button>
        </div>
      )}
      {denHan.length > 0 && <div className={`${s.thongBao} ${s.thongBaoCanh}`} role="status"><strong>Đến lịch nhắc ({denHan.length}):</strong> {denHan.map((v) => v.ten).join(", ")}.</div>}
      {loi && <p className={`${s.thongBao} ${s.thongBaoLoi}`} role="alert">{loi}</p>}

      <LichCuaToiDs ds={lichCuaToi} onDoi={tai} />

      <form onSubmit={themVot} className={s.the} style={{ marginTop: 12 }} aria-label="Thêm vợt vào tủ">
        <h2 className="h5" style={{ margin: 0 }}>Thêm vợt</h2>
        <div className={s.luoiForm}>
          <label className={s.truong}>Tên vợt<input className={s.nhap} required maxLength={80} value={form.ten} onChange={(e) => setForm({ ...form, ten: e.target.value, sanPhamId: null, bienTheId: null })} placeholder="Tên cây vợt" /></label>
          <label className={s.truong}>Số serial (tuỳ chọn)<input className={s.nhap} maxLength={40} value={form.soSerial} onChange={(e) => setForm({ ...form, soSerial: e.target.value })} placeholder="In trên khung vợt" /></label>
          <label className={s.truong}>Nhắc căng lại sau (ngày)<input className={`${s.nhap} ${s.nhapNho}`} inputMode="numeric" value={form.chuKy} onChange={(e) => setForm({ ...form, chuKy: e.target.value })} placeholder="để trống = không nhắc" /></label>
        </div>
        {form.bienTheId && <p className={s.ghiChu} style={{ margin: 0 }}>Gắn với phiên bản trong cửa hàng: khoảng căng nhà sản xuất sẽ được chụp vào hộ chiếu.</p>}
        <div className={s.hang}><button className={`${s.nut} ${s.nutChinh}`}>Thêm vào tủ</button></div>
      </form>

      <h2 className="h5" style={{ marginTop: 18 }}>Vợt trong tủ ({ds?.length ?? 0})</h2>
      {ds === null ? <p>Đang tải tủ vợt…</p> : ds.length === 0 ? <p className={s.thongBao}>Tủ vợt đang trống.</p> : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {ds.map((v) => {
            const nhac = tinhNhac({ ngayCang: ngayISO(v.lanCangGanNhat?.ngay), chuKyNgay: v.chuKyNhacNgay ?? null }, homNay);
            const lan = v.lanCangGanNhat;
            return (
              <li key={v._id} className={`${s.the} ${nhac.loai === "den-han" ? s.theDen : ""}`}>
                <div className={s.hang} style={{ justifyContent: "space-between" }}>
                  <strong>{v.sanPham ? <Link href={`/Home/ChiTietSanPham/${v.sanPham}`}>{v.ten}</Link> : v.ten}</strong>
                  <span className="small text-muted">{NHAN_NGUON[v.nguon]}{v.soSerial ? ` · Serial ${v.soSerial}` : ""}{v.ngayMua ? ` · Mua ${fmt(v.ngayMua)}` : ""}</span>
                </div>
                <p className={s.ghiChu} style={{ margin: 0 }}>
                  {v.thongSoChup?.sucCangMaxLbs !== undefined && <>Khoảng căng nhà sản xuất: <b>{v.thongSoChup.sucCangMinLbs ?? "?"}–{v.thongSoChup.sucCangMaxLbs} lbs</b> · </>}
                  {lan ? <>Lần căng gần nhất: <b>{fmt(lan.ngay)}</b>, {lan.giaTriNhap} {lan.donViNhap}{lan.donViNhap === "kg" ? ` (${lan.mucCangLbs} lbs)` : ""}{lan.tenDay ? `, dây ${lan.tenDay}` : ""}{lan.vuotMucNSX ? " ⚠ vượt mức NSX" : ""}</> : "Chưa ghi lần căng nào"}
                  {` · Đã căng ${v.soLanCang} lần`}
                </p>
                <p className={`${s.thongBao} ${nhac.loai === "den-han" ? s.thongBaoCanh : ""}`} role="status">{loiNhac(nhac)}</p>
                <div className={s.hang} role="group" aria-label="Chu kỳ nhắc">
                  <span className="small">Nhắc sau:</span>
                  {CHU_KY_NHANH.map((n) => <button key={n} type="button" className={s.chip} aria-pressed={v.chuKyNhacNgay === n} onClick={() => doiChuKy(v, v.chuKyNhacNgay === n ? null : n)}>{n} ngày</button>)}
                </div>
                <div className={s.hang}>
                  <button type="button" className={`${s.nut} ${s.nutChinh}`} aria-expanded={moGhi === v._id} onClick={() => setMoGhi(moGhi === v._id ? null : v._id)}>Ghi lần căng</button>
                  <button type="button" className={s.nut} aria-expanded={moDatLich === v._id} onClick={() => setMoDatLich(moDatLich === v._id ? null : v._id)}>Đặt lịch căng tại shop</button>
                  <button type="button" className={s.nut} aria-expanded={moLichSu?.id === v._id} onClick={() => xemLichSu(v)}>Sổ căng ({v.soLanCang})</button>
                  <button type="button" className={s.nut} onClick={() => xoa(v)}>Xoá</button>
                </div>
                {moDatLich === v._id && <DatLichCang votId={v._id} toiDaLbs={v.thongSoChup?.sucCangMaxLbs} khung={khung} onXong={async () => { setMoDatLich(null); await tai(); }} />}
                {moGhi === v._id && <FormLanCang vot={v} onXong={async (tb) => { flash("success", tb); setMoGhi(null); await tai(); }} />}
                {moLichSu?.id === v._id && (
                  <table className="table table-sm small mb-0">
                    <thead><tr><th>Ngày</th><th>Mức căng</th><th>Dây</th><th>Nơi căng</th></tr></thead>
                    <tbody>{moLichSu.ds.map((l) => <tr key={l._id}><td>{fmt(l.ngay)}</td><td>{l.giaTriNhap} {l.donViNhap}{l.donViNhap === "kg" ? ` (${l.mucCangLbs} lbs)` : ""}{l.vuotMucNSX ? " ⚠" : ""}</td><td>{l.tenDay ?? "—"}</td><td>{l.noiCang === "shop" ? "Tại shop" : "Ở ngoài"}</td></tr>)}</tbody>
                  </table>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {coTransaction !== null && <p className={s.ghiChu} style={{ marginTop: 14 }}>Lưu trong tài khoản (MongoDB, {coTransaction ? "ghi sổ căng bằng transaction" : "ghi sổ căng bằng thao tác nguyên tử + bù trừ"}).</p>}
    </Page>
  );
}
