"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { giuFocusTrongVung } from "@/lib/bay-focus";
import { apiPost } from "@/lib/api";
import { imgUrl } from "@/lib/format";
import { TRANG_NHAN_VIEN, canChuyenVeTrangNhanVien, duongDanDuocPhep, mucMenuTheoQuyen } from "@/lib/quyen-admin";
import { useApp } from "../AppProviders";
import { LoginForm } from "../AuthForms";
import { Loading } from "../Ui";
import { ThongBaoTrucTiep } from "./ThongBaoTrucTiep";

type Muc = { href: string; icon: string; nhan: string; moTa: string };

/** Mục nào hiện với vai trò nào do mucMenuTheoQuyen quyết định. */
const MUC: { nhom: string; muc: Muc[] }[] = [
  {
    nhom: "Điều hành", muc: [
      { href: "/admin", icon: "fa-gauge-high", nhan: "Tổng quan", moTa: "Theo dõi doanh thu và những việc cần xem trong cửa hàng." },
      { href: "/admin/don-hang", icon: "fa-receipt", nhan: "Đơn hàng", moTa: "Tìm đơn, kiểm tra thông tin giao hàng và cập nhật tiến độ." },
      { href: "/admin/lich-cang", icon: "fa-calendar-check", nhan: "Lịch căng cước", moTa: "Xem chỗ đang chờ và xác nhận đã căng xong cho khách." },
      { href: "/admin/bao-cao-csdl", icon: "fa-chart-column", nhan: "Báo cáo sổ căng & đánh giá", moTa: "Xem thói quen căng cước, đánh giá vợt và lượt xem sản phẩm." },
    ],
  },
  {
    nhom: "Danh mục & ưu đãi", muc: [
      { href: "/admin/san-pham", icon: "fa-box-archive", nhan: "Sản phẩm", moTa: "Quản lý danh mục, phiên bản và tồn kho." },
      { href: "/admin/khuyen-mai", icon: "fa-tags", nhan: "Khuyến mãi", moTa: "Xem thời hạn, mức giảm và sản phẩm thuộc từng chương trình." },
      { href: "/admin/khai-thac", icon: "fa-fire", nhan: "Combo bán chạy", moTa: "Phân tích sản phẩm mua cùng và chọn combo để khách xem." },
    ],
  },
  {
    nhom: "Nội dung", muc: [
      { href: "/admin/ban-tin", icon: "fa-newspaper", nhan: "Bảng tin", moTa: "Soạn bài, chọn bài nổi bật và kiểm soát nội dung công khai." },
      { href: "/admin/tran-dau", icon: "fa-table-tennis-paddle-ball", nhan: "Kết quả trận đấu", moTa: "Cập nhật tỷ số và trận đấu dùng trong bảng tin." },
    ],
  },
  {
    nhom: "Hệ thống", muc: [
      { href: "/admin/tai-khoan", icon: "fa-users-gear", nhan: "Tài khoản", moTa: "Tìm tài khoản và xem theo vai trò." },
      { href: "/admin/logo", icon: "fa-image", nhan: "Tên và logo cửa hàng", moTa: "Xem trước nhận diện cửa hàng trước khi lưu." },
      { href: "/admin/thong-bao", icon: "fa-triangle-exclamation", nhan: "Cảnh báo đánh giá", moTa: "Đọc các phản hồi thấp điểm để biết sản phẩm nào cần xem lại." },
    ],
  },
];

const khop = (path: string, href: string) => path === href || (href !== "/admin" && path.startsWith(href + "/"));
const boDau = (value: string) => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").trim();

