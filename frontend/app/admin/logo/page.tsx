"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProviders";
import { Field } from "@/components/admin/Common";
import { ErrorBox, Loading } from "@/components/Ui";
import { api, loiTuApi } from "@/lib/api";
import { imgUrl } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export default function LogoPage() {
  const { data, error, loading, reload } = useApi<{ tenSite: string; logo: string }>("/admin/logo");
  const { flash } = useApp();
  const [ten, setTen] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dang, setDang] = useState(false);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Lỗi tải cấu hình"} />;

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    const fd = new FormData();
    fd.append("site_name", ten ?? data.tenSite);
    if (file) fd.append("logo_file", file);
    try {
      const r = await api<{ message: string }>("/admin/logo", { method: "POST", body: fd });
      flash("success", `${r.message} Tải lại trang để thấy logo mới trên toàn site.`);
      setFile(null);
      await reload();
    } catch (err) {
      flash("danger", loiTuApi(err));
    } finally {
      setDang(false);
    }
  };

  return (
    <form className="card-custom p-4" style={{ maxWidth: 560 }} onSubmit={gui}>
      <Field label="Logo hiện tại">{ }<img src={file ? URL.createObjectURL(file) : imgUrl(data.logo, "images/HUIT.jpg")} alt="Logo" height={80} className="d-block" /></Field>
      <Field label="Tên website"><input className="form-control" maxLength={200} value={ten ?? data.tenSite} onChange={(e) => setTen(e.target.value)} /></Field>
      <Field label="Tải logo mới" hint="JPG, PNG, GIF, WEBP – tối đa 10MB."><input type="file" accept="image/*" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
      <button className="btn btn-primary" disabled={dang}>{dang ? "Đang lưu..." : "Lưu thay đổi"}</button>
    </form>
  );
}
