"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ErrorBox } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { type NguoiDungV, useApp } from "./AppProviders";

/** Chỉ cho phép quay lại URL nội bộ để tránh open-redirect. */
export function returnUrlAnToan(u: string | null): string | null {
  return u && u.startsWith("/") && !u.startsWith("//") ? u : null;
}

export function LoginForm({ quanTri = false }: { quanTri?: boolean }) {
  const { setUser, flash } = useApp();
  const router = useRouter();
  const returnUrl = returnUrlAnToan(useSearchParams().get("returnUrl"));
  const [tenDangNhap, setTen] = useState("");
  const [matKhau, setMk] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    setLoi(null);
    try {
      const r = await apiPost<{ user: NguoiDungV }>(quanTri ? "/auth/admin/dang-nhap" : "/auth/dang-nhap", { tenDangNhap, matKhau });
      setUser(r.user);
      flash("success", `Xin chào ${r.user.hoTen}!`);
      const mac = quanTri ? "/admin" : r.user.maQuyen === 2 ? "/admin" : "/";
      router.push(returnUrl && !returnUrl.startsWith("/TaiKhoan/") ? returnUrl : mac);
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };

  return (
    <form className="card mx-auto" style={{ maxWidth: 440 }} onSubmit={gui}>
      <div className="card-body p-4">
        <h3 className="mb-1">{quanTri ? "Đăng nhập quản trị" : "Đăng nhập"}</h3>
        <p className="text-muted">{quanTri ? "Dành cho quản trị viên và nhân viên." : "Chào mừng bạn quay lại cửa hàng."}</p>
        {loi && <ErrorBox message={loi} />}
        <div className="mb-3"><label className="form-label">Tên đăng nhập</label><input className="form-control" required autoFocus value={tenDangNhap} onChange={(e) => setTen(e.target.value)} /></div>
        <div className="mb-3"><label className="form-label">Mật khẩu</label><input type="password" className="form-control" required value={matKhau} onChange={(e) => setMk(e.target.value)} /></div>
        <button className="btn btn-primary w-100" disabled={dang}>{dang ? "Đang đăng nhập..." : "Đăng nhập"}</button>
        {!quanTri && <p className="mt-3 mb-0 text-center">Chưa có tài khoản? <Link href="/TaiKhoan/DangKy">Đăng ký</Link></p>}
      </div>
    </form>
  );
}
