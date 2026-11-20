"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { FilterBar, FilterLinks, ListState, PageBar, Pagination } from "@/components/admin/Common";
import { apiDelete, loiTuApi } from "@/lib/api";
import { ngay } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Trang } from "@/lib/types";

interface TK { id: string; tenDangNhap: string; email: string; maQuyen: number; tenQuyen: string; hoTen: string | null; ngayTao: string }

export default function QuanLyTaiKhoanPage() {
  const sp = useSearchParams();
  const q = sp.toString();
  const { data, error, loading, reload } = useApi<Trang<TK> & { phanQuyens: { maQuyen: number; tenQuyen: string }[] }>(`/admin/tai-khoan${q ? `?${q}` : ""}`);
  const { user, flash } = useApp();
  const xoa = async (t: TK) => {
    if (!confirm(`Xóa tài khoản "${t.tenDangNhap}"? Hồ sơ khách hàng và giỏ hàng đi kèm cũng bị xóa.`)) return;
    try {
      const r = await apiDelete<{ message: string }>(`/admin/tai-khoan/${t.id}`);
      flash("success", r.message);
      await reload();
    } catch (e) {
      flash("danger", loiTuApi(e));
    }
  };
  return (
    <>
      <PageBar title="Danh sách tài khoản" action={{ href: "/admin/tai-khoan/create", text: "Thêm tài khoản" }} />
      <FilterLinks label="Vai trò tài khoản" field="maQuyen" options={[
        { value: "", label: "Tất cả vai trò" },
        ...(data?.phanQuyens ?? []).map((p) => ({ value: String(p.maQuyen), label: p.tenQuyen })),
      ]} />
      <FilterBar placeholder="Tên đăng nhập, họ tên hoặc email…" keep={["maQuyen"]} />
      <ListState loading={loading} error={error} data={data} retry={reload} empty="Không có tài khoản khớp từ khóa và vai trò đã chọn.">
        {data && (<>
          <div className="table-responsive card-custom"><table className="table align-middle mb-0">
            <thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Ngày tạo</th><th className="text-end">Thao tác</th></tr></thead>
            <tbody>{data.items.map((t) => (
              <tr key={t.id}><td className="fw-semibold">{t.tenDangNhap}</td><td>{t.hoTen ?? "—"}</td><td>{t.email}</td>
                <td><span className={`badge ${t.maQuyen === 1 ? "bg-danger" : t.maQuyen === 2 ? "bg-info" : "bg-secondary"}`}>{t.tenQuyen}</span></td><td>{ngay(t.ngayTao)}</td>
                <td className="text-end text-nowrap"><Link href={`/admin/tai-khoan/${t.id}/edit`} className="btn btn-sm btn-outline-primary me-1" aria-label={`Sửa tài khoản ${t.tenDangNhap}`}>Sửa</Link>
                  <button className="btn btn-sm btn-outline-danger" disabled={t.id === user?.id || t.maQuyen === 1} aria-label={`Xóa tài khoản ${t.tenDangNhap}`} title={t.maQuyen === 1 ? "Không được xóa tài khoản quản trị." : undefined} onClick={() => xoa(t)}><i className="fa-solid fa-trash" aria-hidden="true" /></button></td></tr>))}</tbody>
          </table></div>
          <Pagination trang={data} />
        </>)}
      </ListState>
    </>
  );
}
