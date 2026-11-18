"use client";

import { useEffect, useState } from "react";
import { hoiNguoiBan } from "@/components/khu-chat";
import { fontTieuDe } from "@/components/landing/fonts";
import { buocCang, canhBaoCang, chuanHoaCang, docSucCang, doiDonVi, hienThiCang, nhapCang, type DonViCang } from "@/lib/cuoc-cang";
import { NOI_DUNG_LOI_LUU, docJson, ghiJson, khoTrinhDuyet } from "@/lib/luu-tru";
import { KHOA_DU_DINH_CANG, hopLeDuDinh, lamSachDuDinh, type DuDinhCang } from "@/lib/tu-vot";
import type { BienTheV } from "@/lib/types";
import s from "./bento.module.css";

const NHAN_DON_VI: Record<DonViCang, string> = { kg: "kg", lbs: "lbs" };
const dinhDang = (n: number) => n.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function docDuDinh(): { ds: DuDinhCang[]; hong: boolean } {
  const r = docJson(khoTrinhDuyet(), KHOA_DU_DINH_CANG, hopLeDuDinh);
  return r.trangThai === "ok" ? { ds: lamSachDuDinh(r.giaTri), hong: false } : { ds: [], hong: r.trangThai === "hong" };
}

/**
 * Trạm căng cước (tham khảo): chọn mức căng TRONG khoảng nhà sản xuất ghi cho đúng phiên bản đang chọn. Chỉ dùng số có thật: đọc kg/lbs/khoảng,
 * không tự đặt mức tối thiểu khi nguồn chỉ có tối đa, không làm tròn vượt tối đa, đổi đơn vị theo 1 kg = 2,20462262 lbs. Thiếu thông tin thì
 * giải thích và dẫn tới "Hỏi người bán" thay vì dựng thanh trượt. KHÔNG thêm dòng hàng hay cước vào giỏ; "dự định" chỉ là ghi chú trên trình duyệt này,
 * không phải lần căng thực tế và không hứa đơn hàng đã bao gồm căng.
 */
