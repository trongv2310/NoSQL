"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { imgUrl } from "@/lib/format";
import { useApp } from "./AppProviders";

const LOAI = [
  { khoa: "Vot", ten: "VỢT CẦU LÔNG", tenThuong: "Vợt cầu lông" },
  { khoa: "Giay", ten: "GIÀY CẦU LÔNG", tenThuong: "Giày cầu lông" },
  { khoa: "AoQuan", ten: "ÁO QUẦN THỂ THAO", tenThuong: "Áo quần thể thao" },
  { khoa: "PhuKien", ten: "PHỤ KIỆN CẦU LÔNG", tenThuong: "Phụ kiện cầu lông" },
];

const HANG_THEO_LOAI: Record<string, { hang: string; dong: string[] }[]> = {
  Vot: [
    { hang: "Yonex", dong: ["Astrox", "Nanoflare", "Arcsaber"] },
    { hang: "Lining", dong: ["Aeronaut", "Tectonic", "Axforce"] },
    { hang: "Victor", dong: ["Auraspeed", "Thruster", "Jetspeed"] },
    { hang: "Mizuno", dong: ["Fortius", "Altius"] },
  ],
  Giay: [{ hang: "Yonex", dong: ["65", "Aerus", "Eclipsion"] }, { hang: "Lining", dong: [] }, { hang: "Victor", dong: [] }, { hang: "Mizuno", dong: [] }],
  AoQuan: [{ hang: "Yonex", dong: [] }, { hang: "Lining", dong: [] }, { hang: "Victor", dong: [] }, { hang: "Mizuno", dong: [] }],
};

const spUrl = (p: Record<string, string>) => `/SanPham/Index?${new URLSearchParams(p).toString()}`;

