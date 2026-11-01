"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { FilterBar, ListState, PageBar, Pagination } from "@/components/admin/Common";
import { apiDelete, apiPost, loiTuApi } from "@/lib/api";
import { ngay } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { TinV, Trang } from "@/lib/types";

const LOAI: [string, string][] = [["", "Tất cả loại"], ["san-pham-hot", "Sản phẩm hot"], ["san-pham-moi", "Sản phẩm mới"], ["tran-dau", "Trận đấu"], ["tuyen-thu", "Tuyển thủ"], ["giai-dau", "Giải đấu"]];

export default function QuanLyBanTinPage() {
  const sp = useSearchParams();
  const q = sp.toString();
  const { data, error, loading, reload } = useApi<Trang<TinV>>(`/admin/ban-tin${q ? `?${q}` : ""}`);
  const { flash } = useApp();

  const toggle = async (t: TinV, field: "noiBat" | "hienThi") => {
    try {
      const r = await apiPost<{ message: string }>(`/admin/ban-tin/${t.id}/toggle-status`, { field, value: !t[field] });
      flash("success", r.message);
      await reload();
    } catch (e) {
      flash("danger", loiTuApi(e));
    }
  };
  const xoa = async (t: TinV) => {
    if (!confirm(`Xóa bài viết "${t.tieuDe}"?`)) return;
    try {
      const r = await apiDelete<{ message: string }>(`/admin/ban-tin/${t.id}`);
      flash("success", r.message);
      await reload();
    } catch (e) {
      flash("danger", loiTuApi(e));
    }
  };

  return (
    <>
      <PageBar title="Bài viết bảng tin" action={{ href: "/admin/ban-tin/create", text: "Viết bài mới" }} />
      <FilterBar>
        {(set, get) => <select className="form-select w-auto" value={get("loai")} onChange={(e) => set("loai", e.target.value)}>{LOAI.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>}
      </FilterBar>
      <ListState loading={loading} error={error} data={data} empty="Chưa có bài viết nào.">
        {data && (<>
          <div className="table-responsive card-custom"><table className="table align-middle mb-0">
            <thead><tr><th>Tiêu đề</th><th>Loại</th><th>Ngày đăng</th><th className="text-center">Nổi bật</th><th className="text-center">Hiển thị</th><th className="text-end">Xem</th><th /></tr></thead>
            <tbody>{data.items.map((t) => (
              <tr key={t.id}><td className="fw-semibold" style={{ maxWidth: 360 }}>{t.tieuDe}</td><td>{t.nhanLoai}</td><td>{ngay(t.ngayDang)}</td>
                <td className="text-center"><div className="form-check form-switch d-inline-block"><input type="checkbox" className="form-check-input" checked={t.noiBat} onChange={() => toggle(t, "noiBat")} aria-label="Nổi bật" /></div></td>
                <td className="text-center"><div className="form-check form-switch d-inline-block"><input type="checkbox" className="form-check-input" checked={t.hienThi} onChange={() => toggle(t, "hienThi")} aria-label="Hiển thị" /></div></td>
                <td className="text-end">{t.luotXem}</td>
                <td className="text-end text-nowrap"><Link href={`/admin/ban-tin/${t.id}/edit`} className="btn btn-sm btn-outline-primary me-1"><i className="fa-solid fa-pen" /></Link><button className="btn btn-sm btn-outline-danger" onClick={() => xoa(t)}><i className="fa-solid fa-trash" /></button></td></tr>))}</tbody>
          </table></div>
          <Pagination trang={data} />
        </>)}
      </ListState>
    </>
  );
}
