"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useApp } from "./AppProviders";
import { apiPost, loiTuApi } from "@/lib/api";

const NHAN_SAO = ["Rất không hài lòng", "Chưa hài lòng", "Bình thường", "Hài lòng", "Rất hài lòng"];

export function InlineReviewForm({ sanPhamId, onSent, onClose, onBusyChange }: {
  sanPhamId: string; onSent: () => Promise<void>; onClose: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const { user, ready } = useApp();
  const ma = useId();
  const oNhap = useRef<HTMLTextAreaElement>(null);
  const dangGui = useRef(false);
  const [sao, setSao] = useState(5);
  const [noiDung, setNoiDung] = useState("");
  const [dang, setDang] = useState(false);
  const [daGui, setDaGui] = useState(false);
  const [loi, setLoi] = useState("");
  const [loiTaiLai, setLoiTaiLai] = useState(false);

  useEffect(() => { oNhap.current?.focus({ preventScroll: true }); }, [ready, user]);

  const capNhat = async () => {
    try { await onSent(); setLoiTaiLai(false); }
    catch { setLoiTaiLai(true); }
  };
  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dangGui.current || daGui) return;
    if (noiDung.trim().length < 5) { setLoi("Vui lòng viết ít nhất 5 ký tự có nội dung."); oNhap.current?.focus(); return; }
    dangGui.current = true;
    setDang(true); onBusyChange(true); setLoi("");
    try {
      await apiPost("/phan-hoi", { sanPhamId, danhGia: sao, noiDung: noiDung.trim() });
      setDaGui(true);
      await capNhat();
    } catch (err) { setLoi(loiTuApi(err)); }
    finally { dangGui.current = false; setDang(false); onBusyChange(false); }
  };

  if (!ready) return <div className="inline-review-form" role="status">Đang kiểm tra tài khoản…</div>;
  if (!user) return <div className="inline-review-form"><p>Vui lòng đăng nhập để chia sẻ đánh giá về sản phẩm.</p><Link className="btn btn-primary btn-sm" href={`/TaiKhoan/DangNhap?returnUrl=${encodeURIComponent(`/Home/ChiTietSanPham/${sanPhamId}#product-reviews`)}`}>Đăng nhập để đánh giá</Link></div>;
  if (daGui) return <div className="inline-review-form inline-review-success">
    <p role="status"><i className="fa-solid fa-circle-check" aria-hidden="true" /> Đã gửi đánh giá. Cảm ơn bạn đã chia sẻ trải nghiệm!</p>
    {loiTaiLai && <div role="alert"><p>Đánh giá đã được lưu, nhưng chưa tải lại được danh sách.</p><button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void capNhat()}>Tải lại danh sách</button></div>}
    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Đóng</button>
  </div>;

  return <form id="product-review-form" className="inline-review-form" onSubmit={gui} aria-label="Viết đánh giá sản phẩm" aria-busy={dang}>
    <fieldset disabled={dang}>
      <legend>Trải nghiệm của bạn thế nào?</legend>
      <div className="inline-review-stars">{NHAN_SAO.map((nhan, i) => <label key={nhan} className={i < sao ? "is-selected" : ""}>
        <input type="radio" name={`${ma}-rating`} value={i + 1} checked={sao === i + 1} onChange={() => setSao(i + 1)} aria-label={`${i + 1} sao: ${nhan}`} />
        <span aria-hidden="true">★</span>
      </label>)}<span className="inline-review-rating-label">{NHAN_SAO[sao - 1]}</span></div>
      <label htmlFor={`${ma}-content`} className="form-label">Nhận xét của bạn</label>
      <textarea ref={oNhap} id={`${ma}-content`} className="form-control" rows={4} required minLength={5} maxLength={255}
        value={noiDung} onChange={(e) => setNoiDung(e.target.value)} placeholder="Bạn cảm nhận thế nào về sản phẩm, size và trải nghiệm sử dụng?"
        aria-describedby={`${ma}-help${loi ? ` ${ma}-error` : ""}`} aria-invalid={!!loi} />
      <div className="inline-review-hint" id={`${ma}-help`}><span>Từ 5 đến 255 ký tự</span><span>{noiDung.length}/255</span></div>
      {loi && <p id={`${ma}-error`} className="text-danger small" role="alert">{loi}</p>}
      <div className="inline-review-actions"><button type="submit" className="btn btn-primary btn-sm">{dang ? "Đang gửi…" : "Gửi đánh giá"}</button><button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Hủy</button></div>
    </fieldset>
  </form>;
}
