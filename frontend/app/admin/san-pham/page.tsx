"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProviders";
import { FilterBar, FilterLinks, ListState, PageBar, Pagination } from "@/components/admin/Common";
import { apiDelete, apiPost, loiTuApi } from "@/lib/api";
import { imgUrl, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { coQuyenXoa } from "@/lib/quyen-admin";
import type { SanPhamV, Trang } from "@/lib/types";

interface Data extends Trang<SanPhamV> {
  loaiSanPhams: { id: string; tenLoai: string }[];
  hangs: { id: string; tenHang: string }[];
}

export default function QuanLySanPhamPage() {
  const sp = useSearchParams();
  const q = sp.toString();
  const { data, error, loading, reload } = useApi<Data>(`/admin/san-pham${q ? `?${q}` : ""}`);
  const { user, flash } = useApp();
  const xoaDuoc = coQuyenXoa(user?.maQuyen); // nhân viên không xóa mà "Ẩn"
  const dangXemAn = sp.get("an") === "1";

  const doiAn = async (s: SanPhamV, thao: "an" | "hien") => {
    if (thao === "an" && !confirm(`Ẩn sản phẩm "${s.tenSanPham}"? Khách sẽ không thấy sản phẩm và nó bị gỡ khỏi giỏ hàng. Bạn có thể hiện lại sau.`)) return;
    try {
      const r = await apiPost<{ message: string }>(`/admin/san-pham/${s.id}/${thao}`);
      flash("success", r.message);
      await reload();
    } catch (e) {
      flash("danger", loiTuApi(e));
    }
  };

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
      <FilterLinks label="Hiển thị sản phẩm" field="an" options={[{ value: "", label: "Đang hiển thị" }, { value: "1", label: "Đang ẩn" }]} />
      <FilterBar placeholder="Tìm theo tên sản phẩm…" keep={["an"]}>
        {(set, get) => (
          <>
            <select className="form-select w-auto" aria-label="Loại sản phẩm" value={get("maLoai")} onChange={(e) => set("maLoai", e.target.value)}><option value="">Tất cả loại</option>{data?.loaiSanPhams.map((l) => <option key={l.id} value={l.id}>{l.tenLoai}</option>)}</select>
            <select className="form-select w-auto" aria-label="Thương hiệu" value={get("maHang")} onChange={(e) => set("maHang", e.target.value)}><option value="">Tất cả hãng</option>{data?.hangs.map((h) => <option key={h.id} value={h.id}>{h.tenHang}</option>)}</select>
          </>
        )}
      </FilterBar>
      <ListState loading={loading} error={error} data={data} retry={reload} empty={dangXemAn ? "Không có sản phẩm đang ẩn khớp bộ lọc." : "Thử đổi từ khóa, loại sản phẩm hoặc thương hiệu."}>
        {data && (
          <>
            <div className="table-responsive card-custom"><table className="table align-middle mb-0">
              <thead><tr><th>Ảnh</th><th>Tên sản phẩm</th><th>Loại</th><th>Hãng</th><th className="text-end">Giá bán</th><th className="text-end">Tồn kho</th><th className="text-end">Thao tác</th></tr></thead>
              <tbody>{data.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <img src={imgUrl(s.hinhAnhDaiDien)} alt="" width={48} height={48} style={{ objectFit: "contain" }} />
                  </td>
                  <td>{dangXemAn ? <span className="fw-semibold">{s.tenSanPham}</span> : <Link href={`/admin/san-pham/${s.id}`} className="fw-semibold text-decoration-none">{s.tenSanPham}</Link>}{s.khuyenMai && <span className="badge bg-danger ms-2">-{Math.round(s.khuyenMai.phanTramGiam)}%</span>}{s.daAn && <span className="badge bg-secondary ms-2">Đang ẩn</span>}</td>
                  <td className="text-nowrap">{s.loai?.tenLoai ?? "—"}</td><td className="text-nowrap">{s.hang?.tenHang ?? "—"}</td>
                  <td className="text-end text-nowrap"><strong>{vnd(s.dangGiamGia ? s.giaSauKhuyenMai : s.giaGoc)}</strong>
                    {s.dangGiamGia && <del className="d-block small text-muted">{vnd(s.giaGoc)}</del>}
                  </td>
                  <td className="text-end">{s.tongTonKho === 0 ? <span className="badge bg-danger">Hết hàng</span> : s.tongTonKho ?? "—"}</td>
                  <td className="text-end text-nowrap">
                    {dangXemAn || s.daAn ? (
                      <button className="btn btn-sm btn-outline-success" onClick={() => doiAn(s, "hien")}><i className="fa-solid fa-eye" /> Hiện lại</button>
                    ) : (<>
                      <Link href={`/admin/san-pham/${s.id}`} className="btn btn-sm btn-outline-secondary me-1">Phiên bản</Link>
                      <Link href={`/admin/san-pham/${s.id}/edit`} className="btn btn-sm btn-outline-primary me-1" aria-label={`Sửa ${s.tenSanPham}`}>Sửa</Link>
                      {xoaDuoc
                        ? <button className="btn btn-sm btn-outline-danger" title="Xóa" aria-label={`Xóa ${s.tenSanPham}`} onClick={() => xoa(s)}><i className="fa-solid fa-trash" aria-hidden="true" /></button>
                        : <button className="btn btn-sm btn-outline-warning" title="Ẩn" aria-label={`Ẩn sản phẩm ${s.tenSanPham}`} onClick={() => doiAn(s, "an")}><i className="fa-solid fa-eye-slash" /></button>}
                    </>)}
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
