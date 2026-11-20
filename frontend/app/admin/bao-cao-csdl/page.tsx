"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ErrorBox, Loading } from "@/components/Ui";
import { useApi } from "@/lib/hooks";

interface BaoCao {
  coMau: boolean;
  mucCangTheoTrinhDo: { _id: string | null; tb: number; thapNhat: number; caoNhat: number; doLech: number; so: number }[];
  phanBoMucCang: { _id: number | "khac"; so: number }[];
  dayTheoLoiChoi: { _id: string; tong: number; day: { ten: string; so: number }[] }[];
  chuKyThucTe: { _id: string | null; tb: number; trungVi: number | null; so: number }[];
  vuotMucNSX: { _id: string | null; tong: number; vuot: number }[];
  votTheoTrinhDo: { trinhDo: string; sanPham: string; ten?: string; tb: number; so: number }[];
  denHan: { _id: "daDenHan" | "trong7Ngay"; so: number }[];
  luotXemTheoNgay: { ngay: string; so: number; tb7: number }[];
  xemNhieu: { sanPham: string; tenSanPham: string | null; so: number; soNgayCoXem: number }[];
}

const TRINH_DO: Record<string, string> = { moi: "Mới chơi", deu: "Chơi đều", thi: "Thi đấu" };
const LOI_CHOI: Record<string, string> = { cong: "Uy lực", toc: "Tốc độ", toan: "Kiểm soát" };
const NGUONG_MUC_CANG = [14, 18, 20, 22, 24, 26, 28, 30, 32, 40];
const nhomBaoCao = [["cang", "Sổ căng"], ["danh-gia", "Đánh giá vợt"], ["luot-xem", "Lượt xem sản phẩm"]] as const;
const thuTu = (k: string | null) => {
  const index = Object.keys(TRINH_DO).indexOf(k ?? "");
  return index === -1 ? 3 : index;
};
const so = (x: number, decimals = 1) => x.toLocaleString("vi-VN", { maximumFractionDigits: decimals });
const trinhDo = (k: string | null) => TRINH_DO[k ?? ""] ?? "Chưa rõ trình độ";
const mocNgay = (s: string) => new Date(s).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" });

function tieuDeKhoang(muc: BaoCao["phanBoMucCang"][number]["_id"]) {
  if (muc === "khac") return "Ngoài các khoảng trên";
  const index = NGUONG_MUC_CANG.indexOf(muc);
  const canTren = index >= 0 ? NGUONG_MUC_CANG[index + 1] : undefined;
  return canTren && canTren > muc ? `${muc} đến dưới ${canTren} lbs` : `Từ ${muc} lbs`;
}

function TheBaoCao({ title, note, children, wide }: { title: string; note?: string; children: ReactNode; wide?: boolean }) {
  return <section className={wide ? "card-custom admin-report-card admin-report-wide" : "card-custom admin-report-card"}>
    <header><h2>{title}</h2>{note && <p>{note}</p>}</header>{children}
  </section>;
}

function Bang({ heads, rows, empty }: { heads: string[]; rows: { key: string; cells: ReactNode[] }[]; empty: string }) {
  if (!rows.length) return <p className="admin-report-empty">{empty}</p>;
  return <div className="table-responsive"><table role="table" className={heads.length > 3 ? "table align-middle mb-0 admin-report-table is-stacked" : "table align-middle mb-0 admin-report-table"}>
    <thead role="rowgroup"><tr role="row">{heads.map((label) => <th key={label} scope="col" role="columnheader">{label}</th>)}</tr></thead>
    <tbody role="rowgroup">{rows.map(({ key, cells }) => <tr key={key} role="row">
      {cells.map((cell, i) => <td key={heads[i]} data-label={heads[i]} role="cell">{cell}</td>)}
    </tr>)}</tbody>
  </table></div>;
}

