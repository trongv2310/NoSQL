"use client";

import { useEffect, useRef, useState } from "react";
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
  const fileInput = useRef<HTMLInputElement>(null);
  // Địa chỉ xem trước tạo một lần cho mỗi tệp và được thu hồi khi đổi tệp/rời trang (trước đây tạo mới mỗi lần render, không thu hồi).
  const [xemTruoc, setXemTruoc] = useState<string | null>(null);
  useEffect(() => {
    const u = file ? URL.createObjectURL(file) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setXemTruoc(u);
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [file]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <div className="card-custom p-3"><ErrorBox message="Chưa tải được tên và logo của cửa hàng." />
    <button type="button" className="btn btn-outline-primary" onClick={() => void reload()}>Thử lại</button></div>;

  const tenMoi = (ten ?? data.tenSite).trim();
  const thayDoi = file !== null || tenMoi !== data.tenSite;
  const boThayDoi = () => {
    setTen(null);
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thayDoi || !tenMoi || dang) return;
    setDang(true);
    const fd = new FormData();
    fd.append("site_name", tenMoi);
    if (file) fd.append("logo_file", file);
    try {
      const r = await api<{ message: string }>("/admin/logo", { method: "POST", body: fd });
      flash("success", `${r.message} Tải lại trang để cập nhật tên và logo trên toàn cửa hàng.`);
      await reload();
      boThayDoi();
    } catch (err) {
      flash("danger", loiTuApi(err));
    } finally {
      setDang(false);
    }
  };

  return (
    <div className="admin-report-grid">
      <form className="card-custom admin-report-card" onSubmit={gui}>
        <header><h2>Thông tin hiển thị</h2></header>
        <Field label="Tên cửa hàng"><input className="form-control" required maxLength={200} disabled={dang}
          value={ten ?? data.tenSite} onChange={(e) => setTen(e.target.value)} /></Field>
        <Field label="Chọn logo" hint="JPG, PNG, GIF hoặc WEBP. Tối đa 10 MB."><input ref={fileInput} type="file"
          accept="image/jpeg,image/png,image/gif,image/webp" className="form-control" disabled={dang}
          onChange={(e) => {
            const tam = e.target.files?.[0] ?? null;
            if (tam && tam.size > 10 * 1024 * 1024) {
              flash("danger", "Logo vượt quá 10 MB. Hãy chọn ảnh nhỏ hơn.");
              e.target.value = "";
              setFile(null);
              return;
            }
            setFile(tam);
          }} /></Field>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={dang || !thayDoi || !tenMoi}>{dang ? "Đang lưu…" : "Lưu thay đổi"}</button>
          {thayDoi && <button type="button" className="btn btn-outline-secondary" disabled={dang} onClick={boThayDoi}>Hoàn tác chỉnh sửa</button>}
        </div>
      </form>
      <section className="card-custom admin-report-card">
        <header><h2>Xem trước nhận diện</h2><p>{thayDoi ? "Bản xem trước chưa lưu." : "Tên và logo đang sử dụng."}</p></header>
        <div className="admin-brand-preview">
          <img src={xemTruoc ?? imgUrl(data.logo, "images/HUIT.jpg")} alt="Logo cửa hàng" />
          <strong>{tenMoi || "Chưa nhập tên cửa hàng"}</strong>
        </div>
      </section>
    </div>
  );
}
