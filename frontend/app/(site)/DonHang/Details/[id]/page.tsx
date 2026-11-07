"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { PageHero } from "@/components/PageHero";
import { ChipTrangThai, OrderTrack } from "@/components/Steps";
import { ErrorBox, Loading, Page } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { imgUrl, ngayGio, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { DonHangV } from "@/lib/types";

const KHACH_DUOC_HUY = ["Chờ xác nhận", "Chờ thanh toán MoMo", "Đang xử lý"];

export default function ChiTietDonPage() {
  const { id } = useParams<{ id: string }>();
  const { ready, user, flash } = useApp();
  const { data, error, loading, reload } = useApi<DonHangV>(ready && user ? `/don-hang/${id}` : null);

  const huy = async () => {
    if (!confirm(`Bạn chắc chắn muốn hủy đơn hàng #${id}?`)) return;
    try {
      const r = await apiPost<{ message: string }>(`/don-hang/${id}/huy`);
      flash("success", r.message);
      await reload();
    } catch (e) {
      flash("danger", `Lỗi: ${loiTuApi(e)}`);
    }
  };

  if (!ready || loading) return <Page><Loading /></Page>;
  if (error || !data) return <Page><ErrorBox message={error ?? "Không tìm thấy đơn hàng"} /></Page>;
  return (
    <>
      <PageHero compact tone="green" kicker="Chi tiết đơn hàng" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Đơn hàng", href: "/DonHang/Index" }, { nhan: `#${data.soDonHang}` }]}
        title={<>Đơn hàng <em>#{data.soDonHang}</em></>} sub={`Đặt lúc ${ngayGio(data.ngayDat)}`} aside={<ChipTrangThai t={data.trangThai} />} />
      <Page className="od-wrap">
        <div className="od-card"><OrderTrack trangThai={data.trangThai} /></div>
        <div className="row g-4">
          <div className="col-lg-8">
            <section className="od-card">
              <h3 className="ct-card-title"><i className="fa-solid fa-box-open" aria-hidden="true" /> Sản phẩm trong đơn</h3>
              <ul className="od-items is-detail">
                {data.chiTiet.map((c) => (
                  <li key={c.id}>
                    { }
                    <img src={imgUrl(c.hinhAnh)} alt="" loading="lazy" />
                    <div>
                      <b>{c.sanPhamId ? <Link href={`/Home/ChiTietSanPham/${c.sanPhamId}`}>{c.tenSanPham}</Link> : c.tenSanPham}</b>
                      <small>{[c.tenMau, c.tenSize].filter(Boolean).join(" · ")}{c.tenMau || c.tenSize ? " · " : ""}{c.sku}</small>
                      <small>{vnd(c.donGia)} × {c.soLuong}</small>
                    </div>
                    <span>{vnd(c.thanhTien)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="col-lg-4">
            <section className="od-card od-summary">
              <h3 className="ct-card-title"><i className="fa-solid fa-receipt" aria-hidden="true" /> Thông tin đơn</h3>
              <dl className="od-info">
                <div><dt><i className="fa-solid fa-location-dot" aria-hidden="true" /> Địa chỉ giao</dt><dd>{data.diaChiGiaoHang}</dd></div>
                <div><dt><i className="fa-solid fa-phone" aria-hidden="true" /> SĐT nhận hàng</dt><dd>{data.soDienThoaiNhanHang}</dd></div>
                {data.ghiChu && <div><dt><i className="fa-solid fa-note-sticky" aria-hidden="true" /> Ghi chú</dt><dd>{data.ghiChu}</dd></div>}
              </dl>
              <div className="od-total">
                <div><span>Tạm tính</span><span>{vnd(data.tongTien)}</span></div>
                <div><span>Giảm giá</span><span>-{vnd(data.tienGiam)}</span></div>
                <div className="is-sum"><span>Thành tiền</span><strong>{vnd(data.tongTienSauGiam)}</strong></div>
              </div>
              {KHACH_DUOC_HUY.includes(data.trangThai) && <button className="od-btn is-danger w-100 mt-3 justify-content-center" onClick={huy}>Hủy đơn hàng</button>}
            </section>
          </div>
        </div>
      </Page>
    </>
  );
}