function BieuDoLuotXem({ ngay }: { ngay: BaoCao["luotXemTheoNgay"] }) {
  const ds = [...ngay].sort((a, b) => Date.parse(a.ngay) - Date.parse(b.ngay));
  if (!ds.some((d) => d.so > 0)) return <p className="admin-report-empty">Chưa có lượt xem nào trong 30 ngày qua.</p>;
  const w = 720, h = 225, left = 45, bottom = 34, top = 18;
  const width = (w - left - 8) / ds.length;
  const max = Math.max(1, ...ds.map((d) => Math.max(d.so, d.tb7)));
  const y = (v: number) => h - bottom - (v / max) * (h - bottom - top);
  return <>
    <div className="admin-chart-legend">
      <span><i aria-hidden="true" /> Lượt xem mỗi ngày</span><span><i aria-hidden="true" /> Trung bình 7 ngày gần nhất</span>
    </div>
    <svg className="admin-report-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Lượt xem trong ${ds.length} ngày, cao nhất ${so(max)} lượt trong một ngày`}>
      {[0, max / 2, max].map((v) => <g key={v}>
        <line x1={left} x2={w - 8} y1={y(v)} y2={y(v)} stroke="#dce7e2" />
        <text x={left - 9} y={y(v) + 4} textAnchor="end">{so(v)}</text>
      </g>)}
      {ds.map((d, i) => <rect key={d.ngay} x={left + i * width + 2} y={y(d.so)} width={width - 4} height={y(0) - y(d.so)} rx={2} fill="#85cdb4">
        <title>{`${mocNgay(d.ngay)}: ${d.so} lượt xem`}</title>
      </rect>)}
      <polyline fill="none" stroke="#11634c" strokeWidth={2.5} points={ds.map((d, i) => `${left + i * width + width / 2},${y(d.tb7)}`).join(" ")} />
      <text x={left} y={h - 13}>{mocNgay(ds[0].ngay)}</text>
      <text x={w - 8} y={h - 13} textAnchor="end">{mocNgay(ds[ds.length - 1].ngay)}</text>
    </svg>
    <details className="admin-report-details">
      <summary>Xem số lượt theo từng ngày</summary>
      <Bang heads={["Ngày", "Lượt xem", "Trung bình 7 ngày"]} empty="Chưa có lượt xem."
        rows={ds.map((d) => ({ key: d.ngay, cells: [mocNgay(d.ngay), so(d.so), so(d.tb7)] }))} />
    </details>
  </>;
}

