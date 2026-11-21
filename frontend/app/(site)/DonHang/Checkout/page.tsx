"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { PageHero } from "@/components/PageHero";
import { CheckoutSteps } from "@/components/Steps";
import { ErrorBox, Loading, Page } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { vnd } from "@/lib/format";
import { coDuLieuCanDongBo } from "@/lib/gio-khach";
import { useApi } from "@/lib/hooks";
import type { GioHangV } from "@/lib/types";

interface KhachHang { hoTen: string; soDienThoai?: string; diaChi?: string }
type PhuongThuc = "cod" | "momo";

const PHUONG_THUC: { khoa: PhuongThuc; icon: string; ten: string; mota: string }[] = [
  { khoa: "cod", icon: "fa-money-bill-wave", ten: "Thanh toán khi nhận hàng (COD)", mota: "Trả tiền mặt khi nhận hàng." },
  { khoa: "momo", icon: "fa-wallet", ten: "Ví MoMo", mota: "Bạn sẽ được chuyển sang cổng MoMo để hoàn tất thanh toán." },
];

export default function CheckoutPage() {
  const { user, ready, setCartCount, flash, dongBo, thuLaiDongBo } = useApp();
  const router = useRouter();
  // Chưa xong việc gộp giỏ khách vào tài khoản (đang chạy, bị lỗi, hoặc sắp chạy: còn dữ liệu chờ) thì CHƯA tải tóm tắt đơn:
  // giỏ tài khoản lúc này còn thiếu hàng, thậm chí rỗng (khi đó server trả 400 và trang sẽ bị đẩy về giỏ hàng, mất returnUrl Checkout).
  // Đọc kho giỏ trực tiếp để chặn ngay từ lần render đầu, trước cả khi lượt đồng bộ kịp bắt đầu.
  const choDongBo = !!user?.khachHangId && (dongBo.trangThai !== "rong" || coDuLieuCanDongBo(user.id));
  const gio = useApi<GioHangV>(ready && user && !choDongBo ? "/don-hang/checkout" : null);
  const kh = useApi<KhachHang>(ready && user ? "/auth/thong-tin" : null);
  const [f, setF] = useState({ hoTenNhan: "", soDienThoaiNhan: "", diaChiGiao: "", ghiChu: "" });
  const [pt, setPt] = useState<PhuongThuc>("cod");
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const khoaGui = useRef(false);

  useEffect(() => {
    if (ready && !user) router.replace("/TaiKhoan/DangNhap?returnUrl=/DonHang/Checkout");
  }, [ready, user, router]);

  useEffect(() => {
    if (kh.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setF((x) => ({ ...x, hoTenNhan: kh.data!.hoTen, soDienThoaiNhan: kh.data!.soDienThoai ?? "", diaChiGiao: kh.data!.diaChi ?? "" }));
    }
  }, [kh.data]);

  // Giỏ trống: API trả 200 với items rỗng (server cũ trả 400) → quay về trang giỏ hàng.
  const gioTrong = gio.status === 400 || (!!gio.data && gio.data.items.length === 0);
  useEffect(() => {
    if (gioTrong) router.replace("/Home/ViewCart");
  }, [gioTrong, router]);

  const dat = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    if (khoaGui.current) return;
    khoaGui.current = true;
    setLoi(null);
    setDang(true);
    try {
      if (pt === "cod") {
        const r = await apiPost<{ soDonHang: number; message: string }>("/don-hang/checkout", f);
        setCartCount(0);
        flash("success", r.message);
        router.push(`/DonHang/Details/${r.soDonHang}?moi=1`);
      } else {
        const r = await apiPost<{ payUrl: string }>("/don-hang/momo", f);
        window.location.href = r.payUrl;
      }
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
      khoaGui.current = false;
    }
  };

  if (!ready || !user) return <Page><Loading /></Page>; // chưa đăng nhập: đang chuyển sang trang đăng nhập (xem effect phía trên)
  if (choDongBo) {
    // Giữ nguyên trang Thanh toán (và returnUrl) trong lúc chờ; lỗi thì cho thử lại và KHÔNG cho đặt hàng.
    return (
      <Page className="ct-wrap">
        <CheckoutSteps buoc={2} />
        {dongBo.trangThai === "loi" ? (
          <p className="cart-banner is-bad" role="alert">
            Chưa đồng bộ được giỏ hàng bạn thêm trước khi đăng nhập: {dongBo.loi}. Đơn hàng chưa thể tạo cho tới khi giỏ được đồng bộ. Giỏ vẫn được giữ lại.{" "}
            <button type="button" className="cart-link-btn" onClick={thuLaiDongBo}>Thử lại</button>
          </p>
        ) : (
          <div role="status" aria-live="polite"><Loading text="Đang chuyển giỏ hàng của bạn vào tài khoản..." /></div>
        )}
      </Page>
    );
  }
  // Chưa có dữ liệu giỏ mà cũng chưa có lỗi (đang tải, hoặc vừa hết chờ đồng bộ và lượt tải đầu chưa bắt đầu): vẫn là đang tải.
  if ((!gio.data && !gio.error) || gioTrong) return <Page><Loading /></Page>;
  if (gio.error || !gio.data) return <Page><ErrorBox message={gio.error ?? "Giỏ hàng trống"} /></Page>;

  const dongLoi = gio.data.items.filter((it) => !it.sanPhamConKinhDoanh || it.bienThe.soLuongTon < it.soLuong);
  const dangDongBo = dongBo.trangThai !== "rong";
  const khongDatDuoc = dongLoi.length > 0 || dangDongBo;

  return (
    <>
    <PageHero compact tone="green" kicker="Thanh toán" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Giỏ hàng", href: "/Home/ViewCart" }, { nhan: "Thanh toán" }]}
      title={<>Hoàn tất <em>đơn hàng</em></>} sub="Kiểm tra thông tin nhận hàng và chọn cách thanh toán phù hợp." />
    <Page className="ct-wrap">
      <CheckoutSteps buoc={2} />
      {loi && <ErrorBox message={loi} />}
      {dongBo.trangThai === "dang" && <p className="cart-banner" role="status"><i className="fa-solid fa-rotate" aria-hidden="true" /> Đang chuyển giỏ hàng bạn thêm trước khi đăng nhập vào tài khoản...</p>}
      {dongBo.trangThai === "loi" && (
        <p className="cart-banner is-bad" role="alert">
          Chưa đồng bộ được giỏ hàng bạn thêm trước khi đăng nhập: {dongBo.loi}. Hãy thử lại để đơn hàng có đủ sản phẩm.{" "}
          <button type="button" className="cart-link-btn" onClick={thuLaiDongBo}>Thử lại</button>
        </p>
      )}
      {dongLoi.length > 0 && (
        <p className="cart-banner is-bad" role="alert">
          Có sản phẩm hết hàng, ngừng kinh doanh hoặc vượt tồn kho nên chưa đặt được. <Link href="/Home/ViewCart">Quay lại giỏ hàng để chỉnh</Link>.
        </p>
      )}
      <form onSubmit={gui}>
        <div className="row g-4">
          <div className="col-lg-7">
            <div className="card ct-form"><div className="card-body">
              <h2 className="ct-card-title"><i className="fa-solid fa-location-dot" aria-hidden="true" /> Thông tin nhận hàng</h2>
              <div className="mb-3"><label className="form-label" htmlFor="ct-ten">Họ tên người nhận</label><input id="ct-ten" className="form-control" required maxLength={100} autoComplete="name" value={f.hoTenNhan} onChange={dat("hoTenNhan")} /></div>
              <div className="mb-3"><label className="form-label" htmlFor="ct-sdt">Số điện thoại</label><input id="ct-sdt" className="form-control" required inputMode="tel" autoComplete="tel" pattern="0[0-9]{9,10}" title="Bắt đầu bằng 0, gồm 10–11 chữ số" value={f.soDienThoaiNhan} onChange={dat("soDienThoaiNhan")} /></div>
              <div className="mb-3"><label className="form-label" htmlFor="ct-dc">Địa chỉ giao hàng</label><input id="ct-dc" className="form-control" required maxLength={255} autoComplete="street-address" value={f.diaChiGiao} onChange={dat("diaChiGiao")} /></div>
              <div className="mb-3"><label className="form-label" htmlFor="ct-gc">Ghi chú</label><textarea id="ct-gc" className="form-control" rows={3} maxLength={400} value={f.ghiChu} onChange={dat("ghiChu")} /></div>
            </div></div>
            <fieldset className="card ct-form mt-4 ct-pay"><div className="card-body">
              <legend className="ct-card-title"><i className="fa-solid fa-credit-card" aria-hidden="true" /> Phương thức thanh toán</legend>
              <div className="ct-pay-grid">
                {PHUONG_THUC.map((p) => (
                  <label key={p.khoa} className={`ct-pay-opt${pt === p.khoa ? " is-on" : ""}`}>
                    <input type="radio" name="phuong-thuc" value={p.khoa} checked={pt === p.khoa} onChange={() => setPt(p.khoa)} disabled={dang} />
                    <span className="ct-pay-icon" aria-hidden="true"><i className={`fa-solid ${p.icon}`} /></span>
                    <span className="ct-pay-text"><b>{p.ten}</b><small>{p.mota}</small></span>
                  </label>
                ))}
              </div>
            </div></fieldset>
          </div>
          <div className="col-lg-5">
            <div className="card ct-summary"><div className="card-body">
              <h2 className="ct-card-title"><i className="fa-solid fa-bag-shopping" aria-hidden="true" /> Đơn hàng của bạn</h2>
              {gio.data.items.map((it) => (
                <div key={it.id} className="d-flex justify-content-between align-items-start gap-3 small mb-2">
                  <span>{it.tenSanPham} <span className="text-muted">({[it.bienThe.mau?.tenMau, it.bienThe.size?.tenSize].filter(Boolean).join(", ")}) × {it.soLuong}</span></span>
                  <span className="text-nowrap fw-semibold">{vnd(it.thanhTien)}</span>
                </div>
              ))}
              <hr />
              <div className="d-flex justify-content-between"><strong>Tổng tiền hàng</strong><strong className="text-danger">{vnd(gio.data.tongTien)}</strong></div>
              <p className="ct-ship-note">
                Chưa tính phí vận chuyển vào đơn này. Phí và thời gian giao hàng chưa được công bố, xem <Link href="/ChinhSach/giao-hang">chính sách giao hàng</Link>.
              </p>
              <button className="btn btn-primary w-100 ct-pay-btn" type="submit" disabled={dang || khongDatDuoc} aria-busy={dang}>
                {dang ? "Đang đặt hàng…" : "Đặt hàng"}
              </button>
              <p className="ct-ship-note">Giá và tồn kho được kiểm tra lại khi bạn đặt hàng.</p>
            </div></div>
          </div>
        </div>
      </form>
    </Page>
    </>
  );
}
