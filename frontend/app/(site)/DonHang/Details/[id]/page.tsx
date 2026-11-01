"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { ErrorBox, Loading, Page } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { imgUrl, ngayGio, tenTrangThaiClass, vnd } from "@/lib/format";
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
    <Page>
      <Link href="/DonHang/Index" className="small">← Quay lại danh sách</Link>
      <div className="d-flex flex-wrap justify-content-between align-items-center my-3 gap-2">
        <h2 className="page-title mb-0">Đơn hàng #{data.soDonHang}</h2>
        <span className={`badge fs-6 ${tenTrangThaiClass(data.trangThai)}`}>{data.trangThai}</span>
      </div>
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="table-responsive"><table className="table table-bordered align-middle bg-white">
            <thead className="table-light"><tr><th>Sản phẩm</th><th className="text-end">Đơn giá</th><th className="text-center">SL</th><th className="text-end">Thành tiền</th></tr></thead>
            <tbody>{data.chiTiet.map((c) => (
              <tr key={c.id}>
                <td><div className="d-flex gap-2 align-items-center">
                  { }
                  <img src={imgUrl(c.hinhAnh)} alt="" width={56} height={56} style={{ objectFit: "contain" }} />
                  <div>{c.sanPhamId ? <Link href={`/Home/ChiTietSanPham/${c.sanPhamId}`}>{c.tenSanPham}</Link> : c.tenSanPham}<div className="small text-muted">{[c.tenMau, c.tenSize].filter(Boolean).join(" · ")} · {c.sku}</div></div>
                </div></td>
                <td className="text-end">{vnd(c.donGia)}</td><td className="text-center">{c.soLuong}</td><td className="text-end">{vnd(c.thanhTien)}</td>
              </tr>))}</tbody>
          </table></div>
        </div>
        <div className="col-lg-4">
          <div className="card"><div className="card-body small">
            <div className="mb-1"><strong>Ngày đặt:</strong> {ngayGio(data.ngayDat)}</div>
            <div className="mb-1"><strong>Địa chỉ giao:</strong> {data.diaChiGiaoHang}</div>
            <div className="mb-1"><strong>SĐT nhận hàng:</strong> {data.soDienThoaiNhanHang}</div>
            {data.ghiChu && <div className="mb-1"><strong>Ghi chú:</strong> {data.ghiChu}</div>}
            <hr />
            <div className="d-flex justify-content-between"><span>Tạm tính</span><span>{vnd(data.tongTien)}</span></div>
            <div className="d-flex justify-content-between"><span>Giảm giá</span><span>-{vnd(data.tienGiam)}</span></div>
            <div className="d-flex justify-content-between fw-bold fs-6 text-danger"><span>Thành tiền</span><span>{vnd(data.tongTienSauGiam)}</span></div>
            {KHACH_DUOC_HUY.includes(data.trangThai) && <button className="btn btn-outline-danger w-100 mt-3" onClick={huy}>Hủy đơn hàng</button>}
          </div></div>
        </div>
      </div>
    </Page>
  );
}
