"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FilterBar, FilterLinks, ListState, Pagination } from "@/components/admin/Common";
import { ngayGio, tenTrangThaiClass, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { DonHangV, Trang } from "@/lib/types";

export default function QuanLyDonHangPage() {
  const sp = useSearchParams();
  const q = sp.toString();
  const { data, error, loading, reload } = useApi<Trang<DonHangV> & { dsTrangThai: string[] }>(`/admin/don-hang${q ? `?${q}` : ""}`);
  const uuTien = ["Chờ xác nhận", "Đang xử lý", "Đang giao hàng"];
  const trangThaiKhac = data?.dsTrangThai.filter((value) => !uuTien.includes(value)) ?? [];
  return (
    <>
      <FilterLinks label="Xem nhanh đơn theo trạng thái" field="trangThai" options={[{ value: "", label: "Tất cả đơn" }, ...uuTien.map((value) => ({ value, label: value }))]} />
      <FilterBar placeholder="Mã đơn, tên khách hoặc số điện thoại…">
        {(set, get) => <select className="form-select w-auto" aria-label="Trạng thái đơn hàng" value={get("trangThai")} onChange={(e) => set("trangThai", e.target.value)}>
          <option value="">Tất cả trạng thái</option>{[...new Set([...uuTien, ...trangThaiKhac, get("trangThai")].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}
        </select>}
      </FilterBar>
      <ListState loading={loading} error={error} data={data} retry={reload} empty="Không có đơn phù hợp. Thử tìm theo mã đơn hoặc chọn trạng thái khác.">
        {data && (<>
          <div className="table-responsive card-custom"><table className="table align-middle mb-0">
            <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>SĐT nhận</th><th>Ngày đặt</th><th className="text-end">Tổng tiền</th><th>Trạng thái</th><th className="text-end">Thao tác</th></tr></thead>
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
