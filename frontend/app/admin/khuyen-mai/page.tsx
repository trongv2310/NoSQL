"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { FilterBar, ListState, PageBar, Pagination } from "@/components/admin/Common";
import { apiDelete, loiTuApi } from "@/lib/api";
import { ngay } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { KhuyenMaiV, Trang } from "@/lib/types";

function TrangThaiKhuyenMai({ km }: { km: KhuyenMaiV }) {
  const now = new Date().getTime();
  if (km.conHieuLuc) return <span className="badge bg-success">Đang chạy</span>;
  if (km.ngayBatDau && Date.parse(km.ngayBatDau) > now) return <span className="badge bg-info">Sắp bắt đầu</span>;
  if (km.ngayKetThuc && Date.parse(km.ngayKetThuc) < now) return <span className="badge bg-secondary">Đã kết thúc</span>;
  return <span className="badge bg-secondary">Không hiệu lực</span>;
}

export default function QuanLyKhuyenMaiPage() {
  const sp = useSearchParams();
  const q = sp.toString();
  const { data, error, loading, reload } = useApi<Trang<KhuyenMaiV & { soSanPham: number }>>(`/admin/khuyen-mai${q ? `?${q}` : ""}`);
  const { flash } = useApp();
  const xoa = async (k: KhuyenMaiV) => {
    if (!confirm(`Xóa chương trình "${k.tenChuongTrinh}"? Các sản phẩm đang áp dụng sẽ về giá gốc.`)) return;
    try {
      const r = await apiDelete<{ message: string }>(`/admin/khuyen-mai/${k.id}`);
      flash("success", r.message);
      await reload();
    } catch (e) {
      flash("danger", loiTuApi(e));
    }
  };
  return (
    <>
      <PageBar title="Chương trình khuyến mãi" action={{ href: "/admin/khuyen-mai/create", text: "Thêm khuyến mãi" }} />
      <FilterBar placeholder="Tìm theo tên chương trình…" />
      <ListState loading={loading} error={error} data={data} retry={reload} empty="Không tìm thấy chương trình khuyến mãi phù hợp.">
        {data && (<>
          <div className="table-responsive card-custom"><table className="table align-middle mb-0">
            <thead><tr><th>Tên chương trình</th><th>Mức giảm</th><th>Thời gian</th><th>Sản phẩm áp dụng</th><th>Trạng thái</th><th className="text-end">Thao tác</th></tr></thead>
            <tbody>{data.items.map((k) => (
              <tr key={k.id}><td><div className="fw-semibold">{k.tenChuongTrinh}</div><small className="text-muted">{k.moTa}</small></td>
                <td className="text-nowrap">-{k.phanTramGiam}%</td>
                <td className="text-nowrap">{k.ngayBatDau ? ngay(k.ngayBatDau) : "Chưa đặt"} – {k.ngayKetThuc ? ngay(k.ngayKetThuc) : "Không giới hạn"}</td>
                <td>{k.soSanPham}</td>
                <td><TrangThaiKhuyenMai km={k} /></td>
                <td className="text-end text-nowrap"><Link href={`/admin/khuyen-mai/${k.id}/edit`} className="btn btn-sm btn-outline-primary me-1" aria-label={`Sửa ${k.tenChuongTrinh}`}>Sửa</Link>
                  <button className="btn btn-sm btn-outline-danger" aria-label={`Xóa ${k.tenChuongTrinh}`} onClick={() => xoa(k)}><i className="fa-solid fa-trash" aria-hidden="true" /></button></td></tr>))}</tbody>
          </table></div>
          <Pagination trang={data} />
        </>)}
      </ListState>
    </>
  );
}
