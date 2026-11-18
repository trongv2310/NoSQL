"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProviders";
import { nhanKhung } from "@/components/tu-vot/LichCang";
import { ErrorBox, Loading } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { useApi } from "@/lib/hooks";

interface Cho { _id: string; tenKhach?: string; tenVot?: string; giaTriNhap: number; donViNhap: "kg" | "lbs"; mucCangLbs: number; tenDay?: string; trangThai: "cho" | "xong" | "huy" }
interface Khung { _id: string; ngay: string; sucChua: number; soDaDat: number; datCho: Cho[] }

/**
 * Lịch căng cước tại shop (nhân viên). "Đã căng xong" ghi luôn lần căng vào sổ căng (hộ chiếu vợt) của khách,
 * trong MỘT transaction nếu MongoDB chạy replica set.
 */
export default function LichCangAdminPage() {
  const { flash } = useApp();
  const { data, error, loading, reload } = useApi<Khung[]>("/admin/lich-cang");
  const [dang, setDang] = useState<string | null>(null);
  const xong = async (k: Khung, c: Cho) => {
    setDang(c._id);
    try {
      const r = await apiPost<{ message: string; coTransaction: boolean }>(`/admin/lich-cang/${k._id}/${c._id}/xong`);
      flash("success", `${r.message}${r.coTransaction ? " (transaction)" : ""}`);
      await reload();
    } catch (e) { flash("danger", loiTuApi(e)); } finally { setDang(null); }
  };
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Lỗi tải lịch căng"} />;
  const NHAN = { cho: "Đang chờ", xong: "Đã căng xong", huy: "Khách đã huỷ" } as const;
  return (
    <>
      <h5 className="mb-3">Lịch căng cước tại shop (từ hôm qua đến 7 ngày tới)</h5>
      {data.length === 0 ? <div className="text-center text-muted py-4">Chưa có lịch nào.</div> : data.map((k) => (
        <div key={k._id} className="card-custom p-3 mb-2">
          <div className="d-flex justify-content-between flex-wrap"><strong>{nhanKhung(k.ngay)}</strong><small className="text-muted">{k.soDaDat}/{k.sucChua} chỗ</small></div>
          <table className="table table-sm mb-0 mt-2">
            <thead><tr><th>Khách</th><th>Vợt</th><th>Mức căng</th><th>Dây</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>{k.datCho.map((c) => (
              <tr key={c._id}>
                <td>{c.tenKhach ?? "—"}</td><td>{c.tenVot ?? "—"}</td>
                <td>{c.giaTriNhap} {c.donViNhap}{c.donViNhap === "kg" ? ` (${c.mucCangLbs} lbs)` : ""}</td>
                <td>{c.tenDay ?? "—"}</td><td>{NHAN[c.trangThai]}</td>
                <td>{c.trangThai === "cho" && <button className="btn btn-sm btn-success" disabled={dang === c._id} onClick={() => xong(k, c)}>Đã căng xong</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ))}
    </>
  );
}
