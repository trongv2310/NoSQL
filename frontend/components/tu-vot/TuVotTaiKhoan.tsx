"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { fontTieuDe } from "@/components/landing/fonts";
import { ProductImage } from "@/components/landing/ProductImage";
import { api, apiDelete, apiPost, loiTuApi } from "@/lib/api";
import { homNayDiaPhuong, tinhNhac, type TrangThaiNhac } from "@/lib/tu-vot";
import { DatLichCang, LichCuaToiDs, type KhungGio, type LichCuaToi } from "./LichCang";
import { PhanDoan } from "./PhanDoan";
import { docTu, xoaHanTu } from "./tu-vot-store";
import s from "./tu-vot.module.css";

/** Hộ chiếu cây vợt (votcanhans) như API trả về. Ngày là ISO; ngày căng lưu 00:00 UTC của ngày lịch người dùng chọn. */
interface LanCang { _id: string; ngay: string; mucCangLbs: number; giaTriNhap: number; donViNhap: "kg" | "lbs"; tenDay?: string; noiCang: "shop" | "ngoai"; vuotMucNSX?: boolean }
interface HoChieu {
  _id: string; ten: string; nguon: "mua-tai-shop" | "tu-nhap" | "chuyen-tu-trinh-duyet";
  sanPham?: string; bienThe?: string; soSerial?: string; ngayMua?: string; anh?: string;
  thongSoChup?: { sucCangMinLbs?: number; sucCangMaxLbs?: number; trongLuongU?: number };
  chuKyNhacNgay?: number; lanCangGanNhat?: LanCang; hanNhacLuc?: string; soLanCang: number; lichSuCang: LanCang[]; ghiChu?: string;
}
type Mo = { id: string; loai: "ghi" | "lich" | "so" } | null;

