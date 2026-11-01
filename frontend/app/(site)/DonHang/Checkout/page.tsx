"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { ErrorBox, Loading, Page } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { GioHangV } from "@/lib/types";

interface KhachHang { hoTen: string; soDienThoai?: string; diaChi?: string }

export default function CheckoutPage() {
  const { user, ready, setCartCount, flash } = useApp();
  const router = useRouter();
  const gio = useApi<GioHangV>(ready && user ? "/don-hang/checkout" : null);
  const kh = useApi<KhachHang>(ready && user ? "/auth/thong-tin" : null);
  const [f, setF] = useState({ hoTenNhan: "", soDienThoaiNhan: "", diaChiGiao: "", ghiChu: "" });
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/TaiKhoan/DangNhap?returnUrl=/DonHang/Checkout");
  }, [ready, user, router]);

  useEffect(() => {
    if (kh.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setF((x) => ({ ...x, hoTenNhan: kh.data!.hoTen, soDienThoaiNhan: kh.data!.soDienThoai ?? "", diaChiGiao: kh.data!.diaChi ?? "" }));
    }
  }, [kh.data]);

  useEffect(() => {
    if (gio.status === 400) router.replace("/Home/ViewCart");
  }, [gio.status, router]);

  const dat = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const gui = async (kieu: "cod" | "momo") => {
    setLoi(null);
    setDang(true);
    try {
      if (kieu === "cod") {
        const r = await apiPost<{ soDonHang: number; message: string }>("/don-hang/checkout", f);
        setCartCount(0);
        flash("success", r.message);
        router.push("/DonHang/Index");
      } else {
        const r = await apiPost<{ payUrl: string }>("/don-hang/momo", f);
        window.location.href = r.payUrl;
      }
    } catch (e) {
      setLoi(loiTuApi(e));
      setDang(false);
    }
  };

  if (!ready || gio.loading) return <Page><Loading /></Page>;
  if (gio.error || !gio.data) return <Page><ErrorBox message={gio.error ?? "Giỏ hàng trống"} /></Page>;

  return (
    <Page>
      <h2 className="page-title mb-3">Thanh toán</h2>
      {loi && <ErrorBox message={loi} />}
      <div className="row g-4">
        <div className="col-lg-7">
          <form className="card" onSubmit={(e) => { e.preventDefault(); void gui("cod"); }}><div className="card-body">
            <h5 className="mb-3">Thông tin nhận hàng</h5>
            <div className="mb-3"><label className="form-label">Họ tên người nhận</label><input className="form-control" required maxLength={100} value={f.hoTenNhan} onChange={dat("hoTenNhan")} /></div>
            <div className="mb-3"><label className="form-label">Số điện thoại</label><input className="form-control" required pattern="0[0-9]{9,10}" title="Bắt đầu bằng 0, gồm 10–11 chữ số" value={f.soDienThoaiNhan} onChange={dat("soDienThoaiNhan")} /></div>
            <div className="mb-3"><label className="form-label">Địa chỉ giao hàng</label><input className="form-control" required maxLength={255} value={f.diaChiGiao} onChange={dat("diaChiGiao")} /></div>
            <div className="mb-3"><label className="form-label">Ghi chú</label><textarea className="form-control" rows={3} maxLength={400} value={f.ghiChu} onChange={dat("ghiChu")} /></div>
            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-primary" type="submit" disabled={dang}><i className="fa-solid fa-truck" /> Đặt hàng (COD)</button>
              <button className="btn btn-danger" type="button" disabled={dang} onClick={(e) => { const form = (e.currentTarget.closest("form") as HTMLFormElement); if (form.reportValidity()) void gui("momo"); }}>Thanh toán MoMo</button>
            </div>
          </div></form>
        </div>
        <div className="col-lg-5">
          <div className="card"><div className="card-body">
            <h5 className="mb-3">Đơn hàng của bạn</h5>
            {gio.data.items.map((it) => (
              <div key={it.id} className="d-flex justify-content-between align-items-start gap-3 small mb-2">
                <span>{it.tenSanPham} <span className="text-muted">({[it.bienThe.mau?.tenMau, it.bienThe.size?.tenSize].filter(Boolean).join(", ")}) × {it.soLuong}</span></span>
                <span className="text-nowrap fw-semibold">{vnd(it.thanhTien)}</span>
              </div>
            ))}
            <hr /><div className="d-flex justify-content-between"><strong>Tổng cộng</strong><strong className="text-danger">{vnd(gio.data.tongTien)}</strong></div>
          </div></div>
        </div>
      </div>
    </Page>
  );
}
