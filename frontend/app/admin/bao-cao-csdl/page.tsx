"use client";

import { useState } from "react";
import { ErrorBox, Loading } from "@/components/Ui";
import { useApi } from "@/lib/hooks";

interface BaoCao {
  coMau: boolean; coDuLieuMau: boolean; thoiGianMs: number;
  mucCangTheoTrinhDo: { _id: string; tb: number; thapNhat: number; caoNhat: number; doLech: number; so: number }[];
  phanBoMucCang: { _id: number | "khac"; so: number }[];
  dayTheoLoiChoi: { _id: string; tong: number; day: { ten: string; so: number }[] }[];
  chuKyThucTe: { _id: string | null; tb: number; trungVi: number; so: number }[];
  vuotMucNSX: { _id: string; tong: number; vuot: number }[];
  votTheoTrinhDo: { trinhDo: string; sanPham: string; ten: string; tb: number; so: number }[];
  denHan: { _id: "daDenHan" | "trong7Ngay"; so: number }[];
}

const TRINH_DO: Record<string, string> = { moi: "Mới chơi", deu: "Chơi đều", thi: "Thi đấu" };
const LOI_CHOI: Record<string, string> = { cong: "Uy lực", toc: "Tốc độ", toan: "Kiểm soát" };
const thuTu = (k: string | null) => ["moi", "deu", "thi"].indexOf(k ?? "");
const so1 = (x: number) => x.toLocaleString("vi-VN", { maximumFractionDigits: 1 });

/** Báo cáo từ sổ căng cước và đánh giá theo nhóm người chơi. Mỗi bảng là một aggregation pipeline (backend/src/admin/bao-cao-csdl.ts). */
export default function BaoCaoCsdlPage() {
  const [coMau, setCoMau] = useState(true);
  const { data, error, loading } = useApi<BaoCao>(`/admin/bao-cao-csdl?mau=${coMau ? 1 : 0}`);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Lỗi tải báo cáo"} />;
  const maxBucket = Math.max(1, ...data.phanBoMucCang.map((b) => b.so));
  const den = Object.fromEntries(data.denHan.map((d) => [d._id, d.so]));
  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h5 className="mb-0">Báo cáo sổ căng cước và đánh giá</h5>
        <label className="form-check form-switch mb-0">
          <input type="checkbox" className="form-check-input" checked={coMau} onChange={(e) => setCoMau(e.target.checked)} />
          <span className="form-check-label">Tính cả dữ liệu mẫu</span>
        </label>
      </div>
      {data.coMau && data.coDuLieuMau && <div className="alert alert-warning py-2">Đang tính cả <b>dữ liệu mẫu</b> (sinh bằng <code>npm run db:du-lieu-mau</code> để minh hoạ). Số liệu không phản ánh khách hàng thật.</div>}
      <p className="small text-muted">7 aggregation chạy song song trong {data.thoiGianMs} ms.</p>

      <div className="row g-3">
        <div className="col-lg-6"><div className="card-custom p-3 h-100">
          <h6>Mức căng theo trình độ <small className="text-muted">($group, $avg, $stdDevPop)</small></h6>
          <table className="table table-sm mb-0"><thead><tr><th>Trình độ</th><th>TB (lbs)</th><th>Thấp–cao</th><th>Độ lệch</th><th>Số lần</th></tr></thead>
            <tbody>{[...data.mucCangTheoTrinhDo].sort((a, b) => thuTu(a._id) - thuTu(b._id)).map((x) => <tr key={x._id}><td>{TRINH_DO[x._id] ?? x._id}</td><td><b>{so1(x.tb)}</b></td><td>{x.thapNhat}–{x.caoNhat}</td><td>{so1(x.doLech)}</td><td>{x.so}</td></tr>)}</tbody></table>
        </div></div>

        <div className="col-lg-6"><div className="card-custom p-3 h-100">
          <h6>Phân bố mức căng <small className="text-muted">($bucket, mỗi khoảng 2 lbs)</small></h6>
          {data.phanBoMucCang.map((b, i) => {
            const nhan = b._id === "khac" ? "khác" : `${b._id}–${data.phanBoMucCang[i + 1]?._id ?? "…"}`;
            return <div key={String(b._id)} className="d-flex align-items-center gap-2 small"><span style={{ width: 60 }}>{nhan}</span><div className="progress flex-grow-1" style={{ height: 10 }}><div className="progress-bar" style={{ width: `${(b.so / maxBucket) * 100}%` }} /></div><span style={{ width: 36 }} className="text-end">{b.so}</span></div>;
          })}
        </div></div>

        <div className="col-lg-6"><div className="card-custom p-3 h-100">
          <h6>Chu kỳ căng lại thực tế <small className="text-muted">($setWindowFields + $shift + $dateDiff, $median)</small></h6>
          <table className="table table-sm mb-0"><thead><tr><th>Trình độ</th><th>TB (ngày)</th><th>Trung vị</th><th>Số khoảng</th></tr></thead>
            <tbody>{[...data.chuKyThucTe].sort((a, b) => thuTu(a._id) - thuTu(b._id)).map((x) => <tr key={String(x._id)}><td>{TRINH_DO[x._id ?? ""] ?? "Không rõ"}</td><td><b>{so1(x.tb)}</b></td><td>{so1(x.trungVi)}</td><td>{x.so}</td></tr>)}</tbody></table>
        </div></div>

        <div className="col-lg-6"><div className="card-custom p-3 h-100">
          <h6>Dây dùng nhiều nhất theo lối chơi <small className="text-muted">($group hai tầng, $push, $slice)</small></h6>
          <ul className="list-unstyled small mb-0">{data.dayTheoLoiChoi.map((x) => <li key={x._id} className="mb-1"><b>{LOI_CHOI[x._id] ?? x._id}</b> ({x.tong} lần): {x.day.map((d) => `${d.ten} (${d.so})`).join(", ")}</li>)}</ul>
        </div></div>

        <div className="col-lg-6"><div className="card-custom p-3 h-100">
          <h6>Căng vượt mức tối đa nhà sản xuất</h6>
          <ul className="list-unstyled small mb-2">{data.vuotMucNSX.map((x) => <li key={x._id}>{x._id === "shop" ? "Tại shop" : "Ở ngoài"}: <b>{x.vuot}</b> / {x.tong} lần ({so1((x.vuot / Math.max(1, x.tong)) * 100)}%)</li>)}</ul>
          <h6 className="mt-3">Vợt đến hạn căng lại <small className="text-muted">(index sparse han_nhac)</small></h6>
          <p className="small mb-0">Đã đến hạn: <b>{den.daDenHan ?? 0}</b> · Trong 7 ngày tới: <b>{den.trong7Ngay ?? 0}</b></p>
        </div></div>

        <div className="col-lg-6"><div className="card-custom p-3 h-100">
          <h6>Vợt được chấm cao nhất theo trình độ người viết <small className="text-muted">(≥ 3 đánh giá, $lookup tên)</small></h6>
          <table className="table table-sm mb-0"><thead><tr><th>Trình độ</th><th>Vợt</th><th>Điểm</th><th>Số ĐG</th></tr></thead>
            <tbody>{data.votTheoTrinhDo.map((x) => <tr key={`${x.trinhDo}-${x.sanPham}`}><td>{TRINH_DO[x.trinhDo] ?? x.trinhDo}</td><td>{x.ten}</td><td><b>{x.tb}</b></td><td>{x.so}</td></tr>)}</tbody></table>
        </div></div>
      </div>
    </>
  );
}
