"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/AppProviders";
import { Empty, ErrorBox, Loading, Page } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { ngayGio, tenTrangThaiClass, vnd } from "@/lib/format";
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
  return (
    <Page>
      <h2 className="page-title mb-3">Đơn hàng của tôi</h2>
      {data.length === 0 ? <Empty message="Bạn chưa có đơn hàng nào." linkUrl="/SanPham/Index" linkText="Mua sắm ngay" /> : data.map((d) => (
        <div key={d.id} className="card mb-3">
          <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div><strong>Đơn #{d.soDonHang}</strong> <small className="text-muted ms-2">{ngayGio(d.ngayDat)}</small></div>
            <span className={`badge ${tenTrangThaiClass(d.trangThai)}`}>{d.trangThai}</span>
          </div>
          <div className="card-body">
            {d.chiTiet.map((c) => <div key={c.id} className="small d-flex justify-content-between"><span>{c.tenSanPham} × {c.soLuong}</span><span>{vnd(c.thanhTien)}</span></div>)}
            {d.soDong > d.chiTiet.length && <div className="small text-muted">… và {d.soDong - d.chiTiet.length} sản phẩm khác</div>}
            <hr />
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <strong className="text-danger">Tổng: {vnd(d.tongTienSauGiam)}</strong>
              <div className="d-flex gap-2">
                <Link href={`/DonHang/Details/${d.soDonHang}`} className="btn btn-sm btn-outline-primary">Chi tiết</Link>
                {KHACH_DUOC_HUY.includes(d.trangThai) && <button className="btn btn-sm btn-outline-danger" onClick={() => huy(d.soDonHang)}>Hủy đơn</button>}
              </div>
            </div>
          </div>
        </div>
      ))}
    </Page>
  );
}
