"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/AppProviders";
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
    <Page>
      <h2 className="page-title mb-3">Giỏ hàng</h2>
      {data.items.length === 0 ? <Empty message="Giỏ hàng của bạn đang trống." linkUrl="/SanPham/Index" linkText="Tiếp tục mua sắm" /> : (
        <div className="row g-4">
          <div className="col-lg-8">
            {data.items.map((it) => (
              <div key={it.id} className="d-flex gap-3 border rounded bg-white p-3 mb-2">
                { }
                <img src={imgUrl(it.bienThe.hinhAnh)} alt="" width={90} height={90} style={{ objectFit: "contain" }} />
                <div className="flex-grow-1">
                  <Link href={`/Home/ChiTietSanPham/${it.sanPhamId}`} className="fw-semibold text-decoration-none">{it.tenSanPham}</Link>
                  <div className="small text-muted">{[it.bienThe.mau?.tenMau, it.bienThe.size?.tenSize].filter(Boolean).join(" · ")} · SKU {it.bienThe.sku}</div>
                  <div className="text-danger fw-semibold">{vnd(it.donGia)}</div>
                  {!it.sanPhamConKinhDoanh && <div className="text-danger small">Sản phẩm không còn kinh doanh</div>}
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <input type="number" min={1} max={Math.min(100, it.bienThe.soLuongTon)} defaultValue={it.soLuong} className="form-control form-control-sm" style={{ width: 80 }}
                      onBlur={(e) => { const q = Number(e.target.value); if (q >= 1 && q !== it.soLuong) void doiSoLuong(it.id, q); }} aria-label="Số lượng" />
                    <button className="btn btn-sm btn-outline-danger" onClick={() => xoa(it.id)}><i className="fa-solid fa-trash" /> Xóa</button>
                  </div>
                </div>
                <div className="fw-bold text-nowrap">{vnd(it.thanhTien)}</div>
              </div>
            ))}
          </div>
          <div className="col-lg-4">
            <div className="card"><div className="card-body">
              <div className="d-flex justify-content-between mb-2"><span>Số lượng</span><strong>{data.tongSoLuong}</strong></div>
              <div className="d-flex justify-content-between mb-3"><span>Tổng tiền</span><strong className="text-danger fs-5">{vnd(data.tongTien)}</strong></div>
              <Link href="/DonHang/Checkout" className="btn btn-primary w-100">Tiến hành thanh toán</Link>
            </div></div>
          </div>
        </div>
      )}
    </Page>
  );
}