function SoCang({ data }: { data: BaoCao }) {
  const max = Math.max(1, ...data.phanBoMucCang.map((b) => b.so));
  const theoMuc = [...data.mucCangTheoTrinhDo].sort((a, b) => thuTu(a._id) - thuTu(b._id));
  const chuKy = [...data.chuKyThucTe].sort((a, b) => thuTu(a._id) - thuTu(b._id));
  return <div className="admin-report-grid">
    <TheBaoCao wide title="Mức căng theo trình độ" note="So sánh mức khách thường chọn. Dao động lớn nghĩa là mức căng giữa các lần khác nhau nhiều hơn.">
      <Bang heads={["Trình độ", "Trung bình (lbs)", "Thấp nhất – cao nhất", "Dao động (lbs)", "Số lần"]} empty="Chưa có lần căng nào kèm thông tin trình độ."
        rows={theoMuc.map((x) => ({ key: x._id ?? "", cells: [
          trinhDo(x._id), <strong key="average">{so(x.tb)}</strong>, `${so(x.thapNhat)} – ${so(x.caoNhat)}`, so(x.doLech), so(x.so),
        ] }))} />
    </TheBaoCao>
    <TheBaoCao title="Các khoảng mức căng" note="Xem khoảng sức căng nào được ghi nhận nhiều nhất.">
      {data.phanBoMucCang.length ? <ul className="admin-report-bars">
        {data.phanBoMucCang.map((b) => <li key={b._id}>
          <span>{tieuDeKhoang(b._id)}</span><span className="admin-report-meter" aria-hidden="true"><i style={{ width: (b.so / max) * 100 + "%" }} /></span><strong>{so(b.so)} lần</strong>
        </li>)}
      </ul> : <p className="admin-report-empty">Chưa có lần căng nào trong phạm vi đang xem.</p>}
    </TheBaoCao>
    <TheBaoCao title="Bao lâu khách căng lại?" note="Đếm số ngày giữa hai lần căng liên tiếp của cùng một vợt. Mốc giữa ít bị kéo lệch bởi vài khoảng rất dài.">
      <Bang heads={["Trình độ", "Trung bình (ngày)", "Mốc giữa (ngày)", "Số khoảng"]} empty="Cần ít nhất hai lần căng trên cùng một vợt để tính khoảng thời gian."
        rows={chuKy.map((x) => ({ key: x._id ?? "", cells: [
          trinhDo(x._id), <strong key="average">{so(x.tb)}</strong>, x.trungVi == null ? "—" : so(x.trungVi), so(x.so),
        ] }))} />
    </TheBaoCao>
    <TheBaoCao title="Dây được dùng nhiều theo lối chơi" note="Tối đa ba loại dây trong mỗi nhóm, dựa trên các lần có ghi tên dây và lối chơi.">
      {data.dayTheoLoiChoi.length ? <ul className="admin-report-detail-list">
        {data.dayTheoLoiChoi.map((x) => <li key={x._id}>
          <div><strong>{LOI_CHOI[x._id] ?? "Chưa rõ lối chơi"}</strong><small>{so(x.tong)} lần trong nhóm</small></div>
          <ul>{x.day.map((d) => <li key={d.ten}>{d.ten} <span>{so(d.so)} lần</span></li>)}</ul>
        </li>)}
      </ul> : <p className="admin-report-empty">Chưa có dữ liệu để so sánh loại dây theo lối chơi.</p>}
    </TheBaoCao>
    <TheBaoCao title="Lần căng vượt mức nhà sản xuất" note="So sánh số lần vượt mức tối đa cho phép, theo nơi căng được ghi trong sổ.">
      <Bang heads={["Nơi căng", "Số lần vượt", "Tổng số lần", "Tỷ lệ"]} empty="Chưa có lần căng để tính tỷ lệ."
        rows={data.vuotMucNSX.map((x) => ({ key: x._id ?? "", cells: [
          x._id === "shop" ? "Tại cửa hàng" : x._id === "ngoai" ? "Bên ngoài" : "Chưa rõ nơi căng",
          so(x.vuot), so(x.tong), <strong key="rate">{x.tong ? so(x.vuot * 100 / x.tong) + "%" : "—"}</strong>,
        ] }))} />
    </TheBaoCao>
  </div>;
}

function DanhGia({ data }: { data: BaoCao }) {
  return <TheBaoCao title="Vợt được đánh giá cao theo trình độ" note="Mỗi nhóm lấy tối đa ba mẫu vợt. Một mẫu cần ít nhất ba đánh giá trong nhóm để xuất hiện.">
    <Bang heads={["Trình độ", "Vợt", "Điểm trung bình", "Số đánh giá"]} empty="Chưa có mẫu vợt đủ ba đánh giá trong cùng một nhóm trình độ."
      rows={[...data.votTheoTrinhDo].sort((a, b) => thuTu(a.trinhDo) - thuTu(b.trinhDo) || b.tb - a.tb).map((x) => ({
        key: x.trinhDo + "-" + x.sanPham,
        cells: [trinhDo(x.trinhDo), x.ten ? <Link key="product" href={"/admin/san-pham/" + x.sanPham}>{x.ten}</Link> : "Sản phẩm không còn trong danh mục",
          <strong key="rating">{so(x.tb, 2)} / 5</strong>, so(x.so)],
      }))} />
  </TheBaoCao>;
}

