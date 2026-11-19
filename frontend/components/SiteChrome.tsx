"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { giuFocusTrongVung } from "@/lib/bay-focus";
import { apiGet, apiPost } from "@/lib/api";
import { imgUrl, vnd } from "@/lib/format";
import { useApp } from "./AppProviders";
import { HoSoChip } from "./HoSoChoi";
import { useSoSanh } from "./so-sanh/so-sanh-store";
import { useSoVotDenHan } from "./tu-vot/tu-vot-store";

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

/** Trang hỗ trợ khách; nội dung ở app/(site)/ChinhSach. Chính sách chưa được chủ cửa hàng cung cấp thì trang nói rõ là đang cập nhật. */
const CHINH_SACH = [
  { slug: "huong-dan-mua-hang", ten: "Hướng dẫn mua hàng" },
  { slug: "bao-hanh", ten: "Chính sách bảo hành" },
  { slug: "doi-tra", ten: "Chính sách đổi trả" },
  { slug: "giao-hang", ten: "Chính sách giao hàng" },
  { slug: "cau-hoi-thuong-gap", ten: "Câu hỏi thường gặp" },
];

const GOI_Y_TIM = ["Vợt Yonex", "Giày Victor", "Áo Lining", "Quả cầu lông", "Quấn cán"];

/** Kết quả /api/san-pham/goi-y: tiền tố trên mảng từ không dấu, không có thì gần đúng theo bộ ba ký tự (backend catalog/tim-kiem.ts). */
interface GoiYTim {
  cheDo: "tien-to" | "gan-dung" | "trong";
  goiY: string | null;
  items: { id: string; tenSanPham: string; hinhAnhDaiDien: string; giaGoc: number; giaSauKhuyenMai: number }[];
}

/** Gợi ý khi gõ: chờ người dùng ngừng gõ 200 ms rồi mới hỏi; câu trả lời về muộn của từ khoá cũ bị bỏ. */
function useGoiYTim(tuKhoa: string): GoiYTim | null {
  const [kq, setKq] = useState<GoiYTim | null>(null);
  useEffect(() => {
    const q = tuKhoa.trim();
    if (q.length < 2) { setKq(null); return; }
    let conHieuLuc = true;
    const hen = setTimeout(() => {
      apiGet<GoiYTim>(`/san-pham/goi-y?q=${encodeURIComponent(q)}`).then((r) => { if (conHieuLuc) setKq(r); }).catch(() => { if (conHieuLuc) setKq(null); });
    }, 200);
    return () => { conHieuLuc = false; clearTimeout(hen); };
  }, [tuKhoa]);
  return kq;
}

const spUrl = (p: Record<string, string>) => `/SanPham/Index?${new URLSearchParams(p).toString()}`;

