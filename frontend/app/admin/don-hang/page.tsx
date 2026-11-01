"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FilterBar, ListState, PageBar, Pagination } from "@/components/admin/Common";
import { ngayGio, tenTrangThaiClass, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { DonHangV, Trang } from "@/lib/types";

export default function QuanLyDonHangPage() {
  const sp = useSearchParams();
  const q = sp.toString();
  const { data, error, loading } = useApi<Trang<DonHangV> & { dsTrangThai: string[] }>(`/admin/don-hang${q ? `?${q}` : ""}`);
  return (
    <>
      <PageBar title="Danh sách đơn hàng" />
      <FilterBar>
        {(set, get) => <select className="form-select w-auto" value={get("trangThai")} onChange={(e) => set("trangThai", e.target.value)}><option value="">Tất cả trạng thái</option>{data?.dsTrangThai.map((t) => <option key={t}>{t}</option>)}</select>}
      </FilterBar>
      <ListState loading={loading} error={error} data={data} empty="Không có đơn hàng nào.">
        {data && (<>
          <div className="table-responsive card-custom"><table className="table align-middle mb-0">
            <thead><tr><th>Mã</th><th>Khách hàng</th><th>SĐT nhận</th><th>Ngày đặt</th><th className="text-end">Tổng tiền</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>{data.items.map((d) => (
              <tr key={d.id}><td className="fw-semibold">#{d.soDonHang}</td><td>{d.khachHang?.hoTen ?? "—"}</td><td>{d.soDienThoaiNhanHang}</td><td>{ngayGio(d.ngayDat)}</td>
                <td className="text-end">{vnd(d.tongTienSauGiam)}</td><td><span className={`badge ${tenTrangThaiClass(d.trangThai)}`}>{d.trangThai}</span></td>
                <td className="text-end"><Link href={`/admin/don-hang/${d.soDonHang}`} className="btn btn-sm btn-outline-primary">Chi tiết</Link></td></tr>))}</tbody>
          </table></div>
          <Pagination trang={data} />
        </>)}
      </ListState>
    </>
  );
}
