"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProviders";
import { Field } from "@/components/admin/Common";
import { ErrorBox, Loading } from "@/components/Ui";
import { api, apiDelete, loiTuApi } from "@/lib/api";
import { imgUrl, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { BienTheV, SanPhamV } from "@/lib/types";

interface Data {
  sanPham: SanPhamV; bienThes: BienTheV[];
  mauSacs: { id: string; tenMau: string }[]; sizes: { id: string; tenSize: string; loaiSize: string }[];
}

export default function ChiTietSanPhamAdminPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Data>(`/admin/san-pham/${id}`);
  const { flash } = useApp();
  const [f, setF] = useState({ mau: "", size: "", giaBan: "", soLuongTon: "0", sku: "" });
  const [file, setFile] = useState<File | null>(null);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Không tìm thấy"} />;
  const { sanPham: sp } = data;

  const them = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    setLoi(null);
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append("HinhAnhUpload", file);
    try {
      const r = await api<{ message: string }>(`/admin/san-pham/${id}/bien-the`, { method: "POST", body: fd });
      flash("success", r.message);
      setF({ mau: "", size: "", giaBan: "", soLuongTon: "0", sku: "" });
      setFile(null);
      await reload();
    } catch (err) {
      setLoi(loiTuApi(err));
    } finally {
      setDang(false);
    }
  };

  const xoa = async (b: BienTheV) => {
    if (!confirm(`Xóa biến thể SKU "${b.sku}"?`)) return;
    try {
      const r = await apiDelete<{ message: string }>(`/admin/bien-the/${b.id}`);
      flash("success", r.message);
      await reload();
    } catch (err) {
      flash("danger", loiTuApi(err));
    }
  };

  return (
    <>
      <Link href="/admin/san-pham" className="small">← Danh sách sản phẩm</Link>
      <div className="card-custom p-3 my-3 d-flex gap-3 align-items-center flex-wrap">
        { }
        <img src={imgUrl(sp.hinhAnhDaiDien)} alt="" width={96} height={96} style={{ objectFit: "contain" }} />
        <div className="flex-grow-1">
          <h5 className="mb-1">{sp.tenSanPham}</h5>
          <div className="text-muted small">{sp.loai?.tenLoai} · {sp.hang?.tenHang} · NCC: {sp.nhaCungCap?.tenNhaCungCap}</div>
          <div>Giá gốc: <strong>{vnd(sp.giaGoc)}</strong>{sp.khuyenMai && <> · KM: {sp.khuyenMai.tenChuongTrinh} (-{sp.khuyenMai.phanTramGiam}%) → <strong className="text-danger">{vnd(sp.giaSauKhuyenMai)}</strong></>}</div>
        </div>
        <Link href={`/admin/san-pham/${id}/edit`} className="btn btn-outline-primary"><i className="fa-solid fa-pen" /> Sửa sản phẩm</Link>
      </div>

      <h6>Biến thể ({data.bienThes.length})</h6>
      <div className="table-responsive card-custom mb-4"><table className="table align-middle mb-0">
        <thead><tr><th>Ảnh</th><th>SKU</th><th>Màu</th><th>Size</th><th className="text-end">Giá bán</th><th className="text-end">Tồn</th><th /></tr></thead>
        <tbody>
          {data.bienThes.length === 0 && <tr><td colSpan={7} className="text-center text-muted">Chưa có biến thể. Hãy thêm biến thể để khách có thể đặt mua.</td></tr>}
          {data.bienThes.map((b) => (
            <tr key={b.id}>
              <td>{ }<img src={imgUrl(b.hinhAnh)} alt="" width={40} height={40} style={{ objectFit: "contain" }} /></td>
              <td>{b.sku}</td><td>{b.mau?.tenMau ?? "—"}</td><td>{b.size?.tenSize ?? "—"}</td>
              <td className="text-end">{vnd(b.giaBan ?? sp.giaGoc)}</td>
              <td className="text-end">{b.soLuongTon === 0 ? <span className="badge bg-danger">0</span> : b.soLuongTon}</td>
              <td className="text-end text-nowrap">
                <Link href={`/admin/bien-the/${b.id}/edit`} className="btn btn-sm btn-outline-primary me-1"><i className="fa-solid fa-pen" /></Link>
                <button className="btn btn-sm btn-outline-danger" onClick={() => xoa(b)}><i className="fa-solid fa-trash" /></button>
              </td>
            </tr>))}
        </tbody>
      </table></div>

      <form className="card-custom p-3" onSubmit={them}>
        <h6>Thêm biến thể</h6>
        {loi && <ErrorBox message={loi} />}
        <div className="row g-2">
          <div className="col-md-3"><Field label="Màu"><select className="form-select" value={f.mau} onChange={(e) => setF({ ...f, mau: e.target.value })}><option value="">—</option>{data.mauSacs.map((m) => <option key={m.id} value={m.id}>{m.tenMau}</option>)}</select></Field></div>
          <div className="col-md-3"><Field label="Size"><select className="form-select" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })}><option value="">—</option>{data.sizes.map((s) => <option key={s.id} value={s.id}>{s.tenSize} ({s.loaiSize})</option>)}</select></Field></div>
          <div className="col-md-2"><Field label="Giá bán *"><input type="number" min={0} className="form-control" required value={f.giaBan} onChange={(e) => setF({ ...f, giaBan: e.target.value })} /></Field></div>
          <div className="col-md-2"><Field label="Tồn kho *"><input type="number" min={0} className="form-control" required value={f.soLuongTon} onChange={(e) => setF({ ...f, soLuongTon: e.target.value })} /></Field></div>
          <div className="col-md-2"><Field label="SKU *"><input className="form-control" required maxLength={50} value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></Field></div>
          <div className="col-md-6"><Field label="Ảnh biến thể"><input type="file" accept="image/*" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field></div>
        </div>
        <button className="btn btn-primary" disabled={dang}><i className="fa-solid fa-plus" /> Thêm biến thể</button>
      </form>
    </>
  );
}
