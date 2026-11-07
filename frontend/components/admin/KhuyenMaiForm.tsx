"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "../AppProviders";
import { ErrorBox, Loading } from "../Ui";
import { Field, SubmitBar } from "./Common";
import { apiPost, apiPut, loiTuApi } from "@/lib/api";
import { ngayInput } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { KhuyenMaiV } from "@/lib/types";

export function KhuyenMaiForm({ id }: { id?: string }) {
  const router = useRouter();
  const { flash } = useApp();
  const cu = useApi<KhuyenMaiV>(id ? `/admin/khuyen-mai/${id}` : null);
  const [f, setF] = useState({ tenChuongTrinh: "", moTa: "", phanTramGiam: "", giamToiDa: "", soLuongSuDung: "", ngayBatDau: "", ngayKetThuc: "" });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);

  useEffect(() => {
    if (cu.data) {
      const k = cu.data;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setF({ tenChuongTrinh: k.tenChuongTrinh, moTa: k.moTa ?? "", phanTramGiam: String(k.phanTramGiam), giamToiDa: k.giamToiDa ? String(k.giamToiDa) : "", soLuongSuDung: k.soLuongSuDung != null ? String(k.soLuongSuDung) : "", ngayBatDau: ngayInput(k.ngayBatDau), ngayKetThuc: ngayInput(k.ngayKetThuc) });
    }
  }, [cu.data]);

  if (id && cu.loading) return <Loading />;
  if (id && cu.error) return <ErrorBox message={cu.error} />;
  const dat = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    setLoi(null);
    try {
      const r = await (id ? apiPut<{ message: string }>(`/admin/khuyen-mai/${id}`, f) : apiPost<{ message: string }>("/admin/khuyen-mai", f));
      flash("success", r.message);
      router.push("/admin/khuyen-mai");
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };

  return (
    <form className="card-custom p-4" style={{ maxWidth: 860 }} onSubmit={gui}>
      {loi && <ErrorBox message={loi} />}
      <Field label="Tên chương trình *"><input className="form-control" required maxLength={100} value={f.tenChuongTrinh} onChange={dat("tenChuongTrinh")} /></Field>
      <Field label="Mô tả"><input className="form-control" maxLength={255} value={f.moTa} onChange={dat("moTa")} /></Field>
      <div className="row">
        <div className="col-md-4"><Field label="Phần trăm giảm (%) *"><input type="number" min={0} max={100} step="0.01" className="form-control" required value={f.phanTramGiam} onChange={dat("phanTramGiam")} /></Field></div>
        <div className="col-md-4"><Field label="Giảm tối đa (đ)"><input type="number" min={0} className="form-control" value={f.giamToiDa} onChange={dat("giamToiDa")} /></Field></div>
        <div className="col-md-4"><Field label="Số lượt sử dụng"><input type="number" min={0} className="form-control" value={f.soLuongSuDung} onChange={dat("soLuongSuDung")} /></Field></div>
        <div className="col-md-6"><Field label="Ngày bắt đầu *"><input type="date" className="form-control" required value={f.ngayBatDau} onChange={dat("ngayBatDau")} /></Field></div>
        <div className="col-md-6"><Field label="Ngày kết thúc *"><input type="date" className="form-control" required min={f.ngayBatDau} value={f.ngayKetThuc} onChange={dat("ngayKetThuc")} /></Field></div>
      </div>
      <SubmitBar dang={dang} cancel="/admin/khuyen-mai" text={id ? "Cập nhật" : "Tạo khuyến mãi"} />
    </form>
  );
}
