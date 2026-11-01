"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, loiTuApi } from "@/lib/api";
import { imgUrl, vnd } from "@/lib/format";

interface TheSanPham {
  id: string;
  ten: string;
  hang: string | null;
  loai: string | null;
  anh: string;
  gia: number;
  giaGoc: number;
  tuGia: boolean;
  phanTramGiam: number;
  tenKhuyenMai: string | null;
  conHang: boolean;
  tonKho: number;
  link: string;
  lyDo: string[];
  thongSo: string;
  danhGia: number | null;
  vuotNganSach: boolean;
}

interface TheDonHang {
  soDonHang: number;
  trangThai: string;
  ngayDat: string;
  tongTien: number;
  soDong: number;
  link: string;
}

interface PhanHoi {
  success: boolean;
  reply: string;
  products?: TheSanPham[];
  donHang?: TheDonHang[];
  quickReplies?: string[];
  lienKet?: { nhan: string; href: string }[];
  context?: Record<string, unknown>;
  nguon?: "ai" | "tra-cuu";
}

interface Tin {
  id: number;
  vai: "user" | "bot";
  text: string;
  products?: TheSanPham[];
  donHang?: TheDonHang[];
  quickReplies?: string[];
  lienKet?: { nhan: string; href: string }[];
  /** Tin lỗi: hiện nút "Thử lại" gửi lại câu hỏi của khách. */
  loi?: { cauHoi: string };
}

const KHOA_LUU = "chatbot-shop-v2";
const LOI_CHAO = "Xin chào! Mình là trợ lý ảo của Shop Cầu Lông. Mình tư vấn vợt, giày, áo quần theo ngân sách và lối chơi, tra giá – tồn kho – khuyến mãi và kiểm tra đơn hàng giúp bạn. Bạn cần mình giúp gì ạ?";
const GOI_Y_DAU = ["Tư vấn vợt cho người mới", "Giày cầu lông dưới 2 triệu", "Đang có khuyến mãi gì?", "Kiểm tra đơn hàng"];
const THOI_GIAN_CHO_TOI_DA_MS = 30_000;

const tinChao = (): Tin => ({ id: 1, vai: "bot", text: LOI_CHAO, quickReplies: GOI_Y_DAU });

/** Hiển thị **in đậm** an toàn (không dùng dangerouslySetInnerHTML); xuống dòng được giữ bằng CSS. */
function VanBan({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((doan, i) => (i % 2 ? <strong key={i}>{doan}</strong> : <Fragment key={i}>{doan}</Fragment>))}
    </>
  );
}

function TheSanPhamChat({ sp, onDi }: { sp: TheSanPham; onDi: () => void }) {
  return (
    <Link href={sp.link} className="chat-card" onClick={onDi}>
      <div className="chat-card-thumb">
        { }
        <img src={imgUrl(sp.anh)} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).src = "/images/default-product.jpg"; }} />
        {sp.phanTramGiam > 0 && <span className="chat-card-badge">-{sp.phanTramGiam}%</span>}
      </div>
      <div className="chat-card-body">
        {sp.hang && <div className="chat-card-brand">{sp.hang}</div>}
        <div className="chat-card-name">{sp.ten}</div>
        {sp.thongSo && <div className="chat-card-spec">{sp.thongSo}</div>}
        <div className="chat-card-price">
          <strong>{sp.tuGia ? "Từ " : ""}{vnd(sp.gia)}</strong>
          {sp.phanTramGiam > 0 && sp.giaGoc > sp.gia && <s>{vnd(sp.giaGoc)}</s>}
        </div>
        <div className="chat-card-meta">
          <span className={sp.conHang ? "chat-stock ok" : "chat-stock het"}>
            <i className={`fa-solid ${sp.conHang ? "fa-circle-check" : "fa-circle-xmark"}`} aria-hidden="true" /> {sp.conHang ? "Còn hàng" : "Tạm hết hàng"}
          </span>
          {sp.danhGia !== null && <span className="chat-rate"><i className="fa-solid fa-star" aria-hidden="true" /> {sp.danhGia.toFixed(1)}</span>}
        </div>
        {sp.lyDo[0] && <div className="chat-card-reason">{sp.lyDo[0]}</div>}
        {sp.vuotNganSach && <div className="chat-card-warn">Ngoài khoảng giá bạn chọn</div>}
      </div>
    </Link>
  );
}

