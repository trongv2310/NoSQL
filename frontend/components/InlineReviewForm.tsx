"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useApp } from "./AppProviders";
import { apiPost, loiTuApi } from "@/lib/api";
import { CAC_THE, NHAN_THE, nhanNguoiDanh, type NguoiDanhCongKhai } from "@/lib/danh-gia";
import { useApi } from "@/lib/hooks";

const NHAN_SAO = ["Rất không hài lòng", "Chưa hài lòng", "Bình thường", "Hài lòng", "Rất hài lòng"];

export function InlineReviewForm({ sanPhamId, bienTheId, tenPhienBan, onSent, onClose, onBusyChange }: {
  sanPhamId: string; bienTheId?: string | null; tenPhienBan?: string | null; onSent: () => Promise<void>; onClose: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const { user, ready } = useApp();
  // Hồ sơ người chơi trong tài khoản: để hỏi có kèm bản chụp hồ sơ vào đánh giá không (mặc định có; chấn thương mặc định KHÔNG).
  const hs = useApi<{ hoSoChoi: (NguoiDanhCongKhai & { chanThuong?: string[] }) | null }>(ready && user?.maQuyen === 3 ? "/auth/ho-so-choi" : null);
  const hoSo = hs.data?.hoSoChoi ?? null;
  const [the, setThe] = useState<string[]>([]);
  const [kemHoSo, setKemHoSo] = useState(true);
  const [kemChanThuong, setKemChanThuong] = useState(false);
  const [kemPhienBan, setKemPhienBan] = useState(true);
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
      await apiPost("/phan-hoi", {
        sanPhamId, danhGia: sao, noiDung: noiDung.trim(), the,
        chiaSeHoSo: kemHoSo, chiaSeChanThuong: kemHoSo && kemChanThuong,
        ...(bienTheId && kemPhienBan ? { bienTheId } : {}),
      });
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
      <div className="mt-2" role="group" aria-label="Cảm nhận nhanh">
        <div className="small fw-semibold mb-1">Cảm nhận nhanh (không bắt buộc)</div>
        <div className="d-flex flex-wrap gap-1">{CAC_THE.map((k) => (
          <span key={k}>
            <input type="checkbox" className="btn-check" id={`${ma}-the-${k}`} checked={the.includes(k)} onChange={() => setThe((ds) => ds.includes(k) ? ds.filter((x) => x !== k) : [...ds, k])} />
            <label className="btn btn-sm btn-outline-primary rounded-pill" htmlFor={`${ma}-the-${k}`}>{NHAN_THE[k]}</label>
          </span>
        ))}</div>
      </div>
      <div className="mt-2 small">
        {bienTheId && tenPhienBan && <label className="form-check"><input type="checkbox" className="form-check-input" checked={kemPhienBan} onChange={(e) => setKemPhienBan(e.target.checked)} /> <span className="form-check-label">Tôi dùng phiên bản <b>{tenPhienBan}</b></span></label>}
        {hoSo && nhanNguoiDanh(hoSo) ? <>
          <label className="form-check"><input type="checkbox" className="form-check-input" checked={kemHoSo} onChange={(e) => setKemHoSo(e.target.checked)} /> <span className="form-check-label">Kèm hồ sơ người chơi: <b>{nhanNguoiDanh(hoSo)}</b> (giúp người cùng trình độ tham khảo)</span></label>
          {!!hoSo.chanThuong?.length && kemHoSo && <label className="form-check"><input type="checkbox" className="form-check-input" checked={kemChanThuong} onChange={(e) => setKemChanThuong(e.target.checked)} /> <span className="form-check-label">Kèm thông tin chấn thương (chỉ dùng thống kê, không hiện công khai)</span></label>}
        </> : user?.maQuyen === 3 && !hs.loading && <p className="text-muted mb-0"><Link href="/TaiKhoan/HoSoChoi">Khai hồ sơ người chơi</Link> để đánh giá của bạn giúp được người cùng trình độ.</p>}
      </div>
      {loi && <p id={`${ma}-error`} className="text-danger small" role="alert">{loi}</p>}
      <div className="inline-review-actions"><button type="submit" className="btn btn-primary btn-sm">{dang ? "Đang gửi…" : "Gửi đánh giá"}</button><button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Hủy</button></div>
    </fieldset>
  </form>;
}
