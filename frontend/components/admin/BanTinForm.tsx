"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../AppProviders";
import { ErrorBox, Loading } from "../Ui";
import { Field, SubmitBar } from "./Common";
import { api, apiPost, loiTuApi } from "@/lib/api";
import { imgUrl, ngay, ngayInput } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface FormOpts {
  sanPhams: { id: string; tenSanPham: string }[];
  tranDaus: { id: string; tenGiaiDau: string; doiA: string; doiB: string; ngayThiDau: string }[];
  loaiTins: { khoa: string; nhan: string }[];
}
interface TinSua extends FormOpts {
  tieuDe: string; tomTat: string | null; noiDung: string; loaiTin: string; hinhAnhGoc: string; sanPhamId: string | null; tranDauId: string | null;
  nguonTin: string | null; lienKetNguon: string | null; noiBat: boolean; hienThi: boolean; thuTu: number; ngayDang: string;
}

/** Form bài viết. Nội dung là HTML; có nút nhờ AI soạn nháp và nút chèn ảnh vào nội dung. */
export function BanTinForm({ id }: { id?: string }) {
  const router = useRouter();
  const { flash } = useApp();
  const opts = useApi<FormOpts>(id ? null : "/admin/ban-tin/form");
  const sua = useApi<TinSua>(id ? `/admin/ban-tin/${id}` : null);
  const ds = (id ? sua.data : opts.data) as FormOpts | null;
  const [f, setF] = useState({ tieuDe: "", tomTat: "", noiDung: "", loaiTin: "san-pham-hot", hinhAnh: "", sanPham: "", tranDau: "", nguonTin: "", lienKetNguon: "", noiBat: false, hienThi: true, thuTu: "1", ngayDang: "" });
  const [file, setFile] = useState<File | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);
  const [aiDang, setAiDang] = useState(false);
  const noiDungRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (sua.data) {
      const t = sua.data;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setF({ tieuDe: t.tieuDe, tomTat: t.tomTat ?? "", noiDung: t.noiDung, loaiTin: t.loaiTin, hinhAnh: t.hinhAnhGoc, sanPham: t.sanPhamId ?? "", tranDau: t.tranDauId ?? "", nguonTin: t.nguonTin ?? "", lienKetNguon: t.lienKetNguon ?? "", noiBat: t.noiBat, hienThi: t.hienThi, thuTu: String(t.thuTu), ngayDang: ngayInput(t.ngayDang) });
    }
  }, [sua.data]);

  if (!ds) return (id ? sua.error : opts.error) ? <ErrorBox message={(id ? sua.error : opts.error)!} /> : <Loading />;

  const dat = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const aiSoan = async () => {
    setAiDang(true);
    try {
      const r = await apiPost<{ title: string; summary: string; content: string; warning?: string }>("/admin/ban-tin/ai-generate", { topic: f.tieuDe, summary: f.tomTat || undefined });
      setF((x) => ({ ...x, tieuDe: x.tieuDe || r.title, tomTat: x.tomTat || r.summary, noiDung: r.content }));
      flash(r.warning ? "danger" : "success", r.warning ?? "AI đã soạn nháp nội dung, hãy kiểm tra lại trước khi đăng.");
    } catch (e) {
      flash("danger", loiTuApi(e));
    } finally {
      setAiDang(false);
    }
  };

  const chenAnh = async (file: File) => {
    const fd = new FormData();
    fd.append("upload", file);
    try {
      const r = await api<{ url: string }>("/admin/ban-tin/upload-image", { method: "POST", body: fd });
      const ta = noiDungRef.current;
      const tag = `<p><img src="${r.url}" alt="" style="max-width:100%"></p>`;
      const pos = ta?.selectionStart ?? f.noiDung.length;
      setF((x) => ({ ...x, noiDung: x.noiDung.slice(0, pos) + tag + x.noiDung.slice(pos) }));
    } catch (e) {
      flash("danger", loiTuApi(e));
    }
  };

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    setLoi(null);
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, typeof v === "boolean" ? String(v) : v));
    if (file) fd.append("HinhAnh_file", file);
    try {
      const r = await api<{ message: string }>(id ? `/admin/ban-tin/${id}` : "/admin/ban-tin", { method: id ? "PUT" : "POST", body: fd });
      flash("success", r.message);
      router.push("/admin/ban-tin");
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };

  return (
    <form className="card-custom p-4" style={{ maxWidth: 940 }} onSubmit={gui}>
      {loi && <ErrorBox message={loi} />}
      <div className="row">
        <div className="col-md-8"><Field label="Tiêu đề *"><input className="form-control" required maxLength={200} value={f.tieuDe} onChange={dat("tieuDe")} /></Field></div>
        <div className="col-md-4"><Field label="Loại tin *"><select className="form-select" value={f.loaiTin} onChange={dat("loaiTin")}>{ds.loaiTins.map((l) => <option key={l.khoa} value={l.khoa}>{l.nhan}</option>)}</select></Field></div>
      </div>
      <Field label="Tóm tắt"><textarea className="form-control" rows={2} maxLength={500} value={f.tomTat} onChange={dat("tomTat")} /></Field>
      <Field label="Nội dung (HTML) *">
        <div className="d-flex gap-2 mb-2 flex-wrap">
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={aiDang} onClick={aiSoan}><i className="fa-solid fa-wand-magic-sparkles" /> {aiDang ? "AI đang soạn..." : "AI soạn nháp từ tiêu đề"}</button>
          <label className="btn btn-sm btn-outline-secondary mb-0"><i className="fa-solid fa-image" /> Chèn ảnh<input type="file" accept="image/*" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) void chenAnh(x); e.target.value = ""; }} /></label>
        </div>
        <textarea ref={noiDungRef} className="form-control font-monospace" rows={12} required minLength={20} value={f.noiDung} onChange={dat("noiDung")} />
        {f.noiDung.length > 20 && <details className="mt-2"><summary>Xem trước</summary><div className="border rounded p-3 bg-white mt-2" dangerouslySetInnerHTML={{ __html: f.noiDung }} /></details>}
      </Field>
      <div className="row">
        <div className="col-md-6"><Field label="Sản phẩm liên quan"><select className="form-select" value={f.sanPham} onChange={dat("sanPham")}><option value="">—</option>{ds.sanPhams.map((s) => <option key={s.id} value={s.id}>{s.tenSanPham}</option>)}</select></Field></div>
        <div className="col-md-6"><Field label="Trận đấu liên quan"><select className="form-select" value={f.tranDau} onChange={dat("tranDau")}><option value="">—</option>{ds.tranDaus.map((t) => <option key={t.id} value={t.id}>{t.tenGiaiDau}: {t.doiA} vs {t.doiB} ({ngay(t.ngayThiDau)})</option>)}</select></Field></div>
        <div className="col-md-6"><Field label="Nguồn tin"><input className="form-control" maxLength={150} value={f.nguonTin} onChange={dat("nguonTin")} /></Field></div>
        <div className="col-md-6"><Field label="Liên kết nguồn"><input type="url" className="form-control" maxLength={300} value={f.lienKetNguon} onChange={dat("lienKetNguon")} /></Field></div>
        <div className="col-md-6"><Field label="Ảnh bìa (tải lên)">
          {!file && f.hinhAnh && (  <img src={imgUrl(f.hinhAnh)} alt="" height={60} className="d-block mb-2" />)}
          <input type="file" accept="image/*" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field></div>
        <div className="col-md-6"><Field label="…hoặc đường dẫn ảnh"><input className="form-control" maxLength={255} placeholder="images/news/... hoặc https://..." value={f.hinhAnh} onChange={dat("hinhAnh")} /></Field></div>
        <div className="col-md-4"><Field label="Thứ tự (nhỏ hiện trước)"><input type="number" min={0} className="form-control" value={f.thuTu} onChange={dat("thuTu")} /></Field></div>
        <div className="col-md-4"><Field label="Ngày đăng"><input type="date" className="form-control" value={f.ngayDang} onChange={dat("ngayDang")} /></Field></div>
        <div className="col-md-4 d-flex flex-column justify-content-center gap-1">
          <label className="form-check"><input type="checkbox" className="form-check-input" checked={f.noiBat} onChange={(e) => setF({ ...f, noiBat: e.target.checked })} /> <span className="form-check-label">Nổi bật</span></label>
          <label className="form-check"><input type="checkbox" className="form-check-input" checked={f.hienThi} onChange={(e) => setF({ ...f, hienThi: e.target.checked })} /> <span className="form-check-label">Hiển thị</span></label>
        </div>
      </div>
      <SubmitBar dang={dang} cancel="/admin/ban-tin" text={id ? "Cập nhật" : "Đăng bài"} />
    </form>
  );
}
