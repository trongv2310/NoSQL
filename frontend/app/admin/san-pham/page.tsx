"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { FilterBar, ListState, PageBar, Pagination } from "@/components/admin/Common";
import { apiDelete, loiTuApi } from "@/lib/api";
import { imgUrl, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { SanPhamV, Trang } from "@/lib/types";

interface Data extends Trang<SanPhamV> {
  loaiSanPhams: { id: string; tenLoai: string }[];
  hangs: { id: string; tenHang: string }[];
}

export default function QuanLySanPhamPage() {
  const sp = useSearchParams();
  const q = sp.toString();
  const { data, error, loading, reload } = useApi<Data>(`/admin/san-pham${q ? `?${q}` : ""}`);
  const { flash } = useApp();

  const xoa = async (s: SanPhamV) => {
    if (!confirm(`Xóa sản phẩm "${s.tenSanPham}"? Sản phẩm sẽ ngừng kinh doanh và bị gỡ khỏi giỏ hàng.`)) return;
    try {
      const r = await apiDelete<{ message: string }>(`/admin/san-pham/${s.id}`);
      flash("success", r.message);
      await reload();
    } catch (e) {
      flash("danger", loiTuApi(e));
    }
  };

  return (
    <>
      <PageBar title="Danh sách sản phẩm" action={{ href: "/admin/san-pham/create", text: "Thêm sản phẩm" }} />
      <FilterBar>
        {(set, get) => (
          <>
            <select className="form-select w-auto" value={get("maLoai")} onChange={(e) => set("maLoai", e.target.value)}><option value="">Tất cả loại</option>{data?.loaiSanPhams.map((l) => <option key={l.id} value={l.id}>{l.tenLoai}</option>)}</select>
            <select className="form-select w-auto" value={get("maHang")} onChange={(e) => set("maHang", e.target.value)}><option value="">Tất cả hãng</option>{data?.hangs.map((h) => <option key={h.id} value={h.id}>{h.tenHang}</option>)}</select>
          </>
        )}
      </FilterBar>
      <ListState loading={loading} error={error} data={data} empty="Chưa có sản phẩm nào.">
        {data && (
          <>
            <div className="table-responsive card-custom"><table className="table align-middle mb-0">
              <thead><tr><th>Ảnh</th><th>Tên sản phẩm</th><th>Loại</th><th>Hãng</th><th className="text-end">Giá gốc</th><th className="text-end">Tồn kho</th><th /></tr></thead>
              <tbody>{data.items.map((s) => (
                <tr key={s.id}>
                  <td>{ }<img src={imgUrl(s.hinhAnhDaiDien)} alt="" width={48} height={48} style={{ objectFit: "contain" }} /></td>
                  <td><Link href={`/admin/san-pham/${s.id}`} className="fw-semibold text-decoration-none">{s.tenSanPham}</Link>{s.khuyenMai && <span className="badge bg-danger ms-2">-{Math.round(s.khuyenMai.phanTramGiam)}%</span>}</td>
                  <td className="text-nowrap">{s.loai?.tenLoai}</td><td className="text-nowrap">{s.hang?.tenHang}</td><td className="text-end text-nowrap">{vnd(s.giaGoc)}</td>
                  <td className="text-end">{s.tongTonKho === 0 ? <span className="badge bg-danger">Hết hàng</span> : s.tongTonKho}</td>
                  <td className="text-end text-nowrap">
                    <Link href={`/admin/san-pham/${s.id}`} className="btn btn-sm btn-outline-secondary me-1" title="Biến thể"><i className="fa-solid fa-layer-group" /></Link>
                    <Link href={`/admin/san-pham/${s.id}/edit`} className="btn btn-sm btn-outline-primary me-1" title="Sửa"><i className="fa-solid fa-pen" /></Link>
                    <button className="btn btn-sm btn-outline-danger" title="Xóa" onClick={() => xoa(s)}><i className="fa-solid fa-trash" /></button>
                  </td>
                </tr>))}</tbody>
            </table></div>
            <Pagination trang={data} />
          </>
        )}
      </ListState>
    </>
  );
}
