"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type NguoiDungV, useApp } from "@/components/AppProviders";
import { ErrorBox, Page } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";

export default function DangKyPage() {
  const { setUser, flash } = useApp();
  const router = useRouter();
  const [f, setF] = useState({ hoTen: "", tenDangNhap: "", email: "", soDienThoai: "", diaChi: "", matKhau: "", xacNhanMatKhau: "" });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);
  const dat = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.matKhau !== f.xacNhanMatKhau) return setLoi("Xác nhận mật khẩu không khớp.");
    setDang(true);
    setLoi(null);
    try {
      const body = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== "" || ["matKhau", "xacNhanMatKhau"].includes(k)));
      const r = await apiPost<{ user: NguoiDungV; message: string }>("/auth/dang-ky", body);
      setUser(r.user);
      flash("success", r.message);
      router.push("/");
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };

  return (
    <Page>
      <form className="card mx-auto" style={{ maxWidth: 560 }} onSubmit={gui}><div className="card-body p-4">
        <h3 className="mb-3">Đăng ký tài khoản</h3>
        {loi && <ErrorBox message={loi} />}
        <div className="row g-3">
          <div className="col-md-6"><label className="form-label">Họ tên *</label><input className="form-control" required maxLength={100} value={f.hoTen} onChange={dat("hoTen")} /></div>
          <div className="col-md-6"><label className="form-label">Tên đăng nhập *</label><input className="form-control" required minLength={3} maxLength={50} pattern="[A-Za-z0-9_\-]+" title="Chỉ gồm chữ, số, gạch ngang, gạch dưới" value={f.tenDangNhap} onChange={dat("tenDangNhap")} /></div>
          <div className="col-md-6"><label className="form-label">Email *</label><input type="email" className="form-control" required value={f.email} onChange={dat("email")} /></div>
          <div className="col-md-6"><label className="form-label">Số điện thoại</label><input className="form-control" pattern="0[0-9]{9,10}" title="Bắt đầu bằng 0, gồm 10–11 chữ số" value={f.soDienThoai} onChange={dat("soDienThoai")} /></div>
          <div className="col-12"><label className="form-label">Địa chỉ</label><input className="form-control" maxLength={255} value={f.diaChi} onChange={dat("diaChi")} /></div>
          <div className="col-md-6"><label className="form-label">Mật khẩu *</label><input type="password" className="form-control" required minLength={6} value={f.matKhau} onChange={dat("matKhau")} /></div>
          <div className="col-md-6"><label className="form-label">Xác nhận mật khẩu *</label><input type="password" className="form-control" required value={f.xacNhanMatKhau} onChange={dat("xacNhanMatKhau")} /></div>
        </div>
        <button className="btn btn-primary w-100 mt-4" disabled={dang}>{dang ? "Đang tạo tài khoản..." : "Đăng ký"}</button>
        <p className="mt-3 mb-0 text-center">Đã có tài khoản? <Link href="/TaiKhoan/DangNhap">Đăng nhập</Link></p>
      </div></form>
    </Page>
  );
}
