"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProviders";
import { nhanKhung } from "@/components/tu-vot/LichCang";
import { ErrorBox, Loading } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { useApi } from "@/lib/hooks";

interface Cho { _id: string; tenKhach?: string; tenVot?: string; giaTriNhap: number; donViNhap: "kg" | "lbs"; mucCangLbs: number; tenDay?: string; trangThai: "cho" | "xong" | "huy" }
interface Khung { _id: string; ngay: string; sucChua: number; soDaDat: number; datCho: Cho[] }

const TRANG_THAI = {
  cho: { nhan: "Đang chờ", badge: "bg-warning text-dark" },
  xong: { nhan: "Đã căng xong", badge: "bg-success" },
  huy: { nhan: "Đã hủy", badge: "bg-secondary" },
} as const;

/** Đọc đồng hồ. Không gọi trực tiếp khi render: chỉ dùng để khởi tạo state và trong trình xử lý sự kiện. */
const layBayGio = () => Date.now();

export default function LichCangAdminPage() {
  const { flash } = useApp();
  const { data, error, loading, reload } = useApi<Khung[]>("/admin/lich-cang");
  const [dang, setDang] = useState<string | null>(null);
  const [loc, setLoc] = useState<Cho["trangThai"] | "">("cho");
  // Mốc "bây giờ" để khoá nút xác nhận của khung chưa tới; cập nhật mỗi lần tải lại. Máy chủ vẫn tự kiểm tra lại.
  const [bayGio, setBayGio] = useState(layBayGio);
  const taiLai = async () => { setBayGio(layBayGio()); await reload(); };
  const xong = async (k: Khung, c: Cho) => {
    if (dang !== null) return;
    setDang(c._id);
    try {
      const r = await apiPost<{ message: string }>(`/admin/lich-cang/${k._id}/${c._id}/xong`);
      flash("success", r.message);
      await taiLai();
    } catch (e) { flash("danger", loiTuApi(e)); } finally { setDang(null); }
  };
  const dem = { cho: 0, xong: 0, huy: 0 };
  for (const { datCho } of data ?? []) for (const c of datCho) dem[c.trangThai]++;
  const lich = (data ?? []).map((khung) => ({ khung, choXem: khung.datCho.filter((c) => !loc || loc === c.trangThai) })).filter((x) => x.choXem.length);
  return <>
    <div className="admin-section-bar">
      <p className="text-muted mb-0">Từ hôm qua đến 7 ngày tới</p>
      <button type="button" className="btn btn-outline-primary" disabled={loading || dang !== null} onClick={() => void taiLai()}><i className="fa-solid fa-rotate" aria-hidden="true" /> Làm mới</button>
    </div>
    <div className="admin-segments mb-3" role="group" aria-label="Trạng thái lịch căng">
      <button type="button" aria-pressed={!loc} onClick={() => setLoc("")}>Tất cả · {dem.cho + dem.xong + dem.huy}</button>
      {(["cho", "xong", "huy"] as const).map((id) => <button type="button" key={id} aria-pressed={id === loc} onClick={() => setLoc(id)}>
        {TRANG_THAI[id].nhan} · {dem[id]}
      </button>)}
    </div>
    {error && !loading ? <div className="card-custom p-3"><ErrorBox message={error} />
      <button type="button" className="btn btn-outline-primary" onClick={() => void reload()}>Thử lại</button>
    </div> : loading && !data ? <Loading /> : !lich.length ? (
      <div className="admin-list-empty card-custom" role="status"><i className="fa-solid fa-calendar-check" aria-hidden="true" />
        <strong>{loc ? `Chưa có lịch ${TRANG_THAI[loc].nhan.toLowerCase()}` : "Chưa có lịch căng cước"}</strong>
        {loc && dem.cho + dem.xong + dem.huy > 0 && <button type="button" className="btn btn-outline-primary" onClick={() => setLoc("")}>Xem tất cả lịch</button>}
      </div>
    ) : <div aria-busy={loading}>{lich.map(({ khung, choXem }) => (
      <section key={khung._id} className="card-custom admin-booking-slot">
        <header><h2>{nhanKhung(khung.ngay)}</h2><span className={khung.soDaDat >= khung.sucChua ? "badge bg-warning text-dark" : "badge bg-success"}>
          {khung.soDaDat}/{khung.sucChua} chỗ đã đặt
        </span></header>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead><tr><th>Khách</th><th>Vợt</th><th>Mức căng</th><th>Dây</th><th>Trạng thái</th><th className="text-end">Thao tác</th></tr></thead>
            <tbody>{choXem.map((c) => (
              <tr key={c._id}>
                <td className="fw-semibold">{c.tenKhach ?? "—"}</td><td>{c.tenVot ?? "—"}</td>
                <td className="text-nowrap">{c.giaTriNhap} {c.donViNhap}{c.donViNhap === "kg" && <small className="d-block text-muted">{c.mucCangLbs} lbs</small>}</td>
                <td>{c.tenDay ?? "—"}</td><td><span className={"badge " + TRANG_THAI[c.trangThai].badge}>{TRANG_THAI[c.trangThai].nhan}</span></td>
                <td className="text-end">{c.trangThai === "cho" && (new Date(khung.ngay).getTime() > bayGio
                  ? <span className="text-muted small text-nowrap" title="Chỉ xác nhận đã căng khi khung giờ đã bắt đầu.">Chưa tới giờ hẹn</span>
                  : <button type="button" className="btn btn-sm btn-primary" disabled={dang !== null} onClick={() => void xong(khung, c)}>
                    {dang === c._id ? "Đang ghi sổ…" : "Xác nhận đã căng"}
                  </button>)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    ))}</div>}
  </>;
}
