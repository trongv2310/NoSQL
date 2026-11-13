"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Page } from "@/components/Ui";
import s from "@/components/product/bento.module.css";
import { api } from "@/lib/api";
import { TOI_DA_CHU_KY_NGAY, TOI_DA_VOT, homNayDiaPhuong, kiemTraVot, loiNhac, taoIdVot, tinhNhac, type DauVaoVot, type DonViCangNhap, type VotTrongTu } from "@/lib/tu-vot";
import { nhanBienThe } from "@/lib/so-sanh-du-lieu";
import type { BienTheV, SanPhamV, Trang } from "@/lib/types";
import { baoTuVotDoi, docTu, ghiTu, noiDungLoiLuu, xoaHanTu, type TrangThaiTu } from "./tu-vot-store";

interface Form { ten: string; ngayCang: string; cang: string; donVi: DonViCangNhap; chuKy: string; ghiChu: string; sanPhamId: string | null; bienTheId: string | null }
const FORM_TRONG: Form = { ten: "", ngayCang: "", cang: "", donVi: "kg", chuKy: "", ghiChu: "", sanPhamId: null, bienTheId: null };
const ID24 = /^[0-9a-f]{24}$/;
const CHU_KY_NHANH = [14, 30, 45, 60];

const fmtNgay = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Tủ vợt của tôi + nhắc lịch trong app. Dữ liệu chỉ nằm trong trình duyệt này (localStorage): không đồng bộ tài khoản, không email/tin nhắn/thông báo ngoài app.
 * Ngày căng, số kg và chu kỳ nhắc do người dùng tự nhập; app chỉ đếm số ngày lịch đã trôi qua so với chu kỳ đã chọn, không ước lượng độ căng còn lại,
 * không khuyên phải thay cước. Lưu thất bại (đầy bộ nhớ, bị chặn, JSON hỏng) được báo thật và không làm mất dữ liệu đang có.
 */