export function Header() {
  const { user, site, cartCount, setUser, flash } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [keyword, setKeyword] = useState("");
  const goiY = useGoiYTim(keyword);
  const [moMenu, setMoMenu] = useState(false);
  const nutMoMenu = useRef<HTMLButtonElement>(null);
  const nutDongMenu = useRef<HTMLButtonElement>(null);
  const nganKeo = useRef<HTMLElement>(null);
  const dongMenu = () => { setMoMenu(false); nutMoMenu.current?.focus(); };
  const [moUser, setMoUser] = useState(false);
  const userDropdown = useRef<HTMLDivElement>(null);
  const [loaiActive, setLoaiActive] = useState("Vot");
  const [moSub, setMoSub] = useState(false);
  const [menuDong, setMenuDong] = useState(false);

  // Menu di động mở: đưa focus vào menu; Escape ở bất cứ đâu trên trang đóng menu và trả focus về nút mở.
  useEffect(() => {
    if (!moMenu) return;
    nutDongMenu.current?.focus();
    const khiPhim = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMoMenu(false); nutMoMenu.current?.focus(); }
      else giuFocusTrongVung(e, nganKeo.current);
    };
    document.addEventListener("keydown", khiPhim);
    return () => document.removeEventListener("keydown", khiPhim);
  }, [moMenu]);

  // Menu người dùng mở: bấm ra ngoài hoặc nhấn Escape thì đóng (chỉ gắn listener khi đang mở).
  useEffect(() => {
    if (!moUser) return;
    const khiBam = (e: PointerEvent) => { if (!userDropdown.current?.contains(e.target as Node)) setMoUser(false); };
    const khiPhim = (e: KeyboardEvent) => { if (e.key === "Escape") setMoUser(false); };
    document.addEventListener("pointerdown", khiBam);
    document.addEventListener("keydown", khiPhim);
    return () => { document.removeEventListener("pointerdown", khiBam); document.removeEventListener("keydown", khiPhim); };
  }, [moUser]);

  // Đóng menu di động mỗi khi chuyển trang.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoMenu(false);
    setMoUser(false);
    (document.activeElement as HTMLElement | null)?.blur?.();
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
            ["/admin/san-pham", "fa-boxes-stacked", "Quản lý Sản phẩm"],
            ["/admin/don-hang", "fa-file-invoice", "Quản lý Đơn hàng"],
            ["/admin/ban-tin", "fa-newspaper", "Quản lý Bảng tin"],
            ["/admin/tran-dau", "fa-table-tennis-paddle-ball", "Quản lý Trận đấu"],
          ]
        : [];

  const logo = imgUrl(site.logo, "images/HUIT.jpg");
  const { muc: dsSoSanh } = useSoSanh();
  const votDenHan = useSoVotDenHan();
  const act = (p: string) => ((p === "/" ? pathname === "/" : pathname.startsWith(p)) ? "active" : "");

  return (
    <>
      <header className="main-header">
        <div className="sf-topbar">
          <div className="container sf-topbar-in">
            <div className="sf-topbar-left">
              {site.lienHe?.dienThoai
                ? <span><i className="fa-solid fa-phone-volume" aria-hidden="true" /> Hotline <a href={`tel:${site.lienHe.dienThoai.replace(/[^0-9+]/g, "")}`}>{site.lienHe.dienThoai}</a></span>
                : <span><i className="fa-solid fa-phone-volume" aria-hidden="true" /> <Link href="/Home/Contact">Liên hệ cửa hàng</Link></span>}
              <span className="d-none d-lg-inline-flex"><i className="fa-solid fa-truck-fast" aria-hidden="true" /> Đặt online, theo dõi đơn</span>
              <span className="d-none d-xl-inline-flex"><i className="fa-solid fa-wallet" aria-hidden="true" /> Thanh toán COD hoặc MoMo</span>
            </div>
            <div className="sf-topbar-right">
              <Link href="/DonHang/Index"><i className="fa-solid fa-box-open" aria-hidden="true" /> Theo dõi đơn hàng</Link>
              <Link href="/Home/Contact"><i className="fa-solid fa-location-dot" aria-hidden="true" /> Cửa hàng</Link>
            </div>
          </div>
        </div>
        <div className="header-top">
          <div className="header-brand-wrap">
            <button ref={nutMoMenu} className="mobile-toggle-btn" type="button" aria-label="Mở menu" aria-expanded={moMenu} aria-controls="mobile-nav-drawer" onClick={() => setMoMenu(true)}>
              <i className="fa-solid fa-bars" />
            </button>
            <div className="logo">
              <Link href="/" className="sf-brand">{ }<img src={logo} alt="Logo Cửa Hàng Cầu Lông" /><span className="sf-brand-text"><b>{site.tenSite}</b><small>Dụng cụ cầu lông</small></span></Link>
            </div>
          </div>
          <form className="search-form search-absolute" onSubmit={(e) => { e.preventDefault(); if (keyword.trim()) router.push(`/SanPham/TimKiem?keyword=${encodeURIComponent(keyword.trim())}`); }}>
            <label htmlFor="sf-tim-kiem" className="visually-hidden">Tìm kiếm sản phẩm</label>
            <input id="sf-tim-kiem" type="search" name="keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm kiếm sản phẩm..." className="search-input" autoComplete="off" enterKeyHint="search" />
            <button type="submit" className="search-btn" aria-label="Tìm kiếm"><i className="fa-solid fa-magnifying-glass" /></button>
            <div className="sf-suggest" aria-label="Gợi ý tìm kiếm" aria-live="polite">
              {goiY?.items.length ? (
                <>
                  {goiY.cheDo === "gan-dung" && goiY.goiY
                    ? <span>Có phải bạn muốn tìm <Link className="sf-suggest-sua" href={`/SanPham/TimKiem?keyword=${encodeURIComponent(goiY.goiY)}`}>{goiY.goiY}</Link></span>
                    : <span>Sản phẩm gợi ý</span>}
                  {goiY.items.map((sp) => (
                    <Link key={sp.id} href={`/Home/ChiTietSanPham/${sp.id}`} className="sf-suggest-sp">
                      { }<img src={imgUrl(sp.hinhAnhDaiDien)} alt="" width={40} height={40} />
                      <b>{sp.tenSanPham}</b>
                      <em>{vnd(sp.giaSauKhuyenMai)}</em>
                    </Link>
                  ))}
                </>
              ) : (
                <>
                  <span>{goiY && keyword.trim() ? "Không có sản phẩm khớp. Tìm nhiều" : "Tìm nhiều"}</span>
                  {GOI_Y_TIM.map((t) => <Link key={t} href={`/SanPham/TimKiem?keyword=${encodeURIComponent(t)}`}><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> {t}</Link>)}
                </>
              )}
            </div>
          </form>
          <HoSoChip />
          <div className="header-actions">
            <div className="account-section">
              {!user ? (
                <div className="auth-buttons">
                  <Link href="/TaiKhoan/DangNhap" className="auth-btn login-btn"><i className="fa-solid fa-user" /><span>Đăng nhập</span></Link>
                  <Link href="/TaiKhoan/DangKy" className="auth-btn register-btn"><span>Đăng ký</span></Link>
                </div>
              ) : (
                <div ref={userDropdown} className="user-dropdown" onMouseLeave={() => setMoUser(false)}>
                  <button className="user-btn" type="button" onClick={() => setMoUser((v) => !v)}>
                    <i className="fa-solid fa-user" /><span>Xin chào, {user.hoTen}</span><i className="fa-solid fa-chevron-down" />
                  </button>
                  <div className="user-menu" onClick={() => setMoUser(false)} style={moUser ? { display: "block", opacity: 1, visibility: "visible" } : undefined}>
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
            <Link href="/Home/ViewCart" className="cart-btn" data-cart-target aria-label={`Giỏ hàng, ${cartCount} sản phẩm`} title="Giỏ hàng">
              <i className="fa-solid fa-cart-shopping" aria-hidden="true" /><span key={cartCount} className="cart-count" aria-hidden="true">{cartCount}</span><span className="visually-hidden" role="status">{cartCount} sản phẩm trong giỏ hàng</span>
            </Link>
          </div>
        </div>
        <nav className="main-nav">
          <ul>
            <li className={act("/")}><Link href="/">TRANG CHỦ</Link></li>
            <li className={`mega-menu-item ${act("/SanPham")}${menuDong ? " is-shut" : ""}`} onClick={() => { setMenuDong(true); (document.activeElement as HTMLElement | null)?.blur?.(); }} onMouseEnter={() => setMenuDong(false)}>
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
            <li className={`${act("/KhuyenMai")} nav-hot`}><Link href="/KhuyenMai/Index">KHUYẾN MÃI</Link></li>
            <li className={act("/BangTin")}><Link href="/BangTin">BẢNG TIN</Link></li>
            <li className={act("/DonHang")}><Link href="/DonHang/Index">ĐƠN HÀNG</Link></li>
            <li className={act("/so-sanh")}><Link href="/so-sanh" aria-label={dsSoSanh.length ? `SO SÁNH, đã chọn ${dsSoSanh.length} vợt` : "SO SÁNH"}><span className="nav-co-dem">SO SÁNH{dsSoSanh.length > 0 && <b className="nav-dem" aria-hidden="true">{dsSoSanh.length}</b>}</span></Link></li>
            {/* Landing 3D là trang HTML tĩnh ngoài React nên dùng <a> (tải trang đầy đủ), không dùng Link */}
            <li className={act("/trai-nghiem")}><a href="/trai-nghiem">TRẢI NGHIỆM 3D</a></li>
            <li className={act("/tu-vot")}><Link href="/tu-vot" aria-label={votDenHan ? `TỦ VỢT, ${votDenHan} vợt đến lịch nhắc` : "TỦ VỢT"}><span className="nav-co-dem">TỦ VỢT{votDenHan > 0 && <b className="nav-dem nav-dem-nhac" aria-hidden="true">{votDenHan}</b>}</span></Link></li>
            <li className={act("/Home/Contact")}><Link href="/Home/Contact">LIÊN HỆ</Link></li>
          </ul>
        </nav>
      </header>

      <div className={`mobile-nav-backdrop ${moMenu ? "show active open" : ""}`} onClick={dongMenu} />
      <aside id="mobile-nav-drawer" ref={nganKeo} className={`mobile-nav-drawer ${moMenu ? "show active open" : ""}`} aria-label="Menu di động">
        <div className="mobile-nav-header">
          <div className="d-flex align-items-center gap-2">
            { }
            <img src={logo} alt="Logo" className="mobile-nav-logo" />
            <strong className="text-truncate" style={{ maxWidth: 180 }}>{site.tenSite}</strong>
          </div>
          <button ref={nutDongMenu} className="mobile-nav-close" type="button" aria-label="Đóng menu" onClick={dongMenu}><i className="fa-solid fa-xmark" /></button>
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
            <li><Link href="/so-sanh" className="mobile-nav-link"><i className="fa-solid fa-code-compare" /><span>So sánh vợt{dsSoSanh.length > 0 ? ` (${dsSoSanh.length})` : ""}</span></Link></li>
            <li><a href="/trai-nghiem" className="mobile-nav-link"><i className="fa-solid fa-cube" /><span>Trải nghiệm 3D</span></a></li>
            <li><Link href="/tu-vot" className="mobile-nav-link"><i className="fa-solid fa-box-archive" /><span>Tủ vợt{votDenHan > 0 ? ` (${votDenHan} đến lịch nhắc)` : ""}</span></Link></li>
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
  const { site } = useApp();
  const lh = site.lienHe;
  const coLienHe = !!(lh?.diaChi || lh?.dienThoai || lh?.email || lh?.gioMoCua);
  return (
    <>
    <div className="sf-trust-wrap">
        <ul className="sf-trust" aria-label="Cam kết của cửa hàng">
          {[
            ["fa-medal", "Thương hiệu trong cửa hàng", "Yonex, Li-Ning, Victor, Mizuno"],
            ["fa-truck-fast", "Đặt online", "Theo dõi trạng thái đơn sau khi đặt"],
            ["fa-wallet", "Thanh toán linh hoạt", "Trả khi nhận hàng (COD) hoặc ví MoMo"],
            ["fa-robot", "Trợ lý AI tư vấn", "Gợi ý vợt, giày theo ngân sách của bạn"],
          ].map(([icon, ten, mota]) => (
            <li key={ten}><span><i className={`fa-solid ${icon}`} aria-hidden="true" /></span><div><b>{ten}</b><small>{mota}</small></div></li>
          ))}
        </ul>
    </div>
    <footer className="sf-footer">
      <div className="footer-content">
        <div className="footer-section footer-brand">
          <h4>CỬA HÀNG CẦU LÔNG</h4>
          <p className="footer-about">Dụng cụ, trang phục và phụ kiện cầu lông. Chọn theo ngân sách, theo lối chơi — và có người đồng hành tư vấn.</p>
          <div className="footer-pay"><span>Thanh toán</span><b>COD</b>{ }<img src="/images/momo-logo.png" alt="MoMo" height={22} /></div>
        </div>
        <div className="footer-section">
          <h4>THÔNG TIN LIÊN HỆ</h4>
          {lh?.diaChi && <p><i className="fa-solid fa-location-dot" aria-hidden="true" /> {lh.diaChi}</p>}
          {lh?.dienThoai && <p><i className="fa-solid fa-phone" aria-hidden="true" /> <a href={`tel:${lh.dienThoai.replace(/[^0-9+]/g, "")}`}>{lh.dienThoai}</a></p>}
          {lh?.email && <p><i className="fa-solid fa-envelope" aria-hidden="true" /> <a href={`mailto:${lh.email}`}>{lh.email}</a></p>}
          {lh?.gioMoCua && <p><i className="fa-solid fa-clock" aria-hidden="true" /> {lh.gioMoCua}</p>}
          {!coLienHe && <p>Thông tin liên hệ đang được cập nhật.</p>}
          <Link href="/Home/Contact">Trang liên hệ</Link>
        </div>
        <div className="footer-section">
          <h4>DANH MỤC SẢN PHẨM</h4>
          {LOAI.map((l) => <Link key={l.khoa} href={spUrl({ loai: l.khoa })}>{l.tenThuong}</Link>)}
          <Link href="/KhuyenMai/Index">Khuyến mãi đang chạy</Link>
        </div>
        <div className="footer-section">
          <h4>HỖ TRỢ KHÁCH HÀNG</h4>
          {CHINH_SACH.map((c) => <Link key={c.slug} href={`/ChinhSach/${c.slug}`}>{c.ten}</Link>)}
          <Link href="/DonHang/Index">Theo dõi đơn hàng</Link>
        </div>
      </div>
      <div className="footer-bottom"><p>&copy; {new Date().getFullYear()} Cửa hàng Cầu Lông HUIT. Bảo lưu mọi quyền.</p></div>
    </footer>
    </>
  );
}

/** Chatbot tư vấn nằm ở file riêng (components/Chatbot.tsx); xuất lại đây để layout của site giữ nguyên cách import. */
export { Chatbot } from "./Chatbot";