const NHAN_NGUON: Record<HoChieu["nguon"], string> = { "mua-tai-shop": "Mua tại shop", "tu-nhap": "Tự thêm", "chuyen-tu-trinh-duyet": "Chuyển từ trình duyệt" };
const LBS_MOI_KG = 2.20462262;
const ngayISO = (iso?: string) => (iso ? iso.slice(0, 10) : null);
const fmt = (iso?: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const CHU_KY: { v: number | null; nhan: string }[] = [{ v: 14, nhan: "14" }, { v: 30, nhan: "30" }, { v: 45, nhan: "45" }, { v: 60, nhan: "60" }, { v: null, nhan: "Tắt" }];

function AnhVot({ v, sizes }: { v: HoChieu; sizes: string }) {
  if (!v.anh) return <span className={`${s.anh} ${s.anhTrong}`} aria-hidden="true"><i className="fa-solid fa-table-tennis-paddle-ball" /></span>;
  return <span className={s.anh}><ProductImage src={v.anh} alt="" sizes={sizes} hoaNen /></span>;
}

/** Khoảng căng nhà sản xuất của đúng phiên bản (thanh) + vị trí lần căng gần nhất (điểm). Không có khoảng thì không vẽ. */
function KhoangCang({ v }: { v: HoChieu }) {
  const min = v.thongSoChup?.sucCangMinLbs, max = v.thongSoChup?.sucCangMaxLbs;
  if (min === undefined || max === undefined || max <= min) return null;
  const lan = v.lanCangGanNhat;
  const tile = lan ? Math.min(100, Math.max(0, ((lan.mucCangLbs - min) / (max - min)) * 100)) : null;
  return (
    <div className={s.dai2}>
      <div className={s.dai2Dong}>
        <span>Khoảng nhà sản xuất <b className={fontTieuDe.className}>{min}–{max} lbs</b></span>
        {lan && <span>Lần gần nhất <b className={fontTieuDe.className}>{lan.mucCangLbs} lbs</b></span>}
      </div>
      <div className={s.ray} role="img" aria-label={`Nhà sản xuất cho phép ${min} đến ${max} lbs${lan ? `; lần căng gần nhất ${lan.mucCangLbs} lbs` : ""}`}>
        {tile !== null && <span className={`${s.diem} ${lan?.vuotMucNSX ? s.diemVuot : ""}`} style={{ left: `${tile}%` }} />}
      </div>
    </div>
  );
}

/** Nhắc căng lại theo chu kỳ người dùng chọn: một dòng chữ + thanh "số ngày đã qua / chu kỳ". */
function NhacCang({ v, nhac, onDoiChuKy }: { v: HoChieu; nhac: TrangThaiNhac; onDoiChuKy: (n: number | null) => void }) {
  const chuKy = v.chuKyNhacNgay ?? null;
  let chu: React.ReactNode;
  switch (nhac.loai) {
    case "chua-co-ngay": chu = <>Chưa ghi lần căng nào. Ghi ngày căng thực tế để được nhắc.</>; break;
    case "khong-nhac": chu = <>Đã <b>{nhac.daQuaNgay} ngày</b> từ lần căng gần nhất. Chưa bật nhắc.</>; break;
    case "con-han": chu = <>Đã <b>{nhac.daQuaNgay} ngày</b>, còn <b>{nhac.conNgay} ngày</b> đến lịch nhắc.</>; break;
    case "den-han": chu = <>Đã <b>{nhac.daQuaNgay} ngày</b>: {nhac.quaNgay === 0 ? <b>đến lịch căng lại</b> : <>quá lịch nhắc <b>{nhac.quaNgay} ngày</b></>}.</>; break;
  }
  const phan = (nhac.loai === "con-han" || nhac.loai === "den-han") && chuKy ? Math.min(100, (nhac.daQuaNgay / chuKy) * 100) : null;
  return (
    <div className={`${s.nhac} ${nhac.loai === "den-han" ? s.nhacDen : ""}`}>
      <p className={s.nhacChu} role="status">{chu}</p>
      {phan !== null && <div className={s.thanh} aria-hidden="true"><i style={{ width: `${phan}%` }} /></div>}
      <div className={s.nhacPhai}>
        <span>Nhắc sau (ngày)</span>
        <PhanDoan nhan={`Chu kỳ nhắc căng lại cho ${v.ten}`} giaTri={chuKy} luaChon={CHU_KY} onDoi={onDoiChuKy} />
      </div>
    </div>
  );
}

function FormLanCang({ vot, onXong, onDong }: { vot: HoChieu; onXong: (thongBao: string) => void; onDong: () => void }) {
  const [f, setF] = useState({ ngay: homNayDiaPhuong(), giaTri: "", donVi: "lbs" as "kg" | "lbs", tenDay: "", noiCang: "ngoai" as "shop" | "ngoai" });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);
  const so = Number(String(f.giaTri).replace(",", "."));
  const max = vot.thongSoChup?.sucCangMaxLbs;
  const vuot = max !== undefined && f.giaTri !== "" && Number.isFinite(so) && (f.donVi === "kg" ? so * LBS_MOI_KG : so) > max;
  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true); setLoi(null);
    try {
      const r = await apiPost<{ message: string }>(`/tu-vot/${vot._id}/lan-cang`, { ...f, giaTri: so });
      onXong(r.message);
    } catch (err) { setLoi(loiTuApi(err)); } finally { setDang(false); }
  };
  return (
    <form onSubmit={gui} className={s.form} aria-label={`Ghi lần căng cho ${vot.ten}`}>
      <label className={s.truong}>Ngày căng<input className={s.nhap} type="date" value={f.ngay} max={homNayDiaPhuong()} required onChange={(e) => setF({ ...f, ngay: e.target.value })} /></label>
      <div className={s.truong}>
        <label htmlFor={`cang-${vot._id}`}>Số căng</label>
        <div className={s.nhapSo}>
          <input id={`cang-${vot._id}`} className={s.nhap} inputMode="decimal" required value={f.giaTri} onChange={(e) => setF({ ...f, giaTri: e.target.value })} placeholder={f.donVi === "lbs" ? "ví dụ 25" : "ví dụ 11"} aria-describedby={`cang-goiy-${vot._id}`} />
          <PhanDoan nhan="Đơn vị" giaTri={f.donVi} luaChon={[{ v: "lbs", nhan: "lbs" }, { v: "kg", nhan: "kg" }]} onDoi={(v) => setF({ ...f, donVi: v })} />
        </div>
        {max !== undefined && !(vuot && loi) && <small id={`cang-goiy-${vot._id}`} className={`${s.goiY} ${vuot ? s.goiYCanh : ""}`}>
          {vuot ? (f.noiCang === "shop" ? `Vượt mức tối đa ${max} lbs: shop không căng mức này.` : `Vượt mức tối đa ${max} lbs: vẫn ghi được nhưng sẽ bị đánh dấu.`) : `Nhà sản xuất ghi tối đa ${max} lbs (${(max / LBS_MOI_KG).toFixed(1)} kg).`}
        </small>}
      </div>
      <label className={s.truong}>Dây cước (tuỳ chọn)<input className={s.nhap} maxLength={60} value={f.tenDay} onChange={(e) => setF({ ...f, tenDay: e.target.value })} placeholder="Ví dụ Yonex BG66 Ultimax" /></label>
      <div className={s.truong}>
        <span>Căng ở đâu</span>
        <PhanDoan nhan="Căng ở đâu" giaTri={f.noiCang} luaChon={[{ v: "ngoai", nhan: "Ở ngoài" }, { v: "shop", nhan: "Tại shop" }]} onDoi={(v) => setF({ ...f, noiCang: v })} />
      </div>
      {loi && <p className={s.loi} role="alert"><i className="fa-solid fa-circle-exclamation" aria-hidden="true" />{loi}</p>}
      <div className={s.formCuoi}>
        <button className={`${s.nut} ${s.nutChinh}`} disabled={dang}>{dang ? "Đang ghi…" : "Lưu lần căng"}</button>
        <button type="button" className={`${s.nut} ${s.nutChu}`} onClick={onDong}>Đóng</button>
      </div>
    </form>
  );
}