function TheDonChat({ d, onDi }: { d: TheDonHang; onDi: () => void }) {
  return (
    <Link href={d.link} className="chat-order" onClick={onDi}>
      <div>
        <strong>Đơn #{d.soDonHang}</strong>
        <span className="chat-order-date">{new Date(d.ngayDat).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span>
      </div>
      <div className="chat-order-status">{d.trangThai}</div>
      <div className="chat-order-total">{vnd(d.tongTien)} · {d.soDong} mặt hàng <i className="fa-solid fa-chevron-right" aria-hidden="true" /></div>
    </Link>
  );
}

const demTu = (n: number) => (n > 400 ? `${n}/500` : "");

export function Chatbot() {
  const [mo, setMo] = useState(false);
  const [ds, setDs] = useState<Tin[]>(() => [tinChao()]);
  const [nhap, setNhap] = useState("");
  const [cho, setCho] = useState(false);
  const [nguon, setNguon] = useState<"ai" | "tra-cuu" | null>(null);
  const [daNap, setDaNap] = useState(false);
  const nguCanh = useRef<Record<string, unknown>>({});
  const idKeTiep = useRef(2);
  const thanCuon = useRef<HTMLDivElement>(null);
  const oNhap = useRef<HTMLInputElement>(null);
  const dsRef = useRef(ds);

  // Khôi phục cuộc trò chuyện của phiên làm việc (sessionStorage có thể bị chặn nên luôn bọc try/catch).
  useEffect(() => {
    try {
      const luu = JSON.parse(sessionStorage.getItem(KHOA_LUU) ?? "null") as { ds: Tin[]; nguCanh: Record<string, unknown>; nguon: "ai" | "tra-cuu" | null } | null;
      if (luu?.ds?.length) {
        setDs(luu.ds);
        nguCanh.current = luu.nguCanh ?? {};
        setNguon(luu.nguon ?? null);
        idKeTiep.current = Math.max(...luu.ds.map((t) => t.id)) + 1;
      }
    } catch { /* bỏ qua */ }
    setDaNap(true);
  }, []);

  useEffect(() => {
    dsRef.current = ds;
    if (!daNap) return;
    try {
      sessionStorage.setItem(KHOA_LUU, JSON.stringify({ ds: ds.slice(-40), nguCanh: nguCanh.current, nguon }));
    } catch { /* bỏ qua */ }
  }, [ds, nguon, daNap]);

  // Tin mới của bot: cuộn tới đầu tin để khách đọc lời đáp trước khi xem các thẻ; còn lại cuộn xuống cuối.
  useEffect(() => {
    const el = thanCuon.current;
    if (!mo || !el) return;
    const cuoi = ds[ds.length - 1];
    const tin = el.querySelector<HTMLElement>(`[data-tin="${cuoi.id}"]`);
    if (!cho && cuoi.vai === "bot" && tin) el.scrollTo({ top: Math.max(0, tin.offsetTop - 8), behavior: "smooth" });
    else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [ds, cho, mo]);

  useEffect(() => {
    if (mo) oNhap.current?.focus();
  }, [mo]);

  useEffect(() => {
    if (!mo) return;
    const dong = (e: KeyboardEvent) => { if (e.key === "Escape") setMo(false); };
    window.addEventListener("keydown", dong);
    return () => window.removeEventListener("keydown", dong);
  }, [mo]);

  const guiCauHoi = useCallback(async (cauHoi: string) => {
    const text = cauHoi.trim();
    if (!text || cho) return;
    const truoc = dsRef.current.filter((t) => !t.loi);
    const lichSu = truoc.slice(-8).map((t) => ({ vai: t.vai, text: t.text.slice(0, 600) }));
    const thanhCong = (r: PhanHoi): Tin => ({
      id: idKeTiep.current++,
      vai: "bot",
      text: r.reply,
      products: r.products,
      donHang: r.donHang,
      quickReplies: r.quickReplies,
      lienKet: r.lienKet,
    });

    setNhap("");
    setCho(true);
    setDs((d) => [...d.filter((t) => !t.loi), { id: idKeTiep.current++, vai: "user", text }]);
    try {
      const r = await Promise.race([
        api<PhanHoi>("/chatbot/ask", { method: "POST", body: { message: text, history: lichSu, context: nguCanh.current } }),
        new Promise<never>((_, tuChoi) => setTimeout(() => tuChoi(new Error("Máy chủ phản hồi quá lâu.")), THOI_GIAN_CHO_TOI_DA_MS)),
      ]);
      if (r.context) nguCanh.current = r.context;
      if (r.nguon) setNguon(r.nguon);
      setDs((d) => [...d, r.success ? thanhCong(r) : { ...thanhCong(r), loi: { cauHoi: text } }]);
    } catch (err) {
      const quaNhanh = err instanceof ApiError && err.status === 429;
      setDs((d) => [
        ...d,
        {
          id: idKeTiep.current++,
          vai: "bot",
          text: quaNhanh ? loiTuApi(err) : `Xin lỗi, mình chưa kết nối được tới máy chủ (${loiTuApi(err)}). Bạn thử lại giúp mình nhé.`,
          loi: { cauHoi: text },
        },
      ]);
    } finally {
      setCho(false);
      oNhap.current?.focus();
    }
  }, [cho]);

  const lamMoi = () => {
    nguCanh.current = {};
    idKeTiep.current = 2;
    setNguon(null);
    setDs([tinChao()]);
    try { sessionStorage.removeItem(KHOA_LUU); } catch { /* bỏ qua */ }
    oNhap.current?.focus();
  };

  // Trên điện thoại khung chat phủ kín màn hình nên đóng lại khi khách bấm sang trang sản phẩm/đơn hàng.
  const dongNeuDienThoai = () => { if (window.matchMedia("(max-width: 576px)").matches) setMo(false); };
  const tinCuoi = ds[ds.length - 1];

  return (
    <>
      <button id="chat-toggle-btn" type="button" className={mo ? "is-open" : ""} aria-label={mo ? "Đóng trợ lý" : "Chat với trợ lý"} aria-expanded={mo} onClick={() => setMo((v) => !v)}>
        <i className={`fa-solid ${mo ? "fa-xmark" : "fa-comments"}`} aria-hidden="true" />
      </button>
      {mo && (
        <section id="chat-container" role="dialog" aria-label="Trợ lý Shop Cầu Lông">
          <header className="chat-head">
            <span className="chat-head-avatar" aria-hidden="true"><i className="fa-solid fa-robot" /></span>
            <div className="chat-head-text">
              <div className="chat-head-title">Trợ lý Shop Cầu Lông</div>
              <div className="chat-head-sub"><span className={`chat-dot ${nguon === "tra-cuu" ? "is-tra-cuu" : ""}`} aria-hidden="true" />{nguon === "tra-cuu" ? "Tra cứu kho hàng" : nguon === "ai" ? "Tư vấn bằng AI" : "Trực tuyến"}</div>
            </div>
            <button type="button" className="chat-head-btn" aria-label="Cuộc trò chuyện mới" title="Cuộc trò chuyện mới" onClick={lamMoi}><i className="fa-solid fa-rotate-right" /></button>
            <button type="button" className="chat-head-btn" aria-label="Đóng" title="Đóng" onClick={() => setMo(false)}><i className="fa-solid fa-xmark" /></button>
          </header>

          <div className="chat-body" ref={thanCuon} aria-live="polite">
            {ds.map((t) => (
              <div key={t.id} data-tin={t.id} className={`chat-msg ${t.vai}`}>
                <div className={`chat-bubble ${t.loi ? "loi" : ""}`}><VanBan text={t.text} /></div>
                {!!t.products?.length && (
                  <div className="chat-cards">{t.products.map((sp) => <TheSanPhamChat key={sp.id} sp={sp} onDi={dongNeuDienThoai} />)}</div>
                )}
                {!!t.donHang?.length && (
                  <div className="chat-cards">{t.donHang.map((d) => <TheDonChat key={d.soDonHang} d={d} onDi={dongNeuDienThoai} />)}</div>
                )}
                {!!t.lienKet?.length && (
                  <div className="chat-chips">{t.lienKet.map((l) => <Link key={l.href} href={l.href} className="chat-chip is-link" onClick={dongNeuDienThoai}>{l.nhan}</Link>)}</div>
                )}
                {t.loi && (
                  <button type="button" className="chat-retry" disabled={cho} onClick={() => void guiCauHoi(t.loi!.cauHoi)}><i className="fa-solid fa-rotate-right" /> Thử lại</button>
                )}
                {t === tinCuoi && !cho && !!t.quickReplies?.length && !t.loi && (
                  <div className="chat-chips" role="group" aria-label="Gợi ý nhanh">
                    {t.quickReplies.map((q) => <button key={q} type="button" className="chat-chip" onClick={() => void guiCauHoi(q)}>{q}</button>)}
                  </div>
                )}
              </div>
            ))}
            {cho && (
              <div className="chat-msg bot" aria-label="Trợ lý đang soạn câu trả lời">
                <div className="chat-bubble chat-typing"><span /><span /><span /></div>
              </div>
            )}
          </div>

          <form className="chat-foot" onSubmit={(e) => { e.preventDefault(); void guiCauHoi(nhap); }}>
            <input ref={oNhap} className="chat-input" value={nhap} onChange={(e) => setNhap(e.target.value)} placeholder="Nhập câu hỏi, ví dụ: vợt tấn công dưới 3 triệu" maxLength={500} aria-label="Nhập câu hỏi" autoComplete="off" />
            {demTu(nhap.length) && <span className="chat-count">{demTu(nhap.length)}</span>}
            <button className="chat-send" type="submit" disabled={cho || !nhap.trim()} aria-label="Gửi"><i className="fa-solid fa-paper-plane" /></button>
          </form>
        </section>
      )}
    </>
  );
}
