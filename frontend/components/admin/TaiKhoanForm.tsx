"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "../AppProviders";
import { ErrorBox, Loading } from "../Ui";
import { Field, SubmitBar } from "./Common";
import { apiPost, apiPut, loiTuApi } from "@/lib/api";
import { useApi } from "@/lib/hooks";

interface TK { id: string; tenDangNhap: string; email: string; maQuyen: number; hoTen: string | null; soDienThoai: string; diaChi: string; phanQuyens: { maQuyen: number; tenQuyen: string }[] }
const QUYEN = [{ maQuyen: 1, tenQuyen: "Quản trị" }, { maQuyen: 2, tenQuyen: "Nhân viên" }, { maQuyen: 3, tenQuyen: "Khách hàng" }];

export function TaiKhoanForm({ id }: { id?: string }) {
  const router = useRouter();
  const { flash } = useApp();
  const cu = useApi<TK>(id ? `/admin/tai-khoan/${id}` : null);
  const [f, setF] = useState({ tenDangNhap: "", matKhau: "", email: "", maQuyen: "3", hoTen: "", soDienThoai: "", diaChi: "" });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);

  useEffect(() => {
    if (cu.data) {
      const t = cu.data;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setF({ tenDangNhap: t.tenDangNhap, matKhau: "", email: t.email, maQuyen: String(t.maQuyen), hoTen: t.hoTen ?? "", soDienThoai: t.soDienThoai, diaChi: t.diaChi });
    }
  }, [cu.data]);

  if (id && cu.loading) return <Loading />;
  if (id && cu.error) return <ErrorBox message={cu.error} />;
  const dat = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    setLoi(null);
    // Tên đăng nhập không được đổi khi sửa nên không gửi lên.
    const { tenDangNhap, ...conLai } = f;
    const body = id ? conLai : f;
    void tenDangNhap;
    try {
      const r = await (id ? apiPut<{ message: string }>(`/admin/tai-khoan/${id}`, body) : apiPost<{ message: string }>("/admin/tai-khoan", body));
      flash("success", r.message);
      router.push("/admin/tai-khoan");
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };

  return (
    <form className="card-custom p-4" style={{ maxWidth: 760 }} onSubmit={gui}>
      {loi && <ErrorBox message={loi} />}
      <div className="row">
        <div className="col-md-6"><Field label="Tên đăng nhập *"><input className="form-control" required disabled={!!id} minLength={3} maxLength={50} pattern="[A-Za-z0-9_\-]+" value={f.tenDangNhap} onChange={dat("tenDangNhap")} /></Field></div>
        <div className="col-md-6"><Field label={id ? "Mật khẩu mới" : "Mật khẩu *"} hint={id ? "Để trống nếu không đổi." : undefined}><input type="password" className="form-control" required={!id} minLength={6} value={f.matKhau} onChange={dat("matKhau")} /></Field></div>
        <div className="col-md-6"><Field label="Họ tên *"><input className="form-control" required maxLength={100} value={f.hoTen} onChange={dat("hoTen")} /></Field></div>
        <div className="col-md-6"><Field label="Email *"><input type="email" className="form-control" required value={f.email} onChange={dat("email")} /></Field></div>
        <div className="col-md-6"><Field label="Số điện thoại"><input className="form-control" pattern="0[0-9]{9,10}" title="Bắt đầu bằng 0, 10–11 chữ số" value={f.soDienThoai} onChange={dat("soDienThoai")} /></Field></div>
        <div className="col-md-6"><Field label="Phân quyền *"><select className="form-select" required value={f.maQuyen} onChange={dat("maQuyen")}>{(cu.data?.phanQuyens ?? QUYEN).map((q) => <option key={q.maQuyen} value={q.maQuyen}>{q.tenQuyen}</option>)}</select></Field></div>
        <div className="col-12"><Field label="Địa chỉ"><input className="form-control" maxLength={255} value={f.diaChi} onChange={dat("diaChi")} /></Field></div>
      </div>
      <SubmitBar dang={dang} cancel="/admin/tai-khoan" text={id ? "Cập nhật" : "Tạo tài khoản"} />
    </form>
  );
}
