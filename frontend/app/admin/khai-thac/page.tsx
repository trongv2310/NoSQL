"use client";

import { useRef, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { Field } from "@/components/admin/Common";
import { ErrorBox } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { ngayGio, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { K_TOI_DA, THANG_TOI_DA, kiemTraThamSo } from "@/lib/khai-thac";
import type { DongKetQuaTopK, GoiYDaLuuV, KetQuaTopK } from "@/lib/types";

/** POST /admin/khai-thac/top-k trả thêm `thanhCong` và `daLuuGoiY` ngoài kết quả. */
type PhanHoi = KetQuaTopK & { thanhCong: boolean; daLuuGoiY: boolean };

/** Huy hiệu hạng: 1 vàng (cúp), 2 bạc, 3 đồng; còn lại xám. Có chữ cho trình đọc màn hình. */
function HuyHieuHang({ hang }: { hang: number }) {
  const chu = <span className="visually-hidden">Hạng </span>;
  if (hang === 1) return <span className="badge bg-warning text-dark fs-6">{chu}<i className="fa-solid fa-trophy me-1" aria-hidden="true" />1</span>;
  if (hang === 2) return <span className="badge text-dark border fs-6" style={{ background: "#e4e7eb" }}>{chu}<i className="fa-solid fa-medal me-1" aria-hidden="true" />2</span>;
  if (hang === 3) return <span className="badge fs-6" style={{ background: "#cd7f32", color: "#fff" }}>{chu}<i className="fa-solid fa-medal me-1" aria-hidden="true" />3</span>;
  return <span className="badge bg-secondary fs-6">{chu}{hang}</span>;
}

function BangKetQua({ ds }: { ds: DongKetQuaTopK[] }) {
  return (
    <div className="table-responsive">
      <table className="table align-middle mb-0">
        <thead><tr><th style={{ width: 110 }}>Xếp hạng</th><th>Bộ sản phẩm</th><th className="text-end" style={{ width: 190 }}>Doanh số mua cùng</th></tr></thead>
        <tbody>
          {ds.map((d) => (
            <tr key={d.khoa}>
              <td><HuyHieuHang hang={d.hang} /></td>
              <td className="fw-semibold">{d.tenTap}</td>
              <td className="text-end fw-bold text-nowrap">{vnd(d.loiNhuan)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function KhaiThacTopKPage() {
  const { flash } = useApp();
  const [kStr, setKStr] = useState("5");
  const [thangStr, setThangStr] = useState("3");
  const [loiNhap, setLoiNhap] = useState<{ loiK?: string; loiThang?: string }>({});
  const [kq, setKq] = useState<PhanHoi | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState<"phan-tich" | "ap-dung" | null>(null);
  const dangGoi = useRef(false); // chống bấm đúp: ref đổi ngay, state chỉ cập nhật ở lần vẽ sau
  const daLuu = useApi<GoiYDaLuuV>("/admin/khai-thac/goi-y-da-luu");

  const goi = async (k: number, soThang: number, luuGoiY: boolean) => {
    if (dangGoi.current) return;
    dangGoi.current = true;
    setDang(luuGoiY ? "ap-dung" : "phan-tich");
    setLoi(null);
    try {
      const r = await apiPost<PhanHoi>("/admin/khai-thac/top-k", { k, soThang, luuGoiY });
      setKq(r);
      if (luuGoiY) {
        flash("success", r.daLuuGoiY ? "Đã áp dụng combo cho khách." : "Máy chủ không xác nhận đã lưu combo. Hãy xem khối \"Combo đang áp dụng cho khách\".");
        await daLuu.reload();
      }
    } catch (e) {
      setLoi(loiTuApi(e));
    } finally {
      dangGoi.current = false;
      setDang(null);
    }
  };

  const phanTich = (e: React.FormEvent) => {
    e.preventDefault();
    const t = kiemTraThamSo(kStr, thangStr);
    if (!t.ok) { setLoiNhap({ loiK: t.loiK, loiThang: t.loiThang }); return; }
    setLoiNhap({});
    void goi(t.k, t.soThang, false);
  };

  // Áp dụng đúng tham số của kết quả đang hiển thị (không theo ô nhập đã bị sửa sau đó). Máy chủ tính lại rồi lưu, nên bảng được thay bằng kết quả vừa lưu.
  const apDung = () => {
    if (!kq || kq.ketQua.length === 0) return;
    if (!confirm(`Áp dụng ${kq.ketQua.length} combo (xem ${kq.k} combo, ${kq.soThang} tháng gần nhất) cho khách? Combo đang áp dụng sẽ bị thay thế.`)) return;
    void goi(kq.k, kq.soThang, true);
  };

  const dangChay = dang !== null;
  const luu = daLuu.data;

  return (
    <>
      <form className="card-custom admin-report-card mb-3" onSubmit={phanTich} noValidate>
        <header><h2>Phân tích đơn đã hoàn thành</h2>
          <p>Doanh số mua cùng là tổng thành tiền của các món trong bộ, trên những đơn có đủ bộ đó. Phân tích cho bạn xem trước các gợi ý.</p>
        </header>
        <div className="row g-3 align-items-end">
          <div className="col-6 col-md-3">
            <Field label="Số combo cần xem" hint={`Từ 1 đến ${K_TOI_DA}.`}>
              <input className={`form-control${loiNhap.loiK ? " is-invalid" : ""}`} type="number" inputMode="numeric" min={1} max={K_TOI_DA} step={1} value={kStr} disabled={dangChay} aria-invalid={!!loiNhap.loiK} onChange={(e) => setKStr(e.target.value)} />
            </Field>
            {loiNhap.loiK && <div className="text-danger small mb-2" role="alert">{loiNhap.loiK}</div>}
          </div>
          <div className="col-6 col-md-3">
            <Field label="Số tháng gần nhất" hint={`Từ 1 đến ${THANG_TOI_DA}.`}>
              <input className={`form-control${loiNhap.loiThang ? " is-invalid" : ""}`} type="number" inputMode="numeric" min={1} max={THANG_TOI_DA} step={1} value={thangStr} disabled={dangChay} aria-invalid={!!loiNhap.loiThang} onChange={(e) => setThangStr(e.target.value)} />
            </Field>
            {loiNhap.loiThang && <div className="text-danger small mb-2" role="alert">{loiNhap.loiThang}</div>}
          </div>
          <div className="col-12 col-md-6 mb-3 d-flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={dangChay} aria-busy={dang === "phan-tich"}>
              <i className={`fa-solid ${dang === "phan-tich" ? "fa-spinner fa-spin" : "fa-magnifying-glass-chart"}`} aria-hidden="true" /> {dang === "phan-tich" ? "Đang phân tích…" : "Phân tích"}
            </button>
          </div>
        </div>
      </form>

      {dangChay && <p className="text-muted" role="status"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Đang xử lý, với nhiều đơn hàng có thể mất vài giây…</p>}
      {loi && <ErrorBox message={loi} />}

      {kq && (
        <section className="card-custom admin-report-card mb-3" aria-labelledby="kt-ket-qua">
          <header className="admin-section-bar">
            <div><h2 id="kt-ket-qua">Kết quả phân tích</h2>
              <p>{kq.ketQua.length} combo tìm được trong {kq.soThang} tháng · Đã xét {kq.soDonXet} đơn · {ngayGio(kq.chayLuc)}
                {kq.daLuuGoiY && <> · <span className="badge bg-success">Đã áp dụng</span></>}
              </p>
            </div>
            {kq.ketQua.length > 0 && <button type="button" className="btn btn-primary" disabled={dangChay} aria-busy={dang === "ap-dung"} onClick={apDung}>
              {dang === "ap-dung" ? "Đang áp dụng…" : "Áp dụng làm combo cho khách"}
            </button>}
          </header>
          {kq.biCat && <div className="alert alert-warning" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Số đơn hàng vượt giới hạn mỗi lần chạy nên chỉ các đơn mới nhất được xét; kết quả có thể thiếu đơn cũ.</div>}
          {kq.ketQua.length === 0
            ? <p className="admin-report-empty">Chưa tìm được bộ sản phẩm mua cùng. Thử chọn khoảng dài hơn hoặc kiểm tra các đơn đã hoàn thành có từ hai sản phẩm khác nhau.</p>
            : <BangKetQua ds={kq.ketQua} />}
        </section>
      )}

      <section className="card-custom admin-report-card" aria-labelledby="kt-da-luu" aria-busy={daLuu.loading}>
        <header><h2 id="kt-da-luu">Combo đang áp dụng cho khách</h2></header>
        {daLuu.loading && !luu ? <div className="text-muted py-3"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Đang tải...</div>
          : daLuu.error ? (
            <div className="py-2"><ErrorBox message={daLuu.error} /><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void daLuu.reload()}>Thử lại</button></div>
          ) : !luu || !luu.coDuLieu || luu.ketQua.length === 0 ? (
            <div className="text-muted py-3">Chưa có combo nào được áp dụng, nên khách chưa thấy khối combo. Hãy phân tích rồi bấm &quot;Áp dụng làm combo cho khách&quot;.</div>
          ) : (
            <>
              <p className="text-muted small mb-3">
                {luu.ketQua.length} combo đã lưu{luu.capNhatLuc && <> · Cập nhật {ngayGio(luu.capNhatLuc)}</>}.
                Trang khách hiển thị tối đa ba combo có ít nhất hai món còn hàng.
              </p>
              <BangKetQua ds={luu.ketQua} />
            </>
          )}
      </section>
    </>
  );
}