/** Sổ căng: dòng thời gian, lần mới nhất ở trên. */
function SoCang({ ds }: { ds: LanCang[] }) {
  if (!ds.length) return <p className={s.dongTrong}>Sổ căng đang trống. Bấm <b>Ghi lần căng</b> để thêm lần đầu.</p>;
  return (
    <ol className={s.dong}>
      {ds.map((l) => (
        <li key={l._id} className={s.dongMuc}>
          <span className={`${s.dongNgay} ${fontTieuDe.className}`}>{fmt(l.ngay)}</span>
          <span className={s.dongNoi}>
            <b className={fontTieuDe.className}>{l.giaTriNhap} {l.donViNhap}</b>
            {l.donViNhap === "kg" && <span>({l.mucCangLbs} lbs)</span>}
            <span>{l.tenDay ?? "Không ghi dây"}</span>
            <span className={`${s.nhan} ${l.noiCang === "shop" ? s.nhanShop : ""}`}>{l.noiCang === "shop" ? "Tại shop" : "Ở ngoài"}</span>
            {l.vuotMucNSX && <span className={s.canhBao}><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />Vượt mức nhà sản xuất</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Tủ vợt của khách đã đăng nhập: mỗi cây vợt là một "hộ chiếu" lưu trong MongoDB (votcanhans), sổ căng đầy đủ ở lancangs.
 * Dùng chung luật nhắc theo lịch với bản trình duyệt (lib/tu-vot.ts: tinhNhac): chỉ đếm số ngày so với chu kỳ người dùng chọn.
 */
export function TuVotTaiKhoan() {
  const { flash } = useApp();
  const sp = useSearchParams();
  const [ds, setDs] = useState<HoChieu[] | null>(null);
  const [coTransaction, setCoTransaction] = useState<boolean | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [mo, setMo] = useState<Mo>(null);
  const [soCang, setSoCang] = useState<{ id: string; ds: LanCang[] } | null>(null);
  const [khung, setKhung] = useState<KhungGio[]>([]);
  const [lichCuaToi, setLichCuaToi] = useState<LichCuaToi[]>([]);
  const [moThem, setMoThem] = useState(false);
  const [form, setForm] = useState({ ten: "", soSerial: "", chuKy: null as number | null, sanPhamId: null as string | null, bienTheId: null as string | null });
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
      setMoThem(true);
    }).catch(() => { /* nhập tay */ });
    return () => { huy = true; };
  }, [them, bien]);

  const nhacCua = useCallback((v: HoChieu) => tinhNhac({ ngayCang: ngayISO(v.lanCangGanNhat?.ngay), chuKyNgay: v.chuKyNhacNgay ?? null }, homNay), [homNay]);
  const denHan = useMemo(() => (ds ?? []).filter((v) => nhacCua(v).loai === "den-han"), [ds, nhacCua]);
  // Cây đến lịch căng lại lên đầu, rồi cây căng gần đây nhất; cây chưa ghi lần căng nào xuống cuối (giữ thứ tự thêm vào tủ).
  const dsXep = useMemo(() => [...(ds ?? [])].sort((a, b) => {
    const d = Number(nhacCua(b).loai === "den-han") - Number(nhacCua(a).loai === "den-han");
    return d || (b.lanCangGanNhat?.ngay ?? "").localeCompare(a.lanCangGanNhat?.ngay ?? "");
  }), [ds, nhacCua]);
  const lichCho = lichCuaToi.filter((l) => l.datCho.trangThai === "cho").length;

  const moPhan = (id: string, loai: "ghi" | "lich" | "so", cuon = false) => {
    setMo((m) => (m?.id === id && m.loai === loai ? null : { id, loai }));
    if (cuon) requestAnimationFrame(() => document.getElementById(`vot-${id}`)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
  };
  const xemSoCang = async (v: HoChieu) => {
    if (mo?.id === v._id && mo.loai === "so") { setMo(null); return; }
    try { const r = await api<{ lanCang: LanCang[] }>(`/tu-vot/${v._id}/lan-cang`); setSoCang({ id: v._id, ds: r.lanCang }); setMo({ id: v._id, loai: "so" }); } catch (err) { flash("danger", loiTuApi(err)); }
  };
  const themVot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await apiPost<{ message: string }>("/tu-vot", {
        ten: form.ten.trim(), ...(form.sanPhamId ? { sanPhamId: form.sanPhamId } : {}), ...(form.bienTheId ? { bienTheId: form.bienTheId } : {}),
        ...(form.soSerial.trim() ? { soSerial: form.soSerial.trim() } : {}), ...(form.chuKy ? { chuKyNhacNgay: form.chuKy } : {}),
      });
      flash("success", r.message);
      setForm({ ten: "", soSerial: "", chuKy: null, sanPhamId: null, bienTheId: null });
      setMoThem(false);
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
    <div className={`container ${s.trang}`}>
      <p className={s.vet}><Link href="/">Trang chủ</Link> / Tủ vợt của tôi</p>
      <header className={s.dau}>
        <div>
          <h1 className={`${s.tieuDe} ${fontTieuDe.className}`}>Tủ vợt của tôi</h1>
          {ds && <p className={s.tomTat}>
            <b>{ds.length}</b> cây vợt
            {denHan.length > 0 && <> · <b className={s.soCam}>{denHan.length}</b> cây đến lịch căng lại</>}
            {lichCho > 0 && <> · <b>{lichCho}</b> lịch căng tại shop đang chờ</>}
          </p>}
        </div>
        <button type="button" className={`${s.nut} ${s.nutVien}`} aria-expanded={moThem} aria-controls="them-vot" onClick={() => setMoThem((x) => !x)}>
          <i className={`fa-solid ${moThem ? "fa-xmark" : "fa-plus"}`} aria-hidden="true" />{moThem ? "Đóng" : "Thêm vợt"}
        </button>
      </header>

      {soVotTrinhDuyet > 0 && (
        <div className={s.dai} role="status">
          <span><i className="fa-solid fa-laptop" aria-hidden="true" /> Trình duyệt này đang lưu <b>{soVotTrinhDuyet} vợt</b> từ trước khi bạn đăng nhập.</span>
          <button type="button" className={`${s.nut} ${s.nutChinh} ${s.nutNho}`} disabled={dangChuyen} onClick={chuyenTuTrinhDuyet}>{dangChuyen ? "Đang chuyển…" : "Chuyển vào tài khoản"}</button>
          <button type="button" className={`${s.nut} ${s.nutChu} ${s.nutNho}`} onClick={boBanTrinhDuyet}>Xoá bản trên trình duyệt</button>
        </div>
      )}
      {loi && <p className={`${s.dai} ${s.daiLoi}`} role="alert"><i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> {loi}</p>}

      <div className={s.bo}>
        <aside className={s.cot} aria-label="Lịch căng tại shop">
          <LichCuaToiDs ds={lichCuaToi} onDoi={tai} />
        </aside>

        <div className={s.chinh}>
          {moThem && (
            <section id="them-vot" className={s.khoi} aria-labelledby="them-tieu-de">
              <h2 id="them-tieu-de" className={s.khoiTieuDe}>Thêm vợt vào tủ <small>Vợt mua tại shop được tự thêm khi đơn hoàn thành</small></h2>
              <form onSubmit={themVot} className={s.form}>
                <label className={s.truong}>Tên vợt<input className={s.nhap} required maxLength={80} value={form.ten} onChange={(e) => setForm({ ...form, ten: e.target.value, sanPhamId: null, bienTheId: null })} placeholder="Ví dụ Yonex Astrox 88D Pro 4U" /></label>
                <label className={s.truong}>Số serial (tuỳ chọn)<input className={s.nhap} maxLength={40} value={form.soSerial} onChange={(e) => setForm({ ...form, soSerial: e.target.value })} placeholder="In trên khung vợt" /></label>
                <div className={`${s.truong} ${s.truongRong}`}>
                  <span>Nhắc căng lại sau (ngày)</span>
                  <PhanDoan nhan="Chu kỳ nhắc căng lại" giaTri={form.chuKy} luaChon={CHU_KY} onDoi={(v) => setForm({ ...form, chuKy: v })} />
                </div>
                {form.bienTheId && <p className={`${s.goiY} ${s.truongRong}`} style={{ margin: 0 }}>Gắn với phiên bản trong cửa hàng: khoảng căng nhà sản xuất sẽ được chụp vào hộ chiếu.</p>}
                <div className={s.formCuoi}><button className={`${s.nut} ${s.nutChinh}`}>Thêm vào tủ</button></div>
              </form>
            </section>
          )}

          {denHan.length > 0 && (
            <section className={`${s.khoi} ${s.canCang}`} aria-labelledby="can-cang">
              <h2 id="can-cang" className={s.khoiTieuDe}><span><i className="fa-solid fa-bell" aria-hidden="true" /> Đến lịch căng lại</span></h2>
              <ul className={s.canDs}>
                {denHan.map((v) => {
                  const n = nhacCua(v);
                  return (
                    <li key={v._id} className={s.canMuc}>
                      <AnhVot v={v} sizes="52px" />
                      <div>
                        <p className={s.canTen}>{v.ten}</p>
                        <p className={s.canPhu}>{n.loai === "den-han" && (n.quaNgay === 0 ? "Đến lịch hôm nay" : `Quá lịch nhắc ${n.quaNgay} ngày`)}{v.lanCangGanNhat ? ` · căng lần cuối ${fmt(v.lanCangGanNhat.ngay)}` : ""}</p>
                      </div>
                      <div className={s.canNut}>
                        <button type="button" className={`${s.nut} ${s.nutChinh} ${s.nutNho}`} onClick={() => moPhan(v._id, "lich", true)}>Đặt lịch tại shop</button>
                        <button type="button" className={`${s.nut} ${s.nutVien} ${s.nutNho}`} onClick={() => moPhan(v._id, "ghi", true)}>Đã căng ở ngoài</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {ds === null ? <div className={s.khoi} aria-busy="true"><p className={s.dongTrong}>Đang tải tủ vợt…</p></div> : ds.length === 0 ? (
            <div className={`${s.khoi} ${s.trong}`}>
              <i className="fa-solid fa-table-tennis-paddle-ball" aria-hidden="true" />
              <p>Tủ vợt đang trống. Vợt mua tại shop sẽ tự vào đây khi đơn hoàn thành; vợt mua nơi khác bạn thêm bằng tay.</p>
              <div className={s.hanhDong}>
                <button type="button" className={`${s.nut} ${s.nutChinh}`} onClick={() => setMoThem(true)}><i className="fa-solid fa-plus" aria-hidden="true" />Thêm vợt</button>
                <Link href="/SanPham/Index?loai=Vot" className={`${s.nut} ${s.nutVien}`}>Xem vợt tại shop</Link>
              </div>
            </div>
          ) : (
            <ul className={s.ds} aria-label={`Vợt trong tủ (${ds.length})`}>
              {dsXep.map((v) => {
                const nhac = nhacCua(v);
                const lan = v.lanCangGanNhat;
                const dangMo = mo?.id === v._id ? mo.loai : null;
                return (
                  <li key={v._id} id={`vot-${v._id}`} className={`${s.the} ${nhac.loai === "den-han" ? s.theDen : ""}`}>
                    <AnhVot v={v} sizes="(max-width: 639px) 72px, 116px" />
                    <div className={s.theThan}>
                      <div className={s.theDau}>
                        <div>
                          <h3 className={s.theTen}>{v.sanPham ? <Link href={`/Home/ChiTietSanPham/${v.sanPham}`}>{v.ten}</Link> : v.ten}</h3>
                          <div className={s.nhanDs}>
                            <span className={`${s.nhan} ${v.nguon === "mua-tai-shop" ? s.nhanShop : ""}`}>{v.nguon === "mua-tai-shop" && <i className="fa-solid fa-store" aria-hidden="true" />}{NHAN_NGUON[v.nguon]}</span>
                            {v.ngayMua && <span className={s.nhan}>Mua {fmt(v.ngayMua)}</span>}
                            {v.soSerial && <span className={s.nhan}>Serial {v.soSerial}</span>}
                          </div>
                        </div>
                        <button type="button" className={`${s.nut} ${s.nutBieuTuong}`} aria-label={`Xoá ${v.ten} khỏi tủ`} title="Xoá khỏi tủ" onClick={() => xoa(v)}><i className="fa-regular fa-trash-can" aria-hidden="true" /></button>
                      </div>

                      {lan && <dl className={s.so}>
                        <div>
                          <dt>Lần căng gần nhất</dt>
                          <dd>
                            <span className={`${s.soLon} ${fontTieuDe.className}`}>{lan.giaTriNhap}<small>{lan.donViNhap}</small></span>
                            <span className={s.soPhu}>{fmt(lan.ngay)}{lan.tenDay ? ` · ${lan.tenDay}` : ""}</span>
                          </dd>
                        </div>
                        <div>
                          <dt>Đã căng</dt>
                          <dd><span className={`${s.soLon} ${fontTieuDe.className}`}>{v.soLanCang}<small>lần</small></span><span className={s.soPhu}>{lan.noiCang === "shop" ? "Lần cuối tại shop" : "Lần cuối ở ngoài"}</span></dd>
                        </div>
                      </dl>}

                      <KhoangCang v={v} />
                      <NhacCang v={v} nhac={nhac} onDoiChuKy={(n) => doiChuKy(v, n)} />

                      <div className={s.hanhDong}>
                        <button type="button" className={`${s.nut} ${s.nutChinh}`} aria-expanded={dangMo === "ghi"} onClick={() => moPhan(v._id, "ghi")}><i className="fa-solid fa-pen" aria-hidden="true" />Ghi lần căng</button>
                        <button type="button" className={`${s.nut} ${s.nutVien}`} aria-expanded={dangMo === "lich"} onClick={() => moPhan(v._id, "lich")}><i className="fa-regular fa-calendar" aria-hidden="true" />Đặt lịch tại shop</button>
                        <button type="button" className={`${s.nut} ${s.nutChu}`} aria-expanded={dangMo === "so"} onClick={() => xemSoCang(v)}>
                          <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />Sổ căng <span className={`${s.dem} ${fontTieuDe.className}`}>{v.soLanCang}</span>
                          <i className={`fa-solid ${dangMo === "so" ? "fa-chevron-up" : "fa-chevron-down"}`} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {dangMo === "ghi" && <div className={s.mo}><h4 className={s.moTieuDe}>Ghi lần căng</h4>
                      <FormLanCang vot={v} onDong={() => setMo(null)} onXong={async (tb) => { flash("success", tb); setMo(null); await tai(); }} /></div>}
                    {dangMo === "lich" && <div className={s.mo}><h4 className={s.moTieuDe}>Đặt lịch căng tại shop</h4>
                      <DatLichCang votId={v._id} toiDaLbs={v.thongSoChup?.sucCangMaxLbs} khung={khung} onDong={() => setMo(null)} onXong={async () => { setMo(null); await tai(); }} /></div>}
                    {dangMo === "so" && soCang?.id === v._id && <div className={s.mo}><h4 className={s.moTieuDe}>Sổ căng</h4><SoCang ds={soCang.ds} /></div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      {coTransaction !== null && <p className={s.chan}>Lưu trong tài khoản (MongoDB, {coTransaction ? "ghi sổ căng bằng transaction" : "ghi sổ căng bằng thao tác nguyên tử + bù trừ"}).</p>}
    </div>
  );
}
