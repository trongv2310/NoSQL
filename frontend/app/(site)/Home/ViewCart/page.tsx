"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/AppProviders";
import { PageHero } from "@/components/PageHero";
import { CheckoutSteps } from "@/components/Steps";
import { Empty, ErrorBox, Loading, Page } from "@/components/Ui";
import { apiDelete, api, loiTuApi } from "@/lib/api";
import { imgUrl, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { GioHangV } from "@/lib/types";

export default function GioHangPage() {
  const { user, ready, setCartCount, flash } = useApp();
  const router = useRouter();
  const { data, error, loading, reload } = useApi<GioHangV>(ready && user ? "/gio-hang" : null);

  useEffect(() => {
    if (ready && !user) router.replace("/TaiKhoan/DangNhap?returnUrl=/Home/ViewCart");
  }, [ready, user, router]);

  useEffect(() => {
    if (data) setCartCount(data.tongSoLuong);
  }, [data, setCartCount]);

  const doiSoLuong = async (id: string, quantity: number) => {
    try {
      await api(`/gio-hang/${id}`, { method: "PATCH", body: { quantity } });
      await reload();
    } catch (e) {
      flash("danger", loiTuApi(e));
      await reload();
    }
  };
  const xoa = async (id: string) => {
    await apiDelete(`/gio-hang/${id}`);
    flash("success", "Đã xóa sản phẩm khỏi giỏ hàng.");
    await reload();
  };

  if (!ready || loading) return <Page><Loading /></Page>;
  if (error || !data) return <Page><ErrorBox message={error ?? "Lỗi tải giỏ hàng"} /></Page>;

  return (
    <>
    <PageHero compact tone="green" kicker="Giỏ hàng" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Giỏ hàng" }]}
      title={<>Giỏ hàng <em>của bạn</em></>} sub={data.items.length ? `${data.tongSoLuong} sản phẩm đang chờ bạn chốt đơn.` : "Chưa có sản phẩm nào trong giỏ."} />
    <Page className="ct-wrap">
      <CheckoutSteps buoc={1} />
      {data.items.length === 0 ? <Empty message="Giỏ hàng của bạn đang trống." linkUrl="/SanPham/Index" linkText="Tiếp tục mua sắm" /> : (
        <div className="row g-4">
          <div className="col-lg-8">
            {data.items.map((it) => (
              <div key={it.id} className="cart-item sf-reveal">
                <span className="cart-item-thumb">
                  { }
                  <img src={imgUrl(it.bienThe.hinhAnh)} alt="" />
                </span>
                <div className="cart-item-body">
                  <Link href={`/Home/ChiTietSanPham/${it.sanPhamId}`} className="cart-item-name">{it.tenSanPham}</Link>
                  <div className="small text-muted">{[it.bienThe.mau?.tenMau, it.bienThe.size?.tenSize].filter(Boolean).join(" · ")} · SKU {it.bienThe.sku}</div>
                  <div className="small">Đơn giá: <span className="text-danger fw-semibold">{vnd(it.donGia)}</span></div>
                  {!it.sanPhamConKinhDoanh && <div className="text-danger small">Sản phẩm không còn kinh doanh</div>}
                  <div className="cart-item-actions">
                    <input type="number" min={1} max={Math.min(100, it.bienThe.soLuongTon)} defaultValue={it.soLuong} className="form-control form-control-sm" style={{ width: 80 }}
                      onBlur={(e) => { const q = Number(e.target.value); if (q >= 1 && q !== it.soLuong) void doiSoLuong(it.id, q); }} aria-label="Số lượng" />
                    <button className="btn btn-sm btn-outline-danger" onClick={() => xoa(it.id)}><i className="fa-solid fa-trash" /> Xóa</button>
                  </div>
                </div>
                <div className="cart-item-total">{vnd(it.thanhTien)}</div>
              </div>
            ))}
          </div>
          <div className="col-lg-4">
            <div className="card cart-summary"><div className="card-body">
              <h3 className="ct-sum-title">Tóm tắt đơn hàng</h3>
              <div className="d-flex justify-content-between mb-2"><span>Số lượng</span><strong>{data.tongSoLuong}</strong></div>
              <div className="d-flex justify-content-between mb-3"><span>Tổng tiền</span><strong className="text-danger fs-5">{vnd(data.tongTien)}</strong></div>
              <Link href="/DonHang/Checkout" className="btn btn-primary w-100 ct-pay-btn">Tiến hành thanh toán <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
              <Link href="/SanPham/Index" className="ct-continue"><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Tiếp tục mua sắm</Link>
              <ul className="ct-assure"><li><i className="fa-solid fa-wallet" aria-hidden="true" /> Thanh toán COD hoặc MoMo</li><li><i className="fa-solid fa-shield-halved" aria-hidden="true" /> Giá đã gồm khuyến mãi đang áp dụng</li></ul>
            </div></div>
          </div>
        </div>
      )}
    </Page>
    </>
  );
}
