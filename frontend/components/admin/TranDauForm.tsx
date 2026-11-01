"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "../AppProviders";
import { ErrorBox, Loading } from "../Ui";
import { Field, SubmitBar } from "./Common";
import { apiPost, apiPut, loiTuApi } from "@/lib/api";
import { ngayInput } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { TranDauV } from "@/lib/types";

export function TranDauForm({ id }: { id?: string }) {
  const router = useRouter();
  const { flash } = useApp();
  const cu = useApi<TranDauV>(id ? `/admin/tran-dau/${id}` : null);
  const [f, setF] = useState({ tenGiaiDau: "", vong: "", noiDung: "", doiA: "", doiB: "", tiSo: "", doiThang: "", ngayThiDau: "", diaDiem: "", nguonTin: "", lienKetNguon: "" });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);

  useEffect(() => {
    if (cu.data) {
      const t = cu.data;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setF({ tenGiaiDau: t.tenGiaiDau, vong: t.vong, noiDung: t.noiDung, doiA: t.doiA, doiB: t.doiB, tiSo: t.tiSo ?? "", doiThang: t.doiThang ?? "", ngayThiDau: ngayInput(t.ngayThiDau), diaDiem: t.diaDiem ?? "", nguonTin: t.nguonTin ?? "", lienKetNguon: t.lienKetNguon ?? "" });
    }
  }, [cu.data]);

  if (id && cu.loading) return <Loading />;
  if (id && cu.error) return <ErrorBox message={cu.error} />;
  const dat = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    setLoi(null);
    try {
      const r = await (id ? apiPut<{ message: string }>(`/admin/tran-dau/${id}`, f) : apiPost<{ message: string }>("/admin/tran-dau", f));
      flash("success", r.message);
      router.push("/admin/tran-dau");
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };

  return (
    <form className="card-custom p-4" style={{ maxWidth: 820 }} onSubmit={gui}>
      {loi && <ErrorBox message={loi} />}
      <div className="row">
        <div className="col-md-8"><Field label="Tên giải đấu *"><input className="form-control" required maxLength={150} value={f.tenGiaiDau} onChange={dat("tenGiaiDau")} /></Field></div>
        <div className="col-md-4"><Field label="Ngày thi đấu *"><input type="date" className="form-control" required value={f.ngayThiDau} onChange={dat("ngayThiDau")} /></Field></div>
        <div className="col-md-6"><Field label="Vòng đấu *"><input className="form-control" required maxLength={60} placeholder="Chung kết" value={f.vong} onChange={dat("vong")} /></Field></div>
        <div className="col-md-6"><Field label="Nội dung thi đấu *"><input className="form-control" required maxLength={60} placeholder="Đơn nam" value={f.noiDung} onChange={dat("noiDung")} /></Field></div>
        <div className="col-md-6"><Field label="Bên A *"><input className="form-control" required maxLength={150} value={f.doiA} onChange={dat("doiA")} /></Field></div>
        <div className="col-md-6"><Field label="Bên B *"><input className="form-control" required maxLength={150} value={f.doiB} onChange={dat("doiB")} /></Field></div>
        <div className="col-md-6"><Field label="Tỉ số" hint="Dạng 21-11, 21-15 (tối đa 3 ván)"><input className="form-control" pattern="\d{1,2}-\d{1,2}(,\s*\d{1,2}-\d{1,2}){0,2}" value={f.tiSo} onChange={dat("tiSo")} /></Field></div>
        <div className="col-md-6"><Field label="Bên thắng"><select className="form-select" required={!!f.tiSo} value={f.doiThang} onChange={dat("doiThang")}><option value="">—</option><option value="A">Bên A</option><option value="B">Bên B</option></select></Field></div>
        <div className="col-md-6"><Field label="Địa điểm"><input className="form-control" maxLength={120} value={f.diaDiem} onChange={dat("diaDiem")} /></Field></div>
        <div className="col-md-6"><Field label="Nguồn tin"><input className="form-control" maxLength={150} value={f.nguonTin} onChange={dat("nguonTin")} /></Field></div>
        <div className="col-12"><Field label="Liên kết nguồn"><input type="url" className="form-control" maxLength={300} value={f.lienKetNguon} onChange={dat("lienKetNguon")} /></Field></div>
      </div>
      <SubmitBar dang={dang} cancel="/admin/tran-dau" text={id ? "Cập nhật" : "Thêm trận đấu"} />
    </form>
  );
}