function TimMuc({ muc }: { muc: Muc[] }) {
  const [tuKhoa, setTuKhoa] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const oTim = useRef<HTMLInputElement>(null);
  const nut = useRef<HTMLButtonElement>(null);
  const mo = () => {
    if (dialog.current?.open) return;
    setTuKhoa("");
    dialog.current?.showModal();
    oTim.current?.focus();
  };

  useEffect(() => {
    const phimTat = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        nut.current?.click();
      }
    };
    window.addEventListener("keydown", phimTat);
    return () => window.removeEventListener("keydown", phimTat);
  }, []);

  const loc = boDau(tuKhoa);
  const ketQua = muc.filter((m) => boDau(m.nhan + " " + m.moTa).includes(loc));
  return (
    <>
      <button ref={nut} type="button" className="admin-find" onClick={mo} aria-label="Tìm mục quản trị" aria-haspopup="dialog">
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" /><span>Tìm mục quản trị</span><kbd>Ctrl K</kbd>
      </button>
      <dialog ref={dialog} className="admin-search-dialog" aria-labelledby="admin-search-title" onClose={() => nut.current?.focus()}>
        <div className="admin-search-header">
          <h2 id="admin-search-title">Tìm mục quản trị</h2>
          <button type="button" className="admin-icon-button" aria-label="Đóng tìm kiếm" onClick={() => dialog.current?.close()}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (loc && ketQua.length) dialog.current?.querySelector<HTMLAnchorElement>("nav a")?.click();
        }}>
          <input ref={oTim} type="search" className="form-control" value={tuKhoa} autoComplete="off"
            onChange={(e) => setTuKhoa(e.target.value)} aria-label="Tên mục quản trị" placeholder="Ví dụ: đơn hàng, tồn kho…" />
        </form>
        {ketQua.length ? (
          <nav aria-label="Kết quả tìm mục quản trị">
            {ketQua.map((m) => <Link href={m.href} key={m.href} onClick={() => dialog.current?.close()}>
              <i className={"fa-solid " + m.icon} aria-hidden="true" />
              <span><strong>{m.nhan}</strong><small>{m.moTa}</small></span>
            </Link>)}
          </nav>
        ) : <p className="admin-search-empty" role="status">Không tìm thấy mục phù hợp.</p>}
      </dialog>
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, ready, site, setUser, flash } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [mo, setMo] = useState(false);
  const nutMo = useRef<HTMLButtonElement>(null);
  const thanhBen = useRef<HTMLElement>(null);
  // Thanh bên (màn hình hẹp) mở: focus vào mục đầu; Escape ở bất cứ đâu đóng và trả focus về nút mở.
  useEffect(() => {
    if (!mo) return;
    thanhBen.current?.querySelector<HTMLElement>("a, button")?.focus();
    const khiPhim = (e: KeyboardEvent) => {
      if (document.querySelector(".admin-search-dialog[open]")) return;
      if (e.key === "Escape") { setMo(false); nutMo.current?.focus(); }
      else giuFocusTrongVung(e, thanhBen.current);
    };
    document.addEventListener("keydown", khiPhim);
    return () => document.removeEventListener("keydown", khiPhim);
  }, [mo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMo(false);
  }, [pathname]);

  // Nhân viên gõ đúng /admin (Thống kê, không được vào) thì đưa về trang đơn hàng.
  const veTrangNhanVien = canChuyenVeTrangNhanVien(user?.maQuyen, pathname);
  useEffect(() => {
    if (veTrangNhanVien) router.replace(TRANG_NHAN_VIEN);
  }, [veTrangNhanVien, router]);

  if (!ready) return <div className="p-5"><Loading /></div>;

  if (!user || user.maQuyen === 3) {
    return (
      <div className="admin-login">
        <div className="admin-login-inner">
          {user && <div className="alert alert-danger mx-auto" style={{ maxWidth: 440 }}>Bạn không có quyền truy cập vào trang quản trị.</div>}
          <Suspense fallback={null}><LoginForm quanTri /></Suspense>
          <p className="text-center mt-3"><Link href="/">Về trang cửa hàng</Link></p>
        </div>
      </div>
    );
  }

  const laAdmin = user.maQuyen === 1;
  const duocVao = duongDanDuocPhep(user.maQuyen, pathname);
  const dsMenu = MUC.map((n) => ({ ...n, muc: n.muc.filter((m) => mucMenuTheoQuyen(user.maQuyen, m.href)) })).filter((n) => n.muc.length);
  const path = pathname.replace(/\/$/, "");
  const pathMenu = khop(path, "/admin/bien-the") ? "/admin/san-pham" : path;
  const nhom = dsMenu.find((n) => n.muc.some((m) => khop(pathMenu, m.href)));
  const muc = nhom?.muc.find((m) => khop(pathMenu, m.href));
  const dangXuat = async () => {
    await apiPost("/auth/dang-xuat");
    setUser(null);
    flash("success", "Bạn đã đăng xuất.");
    router.push("/admin");
  };

  return (
    <div className="admin-body">
      <aside id="admin-sidebar" ref={thanhBen} className={`admin-sidebar ${mo ? "open show" : ""}`}>
        <Link href={laAdmin ? "/admin" : TRANG_NHAN_VIEN} className="admin-brand">
          <img src={imgUrl(site.logo, "images/HUIT.jpg")} alt="" />
          <span><span className="brand-name d-block">{site.tenSite}</span><span className="brand-sub d-block">Trang quản trị</span></span>
        </Link>
        <nav className="admin-nav" aria-label="Điều hướng quản trị">
          {dsMenu.map((n) => (
            <div key={n.nhom}>
              <div className="admin-nav-label">{n.nhom}</div>
              {n.muc.map(({ href, icon, nhan }) => (
                <Link key={href} href={href} aria-current={khop(pathMenu, href) ? (path === href ? "page" : "location") : undefined}
                  className={khop(pathMenu, href) ? "admin-link active" : "admin-link"}>
                  <i className={"fa-solid " + icon} aria-hidden="true" /><span>{nhan}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <Link href="/" className="admin-link"><i className="fa-solid fa-store" aria-hidden="true" /> Xem cửa hàng</Link>
          {laAdmin && <Link href="/TaiKhoan/DoiMatKhau" className="admin-link"><i className="fa-solid fa-key" aria-hidden="true" /> Đổi mật khẩu</Link>}
          <button type="button" className="admin-link danger" onClick={dangXuat}><i className="fa-solid fa-right-from-bracket" aria-hidden="true" /> Đăng xuất</button>
        </div>
      </aside>
      <div className={`admin-backdrop ${mo ? "show active" : ""}`} onClick={() => { setMo(false); nutMo.current?.focus(); }} />
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-start">
            <button ref={nutMo} type="button" className="admin-toggle" aria-label="Mở menu" aria-expanded={mo} aria-controls="admin-sidebar" onClick={() => setMo((v) => !v)}><i className="fa-solid fa-bars" /></button>
            <span className="admin-topbar-section">{nhom?.nhom ?? "Quản trị"}</span>
          </div>
          <div className="admin-topbar-actions">
            <TimMuc muc={dsMenu.flatMap((n) => n.muc)} />
            {laAdmin && <ThongBaoTrucTiep />}
            <div className="admin-user">
              <div className="meta text-end"><div className="name">{user.hoTen}</div><div className="role">{laAdmin ? "Quản trị viên" : "Nhân viên"}</div></div>
              <div className="admin-avatar" aria-hidden="true">{user.hoTen.charAt(0).toUpperCase()}</div>
            </div>
          </div>
        </header>
        <main className="admin-content">
          {duocVao ? <>
            <div className="admin-page-heading">
              {muc && path !== muc.href && <Link className="admin-section-back" href={muc.href}><i className="fa-solid fa-chevron-left" aria-hidden="true" /> {muc.nhan}</Link>}
              <h1>{muc?.nhan ?? "Bảng điều khiển"}</h1>
              {muc && path === muc.href && <p>{muc.moTa}</p>}
            </div>
            <Suspense fallback={<Loading />}>{children}</Suspense>
          </>
            : veTrangNhanVien ? <Loading />
              : (
                <div className="card-custom p-4" role="alert">
                  <p className="mb-3">Bạn không có quyền truy cập trang này.</p>
                  <Link href={TRANG_NHAN_VIEN} className="btn btn-primary">Về trang đơn hàng</Link>
                </div>
              )}
        </main>
      </div>
    </div>
  );
}
