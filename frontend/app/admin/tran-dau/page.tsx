"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { FilterBar, ListState, PageBar, Pagination } from "@/components/admin/Common";
import { apiDelete, apiPost, loiTuApi } from "@/lib/api";
import { ngay } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { coQuyenXoa } from "@/lib/quyen-admin";
import type { Trang, TranDauV } from "@/lib/types";

export default function QuanLyTranDauPage() {
  const sp = useSearchParams();
  const q = sp.toString();
  const { data, error, loading, reload } = useApi<Trang<TranDauV>>(`/admin/tran-dau${q ? `?${q}` : ""}`);
  const { user, flash } = useApp();
  const xoaDuoc = coQuyenXoa(user?.maQuyen); // nhân viên không xóa, chỉ ẩn/hiện
  const daAn = (t: TranDauV) => t.hienThi === false; // thiếu field = đang hiển thị

  // Ẩn / hiện lại theo CONTRACT C-4: POST /admin/tran-dau/:id/toggle-status { value } (BE T-502 chưa có lúc viết: gọi sẽ 404 cho tới khi xong).
  const doiAn = async (t: TranDauV, hienThi: boolean) => {
    if (!hienThi && !confirm(`Ẩn trận ${t.doiA} vs ${t.doiB}? Khách sẽ không thấy trận này. Bạn có thể hiện lại sau.`)) return;
    try {
      const r = await apiPost<{ message: string }>(`/admin/tran-dau/${t.id}/toggle-status`, { value: hienThi });
      flash("success", r.message);
      await reload();
    } catch (e) {
      flash("danger", loiTuApi(e));
    }
  };
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
      <PageBar title="Danh sách trận đấu" action={{ href: "/admin/tran-dau/create", text: "Thêm trận đấu" }} />
      <FilterBar placeholder="Tìm theo giải đấu hoặc tên đội…" />
      <ListState loading={loading} error={error} data={data} retry={reload} empty="Không tìm thấy trận đấu phù hợp.">
        {data && (<>
          <div className="table-responsive card-custom"><table className="table align-middle mb-0">
            <thead><tr><th>Giải đấu</th><th>Trận</th><th>Tỉ số</th><th>Ngày</th><th>Tin liên quan</th><th>Hiển thị</th><th className="text-end">Thao tác</th></tr></thead>
            <tbody>{data.items.map((t) => (
              <tr key={t.id}><td><div className="fw-semibold">{t.tenGiaiDau}</div><small className="text-muted">{t.vong} · {t.noiDung}</small></td>
                <td><span className={t.doiThang === "A" ? "fw-bold" : ""}>{t.doiA}</span> vs <span className={t.doiThang === "B" ? "fw-bold" : ""}>{t.doiB}</span></td>
                <td className="text-nowrap">{t.tiSo || "Chưa cập nhật"}</td><td className="text-nowrap">{ngay(t.ngayThiDau)}</td><td>{t.soTin}</td>
                <td><span className={daAn(t) ? "badge bg-secondary" : "badge bg-success"}>{daAn(t) ? "Đang ẩn" : "Công khai"}</span></td>
                <td className="text-end text-nowrap"><Link href={`/admin/tran-dau/${t.id}/edit`} className="btn btn-sm btn-outline-primary me-1" aria-label={`Sửa trận ${t.doiA} – ${t.doiB}`}>Sửa</Link>
                  {daAn(t)
                    ? <button className="btn btn-sm btn-outline-success me-1" title="Hiện lại" aria-label={`Hiện lại trận ${t.doiA} vs ${t.doiB}`} onClick={() => doiAn(t, true)}><i className="fa-solid fa-eye" /></button>
                    : <button className="btn btn-sm btn-outline-warning me-1" title="Ẩn" aria-label={`Ẩn trận ${t.doiA} vs ${t.doiB}`} onClick={() => doiAn(t, false)}><i className="fa-solid fa-eye-slash" /></button>}
                  {xoaDuoc && <button className="btn btn-sm btn-outline-danger" aria-label={`Xóa trận ${t.doiA} – ${t.doiB}`} onClick={() => xoa(t)}><i className="fa-solid fa-trash" aria-hidden="true" /></button>}</td></tr>))}</tbody>
          </table></div>
          <Pagination trang={data} />
        </>)}
      </ListState>
    </>
  );
}
