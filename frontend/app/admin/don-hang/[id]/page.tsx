"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { ErrorBox, Loading } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { imgUrl, ngayGio, tenTrangThaiClass, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { DonHangV } from "@/lib/types";

/** Phải khớp CHUYEN_TRANG_THAI ở backend; backend vẫn là nơi kiểm tra cuối cùng. */
const CHUYEN: Record<string, string[]> = {
  "Chờ xác nhận": ["Đang xử lý", "Đã hủy"], "Chờ thanh toán MoMo": ["Đang xử lý", "Đã hủy"],
  "Đã thanh toán bằng MoMo": ["Đang giao hàng", "Đã hủy"], "Đang xử lý": ["Đang giao hàng", "Đã hủy"], "Đang giao hàng": ["Đã hoàn thành", "Đã hủy"],
};

export default function ChiTietDonAdminPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<DonHangV>(`/admin/don-hang/${id}`);
  const { flash } = useApp();

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Không tìm thấy đơn hàng"} />;

  const doi = async (trangThaiMoi: string) => {
    if (!confirm(`Chuyển đơn #${data.soDonHang} sang "${trangThaiMoi}"?`)) return;
    try {
      const r = await apiPost<{ message: string }>(`/admin/don-hang/${id}/trang-thai`, { trangThaiMoi });
      flash("success", r.message);
      await reload();
    } catch (e) {
      flash("danger", `Lỗi khi cập nhật trạng thái: ${loiTuApi(e)}`);
    }
  };

  return (
    <>
      <Link href="/admin/don-hang" className="small">← Danh sách đơn hàng</Link>
      <div className="d-flex flex-wrap justify-content-between align-items-center my-3 gap-2">
        <h5 className="mb-0">Đơn hàng #{data.soDonHang} <span className={`badge ms-2 ${tenTrangThaiClass(data.trangThai)}`}>{data.trangThai}</span></h5>
        <div className="d-flex gap-2">
          {(CHUYEN[data.trangThai] ?? []).map((t) => <button key={t} className={`btn btn-sm ${t === "Đã hủy" ? "btn-outline-danger" : "btn-primary"}`} onClick={() => doi(t)}>→ {t}</button>)}
        </div>
      </div>
      <div className="row g-3">
        <div className="col-lg-8">
          <div className="table-responsive card-custom"><table className="table align-middle mb-0">
            <thead><tr><th>Sản phẩm</th><th className="text-end">Đơn giá</th><th className="text-center">SL</th><th className="text-end">Thành tiền</th></tr></thead>
            <tbody>{data.chiTiet.map((c) => (
              <tr key={c.id}><td><div className="d-flex gap-2 align-items-center">{ }<img src={imgUrl(c.hinhAnh)} alt="" width={44} height={44} style={{ objectFit: "contain" }} /><div>{c.tenSanPham}<div className="small text-muted">{[c.tenMau, c.tenSize].filter(Boolean).join(" · ")} · {c.sku}</div></div></div></td>
                <td className="text-end">{vnd(c.donGia)}</td><td className="text-center">{c.soLuong}</td><td className="text-end">{vnd(c.thanhTien)}</td></tr>))}</tbody>
            <tfoot><tr><th colSpan={3} className="text-end">Tổng thanh toán</th><th className="text-end text-danger">{vnd(data.tongTienSauGiam)}</th></tr></tfoot>
          </table></div>
        </div>
        <div className="col-lg-4"><div className="card-custom p-3 small">
          <div className="mb-1"><strong>Khách hàng:</strong> {data.khachHang?.hoTen ?? "—"}</div>
          <div className="mb-1"><strong>Email:</strong> {data.khachHang?.email ?? "—"}</div>
          <div className="mb-1"><strong>Ngày đặt:</strong> {ngayGio(data.ngayDat)}</div>
          <div className="mb-1"><strong>Địa chỉ giao:</strong> {data.diaChiGiaoHang}</div>
          <div className="mb-1"><strong>SĐT nhận hàng:</strong> {data.soDienThoaiNhanHang}</div>
          {data.ghiChu && <div><strong>Ghi chú:</strong> {data.ghiChu}</div>}
        </div></div>
      </div>
    </>
  );
}