export function TuVot() {
  const sp = useSearchParams();
  const [trangThai, setTrangThai] = useState<TrangThaiTu>("dang-nap");
  const [ds, setDs] = useState<VotTrongTu[]>([]);
  const [phanHong, setPhanHong] = useState<unknown[]>([]);
  const [form, setForm] = useState<Form>(FORM_TRONG);
  const [suaId, setSuaId] = useState<string | null>(null);
  const [loi, setLoi] = useState<Partial<Record<string, string>>>({});
  const [loiLuu, setLoiLuu] = useState<string | null>(null);
  const [xacNhanXoa, setXacNhanXoa] = useState<string | null>(null);
  const [thongBao, setThongBao] = useState<string | null>(null);
  const [dsVot, setDsVot] = useState<{ id: string; ten: string }[]>([]);
  const [homNay, setHomNay] = useState("");

  useEffect(() => {
    const r = docTu();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrangThai(r.trangThai); setDs(r.ds); setPhanHong(r.phanHong); setHomNay(homNayDiaPhuong());
  }, []);

  // Điền sẵn từ trang chi tiết: /tu-vot?them=<id sản phẩm>&bien=<id phiên bản>
  const them = sp.get("them"), bien = sp.get("bien");
  useEffect(() => {
    if (!them || !ID24.test(them)) return;
    let huy = false;
    api<{ sanPham: SanPhamV; bienThes: BienTheV[] }>(`/san-pham/${them}`).then((ct) => {
      if (huy) return;
      const b = bien && ID24.test(bien) ? ct.bienThes.find((x) => x.id === bien) ?? null : null;
      setForm((f) => ({ ...f, ten: ct.sanPham.tenSanPham + (b ? ` (${nhanBienThe(b)})` : ""), sanPhamId: ct.sanPham.id, bienTheId: b?.id ?? null }));
    }).catch(() => { if (!huy) setThongBao("Không điền sẵn được tên vợt từ trang sản phẩm; bạn có thể nhập tên tay."); });
    return () => { huy = true; };
  }, [them, bien]);

  // Danh sách vợt của cửa hàng để gợi ý tên (không bắt buộc).
  useEffect(() => {
    let huy = false;
    (async () => {
      try {
        const tat: { id: string; ten: string }[] = [];
        for (let p = 1; p <= 6; p++) { const r = await api<Trang<SanPhamV>>(`/san-pham?loai=Vot&page=${p}`); tat.push(...r.items.map((x) => ({ id: x.id, ten: x.tenSanPham }))); if (p >= r.pages) break; }
        if (!huy) setDsVot(tat);
      } catch { /* gợi ý không bắt buộc */ }
    })();
    return () => { huy = true; };
  }, []);

  const denHan = useMemo(() => ds.filter((v) => tinhNhac(v, homNay || undefined).loai === "den-han"), [ds, homNay]);
  const khongLuuDuoc = trangThai === "khong-dung-duoc";

  const batDauSua = (v: VotTrongTu) => {
    setSuaId(v.id);
    setForm({ ten: v.ten, ngayCang: v.ngayCang ?? "", cang: v.cang ? String(v.cang.giaTri) : "", donVi: v.cang?.donVi ?? "kg", chuKy: v.chuKyNgay ? String(v.chuKyNgay) : "", ghiChu: v.ghiChu, sanPhamId: v.sanPhamId, bienTheId: v.bienTheId });
    setLoi({}); setLoiLuu(null); setThongBao(null);
    document.getElementById("form-tu-vot")?.scrollIntoView({ block: "center" });
  };
  const huySua = () => { setSuaId(null); setForm(FORM_TRONG); setLoi({}); setLoiLuu(null); };

  const gui = (e: React.FormEvent) => {
    e.preventDefault();
    setThongBao(null);
    const khop = dsVot.find((v) => v.ten.toLowerCase() === form.ten.trim().toLowerCase());
    const vao: DauVaoVot = { nguon: form.sanPhamId || khop ? "catalog" : "tu-nhap", sanPhamId: form.sanPhamId ?? khop?.id ?? null, bienTheId: form.bienTheId, ten: form.ten, ngayCang: form.ngayCang, cangGiaTri: form.cang, cangDonVi: form.donVi, chuKyNgay: form.chuKy, ghiChu: form.ghiChu };
    const kt = kiemTraVot(vao, homNayDiaPhuong());
    if (!kt.ok) { setLoi(kt.loi); return; }
    if (!suaId && ds.length >= TOI_DA_VOT) { setLoi({ chung: `Tủ vợt chứa tối đa ${TOI_DA_VOT} cây.` }); return; }
    const moi: VotTrongTu = suaId ? { ...(ds.find((x) => x.id === suaId) as VotTrongTu), ...kt.vot } : { ...kt.vot, id: taoIdVot(), taoLuc: Date.now() };
    const dsMoi = suaId ? ds.map((x) => (x.id === suaId ? moi : x)) : [moi, ...ds];
    const kq = ghiTu(dsMoi, phanHong);
    if (!kq.ok) { setLoiLuu(noiDungLoiLuu(kq)); return; } // không đổi giao diện: chưa lưu thì không báo đã lưu
    setDs(dsMoi); setTrangThai("ok"); setLoi({}); setLoiLuu(null); setSuaId(null); setForm(FORM_TRONG);
    setThongBao(suaId ? "Đã cập nhật vợt trong tủ (lưu trên trình duyệt này)." : "Đã thêm vợt vào tủ (lưu trên trình duyệt này).");
    baoTuVotDoi();
  };
  const xoa = (id: string) => {
    const dsMoi = ds.filter((x) => x.id !== id);
    const kq = ghiTu(dsMoi, phanHong);
    if (!kq.ok) { setLoiLuu(noiDungLoiLuu(kq)); return; }
    setDs(dsMoi); setXacNhanXoa(null); setTrangThai(dsMoi.length ? "ok" : "rong"); setThongBao("Đã xóa vợt khỏi tủ.");
    if (suaId === id) huySua();
    baoTuVotDoi();
  };
  /** Chủ động bỏ các mục không đọc được (chỉ khi người dùng bấm); các vợt hợp lệ được ghi lại nguyên. */
  const boMucHong = () => {
    const kq = ghiTu(ds);
    if (!kq.ok) { setLoiLuu(noiDungLoiLuu(kq)); return; }
    setPhanHong([]); setLoiLuu(null); setThongBao("Đã bỏ các mục không đọc được. Các vợt hợp lệ vẫn nguyên.");
    baoTuVotDoi();
  };
  const batDauLai = () => {
    const kq = xoaHanTu();
    if (!kq.ok) { setLoiLuu(noiDungLoiLuu(kq)); return; }
    setDs([]); setPhanHong([]); setTrangThai("rong"); setLoiLuu(null); setThongBao("Đã xóa dữ liệu tủ vợt bị hỏng. Bạn có thể bắt đầu lại.");
    baoTuVotDoi();
  };

  const dat = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Page>
      <nav className="mb-3 small text-muted"><Link href="/">Trang chủ</Link> / Tủ vợt của tôi</nav>
      <h1 className="h3">Tủ vợt của tôi</h1>
      <p className={s.ghiChu}>Ghi lại cây vợt bạn đang dùng, ngày căng thực tế, số kg căng thực tế và chu kỳ nhắc bạn tự chọn. <strong>Dữ liệu chỉ lưu trong trình duyệt này</strong> (không gắn với tài khoản, không đồng bộ giữa thiết bị, mất khi xóa dữ liệu trình duyệt). Shop chỉ nhắc ngay trong trang này, không gửi email, tin nhắn hay thông báo ngoài app.</p>

      {khongLuuDuoc && <p className={`${s.thongBao} ${s.thongBaoLoi}`} role="alert">Trình duyệt này không cho lưu dữ liệu (chế độ riêng tư hoặc đã chặn lưu trữ), nên tủ vợt không lưu được. Bạn vẫn xem được trang nhưng sẽ không thêm được vợt.</p>}
      {trangThai === "hong" && (
        <div className={`${s.thongBao} ${s.thongBaoCanh}`} role="alert">
          Dữ liệu tủ vợt đã lưu trên trình duyệt bị hỏng nên chưa đọc được. Shop không tự ghi đè để tránh mất dữ liệu.{" "}
          <button type="button" className={s.nut} onClick={batDauLai}>Xóa dữ liệu hỏng và bắt đầu lại</button>
        </div>
      )}
      {phanHong.length > 0 && trangThai !== "hong" && (
        <div className={`${s.thongBao} ${s.thongBaoCanh}`} role="alert" id="tv-muc-hong">
          Có {phanHong.length} mục trong tủ vợt không đọc được (dữ liệu lưu sai định dạng hoặc không hợp lệ) nên không hiển thị. Các vợt hợp lệ vẫn nguyên và các mục lỗi vẫn được giữ trong trình duyệt, không bị tự xóa.{" "}
          <button type="button" className={s.nut} onClick={boMucHong}>Bỏ các mục không đọc được</button>
        </div>
      )}
      {denHan.length > 0 && (
        <div className={`${s.thongBao} ${s.thongBaoCanh}`} role="status" aria-label="Nhắc lịch">
          <strong>Đến lịch nhắc ({denHan.length}):</strong> {denHan.map((v) => v.ten).join(", ")}. Lịch nhắc dựa trên số ngày bạn đã đặt, không phải đo độ căng.
        </div>
      )}
      {thongBao && <p className={s.thongBao} role="status">{thongBao}</p>}

      <form id="form-tu-vot" onSubmit={gui} noValidate className={s.the} style={{ marginTop: 12 }} aria-label={suaId ? "Sửa vợt" : "Thêm vợt vào tủ"}>
        <h2 className="h5" style={{ margin: 0 }}>{suaId ? "Sửa vợt" : "Thêm vợt vào tủ"}</h2>
        <div className={s.luoiForm}>
          <label className={s.truong} htmlFor="tv-ten">Tên vợt
            <input id="tv-ten" className={s.nhap} list="tv-goi-y" value={form.ten} maxLength={80} autoComplete="off" onChange={(e) => setForm((f) => ({ ...f, ten: e.target.value, sanPhamId: null, bienTheId: null }))} aria-invalid={loi.ten ? true : undefined} aria-describedby={loi.ten ? "tv-ten-loi" : undefined} placeholder="Chọn vợt của shop hoặc tự nhập tên" />
            <datalist id="tv-goi-y">{dsVot.map((v) => <option key={v.id} value={v.ten} />)}</datalist>
            {loi.ten && <span id="tv-ten-loi" className={s.loi} role="alert">{loi.ten}</span>}
          </label>
          <label className={s.truong} htmlFor="tv-ngay">Ngày căng thực tế
            <input id="tv-ngay" className={s.nhap} type="date" value={form.ngayCang} max={homNay || undefined} onChange={(e) => dat("ngayCang", e.target.value)} aria-invalid={loi.ngayCang ? true : undefined} aria-describedby={loi.ngayCang ? "tv-ngay-loi" : undefined} />
            {loi.ngayCang && <span id="tv-ngay-loi" className={s.loi} role="alert">{loi.ngayCang}</span>}
          </label>
          <div className={s.truong}>
            <label htmlFor="tv-cang">Số căng thực tế</label>
            <div className={s.hang}>
              <input id="tv-cang" className={`${s.nhap} ${s.nhapNho}`} inputMode="decimal" value={form.cang} onChange={(e) => dat("cang", e.target.value)} placeholder="ví dụ 11" aria-invalid={loi.cang ? true : undefined} aria-describedby={loi.cang ? "tv-cang-loi" : undefined} />
              <select className={`${s.nhap} ${s.nhapNho}`} aria-label="Đơn vị" value={form.donVi} onChange={(e) => dat("donVi", e.target.value)}><option value="kg">kg</option><option value="lbs">lbs</option></select>
            </div>
            {loi.cang && <span id="tv-cang-loi" className={s.loi} role="alert">{loi.cang}</span>}
          </div>
          <div className={s.truong}>
            <label htmlFor="tv-ck">Nhắc sau (ngày)</label>
            <input id="tv-ck" className={`${s.nhap} ${s.nhapNho}`} inputMode="numeric" value={form.chuKy} onChange={(e) => dat("chuKy", e.target.value)} placeholder={`1–${TOI_DA_CHU_KY_NGAY}, để trống = không nhắc`} aria-invalid={loi.chuKy ? true : undefined} aria-describedby={loi.chuKy ? "tv-ck-loi" : undefined} />
            <div className={s.hang} role="group" aria-label="Chọn nhanh chu kỳ nhắc">
              {CHU_KY_NHANH.map((n) => <button key={n} type="button" className={s.chip} aria-pressed={form.chuKy === String(n)} onClick={() => dat("chuKy", form.chuKy === String(n) ? "" : String(n))}>{n} ngày</button>)}
            </div>
            {loi.chuKy && <span id="tv-ck-loi" className={s.loi} role="alert">{loi.chuKy}</span>}
          </div>
          <label className={s.truong} htmlFor="tv-ghi">Ghi chú (tùy chọn)
            <input id="tv-ghi" className={s.nhap} value={form.ghiChu} maxLength={200} onChange={(e) => dat("ghiChu", e.target.value)} />
          </label>
        </div>
        {loi.chung && <p className={s.loi} role="alert">{loi.chung}</p>}
        {loiLuu && <p className={s.loi} role="alert">{loiLuu} Dữ liệu đang có không bị thay đổi.</p>}
        <div className={s.hang}>
          <button type="submit" className={`${s.nut} ${s.nutChinh}`} disabled={khongLuuDuoc || trangThai === "hong" || trangThai === "dang-nap"}>{suaId ? "Lưu thay đổi" : "Thêm vào tủ"}</button>
          {suaId && <button type="button" className={s.nut} onClick={huySua}>Hủy sửa</button>}
        </div>
      </form>

      <h2 className="h5" style={{ marginTop: 18 }}>Vợt trong tủ ({ds.length})</h2>
      {trangThai === "dang-nap" ? <p>Đang đọc tủ vợt…</p> : ds.length === 0 ? (
        <p className={s.thongBao}>Tủ vợt đang trống. Thêm cây vợt bạn đang dùng ở trên, hoặc bấm “Thêm vào tủ vợt” ở trang chi tiết vợt.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {ds.map((v) => {
            const nhac = tinhNhac(v, homNay || undefined);
            return (
              <li key={v.id} className={`${s.the} ${nhac.loai === "den-han" ? s.theDen : ""}`}>
                <div className={s.hang} style={{ justifyContent: "space-between" }}>
                  <strong>{v.sanPhamId ? <Link href={`/Home/ChiTietSanPham/${v.sanPhamId}`}>{v.ten}</Link> : v.ten}</strong>
                  <span className="small text-muted">{v.nguon === "catalog" ? "Vợt của shop" : "Tự nhập"}</span>
                </div>
                <p className={s.ghiChu} style={{ margin: 0 }}>
                  {v.ngayCang ? <>Ngày căng bạn ghi: <b>{fmtNgay(v.ngayCang)}</b></> : "Chưa ghi ngày căng"}
                  {v.cang ? <> · Số căng bạn ghi: <b>{v.cang.giaTri} {v.cang.donVi}</b></> : null}
                  {v.chuKyNgay ? <> · Nhắc sau {v.chuKyNgay} ngày</> : null}
                </p>
                <p className={`${s.thongBao} ${nhac.loai === "den-han" ? s.thongBaoCanh : ""}`} role="status">{loiNhac(nhac)}</p>
                {v.ghiChu && <p className={s.ghiChu} style={{ margin: 0 }}>{v.ghiChu}</p>}
                <div className={s.hang}>
                  <button type="button" className={s.nut} onClick={() => batDauSua(v)} aria-label={`Sửa ${v.ten}`}>Sửa</button>
                  {xacNhanXoa === v.id ? (
                    <>
                      <button type="button" className={`${s.nut} ${s.nutChinh}`} onClick={() => xoa(v.id)}>Xác nhận xóa</button>
                      <button type="button" className={s.nut} onClick={() => setXacNhanXoa(null)}>Giữ lại</button>
                    </>
                  ) : <button type="button" className={s.nut} onClick={() => setXacNhanXoa(v.id)} aria-label={`Xóa ${v.ten}`}>Xóa</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className={s.ghiChu} style={{ marginTop: 14 }}>Phạm vi lưu: localStorage của trình duyệt này. Ngày được tính theo lịch trên thiết bị của bạn.</p>
    </Page>
  );
}
