"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { FilterBar, ListState, PageBar, Pagination } from "@/components/admin/Common";
import { apiDelete, loiTuApi } from "@/lib/api";
import { ngay } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Trang, TranDauV } from "@/lib/types";

export default function QuanLyTranDauPage() {
  const sp = useSearchParams();
  const q = sp.toString();
  const { data, error, loading, reload } = useApi<Trang<TranDauV>>(`/admin/tran-dau${q ? `?${q}` : ""}`);
  const { flash } = useApp();
  const xoa = async (t: TranDauV) => {
    if (!confirm(`Xóa trận ${t.doiA} vs ${t.doiB}?`)) return;
    try {
      const r = await apiDelete<{ message: string }>(`/admin/tran-dau/${t.id}`);
      flash("success", r.message);
      await reload();
    } catch (e) {
      flash("danger", loiTuApi(e));
    }
  };
  return (
    <>
      <PageBar title="Kết quả trận đấu" action={{ href: "/admin/tran-dau/create", text: "Thêm trận đấu" }} />
      <FilterBar />
      <ListState loading={loading} error={error} data={data} empty="Chưa có trận đấu nào.">
        {data && (<>
          <div className="table-responsive card-custom"><table className="table align-middle mb-0">
            <thead><tr><th>Giải đấu</th><th>Trận</th><th>Tỉ số</th><th>Ngày</th><th>Bài viết</th><th /></tr></thead>
            <tbody>{data.items.map((t) => (
              <tr key={t.id}><td><div className="fw-semibold">{t.tenGiaiDau}</div><small className="text-muted">{t.vong} · {t.noiDung}</small></td>
                <td><span className={t.doiThang === "A" ? "fw-bold" : ""}>{t.doiA}</span> vs <span className={t.doiThang === "B" ? "fw-bold" : ""}>{t.doiB}</span></td>
                <td>{t.tiSo ?? "—"}</td><td>{ngay(t.ngayThiDau)}</td><td>{t.soTin}</td>
                <td className="text-end text-nowrap"><Link href={`/admin/tran-dau/${t.id}/edit`} className="btn btn-sm btn-outline-primary me-1"><i className="fa-solid fa-pen" /></Link><button className="btn btn-sm btn-outline-danger" onClick={() => xoa(t)}><i className="fa-solid fa-trash" /></button></td></tr>))}</tbody>
          </table></div>
          <Pagination trang={data} />
        </>)}
      </ListState>
    </>
  );
}
