"use client";

import Link from "next/link";
import { bayVaoGio } from "@/lib/cart-motion";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, loiTuApi } from "@/lib/api";
import { imgUrl, vnd } from "@/lib/format";
import { useApp } from "./AppProviders";

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

interface HanhDong {
  loai: "thanh_toan";
  href: string;
  nhan: string;
  soLuongGio: number;
}

interface PhanHoi {
  success: boolean;
  reply: string;
  products?: TheSanPham[];
  donHang?: TheDonHang[];
  quickReplies?: string[];
  lienKet?: { nhan: string; href: string }[];
  hanhDong?: HanhDong | null;
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
  hanhDong?: HanhDong | null;
  /** Tin lỗi: hiện nút "Thử lại" gửi lại câu hỏi của khách. */
  loi?: { cauHoi: string };
}

/* ---- Nhận giọng nói / đọc to (Web Speech API; chỉ có ở một số trình duyệt như Chrome, Edge, Safari) ---- */
interface KetQuaNhanDang { isFinal: boolean; 0: { transcript: string } }
interface SuKienNhanDang { results: ArrayLike<KetQuaNhanDang> }
interface BoNhanDang {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SuKienNhanDang) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type HamTaoNhanDang = new () => BoNhanDang;

const layNhanDang = (): HamTaoNhanDang | null => {
  const w = window as unknown as { SpeechRecognition?: HamTaoNhanDang; webkitSpeechRecognition?: HamTaoNhanDang };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const LOI_MIC: Record<string, string> = {
  "not-allowed": "Trình duyệt chưa cho phép dùng micro. Bạn bấm vào biểu tượng khóa trên thanh địa chỉ để cấp quyền nhé.",
  "service-not-allowed": "Trình duyệt chưa cho phép dùng micro. Bạn bấm vào biểu tượng khóa trên thanh địa chỉ để cấp quyền nhé.",
  "no-speech": "Mình chưa nghe thấy gì, bạn bấm micro và nói lại nhé.",
  "audio-capture": "Không tìm thấy micro trên thiết bị của bạn.",
  network: "Không kết nối được dịch vụ nhận giọng nói, bạn thử lại hoặc gõ chữ nhé.",
};

/** Biến lời đáp thành câu dễ đọc to: bỏ ký hiệu, emoji, đọc số tiền theo tiếng Việt. */
export function vanBanDocTo(text: string): string {
  const docTien = (so: string) => {
    const n = parseInt(so.replace(/\./g, ""), 10);
    const tr = Math.floor(n / 1_000_000);
    const nghin = Math.round((n % 1_000_000) / 1000);
    return [tr ? `${tr} triệu` : "", nghin ? `${nghin} nghìn` : "", "đồng"].filter(Boolean).join(" ");
  };
  const sach = text
    .replace(/\*\*/g, "")
    .replace(/(\d{1,3}(?:\.\d{3})+)\s*(?:đ|₫|đồng)/gi, (_, so: string) => docTien(so))
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[•·]/g, ",")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  return sach.length > 600 ? `${sach.slice(0, 600).replace(/[^.!?]*$/, "").trim() || sach.slice(0, 600)}` : sach;
}

const KHOA_LUU = "chatbot-shop-v3";
const KHOA_DOC_TO = "chatbot-doc-to";
const LOI_CHAO = "Xin chào! Mình là trợ lý ảo của Shop Cầu Lông. Mình tư vấn vợt, giày, áo quần theo ngân sách và lối chơi, tra giá – tồn kho – khuyến mãi, kiểm tra đơn hàng và đặt hàng giúp bạn (bạn có thể gõ hoặc bấm micro để nói). Bạn cần mình giúp gì ạ?";
const GOI_Y_DAU = ["Tư vấn vợt cho người mới", "Giày cầu lông dưới 2 triệu", "Đang có khuyến mãi gì?", "Kiểm tra đơn hàng"];
const THOI_GIAN_CHO_TOI_DA_MS = 30_000;
const TRE_CHUYEN_TRANG_MS = 1800;

const tinChao = (): Tin => ({ id: 1, vai: "bot", text: LOI_CHAO, quickReplies: GOI_Y_DAU });