export function Header() {
  const { user, site, cartCount, setUser, flash } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [keyword, setKeyword] = useState("");
  const [moMenu, setMoMenu] = useState(false);
  const [moUser, setMoUser] = useState(false);
  const [loaiActive, setLoaiActive] = useState("Vot");
  const [moSub, setMoSub] = useState(false);

  // Đóng menu di động mỗi khi chuyển trang.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoMenu(false);
    setMoUser(false);
  }, [pathname]);

  const dangXuat = async () => {
    await apiPost("/auth/dang-xuat");
    setUser(null);
    flash("success", "Bạn đã đăng xuất.");
    router.push("/");
  };

  const maQuyen = user?.maQuyen ?? 3;
  const adminLinks =
    maQuyen === 1
      ? [
          ["/admin/san-pham", "fa-boxes-stacked", "Quản lý Sản phẩm"],
          ["/admin/tai-khoan", "fa-users", "Quản lý tài khoản"],
          ["/admin/don-hang", "fa-file-invoice", "Quản lý Đơn hàng"],
          ["/admin/khuyen-mai", "fa-tags", "Quản lý Khuyến mãi"],
          ["/admin", "fa-chart-line", "Dashboard"],
          ["/admin/thong-bao", "fa-bell", "Thông Báo Đánh Giá Thấp"],
        ]
      : maQuyen === 2
        ? [
            ["/admin/don-hang", "fa-file-invoice", "Quản lý Đơn hàng"],
            ["/admin", "fa-chart-line", "Dashboard"],
            ["/admin/thong-bao", "fa-bell", "Thông Báo Đánh Giá Thấp"],
          ]
        : [];

  const logo = imgUrl(site.logo, "images/HUIT.jpg");

  return (
    <>
      <header className="main-header">
        <div className="header-top">
          <div className="header-brand-wrap">
            <button className="mobile-toggle-btn" type="button" aria-label="Mở menu" aria-expanded={moMenu} onClick={() => setMoMenu(true)}>
              <i className="fa-solid fa-bars" />
            </button>
            <div className="logo">
              <Link href="/">{ }<img src={logo} alt="Logo Cửa Hàng Cầu Lông" /></Link>
            </div>
          </div>
          <form className="search-form search-absolute" onSubmit={(e) => { e.preventDefault(); if (keyword.trim()) router.push(`/SanPham/TimKiem?keyword=${encodeURIComponent(keyword.trim())}`); }}>
            <input type="text" name="keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm kiếm sản phẩm..." className="search-input" />
            <button type="submit" className="search-btn" aria-label="Tìm kiếm"><i className="fa-solid fa-magnifying-glass" /></button>
          </form>
          <div className="header-actions">
            <div className="account-section">
              {!user ? (
                <div className="auth-buttons">
                  <Link href="/TaiKhoan/DangNhap" className="auth-btn login-btn"><i className="fa-solid fa-user" /><span>Đăng nhập</span></Link>
                  <Link href="/TaiKhoan/DangKy" className="auth-btn register-btn"><span>Đăng ký</span></Link>
                </div>
              ) : (
                <div className="user-dropdown" onMouseLeave={() => setMoUser(false)}>
                  <button className="user-btn" type="button" onClick={() => setMoUser((v) => !v)}>
                    <i className="fa-solid fa-user" /><span>Xin chào, {user.hoTen}</span><i className="fa-solid fa-chevron-down" />
                  </button>
                  <div className="user-menu" style={moUser ? { display: "block", opacity: 1, visibility: "visible" } : undefined}>
                    {adminLinks.map(([href, icon, text]) => (
                      <Link key={href} href={href} className="user-menu-item is-admin"><i className={`fa-solid ${icon}`} /> {text}</Link>
                    ))}
                    {adminLinks.length > 0 && <hr />}
                    <Link href="/TaiKhoan/ThongTin" className="user-menu-item"><i className="fa-solid fa-user-circle" /> Thông tin tài khoản</Link>
                    <Link href="/TaiKhoan/DoiMatKhau" className="user-menu-item"><i className="fa-solid fa-key" /> Đổi mật khẩu</Link>
                    <Link href="/DonHang/Index" className="user-menu-item"><i className="fa-solid fa-clipboard-list" /> Đơn hàng của tôi</Link>
                    <button type="button" onClick={dangXuat} className="user-menu-item w-100 text-start border-0 bg-transparent"><i className="fa-solid fa-right-from-bracket" /> Đăng xuất</button>
                  </div>
                </div>
              )}
            </div>
            <Link href="/Home/ViewCart" className="cart-btn" aria-label="Giỏ hàng" title="Giỏ hàng">
              <i className="fa-solid fa-cart-shopping" aria-hidden="true" /><span className="cart-count">{cartCount}</span>
            </Link>
          </div>
        </div>
        <nav className="main-nav">
          <ul>
            <li><Link href="/">TRANG CHỦ</Link></li>
            <li className="mega-menu-item">
              <Link href="/SanPham/Index">SẢN PHẨM <i className="fa-solid fa-chevron-down" /></Link>
              <div className="mega-submenu">
                <div className="sidebar-categories">
                  <h3>DANH MỤC SẢN PHẨM</h3>
                  {LOAI.map((l) => (
                    <Link key={l.khoa} href={spUrl({ loai: l.khoa })} className={`main-cat ${loaiActive === l.khoa ? "active" : ""}`} onMouseEnter={() => setLoaiActive(l.khoa)}>
                      {l.ten} <i className="fa-solid fa-chevron-right" />
                    </Link>
                  ))}
                </div>
                <div className="mega-contents-wrapper">
                  {LOAI.map((l) => (
                    <div key={l.khoa} className={`mega-content ${loaiActive === l.khoa ? "active" : ""}`}>
                      <div className="product-brands-grid">
                        {l.khoa === "PhuKien" ? (
                          <div className="brand-column">
                            <p className="brand-title">PHỤ KIỆN CẦU LÔNG</p>
                            {["Túi đựng vợt", "Dây cuốn cán", "Balo cầu lông"].map((t) => (
                              <Link key={t} href={spUrl({ loai: "PhuKien", ten: t })}>{t}</Link>
                            ))}
                          </div>
                        ) : (
                          (HANG_THEO_LOAI[l.khoa] ?? []).map((h) => (
                            <div className="brand-column" key={h.hang}>
                              <p className="brand-title"><Link href={spUrl({ hang: h.hang, loai: l.khoa })}>{l.ten.split(" ")[0]} {h.hang.toUpperCase()}</Link></p>
                              {h.dong.map((d) => (
                                <Link key={d} href={spUrl({ hang: h.hang, loai: l.khoa, ten: d })}>{l.khoa === "Vot" ? "Vợt" : "Giày"} {h.hang} {d}</Link>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </li>
            <li><Link href="/KhuyenMai/Index">KHUYẾN MÃI</Link></li>
            <li><Link href="/BangTin">BẢNG TIN</Link></li>
            <li><Link href="/DonHang/Index">ĐƠN HÀNG</Link></li>
            <li><Link href="/Home/Contact">LIÊN HỆ</Link></li>
          </ul>
        </nav>
      </header>

      <div className={`mobile-nav-backdrop ${moMenu ? "show active open" : ""}`} onClick={() => setMoMenu(false)} />
      <aside className={`mobile-nav-drawer ${moMenu ? "show active open" : ""}`} aria-label="Menu di động">
        <div className="mobile-nav-header">
          <div className="d-flex align-items-center gap-2">
            { }
            <img src={logo} alt="Logo" className="mobile-nav-logo" />
            <strong className="text-truncate" style={{ maxWidth: 180 }}>{site.tenSite}</strong>
          </div>
          <button className="mobile-nav-close" type="button" aria-label="Đóng menu" onClick={() => setMoMenu(false)}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="mobile-nav-body">
          <ul className="mobile-nav-list">
            <li><Link href="/" className="mobile-nav-link"><i className="fa-solid fa-house" /><span>Trang chủ</span></Link></li>
            <li className={`mobile-nav-item-has-sub ${moSub ? "open" : ""}`}>
              <div className="mobile-nav-link-row">
                <Link href="/SanPham/Index" className="mobile-nav-link"><i className="fa-solid fa-boxes-stacked" /><span>Sản phẩm</span></Link>
                <button type="button" className="mobile-nav-sub-toggle" aria-label="Mở danh mục" onClick={() => setMoSub((v) => !v)}><i className="fa-solid fa-chevron-down" /></button>
              </div>
              <div className="mobile-nav-submenu" style={moSub ? { display: "block", maxHeight: 400 } : undefined}>
                {LOAI.map((l) => <Link key={l.khoa} href={spUrl({ loai: l.khoa })}>{l.tenThuong}</Link>)}
              </div>
            </li>
            <li><Link href="/KhuyenMai/Index" className="mobile-nav-link"><i className="fa-solid fa-tags" /><span>Khuyến mãi</span></Link></li>
            <li><Link href="/BangTin" className="mobile-nav-link"><i className="fa-solid fa-newspaper" /><span>Bảng tin</span></Link></li>
            <li><Link href="/DonHang/Index" className="mobile-nav-link"><i className="fa-solid fa-clipboard-list" /><span>Đơn hàng</span></Link></li>
            <li><Link href="/Home/Contact" className="mobile-nav-link"><i className="fa-solid fa-phone" /><span>Liên hệ</span></Link></li>
            <li><Link href="/Home/ViewCart" className="mobile-nav-link"><i className="fa-solid fa-cart-shopping" /><span>Giỏ hàng ({cartCount})</span></Link></li>
          </ul>
          <div className="mobile-nav-account">
            {!user ? (
              <div className="d-flex flex-column gap-2">
                <Link href="/TaiKhoan/DangNhap" className="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2"><i className="fa-solid fa-user" /><span>Đăng nhập</span></Link>
                <Link href="/TaiKhoan/DangKy" className="btn btn-outline-secondary w-100 py-2"><span>Đăng ký</span></Link>
              </div>
            ) : (
              <div className="d-flex flex-column gap-1">
                <div className="p-2 mb-2 rounded bg-light d-flex align-items-center gap-2">
                  <i className="fa-solid fa-circle-user fa-2x text-success" />
                  <div className="overflow-hidden"><small className="text-muted d-block">Xin chào,</small><strong className="d-block text-truncate">{user.hoTen}</strong></div>
                </div>
                {adminLinks.map(([href, icon, text]) => <Link key={href} href={href} className="mobile-nav-link is-admin py-2"><i className={`fa-solid ${icon}`} /> {text}</Link>)}
                <Link href="/TaiKhoan/ThongTin" className="mobile-nav-link py-2"><i className="fa-solid fa-user-circle" /> Thông tin tài khoản</Link>
                <Link href="/TaiKhoan/DoiMatKhau" className="mobile-nav-link py-2"><i className="fa-solid fa-key" /> Đổi mật khẩu</Link>
                <button type="button" onClick={dangXuat} className="mobile-nav-link py-2 border-0 bg-transparent text-start"><i className="fa-solid fa-right-from-bracket" /> Đăng xuất</button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="footer-content">
        <div className="footer-section">
          <h4>THÔNG TIN LIÊN HỆ</h4>
          <p><i className="fa-solid fa-location-dot" /> 140 Lê Trọng Tấn, Tây Thạnh, Tân Phú, TP.HCM</p>
          <p><i className="fa-solid fa-phone" /> 0123456789</p>
          <p><i className="fa-solid fa-envelope" /> HUIT@gmail.com</p>
        </div>
        <div className="footer-section">
          <h4>DANH MỤC SẢN PHẨM</h4>
          {LOAI.map((l) => <Link key={l.khoa} href={spUrl({ loai: l.khoa })}>{l.tenThuong}</Link>)}
        </div>
        <div className="footer-section">
          <h4>HỖ TRỢ KHÁCH HÀNG</h4>
          {["Hướng dẫn mua hàng", "Chính sách bảo hành", "Chính sách đổi trả", "Câu hỏi thường gặp"].map((t) => <Link key={t} href="/">{t}</Link>)}
        </div>
      </div>
      <div className="footer-bottom"><p>&copy; {new Date().getFullYear()} Cửa hàng Cầu Lông HUIT. Bảo lưu mọi quyền.</p></div>
    </footer>
  );
}

/** Chatbot tư vấn nằm ở file riêng (components/Chatbot.tsx); xuất lại đây để layout của site giữ nguyên cách import. */
export { Chatbot } from "./Chatbot";
