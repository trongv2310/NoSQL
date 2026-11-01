"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/AppProviders";
import { PageHero } from "@/components/PageHero";
import { ErrorBox, Loading, Page } from "@/components/Ui";
import { ngay } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export default function ThongTinPage() {
  const { user, ready } = useApp();
  const router = useRouter();
  const { data, error, loading } = useApi<{ hoTen: string; email: string; soDienThoai: string; diaChi: string; ngayTao: string }>(ready && user ? "/auth/thong-tin" : null);

  useEffect(() => {
    if (ready && !user) router.replace("/TaiKhoan/DangNhap?returnUrl=/TaiKhoan/ThongTin");
  }, [ready, user, router]);

  if (!ready || loading) return <Page><Loading /></Page>;
  if (error || !data) return <Page><ErrorBox message={error ?? "Không có thông tin"} /></Page>;
  const dong: [string, string, string][] = [
    ["fa-user", "Tên đăng nhập", user?.tenDangNhap ?? "—"],
    ["fa-envelope", "Email", data.email],
    ["fa-phone", "Điện thoại", data.soDienThoai || "—"],
    ["fa-location-dot", "Địa chỉ", data.diaChi || "—"],
    ["fa-calendar-check", "Ngày tạo tài khoản", ngay(data.ngayTao)],
  ];
  return (
    <>
      <PageHero compact tone="green" kicker="Tài khoản" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Thông tin tài khoản" }]} title={<>Xin chào, <em>{data.hoTen}</em></>} sub="Thông tin dùng để nhận hàng và liên hệ khi cần." />
      <Page className="pf-wrap">
        <div className="pf-grid">
          <section className="pf-card sf-reveal">
            <div className="pf-head"><span className="pf-avatar" aria-hidden="true">{data.hoTen.trim().charAt(0).toUpperCase()}</span><div><strong>{data.hoTen}</strong><small>Thành viên cửa hàng</small></div></div>
            <dl className="pf-list">
              {dong.map(([icon, nhan, gt]) => <div key={nhan}><dt><i className={`fa-solid ${icon}`} aria-hidden="true" /> {nhan}</dt><dd>{gt}</dd></div>)}
            </dl>
          </section>
          <aside className="pf-side">
            <Link href="/DonHang/Index" className="pf-link sf-reveal"><span><i className="fa-solid fa-box-open" aria-hidden="true" /></span><div><b>Đơn hàng của tôi</b><small>Theo dõi trạng thái và lịch sử mua hàng</small></div><i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
            <Link href="/TaiKhoan/DoiMatKhau" className="pf-link sf-reveal"><span><i className="fa-solid fa-key" aria-hidden="true" /></span><div><b>Đổi mật khẩu</b><small>Giữ tài khoản của bạn an toàn</small></div><i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
            <Link href="/Home/ViewCart" className="pf-link sf-reveal"><span><i className="fa-solid fa-cart-shopping" aria-hidden="true" /></span><div><b>Giỏ hàng</b><small>Xem sản phẩm bạn đã chọn</small></div><i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
          </aside>
        </div>
      </Page>
    </>
  );
}
