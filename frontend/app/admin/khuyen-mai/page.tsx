"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { FilterBar, ListState, PageBar, Pagination } from "@/components/admin/Common";
import { apiDelete, loiTuApi } from "@/lib/api";
import { ngay } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { KhuyenMaiV, Trang } from "@/lib/types";

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
      <FilterBar />
      <ListState loading={loading} error={error} data={data} empty="Chưa có chương trình nào.">
        {data && (<>
          <div className="table-responsive card-custom"><table className="table align-middle mb-0">
            <thead><tr><th>Tên chương trình</th><th>Giảm</th><th>Thời gian</th><th>Sản phẩm</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>{data.items.map((k) => (
              <tr key={k.id}><td><div className="fw-semibold">{k.tenChuongTrinh}</div><small className="text-muted">{k.moTa}</small></td>
                <td>-{k.phanTramGiam}%</td><td>{ngay(k.ngayBatDau)} – {ngay(k.ngayKetThuc)}</td><td>{k.soSanPham}</td>
                <td><span className={`badge ${k.conHieuLuc ? "bg-success" : "bg-secondary"}`}>{k.conHieuLuc ? "Đang chạy" : "Không hiệu lực"}</span></td>
                <td className="text-end text-nowrap"><Link href={`/admin/khuyen-mai/${k.id}/edit`} className="btn btn-sm btn-outline-primary me-1"><i className="fa-solid fa-pen" /></Link><button className="btn btn-sm btn-outline-danger" onClick={() => xoa(k)}><i className="fa-solid fa-trash" /></button></td></tr>))}</tbody>
          </table></div>
          <Pagination trang={data} />
        </>)}
      </ListState>
    </>
  );
}
