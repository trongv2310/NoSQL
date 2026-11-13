"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { type NguoiDungV, useApp } from "@/components/AppProviders";
import { AuthShell, returnUrlAnToan } from "@/components/AuthForms";
import { ErrorBox, Page } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";

export default function DangKyPage() {
  const { setUser, flash } = useApp();
  const router = useRouter();
  const returnUrl = returnUrlAnToan(useSearchParams().get("returnUrl"));
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
      // Về lại nơi khách đang làm dở (ví dụ trang thanh toán); không cho quay lại các trang đăng nhập/đăng ký.
      router.push(returnUrl && !returnUrl.startsWith("/TaiKhoan/") ? returnUrl : "/");
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };

  return (
    <Page className="au-wrap">
      <AuthShell tieuDe={<>Tạo tài khoản, <em>vào sân ngay</em></>} moTa="Chỉ mất một phút để có tài khoản: đặt hàng nhanh, lưu địa chỉ và theo dõi đơn dễ dàng.">
        <form onSubmit={gui} className="au-card">
          <h1>Đăng ký tài khoản</h1>
          <p className="au-sub">Các mục có dấu * là bắt buộc.</p>
          {loi && <ErrorBox message={loi} />}
          <div className="row g-3">
            <div className="col-md-6"><label className="form-label" htmlFor="dk-1">Họ tên *</label><input id="dk-1" className="form-control" required maxLength={100} autoComplete="name" value={f.hoTen} onChange={dat("hoTen")} /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="dk-2">Tên đăng nhập *</label><input id="dk-2" className="form-control" required minLength={3} maxLength={50} pattern="[A-Za-z0-9_\-]+" title="Chỉ gồm chữ, số, gạch ngang, gạch dưới" autoComplete="username" value={f.tenDangNhap} onChange={dat("tenDangNhap")} /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="dk-3">Email *</label><input id="dk-3" type="email" className="form-control" required autoComplete="email" value={f.email} onChange={dat("email")} /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="dk-4">Số điện thoại</label><input id="dk-4" className="form-control" pattern="0[0-9]{9,10}" title="Bắt đầu bằng 0, gồm 10–11 chữ số" autoComplete="tel" value={f.soDienThoai} onChange={dat("soDienThoai")} /></div>
            <div className="col-12"><label className="form-label" htmlFor="dk-5">Địa chỉ</label><input id="dk-5" className="form-control" maxLength={255} autoComplete="street-address" value={f.diaChi} onChange={dat("diaChi")} /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="dk-6">Mật khẩu *</label><input id="dk-6" type="password" className="form-control" required minLength={6} autoComplete="new-password" value={f.matKhau} onChange={dat("matKhau")} /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="dk-7">Xác nhận mật khẩu *</label><input id="dk-7" type="password" className="form-control" required autoComplete="new-password" value={f.xacNhanMatKhau} onChange={dat("xacNhanMatKhau")} /></div>
          </div>
          <button className="au-submit" disabled={dang}>{dang ? "Đang tạo tài khoản..." : <>Đăng ký <i className="fa-solid fa-arrow-right" aria-hidden="true" /></>}</button>
          <p className="au-switch">Đã có tài khoản? <Link href={returnUrl ? `/TaiKhoan/DangNhap?returnUrl=${encodeURIComponent(returnUrl)}` : "/TaiKhoan/DangNhap"}>Đăng nhập</Link></p>
        </form>
      </AuthShell>
    </Page>
  );
}
