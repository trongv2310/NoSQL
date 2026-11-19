"use client";

import { useRef, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { Field, PageBar } from "@/components/admin/Common";
import { ErrorBox } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { ngayGio, vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { K_TOI_DA, THANG_TOI_DA, dinhDangThoiGian, kiemTraThamSo } from "@/lib/khai-thac";
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
        <thead><tr><th style={{ width: 110 }}>Xếp hạng</th><th>Bộ sản phẩm</th><th className="text-end" style={{ width: 190 }}>Lợi nhuận tính toán</th></tr></thead>
        <tbody>
          {ds.map((d) => (
            <tr key={d.khoa}>
              <td><HuyHieuHang hang={d.hang} /></td>
              <td className="fw-semibold">{d.tenTap}</td>
              <td className="text-end fw-bold text-danger">{vnd(d.loiNhuan)}</td>
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
      <PageBar title="Combo bán chạy: bộ sản phẩm hay được mua cùng" />
      <p className="text-muted">
        Tìm các bộ sản phẩm (từ 2 món) khách hay mua cùng nhau và mang lại lợi nhuận cao nhất, dựa trên các đơn hàng <strong>Đã hoàn thành</strong> trong những tháng gần đây.
        &quot;Phân tích&quot; chỉ tính và hiển thị, không đổi gì cho khách; chỉ khi bấm &quot;Áp dụng làm combo cho khách&quot; thì kết quả mới được lưu để khách thấy combo.
      </p>

      <form className="card-custom p-3 mb-3" onSubmit={phanTich} noValidate>
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
            <button type="button" className="btn btn-success" disabled={dangChay || !kq || kq.ketQua.length === 0} aria-busy={dang === "ap-dung"} onClick={apDung}
              title={!kq ? "Hãy bấm Phân tích trước." : kq.ketQua.length === 0 ? "Không có kết quả để áp dụng." : undefined}>
              <i className={`fa-solid ${dang === "ap-dung" ? "fa-spinner fa-spin" : "fa-bullhorn"}`} aria-hidden="true" /> {dang === "ap-dung" ? "Đang áp dụng…" : "Áp dụng làm combo cho khách"}
            </button>
          </div>
        </div>
      </form>

      {dangChay && <p className="text-muted" role="status"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Đang xử lý, với nhiều đơn hàng có thể mất vài giây…</p>}
      {loi && <ErrorBox message={loi} />}

      {kq && (
        <section className="card-custom p-3 mb-4" aria-labelledby="kt-ket-qua">
          <h5 id="kt-ket-qua" className="mb-1">Kết quả: {kq.k} combo bán chạy nhất trong {kq.soThang} tháng gần nhất</h5>
          <p className="text-muted small mb-3">
            Đã xét <strong>{kq.soDonXet}</strong> đơn · <strong>{kq.soBatch}</strong> đợt (theo tháng) · {dinhDangThoiGian(kq.thoiGianMs)} · chạy lúc {ngayGio(kq.chayLuc)}
            {kq.daLuuGoiY && <> · <span className="badge bg-success">Đã áp dụng cho khách</span></>}
          </p>
          {kq.biCat && <div className="alert alert-warning" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Số đơn hàng vượt giới hạn mỗi lần chạy nên chỉ các đơn mới nhất được xét; kết quả có thể thiếu đơn cũ.</div>}
          {kq.ketQua.length === 0
            ? <div className="text-center text-muted py-4">Không có dữ liệu để tìm combo: cần đơn &quot;Đã hoàn thành&quot; có ít nhất 2 sản phẩm khác nhau trong {kq.soThang} tháng gần nhất, và dữ liệu phải trải đủ số tháng đã chọn.</div>
            : <BangKetQua ds={kq.ketQua} />}
        </section>
      )}

      <section className="card-custom p-3" aria-labelledby="kt-da-luu" aria-busy={daLuu.loading}>
        <h5 id="kt-da-luu" className="mb-1">Combo đang áp dụng cho khách</h5>
        {daLuu.loading && !luu ? <div className="text-muted py-3"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Đang tải...</div>
          : daLuu.error ? (
            <div className="py-2"><ErrorBox message={daLuu.error} /><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void daLuu.reload()}>Thử lại</button></div>
          ) : !luu || !luu.coDuLieu || luu.ketQua.length === 0 ? (
            <div className="text-muted py-3">Chưa có combo nào được áp dụng, nên khách chưa thấy khối combo. Hãy phân tích rồi bấm &quot;Áp dụng làm combo cho khách&quot;.</div>
          ) : (
            <>
              <p className="text-muted small mb-3">
                {luu.k !== undefined && <>{luu.k} combo</>}{luu.soThang !== undefined && <> · {luu.soThang} tháng</>}{luu.capNhatLuc && <> · cập nhật {ngayGio(luu.capNhatLuc)}</>}
                {" "}· Khách thấy tối đa 3 combo đầu còn hàng, không thấy lợi nhuận hay xếp hạng.
              </p>
              <BangKetQua ds={luu.ketQua} />
            </>
          )}
      </section>
    </>
  );
}