export function TramCangCuoc({ bienThe, tenVot }: { bienThe: BienTheV | null; tenVot: string }) {
  const doc = docSucCang(bienThe?.thongSo?.sucCang);
  const khoang = doc.ok ? doc.khoang : null;
  const bienId = bienThe?.id ?? null;
  const [gia, setGia] = useState<number | null>(null);
  const [dv, setDv] = useState<DonViCang>("lbs");
  const [go, setGo] = useState("");
  const [loiNhap, setLoiNhap] = useState<string | null>(null);
  const [duDinh, setDuDinh] = useState<DuDinhCang[]>([]);
  const [loiLuu, setLoiLuu] = useState<string | null>(null);
  const [hong, setHong] = useState(false);
  const [daLuu, setDaLuu] = useState(false);

  // Đọc dự định đã lưu (chỉ sau khi mount, tránh lệch hydration) và đổi theo phiên bản.
  useEffect(() => {
    const r = docDuDinh();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDuDinh(r.ds); setHong(r.hong);
  }, []);
  const daCo = bienId ? duDinh.find((d) => d.bienTheId === bienId) : undefined;
  useEffect(() => {
    // Đổi phiên bản (hoặc đổi vợt): mức đang chọn thuộc phiên bản cũ nên bỏ.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGia(null); setGo(""); setLoiNhap(null); setLoiLuu(null); setDaLuu(false);
    if (khoang) setDv(khoang.donVi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bienId, khoang?.nguon]);
  // Phiên bản có dự định đã lưu (đọc xong sau khi mount hoặc sau khi đổi phiên bản) và người dùng chưa chọn gì: mở lại đúng mức đã lưu.
  const giaDaLuu = daCo?.giaTri ?? null, donViDaLuu = daCo?.donVi ?? null;
  useEffect(() => {
    if (giaDaLuu === null || donViDaLuu === null || !khoang) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGia((g) => (g !== null ? g : chuanHoaCang(donViDaLuu === khoang.donVi ? giaDaLuu : doiDonVi(giaDaLuu, donViDaLuu, khoang.donVi), khoang)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giaDaLuu, donViDaLuu, bienId, khoang?.nguon]);

  if (!bienThe) {
    return <p className={s.thongBao}>Chọn phiên bản (màu / size) ở trên để xem mức căng nhà sản xuất ghi cho phiên bản đó.</p>;
  }
  if (!khoang) {
    const lyDo = doc.ok ? "" : doc.lyDo;
    return (
      <div className={s.cuoc}>
        <p className={`${s.thongBao} ${s.thongBaoCanh}`}>
          {lyDo === "trong"
            ? "Phiên bản này chưa có thông tin sức căng nên shop chưa dựng thanh chọn mức căng."
            : "Thông tin sức căng của phiên bản này chưa đọc được thành khoảng số rõ ràng (thiếu đơn vị hoặc khoảng không hợp lệ) nên shop chưa dựng thanh chọn mức căng."}
          {" "}Hãy hỏi người bán để biết mức căng phù hợp với cây vợt này.
        </p>
        <div className={s.hang}>
          <button type="button" className={`${s.nut} ${s.nutChinh}`} onClick={() => hoiNguoiBan(`Cây ${tenVot} căng được tối đa bao nhiêu kg/lbs?`)}>Hỏi người bán về mức căng</button>
        </div>
      </div>
    );
  }

  const k = khoang;
  const buoc = buocCang(k.donVi);
  const coThanh = k.min !== null;
  const canh = gia === null ? null : canhBaoCang(gia, k);
  const hienChinh = gia === null ? null : hienThiCang(gia, k, dv);
  const hienPhu = gia === null ? null : hienThiCang(gia, k, dv === "kg" ? "lbs" : "kg");
  const khoangHienThi = (() => {
    const lo = k.min === null ? null : hienThiCang(k.min, k, dv), hi = hienThiCang(k.max, k, dv);
    return lo === null ? `tối đa ${dinhDang(hi)} ${NHAN_DON_VI[dv]}` : `${dinhDang(lo)} – ${dinhDang(hi)} ${NHAN_DON_VI[dv]}`;
  })();

  const datGia = (v: number | null) => { setGia(v); setLoiNhap(null); setDaLuu(false); setLoiLuu(null); if (v !== null) setGo(""); };
  const ap = () => {
    if (!go.trim()) return;
    const raw = Number(go.trim().replace(",", "."));
    const v = nhapCang(go, dv, k);
    if (v === null) { setLoiNhap("Nhập một số lớn hơn 0 (ví dụ 10,5)."); return; }
    const goc = doiDonVi(raw, dv, k.donVi);
    const ngoai = goc > k.max + 1e-9 || (k.min !== null && goc < k.min - 1e-9);
    setGia(v); setDaLuu(false); setLoiLuu(null); setGo("");
    setLoiNhap(ngoai ? `Số bạn nhập nằm ngoài khoảng nhà sản xuất ghi (${khoangHienThi}), đã đưa về ${dinhDang(hienThiCang(v, k, dv))} ${NHAN_DON_VI[dv]}.` : null);
  };
  const luuDuDinh = () => {
    if (gia === null || !bienThe) return;
    const moi: DuDinhCang = { bienTheId: bienThe.id, sanPhamId: bienThe.sanPhamId, giaTri: gia, donVi: k.donVi, luc: Date.now() };
    const ds = [moi, ...duDinh.filter((d) => d.bienTheId !== moi.bienTheId)].slice(0, 60);
    const kq = ghiJson(khoTrinhDuyet(), KHOA_DU_DINH_CANG, { v: 1, muc: ds });
    if (!kq.ok) { setLoiLuu(NOI_DUNG_LOI_LUU[kq.lyDo]); setDaLuu(false); return; }
    setDuDinh(ds); setLoiLuu(null); setDaLuu(true); setHong(false);
  };
  const xoaDuDinh = () => {
    const ds = duDinh.filter((d) => d.bienTheId !== bienThe.id);
    const kq = ghiJson(khoTrinhDuyet(), KHOA_DU_DINH_CANG, { v: 1, muc: ds });
    if (!kq.ok) { setLoiLuu(NOI_DUNG_LOI_LUU[kq.lyDo]); return; }
    setDuDinh(ds); setDaLuu(false); setLoiLuu(null);
  };

  return (
    <div className={s.cuoc}>
      <p className={s.ghiChu}>Nhà sản xuất ghi mức căng cho phiên bản này: <strong>{khoang.nguon}</strong>. Mức bạn chọn dưới đây chỉ để tham khảo và lên kế hoạch.</p>
      <div className={s.hang} role="group" aria-label="Đơn vị hiển thị">
        {(["lbs", "kg"] as const).map((d) => <button key={d} type="button" className={s.chip} aria-pressed={dv === d} onClick={() => { setDv(d); setGo(""); setLoiNhap(null); }}>{NHAN_DON_VI[d]}</button>)}
      </div>
      <div aria-live="polite">
        {hienChinh === null ? (
          <p className={s.soPhu}>Chưa chọn mức căng. {coThanh ? "Kéo thanh trượt hoặc nhập số bên dưới." : "Nhập số bên dưới."}</p>
        ) : (
          <p><span className={`${s.soLon} ${fontTieuDe.className}`}>{dinhDang(hienChinh)}</span> <span className={s.soPhu}>{NHAN_DON_VI[dv]} · ≈ {dinhDang(hienPhu ?? 0)} {NHAN_DON_VI[dv === "kg" ? "lbs" : "kg"]}</span></p>
        )}
      </div>
      {coThanh ? (
        <div>
          <label htmlFor="tram-cang-thanh" className="visually-hidden">Mức căng ({NHAN_DON_VI[k.donVi]}) trong khoảng {khoang.nguon}</label>
          <input id="tram-cang-thanh" className={s.thanh} type="range" min={k.min as number} max={k.max} step={buoc} value={gia ?? (k.min as number)}
            aria-valuetext={gia === null ? "Chưa chọn mức căng" : `${dinhDang(hienThiCang(gia, k, k.donVi))} ${NHAN_DON_VI[k.donVi]}`}
            onChange={(e) => { const v = chuanHoaCang(Number(e.target.value), k); datGia(v); }} />
          <div className={s.moc}><span>{dinhDang(k.min as number)} {k.donVi}</span><span>{dinhDang(k.max)} {k.donVi}</span></div>
        </div>
      ) : (
        <p className={`${s.thongBao} ${s.thongBaoCanh}`}>Nguồn chỉ ghi mức tối đa ({khoangHienThi}), chưa có mức tối thiểu, nên shop không dựng thanh trượt mà chỉ cho nhập số trong giới hạn đó.</p>
      )}
      <div className={s.hang}>
        <label className={s.truong} htmlFor="tram-cang-nhap">Nhập mức căng ({NHAN_DON_VI[dv]})
          <input id="tram-cang-nhap" className={`${s.nhap} ${s.nhapNho}`} inputMode="decimal" autoComplete="off" value={go} placeholder="Nhập số"
            onChange={(e) => setGo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ap(); } }} onBlur={ap} aria-describedby={loiNhap ? "tram-cang-loi" : undefined} aria-invalid={loiNhap && /lớn hơn 0/.test(loiNhap) ? true : undefined} />
        </label>
      </div>
      {loiNhap && <p id="tram-cang-loi" className={s.loi} role="alert">{loiNhap}</p>}
      {canh === "bang-toi-da" && <p className={`${s.thongBao} ${s.thongBaoCanh}`}>Đây đúng là mức tối đa nhà sản xuất ghi cho phiên bản này; mức cao hơn nằm ngoài khoảng được ghi.</p>}
      {canh === "sat-toi-thieu" && <p className={s.thongBao}>Đây là mức tối thiểu trong khoảng nhà sản xuất ghi.</p>}
      {canh === "chua-co-can-duoi" && <p className={s.thongBao}>Nguồn chỉ ghi mức tối đa nên shop chưa biết mức tối thiểu của vợt này.</p>}
      <p className={s.ghiChu}>Con số kg/lbs không cho biết tiếng nổ, độ bền cổ tay hay hiệu suất; hãy hỏi người bán nếu bạn cần tư vấn. Cửa hàng hiện chưa bán dịch vụ căng cước hay cước trên web: mức này không tự thêm vào giỏ hàng và đơn hàng không bao gồm căng cước.</p>
      <div className={s.hang}>
        <button type="button" className={`${s.nut} ${s.nutChinh}`} disabled={gia === null}
          onClick={() => gia !== null && hoiNguoiBan(`Mình dự định căng ${dinhDang(hienThiCang(gia, k, "lbs"))} lbs (≈ ${dinhDang(hienThiCang(gia, k, "kg"))} kg) cho ${tenVot}. Shop có nhận căng cước không và tư vấn giúp mình?`)}>Hỏi shop về mức này</button>
        <button type="button" className={s.nut} disabled={gia === null} onClick={luuDuDinh}>Lưu dự định (chưa phải lần căng thực tế)</button>
      </div>
      {loiLuu && <p className={s.loi} role="alert">{loiLuu}</p>}
      {daLuu && <p className={s.thongBao} role="status">Đã lưu dự định này trên trình duyệt này.</p>}
      {hong && <p className={`${s.thongBao} ${s.thongBaoCanh}`}>Dữ liệu dự định đã lưu trên trình duyệt bị hỏng nên chưa đọc được; lưu mới sẽ thay thế dữ liệu hỏng đó.</p>}
      {daCo && (
        <p className={s.thongBao}>Dự định đã lưu cho phiên bản này: <strong>{dinhDang(hienThiCang(daCo.giaTri, { ...k, donVi: daCo.donVi }, "lbs"))} lbs</strong>. Đây là ghi chú dự định, chưa phải lần căng thực tế.{" "}
          <button type="button" className={s.lienKet} style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={xoaDuDinh}>Xóa dự định</button></p>
      )}
    </div>
  );
}