export default function BaoCaoCsdlPage() {
  const [coMau, setCoMau] = useState(false);
  const [nhom, setNhom] = useState<(typeof nhomBaoCao)[number][0]>("cang");
  const { data, error, loading, reload } = useApi<BaoCao>("/admin/bao-cao-csdl?mau=" + (coMau ? "1" : "0"));
  const dangDoiDuLieu = loading || (data !== null && data.coMau !== coMau);
  const den = Object.fromEntries(data?.denHan.map((d) => [d._id, d.so]) ?? []);
  const tongLan = data?.phanBoMucCang.reduce((tong, d) => tong + d.so, 0) ?? 0;
  return <>
    <div className="admin-report-tools">
      <div className="admin-segments" role="group" aria-label="Nhóm báo cáo">
        {nhomBaoCao.map(([id, nhan]) => <button type="button" key={id} aria-pressed={nhom === id} onClick={() => setNhom(id)}>{nhan}</button>)}
      </div>
      <label className="admin-switch form-check form-switch">
        <input type="checkbox" className="form-check-input" checked={coMau} onChange={(e) => setCoMau(e.target.checked)} />
        <span className="form-check-label">Tính cả dữ liệu mẫu</span>
      </label>
    </div>
    {coMau && <p className="admin-report-banner" role="status"><i className="fa-solid fa-flask" aria-hidden="true" /> Bản xem này có thể gồm dữ liệu minh hoạ. Tắt công tắc để xem hoạt động thực tế.</p>}
    <div aria-busy={dangDoiDuLieu}>
      {error && !loading ? <div className="card-custom admin-report-card">
        <ErrorBox message="Chưa tải được báo cáo." /><button className="btn btn-outline-primary" type="button" onClick={() => void reload()}>Thử lại</button>
      </div> : !data || dangDoiDuLieu ? <Loading text="Đang tải số liệu báo cáo…" /> : (
        nhom === "cang" ? <>
          <div className="admin-kpis admin-report-kpis" aria-label="Tóm tắt sổ căng">
            <div className="admin-kpi"><span><i className="fa-solid fa-book" aria-hidden="true" /> Lần căng đã ghi</span><strong>{so(tongLan)}</strong></div>
            <div className="admin-kpi is-urgent"><span><i className="fa-solid fa-clock" aria-hidden="true" /> Vợt đã đến hạn</span><strong>{so(den.daDenHan ?? 0)}</strong></div>
            <div className="admin-kpi"><span><i className="fa-solid fa-calendar" aria-hidden="true" /> Vợt đến hạn trong 7 ngày tới</span><strong>{so(den.trong7Ngay ?? 0)}</strong></div>
          </div>
          <SoCang data={data} />
        </> : nhom === "danh-gia" ? <DanhGia data={data} /> : <div className="admin-report-grid">
          <TheBaoCao title="Lượt xem sản phẩm trong 30 ngày">
            <BieuDoLuotXem ngay={data.luotXemTheoNgay} />
          </TheBaoCao>
          <TheBaoCao title="Sản phẩm được xem nhiều trong 7 ngày" note="Số ngày có người xem cho biết sự quan tâm có kéo dài qua nhiều ngày hay tập trung vào một ngày.">
            <Bang heads={["Sản phẩm", "Lượt xem", "Số ngày có người xem"]} empty="Chưa có lượt xem trong 7 ngày qua."
              rows={data.xemNhieu.map((x) => ({ key: x.sanPham, cells: [
                x.tenSanPham ? <Link key="product" href={"/admin/san-pham/" + x.sanPham}>{x.tenSanPham}</Link> : "Sản phẩm không còn trong danh mục",
                <strong key="views">{so(x.so)}</strong>, so(x.soNgayCoXem),
              ] }))} />
          </TheBaoCao>
        </div>
      )}
    </div>
  </>;
}