/** Hiển thị **in đậm** an toàn (không dùng dangerouslySetInnerHTML); xuống dòng được giữ bằng CSS. */
function VanBan({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((doan, i) => (i % 2 ? <strong key={i}>{doan}</strong> : <Fragment key={i}>{doan}</Fragment>))}
    </>
  );
}

function TheSanPhamChat({ sp, onDi, onDat, roi }: { sp: TheSanPham; onDi: () => void; onDat: (sp: TheSanPham) => void; roi: boolean }) {
  return (
    <div className="chat-card">
      <Link href={sp.link} className="chat-card-main" onClick={onDi}>
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
      <div className="chat-card-actions">
        <Link href={sp.link} className="chat-btn" onClick={onDi}>Xem chi tiết <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
        {sp.conHang && (
          <button type="button" className="chat-btn is-primary" disabled={roi} onClick={() => onDat(sp)}><i className="fa-solid fa-cart-shopping" aria-hidden="true" /> Đặt hàng</button>
        )}
      </div>
    </div>
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
  const router = useRouter();
  const { setCartCount } = useApp();
  const [mo, setMo] = useState(false);
  const [ds, setDs] = useState<Tin[]>(() => [tinChao()]);
  const [nhap, setNhap] = useState("");
  const [cho, setCho] = useState(false);
  const [nguon, setNguon] = useState<"ai" | "tra-cuu" | null>(null);
  const [daNap, setDaNap] = useState(false);
  const [coMic, setCoMic] = useState(false);
  const [dangNghe, setDangNghe] = useState(false);
  const [docTo, setDocTo] = useState(false);
  const [thongBao, setThongBao] = useState("");
  const nguCanh = useRef<Record<string, unknown>>({});
  const idKeTiep = useRef(2);
  const thanCuon = useRef<HTMLDivElement>(null);
  const oNhap = useRef<HTMLInputElement>(null);
  const dsRef = useRef(ds);
  const nhanDang = useRef<BoNhanDang | null>(null);
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docToRef = useRef(false);

  const dungDoc = useCallback(() => {
    try { window.speechSynthesis?.cancel(); } catch { /* bỏ qua */ }
  }, []);

  const doc = useCallback((text: string) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(vanBanDocTo(text));
      u.lang = "vi-VN";
      u.rate = 1.05;
      const giong = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("vi"));
      if (giong) u.voice = giong;
      synth.speak(u);
    } catch { /* bỏ qua */ }
  }, []);

  // Khôi phục cuộc trò chuyện của phiên làm việc (sessionStorage có thể bị chặn nên luôn bọc try/catch).
  useEffect(() => {
    try {
      const luu = JSON.parse(sessionStorage.getItem(KHOA_LUU) ?? "null") as { ds: Tin[]; nguCanh: Record<string, unknown>; nguon: "ai" | "tra-cuu" | null } | null;
      if (luu?.ds?.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDs(luu.ds);
        nguCanh.current = luu.nguCanh ?? {};
        setNguon(luu.nguon ?? null);
        idKeTiep.current = Math.max(...luu.ds.map((t) => t.id)) + 1;
      }
    } catch { /* bỏ qua */ }
    try {
      const b = localStorage.getItem(KHOA_DOC_TO) === "1";
      setDocTo(b);
      docToRef.current = b;
    } catch { /* bỏ qua */ }
    setCoMic(!!layNhanDang());
    setDaNap(true);
    return () => {
      if (hen.current) clearTimeout(hen.current);
      nhanDang.current?.abort();
      try { window.speechSynthesis?.cancel(); } catch { /* bỏ qua */ }
    };
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
    else {
      nhanDang.current?.abort();
      dungDoc();
    }
  }, [mo, dungDoc]);

  useEffect(() => {
    if (!mo) return;
    const dong = (e: KeyboardEvent) => { if (e.key === "Escape") setMo(false); };
    window.addEventListener("keydown", dong);
    return () => window.removeEventListener("keydown", dong);
  }, [mo]);

  // Trên điện thoại khung chat phủ kín màn hình nên đóng lại khi khách bấm sang trang sản phẩm/đơn hàng.
  const dongNeuDienThoai = useCallback(() => { if (window.matchMedia("(max-width: 576px)").matches) setMo(false); }, []);

  const guiCauHoi = useCallback(async (cauHoi: string, bangGiongNoi = false) => {
    const text = cauHoi.trim();
    if (!text || cho) return;
    if (hen.current) clearTimeout(hen.current);
    dungDoc();
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
      hanhDong: r.hanhDong,
    });

    setNhap("");
    setThongBao("");
    setCho(true);
    setDs((d) => [...d.filter((t) => !t.loi), { id: idKeTiep.current++, vai: "user", text }]);
    try {
      const r = await Promise.race([
        api<PhanHoi>("/chatbot/ask", { method: "POST", body: { message: text, history: lichSu, context: nguCanh.current } }),
        new Promise<never>((_, tuChoi) => setTimeout(() => tuChoi(new Error("Máy chủ phản hồi quá lâu.")), THOI_GIAN_CHO_TOI_DA_MS)),
      ]);
      if (r.context) nguCanh.current = r.context;
      if (r.nguon) setNguon(r.nguon);
      const theTruoc = document.querySelector<HTMLElement>("#chat-container .chat-msg.bot:last-of-type .chat-card");
      setDs((d) => [...d, r.success ? thanhCong(r) : { ...thanhCong(r), loi: { cauHoi: text } }]);
      if (bangGiongNoi || docToRef.current) doc(r.reply);
      if (r.hanhDong) {
        // Đã thêm vào giỏ: cập nhật số lượng giỏ hàng và chuyển khách tới trang thanh toán.
        await bayVaoGio(theTruoc);
        setCartCount(r.hanhDong.soLuongGio);
        const href = r.hanhDong.href;
        hen.current = setTimeout(() => { dongNeuDienThoai(); router.push(href); }, TRE_CHUYEN_TRANG_MS);
      }
    } catch (err) {
      const quaNhanh = err instanceof ApiError && err.status === 429;
      const noiDung = quaNhanh ? loiTuApi(err) : `Xin lỗi, mình chưa kết nối được tới máy chủ (${loiTuApi(err)}). Bạn thử lại giúp mình nhé.`;
      setDs((d) => [...d, { id: idKeTiep.current++, vai: "bot", text: noiDung, loi: { cauHoi: text } }]);
      if (bangGiongNoi) doc(noiDung);
    } finally {
      setCho(false);
      oNhap.current?.focus();
    }
  }, [cho, doc, dungDoc, dongNeuDienThoai, router, setCartCount]);

  const batDauNghe = () => {
    const Ham = layNhanDang();
    if (!Ham) {
      setThongBao("Trình duyệt này chưa hỗ trợ nhập bằng giọng nói. Bạn thử Chrome hoặc Edge nhé.");
      return;
    }
    if (dangNghe) {
      nhanDang.current?.stop();
      return;
    }
    dungDoc();
    const r = new Ham();
    r.lang = "vi-VN";
    r.interimResults = true;
    r.continuous = false;
    let cuoi = "";
    r.onresult = (e) => {
      const phan = Array.from(e.results);
      cuoi = phan.map((x) => x[0].transcript).join("").trim();
      setNhap(cuoi);
      if (phan.some((x) => x.isFinal)) r.stop();
    };
    r.onerror = (e) => {
      setThongBao(LOI_MIC[e.error] ?? "Không nhận được giọng nói, bạn thử lại hoặc gõ chữ nhé.");
      cuoi = "";
    };
    r.onend = () => {
      setDangNghe(false);
      nhanDang.current = null;
      if (cuoi) void guiCauHoi(cuoi, true);
    };
    nhanDang.current = r;
    setThongBao("");
    try {
      r.start();
      setDangNghe(true);
    } catch {
      setThongBao("Không bật được micro, bạn thử lại nhé.");
    }
  };

  const doiDocTo = () => {
    const moi = !docTo;
    setDocTo(moi);
    docToRef.current = moi;
    try { localStorage.setItem(KHOA_DOC_TO, moi ? "1" : "0"); } catch { /* bỏ qua */ }
    if (!moi) dungDoc();
    else {
      const cuoiBot = [...dsRef.current].reverse().find((t) => t.vai === "bot");
      if (cuoiBot) doc(cuoiBot.text);
    }
  };

  const lamMoi = () => {
    if (hen.current) clearTimeout(hen.current);
    nhanDang.current?.abort();
    dungDoc();
    nguCanh.current = {};
    idKeTiep.current = 2;
    setNguon(null);
    setThongBao("");
    setDs([tinChao()]);
    try { sessionStorage.removeItem(KHOA_LUU); } catch { /* bỏ qua */ }
    oNhap.current?.focus();
  };

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
            <button type="button" className={`chat-head-btn ${docTo ? "is-on" : ""}`} aria-label="Đọc to câu trả lời" aria-pressed={docTo} title={docTo ? "Đang bật đọc to câu trả lời" : "Bật đọc to câu trả lời"} onClick={doiDocTo}>
              <i className={`fa-solid ${docTo ? "fa-volume-high" : "fa-volume-xmark"}`} />
            </button>
            <button type="button" className="chat-head-btn" aria-label="Cuộc trò chuyện mới" title="Cuộc trò chuyện mới" onClick={lamMoi}><i className="fa-solid fa-rotate-right" /></button>
            <button type="button" className="chat-head-btn" aria-label="Đóng" title="Đóng" onClick={() => setMo(false)}><i className="fa-solid fa-xmark" /></button>
          </header>

          <div className="chat-body" ref={thanCuon} aria-live="polite">
            {ds.map((t) => (
              <div key={t.id} data-tin={t.id} className={`chat-msg ${t.vai}`}>
                <div className={`chat-bubble ${t.loi ? "loi" : ""}`}><VanBan text={t.text} /></div>
                {!!t.products?.length && (
                  <div className="chat-cards">{t.products.map((sp) => <TheSanPhamChat key={sp.id} sp={sp} onDi={dongNeuDienThoai} onDat={(s) => void guiCauHoi(`Đặt hàng ${s.ten}`)} roi={cho} />)}</div>
                )}
                {!!t.donHang?.length && (
                  <div className="chat-cards">{t.donHang.map((d) => <TheDonChat key={d.soDonHang} d={d} onDi={dongNeuDienThoai} />)}</div>
                )}
                {t.hanhDong && (
                  <div className="chat-chips"><Link href={t.hanhDong.href} className="chat-chip is-link" onClick={() => { if (hen.current) clearTimeout(hen.current); dongNeuDienThoai(); }}><i className="fa-solid fa-credit-card" aria-hidden="true" /> {t.hanhDong.nhan}</Link></div>
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

          {thongBao && <div className="chat-notice" role="status">{thongBao}</div>}
          <form className="chat-foot" onSubmit={(e) => { e.preventDefault(); void guiCauHoi(nhap); }}>
            <button
              type="button"
              className={`chat-mic ${dangNghe ? "is-listening" : ""}`}
              onClick={batDauNghe}
              disabled={cho || !coMic}
              aria-label={dangNghe ? "Dừng ghi âm" : "Nói câu hỏi bằng giọng nói"}
              aria-pressed={dangNghe}
              title={coMic ? (dangNghe ? "Bấm để dừng" : "Bấm để nói") : "Trình duyệt chưa hỗ trợ nhập bằng giọng nói (hãy dùng Chrome hoặc Edge)"}
            >
              <i className={`fa-solid ${dangNghe ? "fa-stop" : "fa-microphone"}`} />
            </button>
            <input ref={oNhap} className="chat-input" value={nhap} onChange={(e) => setNhap(e.target.value)} placeholder={dangNghe ? "Đang nghe bạn nói…" : "Nhập hoặc nói câu hỏi, ví dụ: vợt tấn công dưới 3 triệu"} maxLength={500} aria-label="Nhập câu hỏi" autoComplete="off" />
            {demTu(nhap.length) && <span className="chat-count">{demTu(nhap.length)}</span>}
            <button className="chat-send" type="submit" disabled={cho || !nhap.trim()} aria-label="Gửi"><i className="fa-solid fa-paper-plane" /></button>
          </form>
        </section>
      )}
    </>
  );
}
