"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ErrorBox, Loading } from "@/components/Ui";
import { imgUrl, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Dash {
  nam: number; tongSanPham: number; soCanhBao: number; tongDoanhThuNam: number; soLuongDonNam: number;
  doanhThuQuy: { quy: number; soLuongDon: number; tongDoanhThu: number }[];
  doanhThuThang: { thang: number; soLuongDon: number; tongDoanhThu: number }[];
  sanPhamBanChay: { sanPhamId: string; tenSanPham: string; hinhAnh: string; tongSoLuongBan: number; tongDoanhThu: number }[];
}

export default function DashboardPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const nam = sp.get("nam");
  const { data, error, loading } = useApi<Dash>(`/admin/dashboard${nam ? `?nam=${nam}` : ""}`);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Lỗi tải thống kê"} />;
  const max = Math.max(1, ...data.doanhThuThang.map((t) => t.tongDoanhThu));
  const namHienTai = new Date().getFullYear();

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Năm {data.nam}</h5>
        <select className="form-select w-auto" value={data.nam} onChange={(e) => router.push(`/admin?nam=${e.target.value}`)} aria-label="Chọn năm">
          {Array.from({ length: 6 }, (_, i) => namHienTai - i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="row g-3 mb-4">
        {[
          ["fa-sack-dollar", "Doanh thu năm", vnd(data.tongDoanhThuNam)], ["fa-receipt", "Số đơn hàng", data.soLuongDonNam],
          ["fa-box-archive", "Tổng sản phẩm", data.tongSanPham], ["fa-triangle-exclamation", "Cảnh báo đánh giá thấp", data.soCanhBao],
        ].map(([icon, nhan, giaTri]) => (
          <div className="col-6 col-xl-3" key={String(nhan)}>
            <div className="stat-card card-custom p-3 d-flex gap-3 align-items-center">
              <span className="stat-icon"><i className={`fa-solid ${icon}`} /></span>
              <div><div className="stat-label">{nhan}</div><div className="stat-value">{giaTri}</div></div>
            </div>
          </div>
        ))}
      </div>
      <div className="row g-3">
        <div className="col-xl-8">
          <div className="card-custom p-3">
            <h6>Doanh thu theo tháng</h6>
            <div className="d-flex align-items-end gap-2" style={{ height: 220 }}>
              {data.doanhThuThang.map((t) => (
                <div key={t.thang} className="flex-fill text-center" title={`${vnd(t.tongDoanhThu)} · ${t.soLuongDon} đơn`}>
                  <div style={{ height: `${(t.tongDoanhThu / max) * 180}px`, minHeight: 2, background: "#1f8f4e", borderRadius: "4px 4px 0 0" }} />
                  <small className="text-muted">T{t.thang}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-xl-4">
          <div className="card-custom p-3 h-100">
            <h6>Theo quý</h6>
            <table className="table table-sm mb-0"><tbody>
              {data.doanhThuQuy.map((q) => <tr key={q.quy}><td>Quý {q.quy}</td><td className="text-end">{q.soLuongDon} đơn</td><td className="text-end fw-semibold">{vnd(q.tongDoanhThu)}</td></tr>)}
            </tbody></table>
          </div>
        </div>
        <div className="col-12">
          <div className="card-custom p-3">
            <h6>Top 10 sản phẩm bán chạy</h6>
            <div className="table-responsive"><table className="table align-middle mb-0">
              <thead><tr><th>#</th><th>Sản phẩm</th><th className="text-end">Đã bán</th><th className="text-end">Doanh thu</th></tr></thead>
              <tbody>
                {data.sanPhamBanChay.length === 0 && <tr><td colSpan={4} className="text-center text-muted">Chưa có dữ liệu bán hàng trong năm này.</td></tr>}
                {data.sanPhamBanChay.map((s, i) => (
                  <tr key={s.sanPhamId}><td><span className="rank-badge">{i + 1}</span></td>
                    <td><div className="d-flex align-items-center gap-2">{ }<img src={imgUrl(s.hinhAnh)} alt="" width={40} height={40} style={{ objectFit: "contain" }} />{s.tenSanPham}</div></td>
                    <td className="text-end">{s.tongSoLuongBan}</td><td className="text-end">{vnd(s.tongDoanhThu)}</td></tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>
    </>
  );
}
