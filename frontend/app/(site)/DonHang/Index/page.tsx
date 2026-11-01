"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/AppProviders";
import { PageHero } from "@/components/PageHero";
import { ChipTrangThai, OrderTrack } from "@/components/Steps";
import { Empty, ErrorBox, Loading, Page } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { imgUrl, ngayGio, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { DonHangV } from "@/lib/types";

const KHACH_DUOC_HUY = ["Chờ xác nhận", "Chờ thanh toán MoMo", "Đang xử lý"];

export default function DonHangCuaToiPage() {
  const { user, ready, flash } = useApp();
  const router = useRouter();
  const { data, error, loading, reload } = useApi<DonHangV[]>(ready && user ? "/don-hang" : null);

  useEffect(() => {
    if (ready && !user) router.replace("/TaiKhoan/DangNhap?returnUrl=/DonHang/Index");
  }, [ready, user, router]);

  const huy = async (so: number) => {
    if (!confirm(`Bạn chắc chắn muốn hủy đơn hàng #${so}?`)) return;
    try {
      const r = await apiPost<{ message: string }>(`/don-hang/${so}/huy`);
      flash("success", r.message);
      await reload();
    } catch (e) {
      flash("danger", `Lỗi: ${loiTuApi(e)}`);
    }
  };

  if (!ready || loading) return <Page><Loading /></Page>;
  if (error || !data) return <Page><ErrorBox message={error ?? "Lỗi tải đơn hàng"} /></Page>;
  const dangXuLy = data.filter((d) => d.trangThai !== "Đã hoàn thành" && !d.trangThai.startsWith("Đã hủy")).length;
  return (
    <>
      <PageHero compact tone="green" kicker="Tài khoản" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Đơn hàng của tôi" }]}
        title={<>Đơn hàng <em>của tôi</em></>} sub="Theo dõi trạng thái từng đơn và xem lại những gì bạn đã mua."
        stats={[{ value: data.length, nhan: "Tổng số đơn" }, { value: dangXuLy, nhan: "Đang xử lý" }]} />
      <Page className="od-wrap">
        {data.length === 0 ? <Empty message="Bạn chưa có đơn hàng nào." linkUrl="/SanPham/Index" linkText="Mua sắm ngay" /> : data.map((d) => (
          <article key={d.id} className="od-card sf-reveal">
            <header className="od-head">
              <div><strong>Đơn #{d.soDonHang}</strong><small><i className="fa-regular fa-clock" aria-hidden="true" /> {ngayGio(d.ngayDat)}</small></div>
              <ChipTrangThai t={d.trangThai} />
            </header>
            <OrderTrack trangThai={d.trangThai} />
            <ul className="od-items">
              {d.chiTiet.map((c) => (
                <li key={c.id}>
                  { }
                  <img src={imgUrl(c.hinhAnh)} alt="" loading="lazy" />
                  <div><b>{c.tenSanPham}</b><small>{[c.tenMau, c.tenSize].filter(Boolean).join(" · ")}{c.tenMau || c.tenSize ? " · " : ""}SL {c.soLuong}</small></div>
                  <span>{vnd(c.thanhTien)}</span>
                </li>
              ))}
              {d.soDong > d.chiTiet.length && <li className="od-more">… và {d.soDong - d.chiTiet.length} sản phẩm khác</li>}
            </ul>
            <div className="od-foot">
              <div><small>Tổng thanh toán</small><strong>{vnd(d.tongTienSauGiam)}</strong></div>
              <div className="od-actions">
                {KHACH_DUOC_HUY.includes(d.trangThai) && <button className="od-btn is-danger" onClick={() => huy(d.soDonHang)}>Hủy đơn</button>}
                <Link href={`/DonHang/Details/${d.soDonHang}`} className="od-btn is-solid">Chi tiết <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
              </div>
            </div>
          </article>
        ))}
      </Page>
    </>
  );
}
