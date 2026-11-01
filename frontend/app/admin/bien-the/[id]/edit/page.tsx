"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { Field, SubmitBar } from "@/components/admin/Common";
import { ErrorBox, Loading } from "@/components/Ui";
import { api, loiTuApi } from "@/lib/api";
import { imgUrl } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { BienTheV } from "@/lib/types";

interface Data {
  bienThe: BienTheV; sanPham: { id: string; tenSanPham: string };
  mauSacs: { id: string; tenMau: string }[]; sizes: { id: string; tenSize: string; loaiSize: string }[];
}

export default function SuaBienThePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { flash } = useApp();
  const { data, error, loading } = useApi<Data>(`/admin/bien-the/${id}`);
  const [f, setF] = useState({ mau: "", size: "", giaBan: "", soLuongTon: "0", sku: "", doCanBang: "", trongLuong: "", doCung: "", chieuDai: "", sucCang: "" });
  const [file, setFile] = useState<File | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);

  useEffect(() => {
    if (data) {
      const b = data.bienThe;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setF({ mau: b.mau?.id ?? "", size: b.size?.id ?? "", giaBan: String(b.giaBan ?? ""), soLuongTon: String(b.soLuongTon), sku: b.sku,
        doCanBang: b.thongSo?.doCanBang ?? "", trongLuong: b.thongSo?.trongLuong ?? "", doCung: b.thongSo?.doCung ?? "", chieuDai: b.thongSo?.chieuDai ?? "", sucCang: b.thongSo?.sucCang ?? "" });
    }
  }, [data]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Không tìm thấy"} />;

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append("HinhAnhUpload", file);
    try {
      const r = await api<{ sanPhamId: string; message: string }>(`/admin/bien-the/${id}`, { method: "PUT", body: fd });
      flash("success", r.message);
      router.push(`/admin/san-pham/${r.sanPhamId}`);
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };
  const dat = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <Link href={`/admin/san-pham/${data.sanPham.id}`} className="small">← {data.sanPham.tenSanPham}</Link>
      <form className="card-custom p-4 mt-3" style={{ maxWidth: 860 }} onSubmit={gui}>
        <h5>Sửa biến thể</h5>
        {loi && <ErrorBox message={loi} />}
        <div className="row">
          <div className="col-md-6"><Field label="Màu"><select className="form-select" value={f.mau} onChange={dat("mau")}><option value="">—</option>{data.mauSacs.map((m) => <option key={m.id} value={m.id}>{m.tenMau}</option>)}</select></Field></div>
          <div className="col-md-6"><Field label="Size"><select className="form-select" value={f.size} onChange={dat("size")}><option value="">—</option>{data.sizes.map((s) => <option key={s.id} value={s.id}>{s.tenSize} ({s.loaiSize})</option>)}</select></Field></div>
          <div className="col-md-4"><Field label="Giá bán *"><input type="number" min={0} className="form-control" required value={f.giaBan} onChange={dat("giaBan")} /></Field></div>
          <div className="col-md-4"><Field label="Tồn kho *"><input type="number" min={0} className="form-control" required value={f.soLuongTon} onChange={dat("soLuongTon")} /></Field></div>
          <div className="col-md-4"><Field label="SKU *"><input className="form-control" required maxLength={50} value={f.sku} onChange={dat("sku")} /></Field></div>
        </div>
        <h6 className="mt-2">Thông số vợt (nếu có)</h6>
        <div className="row">
          {([["doCanBang", "Điểm cân bằng"], ["trongLuong", "Trọng lượng"], ["doCung", "Độ cứng"], ["chieuDai", "Chiều dài"], ["sucCang", "Sức căng"]] as const).map(([k, nhan]) => (
            <div className="col-md-4" key={k}><Field label={nhan}><input className="form-control" value={f[k]} onChange={dat(k)} /></Field></div>
          ))}
        </div>
        <Field label="Ảnh biến thể">
          {!file && (  <img src={imgUrl(data.bienThe.hinhAnh)} alt="" height={70} className="d-block mb-2" />)}
          <input type="file" accept="image/*" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <SubmitBar dang={dang} cancel={`/admin/san-pham/${data.sanPham.id}`} text="Cập nhật" />
      </form>
    </>
  );
}
