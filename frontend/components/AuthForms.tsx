"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Shuttle } from "@/components/PageHero";
import { ErrorBox } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { trangSauDangNhap } from "@/lib/quyen-admin";
import { type NguoiDungV, useApp } from "./AppProviders";

import { returnUrlAnToan } from "@/lib/url-an-toan";
export { returnUrlAnToan };

/** Khung hai cột cho trang đăng nhập/đăng ký: bên trái giới thiệu quyền lợi, bên phải là form. */
export function AuthShell({ tieuDe, moTa, children }: { tieuDe: React.ReactNode; moTa: string; children: React.ReactNode }) {
  return (
    <div className="au-shell">
      <aside className="au-visual" aria-hidden="false">
        <Shuttle className="au-shuttle s1" /><Shuttle className="au-shuttle s2" />
        <span className="sf-kicker">Thành viên cửa hàng</span>
        <h2>{tieuDe}</h2>
        <p>{moTa}</p>
        <ul>
          {[["fa-box-open", "Theo dõi trạng thái đơn hàng"], ["fa-wallet", "Thanh toán COD hoặc MoMo"], ["fa-cart-shopping", "Giỏ hàng và địa chỉ được lưu lại"], ["fa-robot", "Trợ lý AI tư vấn chọn vợt, giày"]].map(([icon, nhan]) => <li key={nhan}><i className={`fa-solid ${icon}`} aria-hidden="true" />{nhan}</li>)}
        </ul>
      </aside>
      <div className="au-form">{children}</div>
    </div>
  );
}

export function LoginForm({ quanTri = false }: { quanTri?: boolean }) {
  const { setUser, flash } = useApp();
  const router = useRouter();
  const returnUrl = returnUrlAnToan(useSearchParams().get("returnUrl"));
  const tuGioHang = !!returnUrl && (returnUrl.startsWith("/DonHang/Checkout") || returnUrl.startsWith("/Home/ViewCart"));
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
      const mac = trangSauDangNhap(r.user.maQuyen, quanTri);
      router.push(returnUrl && !returnUrl.startsWith("/TaiKhoan/") ? returnUrl : mac);
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };

  const [hien, setHien] = useState(false);
  if (!quanTri) {
    return (
      <AuthShell
        tieuDe={tuGioHang ? <>Đăng nhập để <em>thanh toán</em></> : <>Chào mừng bạn <em>quay lại sân</em></>}
        moTa={tuGioHang ? "Giỏ hàng bạn vừa chọn được giữ lại và sẽ được chuyển vào tài khoản sau khi đăng nhập." : "Đăng nhập để theo dõi đơn hàng, lưu giỏ hàng và nhận tư vấn nhanh hơn."}
      >
        <form onSubmit={gui} className="au-card">
          <h1>Đăng nhập</h1>
          <p className="au-sub">Chào mừng bạn quay lại cửa hàng.</p>
          {loi && <ErrorBox message={loi} />}
          <label className="au-field"><span>Tên đăng nhập</span><div><i className="fa-regular fa-user" aria-hidden="true" /><input className="form-control" required autoFocus autoComplete="username" value={tenDangNhap} onChange={(e) => setTen(e.target.value)} /></div></label>
          <label className="au-field"><span>Mật khẩu</span><div><i className="fa-solid fa-lock" aria-hidden="true" /><input type={hien ? "text" : "password"} className="form-control" required autoComplete="current-password" value={matKhau} onChange={(e) => setMk(e.target.value)} /><button type="button" className="au-eye" aria-label={hien ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setHien((v) => !v)}><i className={`fa-regular ${hien ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true" /></button></div></label>
          <button className="au-submit" disabled={dang}>{dang ? "Đang đăng nhập..." : <>Đăng nhập <i className="fa-solid fa-arrow-right" aria-hidden="true" /></>}</button>
          <p className="au-switch">Chưa có tài khoản? <Link href={returnUrl ? `/TaiKhoan/DangKy?returnUrl=${encodeURIComponent(returnUrl)}` : "/TaiKhoan/DangKy"}>Đăng ký ngay</Link></p>
        </form>
      </AuthShell>
    );
  }

  return (
    <form className="card mx-auto" style={{ maxWidth: 440 }} onSubmit={gui}>
      <div className="card-body p-4">
        <h3 className="mb-1">{quanTri ? "Đăng nhập quản trị" : "Đăng nhập"}</h3>
        <p className="text-muted">{quanTri ? "Dành cho quản trị viên và nhân viên." : "Chào mừng bạn quay lại cửa hàng."}</p>
        {loi && <ErrorBox message={loi} />}
        <div className="mb-3"><label className="form-label" htmlFor="qt-1">Tên đăng nhập</label><input id="qt-1" className="form-control" required autoFocus value={tenDangNhap} onChange={(e) => setTen(e.target.value)} /></div>
        <div className="mb-3"><label className="form-label" htmlFor="qt-2">Mật khẩu</label><input id="qt-2" type="password" className="form-control" required value={matKhau} onChange={(e) => setMk(e.target.value)} /></div>
        <button className="btn btn-primary w-100" disabled={dang}>{dang ? "Đang đăng nhập..." : "Đăng nhập"}</button>
        {!quanTri && <p className="mt-3 mb-0 text-center">Chưa có tài khoản? <Link href="/TaiKhoan/DangKy">Đăng ký</Link></p>}
      </div>
    </form>
  );
}
