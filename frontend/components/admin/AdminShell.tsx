"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { imgUrl } from "@/lib/format";
import { useApp } from "../AppProviders";
import { LoginForm } from "../AuthForms";
import { Loading } from "../Ui";

const MUC: { nhom: string; muc: [string, string, string, boolean][] }[] = [
  { nhom: "Tổng quan", muc: [["/admin", "fa-chart-pie", "Thống kê", false]] },
  {
    nhom: "Bán hàng",
    muc: [["/admin/san-pham", "fa-box-archive", "Sản phẩm", true], ["/admin/don-hang", "fa-file-invoice-dollar", "Đơn hàng", false], ["/admin/khuyen-mai", "fa-tags", "Khuyến mãi", true]],
  },
  { nhom: "Nội dung", muc: [["/admin/ban-tin", "fa-newspaper", "Bảng tin", false], ["/admin/tran-dau", "fa-table-tennis-paddle-ball", "Kết quả trận đấu", false]] },
  { nhom: "Hệ thống", muc: [["/admin/tai-khoan", "fa-users-gear", "Tài khoản", true], ["/admin/logo", "fa-image", "Logo hệ thống", true], ["/admin/thong-bao", "fa-triangle-exclamation", "Cảnh báo đánh giá", false]] },
];

const TIEU_DE: [string, string][] = [
  ["/admin/san-pham", "Quản lý sản phẩm"], ["/admin/bien-the", "Quản lý sản phẩm"], ["/admin/don-hang", "Quản lý đơn hàng"],
  ["/admin/khuyen-mai", "Quản lý khuyến mãi"], ["/admin/ban-tin", "Quản lý bảng tin"], ["/admin/tran-dau", "Kết quả trận đấu"],
  ["/admin/tai-khoan", "Quản lý tài khoản"], ["/admin/logo", "Quản lý Logo"], ["/admin/thong-bao", "Cảnh báo đánh giá"],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, ready, site, setUser, flash } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [mo, setMo] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMo(false);
  }, [pathname]);

  if (!ready) return <div className="p-5"><Loading /></div>;

  if (!user || user.maQuyen === 3) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh", background: "#f4f6f8" }}>
        <div className="w-100 p-3">
          {user && <div className="alert alert-danger mx-auto" style={{ maxWidth: 440 }}>Bạn không có quyền truy cập vào trang quản trị.</div>}
          <Suspense fallback={null}><LoginForm quanTri /></Suspense>
          <p className="text-center mt-3"><Link href="/">← Về trang cửa hàng</Link></p>
        </div>
      </div>
    );
  }

  const laAdmin = user.maQuyen === 1;
  const tieuDe = pathname === "/admin" ? "Thống kê & báo cáo" : (TIEU_DE.find(([p]) => pathname.startsWith(p))?.[1] ?? "Bảng điều khiển");
  const dangXuat = async () => {
    await apiPost("/auth/dang-xuat");
    setUser(null);
    flash("success", "Bạn đã đăng xuất.");
    router.push("/admin");
  };

  return (
    <div className="admin-body">
      <aside className={`admin-sidebar ${mo ? "open show" : ""}`}>
        <Link href="/admin" className="admin-brand">
          { }
          <img src={imgUrl(site.logo, "images/HUIT.jpg")} alt="Logo" />
          <span><span className="brand-name d-block">{site.tenSite}</span><span className="brand-sub d-block">Trang quản trị</span></span>
        </Link>
        <nav className="admin-nav">
          {MUC.map((n) => (
            <div key={n.nhom}>
              <div className="admin-nav-label">{n.nhom}</div>
              {n.muc.filter(([, , , chiAdmin]) => laAdmin || !chiAdmin).map(([href, icon, nhan]) => (
                <Link key={href} href={href} className={`admin-link ${(href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)) ? "active" : ""}`}>
                  <i className={`fa-solid ${icon}`} /> {nhan}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <Link href={laAdmin ? "/TaiKhoan/DoiMatKhau" : "/"} className="admin-link"><i className={`fa-solid ${laAdmin ? "fa-key" : "fa-arrow-up-right-from-square"}`} /> {laAdmin ? "Đổi mật khẩu" : "Xem trang khách hàng"}</Link>
          <button type="button" className="admin-link danger" onClick={dangXuat}><i className="fa-solid fa-right-from-bracket" /> Đăng xuất</button>
        </div>
      </aside>
      <div className={`admin-backdrop ${mo ? "show active" : ""}`} onClick={() => setMo(false)} />
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="d-flex align-items-center gap-3">
            <button type="button" className="admin-toggle" aria-label="Mở menu" onClick={() => setMo((v) => !v)}><i className="fa-solid fa-bars" /></button>
            <h1>{tieuDe}</h1>
          </div>
          <div className="admin-user">
            <div className="meta text-end"><div className="name">{user.hoTen}</div><div className="role">{laAdmin ? "Quản trị viên" : "Nhân viên"}</div></div>
            <div className="admin-avatar">{user.hoTen.charAt(0).toUpperCase()}</div>
          </div>
        </header>
        <main className="admin-content"><Suspense fallback={<Loading />}>{children}</Suspense></main>
      </div>
    </div>
  );
}
