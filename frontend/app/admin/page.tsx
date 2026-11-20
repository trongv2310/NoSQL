"use client";

import Link from "next/link";
import { useState } from "react";
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
  const [thangChon, setThangChon] = useState<number | null>(null);
  const { data, error, loading, reload } = useApi<Dash>(`/admin/dashboard${nam ? `?nam=${nam}` : ""}`);
  if (loading && !data) return <Loading />;
  if (error || !data) return <div className="card-custom p-3"><ErrorBox message="Chưa tải được số liệu tổng quan." />
    <button type="button" className="btn btn-outline-primary" onClick={() => void reload()}>Thử lại</button></div>;
  const max = Math.max(1, ...data.doanhThuThang.map((t) => t.tongDoanhThu));
  const namHienTai = new Date().getFullYear();
  const thang = data.doanhThuThang.find((t) => t.thang === thangChon) ?? data.doanhThuThang.findLast((t) => t.soLuongDon > 0);
  const danhSachNam = Array.from(new Set([data.nam, ...Array.from({ length: 6 }, (_, i) => namHienTai - i)])).sort((a, b) => b - a);

  return (
    <div aria-busy={loading}>
      <div className="admin-section-bar">
        <h2>Kết quả kinh doanh</h2>
        <label className="d-flex align-items-center gap-2">
          <span>Năm</span>
          <select className="form-select w-auto" value={data.nam} disabled={loading} onChange={(e) => router.push(`/admin?nam=${e.target.value}`, { scroll: false })}>
            {danhSachNam.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
      <div className="admin-kpis">
        <div className="admin-kpi"><span><i className="fa-solid fa-sack-dollar" aria-hidden="true" /> Doanh thu năm {data.nam}</span><strong>{vnd(data.tongDoanhThuNam)}</strong></div>
        <Link href="/admin/don-hang" className="admin-kpi"><span><i className="fa-solid fa-receipt" aria-hidden="true" /> Đơn tính vào doanh thu</span><strong>{data.soLuongDonNam}</strong><small>Xem đơn hàng</small></Link>
        <Link href="/admin/san-pham" className="admin-kpi"><span><i className="fa-solid fa-box-archive" aria-hidden="true" /> Sản phẩm trong danh mục</span><strong>{data.tongSanPham}</strong><small>Xem tồn kho và phiên bản</small></Link>
        <Link href="/admin/thong-bao" className={data.soCanhBao > 0 ? "admin-kpi is-urgent" : "admin-kpi"}><span><i className="fa-solid fa-star" aria-hidden="true" /> Đánh giá từ 2 sao trở xuống</span><strong>{data.soCanhBao}</strong><small>Đọc phản hồi</small></Link>
      </div>
      <section className="card-custom admin-report-card mb-3">
        <header><h2>Việc cần xem</h2></header>
        <div className="admin-work-actions">
          <Link href={"/admin/don-hang?trangThai=" + encodeURIComponent("Chờ xác nhận")}><i className="fa-solid fa-receipt" aria-hidden="true" /> Đơn chờ xác nhận</Link>
          <Link href="/admin/lich-cang"><i className="fa-solid fa-calendar-check" aria-hidden="true" /> Lịch căng đang chờ</Link>
          <Link href="/admin/bao-cao-csdl"><i className="fa-solid fa-chart-column" aria-hidden="true" /> Báo cáo sổ căng và đánh giá</Link>
        </div>
      </section>
      <div className="row g-3">
        <div className="col-xl-8">
          <section className="card-custom admin-report-card h-100">
            <header><h2>Doanh thu theo tháng</h2></header>
            <div className="admin-month-chart" role="group" aria-label="Chọn tháng để xem doanh thu">
              {data.doanhThuThang.map((t) => (
                <button type="button" key={t.thang} aria-pressed={t.thang === thang?.thang} aria-label={`Tháng ${t.thang}: ${vnd(t.tongDoanhThu)}, ${t.soLuongDon} đơn`}
                  onClick={() => setThangChon(t.thang)}>
                  <i aria-hidden="true" style={{ height: Math.max(2, t.tongDoanhThu / max * 125) }} /><span>T{t.thang}</span>
                </button>
              ))}
            </div>
            <p className="admin-report-empty mt-2" role="status">{thang ? `Tháng ${thang.thang} · ${vnd(thang.tongDoanhThu)} · ${thang.soLuongDon} đơn` : "Chưa ghi nhận doanh thu trong năm này."}</p>
          </section>
        </div>
        <div className="col-xl-4">
          <div className="card-custom p-3 h-100">
            <h6 className="mb-3">Doanh thu theo quý</h6>
            <table className="table table-sm mb-0"><tbody>
              {data.doanhThuQuy.map((q) => <tr key={q.quy}><td className="text-nowrap">Quý {q.quy}</td><td className="text-end text-nowrap text-muted">{q.soLuongDon} đơn</td><td className="text-end text-nowrap fw-semibold">{vnd(q.tongDoanhThu)}</td></tr>)}
            </tbody></table>
          </div>
        </div>
        <div className="col-12">
          <div className="card-custom p-3">
            <h6 className="mb-3">10 sản phẩm bán nhiều nhất</h6>
            <div className="table-responsive"><table className="table align-middle mb-0">
              <thead><tr><th>#</th><th>Sản phẩm</th><th className="text-end">Đã bán</th><th className="text-end">Doanh thu</th></tr></thead>
              <tbody>
                {data.sanPhamBanChay.length === 0 && <tr><td colSpan={4} className="text-center text-muted">Chưa có dữ liệu bán hàng trong năm này.</td></tr>}
                {data.sanPhamBanChay.map((s, i) => (
                  <tr key={s.sanPhamId}><td><span className="rank-badge">{i + 1}</span></td>
                    <td><div className="d-flex align-items-center gap-2">
                      <img src={imgUrl(s.hinhAnh)} alt="" width={40} height={40} style={{ objectFit: "contain" }} />
                      <Link href={`/admin/san-pham/${s.sanPhamId}`}>{s.tenSanPham}</Link>
                    </div></td>
                    <td className="text-end">{s.tongSoLuongBan}</td><td className="text-end">{vnd(s.tongDoanhThu)}</td></tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>
    </div>
  );
}
