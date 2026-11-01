"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "../AppProviders";
import { ErrorBox, Loading } from "../Ui";
import { Field, SubmitBar } from "./Common";
import { api, loiTuApi } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { imgUrl } from "@/lib/format";

interface FormData_ {
  loaiSanPhams: { id: string; tenLoai: string }[]; nhaCungCaps: { id: string; tenNhaCungCap: string }[];
  hangs: { id: string; tenHang: string }[]; khuyenMais: { id: string; tenChuongTrinh: string; phanTramGiam: number }[];
}
interface SuaData extends FormData_ {
  sanPham: { id: string; tenSanPham: string; moTa: string; giaGoc: number; loai: string; hang: string; nhaCungCap: string; khuyenMai: string | null; coSize: boolean; coMau: boolean; hinhAnhDaiDien: string };
}

/** Form thêm/sửa sản phẩm; truyền id để sửa. Gửi multipart vì có ảnh đại diện. */
export function ProductForm({ id }: { id?: string }) {
  const router = useRouter();
  const { flash } = useApp();
  const tuyChon = useApi<FormData_>(id ? null : "/admin/form-san-pham");
  const sua = useApi<SuaData>(id ? `/admin/san-pham/${id}/sua` : null);
  const ds = (id ? sua.data : tuyChon.data) as FormData_ | null;
  const [f, setF] = useState({ tenSanPham: "", moTa: "", giaGoc: "", loai: "", hang: "", nhaCungCap: "", khuyenMai: "", coSize: false, coMau: false });
  const [file, setFile] = useState<File | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);

  useEffect(() => {
    if (sua.data) {
      const s = sua.data.sanPham;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setF({ tenSanPham: s.tenSanPham, moTa: s.moTa, giaGoc: String(s.giaGoc), loai: s.loai, hang: s.hang, nhaCungCap: s.nhaCungCap, khuyenMai: s.khuyenMai ?? "", coSize: s.coSize, coMau: s.coMau });
    }
  }, [sua.data]);

  if ((id ? sua.loading : tuyChon.loading) || !ds) return (id ? sua.error : tuyChon.error) ? <ErrorBox message={(id ? sua.error : tuyChon.error)!} /> : <Loading />;

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    setLoi(null);
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, typeof v === "boolean" ? String(v) : v));
    if (file) fd.append("HinhAnhUpload", file);
    try {
      const r = await api<{ id?: string; message: string }>(id ? `/admin/san-pham/${id}` : "/admin/san-pham", { method: id ? "PUT" : "POST", body: fd });
      flash("success", r.message);
      router.push(id ? "/admin/san-pham" : `/admin/san-pham/${r.id}`);
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };
  const dat = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form className="card-custom p-4" onSubmit={gui} style={{ maxWidth: 860 }}>
      {loi && <ErrorBox message={loi} />}
      <Field label="Tên sản phẩm *"><input className="form-control" required maxLength={100} value={f.tenSanPham} onChange={dat("tenSanPham")} /></Field>
      <div className="row">
        <div className="col-md-6"><Field label="Giá gốc (đ) *"><input type="number" min={0} className="form-control" required value={f.giaGoc} onChange={dat("giaGoc")} /></Field></div>
        <div className="col-md-6"><Field label="Khuyến mãi"><select className="form-select" value={f.khuyenMai} onChange={dat("khuyenMai")}><option value="">— Không áp dụng —</option>{ds.khuyenMais.map((k) => <option key={k.id} value={k.id}>{k.tenChuongTrinh} (-{k.phanTramGiam}%)</option>)}</select></Field></div>
        <div className="col-md-4"><Field label="Loại sản phẩm *"><select className="form-select" required value={f.loai} onChange={dat("loai")}><option value="">— Chọn —</option>{ds.loaiSanPhams.map((l) => <option key={l.id} value={l.id}>{l.tenLoai}</option>)}</select></Field></div>
        <div className="col-md-4"><Field label="Hãng *"><select className="form-select" required value={f.hang} onChange={dat("hang")}><option value="">— Chọn —</option>{ds.hangs.map((h) => <option key={h.id} value={h.id}>{h.tenHang}</option>)}</select></Field></div>
        <div className="col-md-4"><Field label="Nhà cung cấp *"><select className="form-select" required value={f.nhaCungCap} onChange={dat("nhaCungCap")}><option value="">— Chọn —</option>{ds.nhaCungCaps.map((n) => <option key={n.id} value={n.id}>{n.tenNhaCungCap}</option>)}</select></Field></div>
      </div>
      <Field label="Mô tả"><textarea className="form-control" rows={5} maxLength={5000} value={f.moTa} onChange={dat("moTa")} /></Field>
      <div className="d-flex gap-4 mb-3">
        <label className="form-check"><input type="checkbox" className="form-check-input" checked={f.coMau} onChange={(e) => setF({ ...f, coMau: e.target.checked })} /> <span className="form-check-label">Có nhiều màu</span></label>
        <label className="form-check"><input type="checkbox" className="form-check-input" checked={f.coSize} onChange={(e) => setF({ ...f, coSize: e.target.checked })} /> <span className="form-check-label">Có nhiều size</span></label>
      </div>
      <Field label="Ảnh đại diện" hint="JPG/PNG/WEBP/GIF, tối đa 5MB.">
        {id && sua.data && !file && (  <img src={imgUrl(sua.data.sanPham.hinhAnhDaiDien)} alt="" height={80} className="d-block mb-2" />)}
        <input type="file" accept="image/*" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <SubmitBar dang={dang} cancel="/admin/san-pham" text={id ? "Cập nhật" : "Thêm sản phẩm"} />
    </form>
  );
}
