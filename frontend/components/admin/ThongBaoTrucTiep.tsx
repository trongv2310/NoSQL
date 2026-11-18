"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet } from "@/lib/api";
import { vnd } from "@/lib/format";

/** Sự kiện từ /api/admin/su-kien (Server-Sent Events, nguồn là change stream MongoDB: backend/src/su-kien). */
type SuKien =
  | { loai: "don-moi"; luc: string; soDonHang: number; tongTien: number; hoTenNhan: string | null }
  | { loai: "ton-thap"; luc: string; chiTiet: string; sku: string | null; tenSanPham: string | null; soLuongTon: number };

interface TrangThai { hoTro: boolean; lyDo: string | null }

const khoa = (s: SuKien) => (s.loai === "don-moi" ? `d${s.soDonHang}` : `t${s.chiTiet}-${s.luc}`);
const gio = (s: string) => new Date(s).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

function NoiDung({ s }: { s: SuKien }) {
  return s.loai === "don-moi"
    ? <Link href={`/admin/don-hang/${s.soDonHang}`}><b>Đơn mới #{s.soDonHang}</b> · {vnd(s.tongTien)}{s.hoTenNhan ? ` · ${s.hoTenNhan}` : ""}</Link>
    : <Link href={`/admin/bien-the/${s.chiTiet}/edit`}><b>Sắp hết hàng</b> · {s.tenSanPham ?? "Sản phẩm"}{s.sku ? ` (${s.sku})` : ""}: còn {s.soLuongTon}</Link>;
}

/**
 * Chuông thông báo trên thanh trên của trang quản trị. Sự kiện cũ (gửi lại khi vừa kết nối) chỉ vào danh sách; sự kiện xảy ra sau khi
 * mở trang thì hiện thêm thông báo nổi 8 giây. MongoDB standalone không có change stream: chuông xám, di chuột xem lý do.
 */
export function ThongBaoTrucTiep() {
  const [trangThai, setTrangThai] = useState<TrangThai | null>(null);
  const [ds, setDs] = useState<SuKien[]>([]);
  const [noi, setNoi] = useState<SuKien[]>([]);
  const [chuaDoc, setChuaDoc] = useState(0);
  const [mo, setMo] = useState(false);
  const moLuc = useRef(Date.now());

  useEffect(() => {
    let es: EventSource | null = null;
    let huy = false;
    apiGet<TrangThai>("/admin/su-kien/trang-thai").then((t) => {
      if (huy) return;
      setTrangThai(t);
      if (!t.hoTro) return;
      es = new EventSource("/api/admin/su-kien", { withCredentials: true });
      const nhan = (e: MessageEvent) => {
        const s = JSON.parse(e.data) as SuKien;
        setDs((cu) => (cu.some((x) => khoa(x) === khoa(s)) ? cu : [s, ...cu].slice(0, 20)));
        if (new Date(s.luc).getTime() >= moLuc.current - 2000) {
          setChuaDoc((n) => n + 1);
          setNoi((cu) => [s, ...cu].slice(0, 3));
          setTimeout(() => setNoi((cu) => cu.filter((x) => x !== s)), 8000);
        }
      };
      es.addEventListener("don-moi", nhan as EventListener);
      es.addEventListener("ton-thap", nhan as EventListener);
    }).catch(() => setTrangThai({ hoTro: false, lyDo: "Không đọc được trạng thái thông báo." }));
    return () => { huy = true; es?.close(); };
  }, []);

  if (!trangThai) return null;
  const tieuDe = trangThai.hoTro ? "Thông báo trực tiếp (change stream MongoDB)" : `Thông báo trực tiếp đang tắt: ${trangThai.lyDo ?? ""}`;
  return (
    <div className="position-relative me-2">
      <button type="button" className="btn btn-light position-relative" title={tieuDe} aria-label={tieuDe} aria-expanded={mo}
        onClick={() => { setMo((v) => !v); setChuaDoc(0); }} style={trangThai.hoTro ? undefined : { opacity: 0.5 }}>
        <i className={`fa-solid ${trangThai.hoTro ? "fa-bell" : "fa-bell-slash"}`} aria-hidden="true" />
        {chuaDoc > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{chuaDoc}</span>}
      </button>
      {mo && (
        <div className="card shadow position-absolute end-0 mt-2 p-2 small" style={{ width: 340, zIndex: 1050 }}>
          {!trangThai.hoTro ? <p className="mb-0 text-muted">{trangThai.lyDo}</p>
            : ds.length === 0 ? <p className="mb-0 text-muted">Chưa có sự kiện nào. Đơn mới và sản phẩm sắp hết hàng sẽ hiện ở đây ngay khi xảy ra.</p>
              : <ul className="list-unstyled mb-0">{ds.map((s) => <li key={khoa(s)} className="py-1 border-bottom"><span className="text-muted me-2">{gio(s.luc)}</span><NoiDung s={s} /></li>)}</ul>}
        </div>
      )}
      {/* Portal ra body: thanh trên của admin tạo khung chứa riêng cho position: fixed, để trong đó thì thông báo bị kẹt ở mép thanh. */}
      {createPortal(
        <div className="position-fixed bottom-0 end-0 p-3 d-flex flex-column gap-2" style={{ zIndex: 1080, maxWidth: 420 }} aria-live="polite">
          {noi.map((s) => (
            <div key={khoa(s)} className={`alert ${s.loai === "don-moi" ? "alert-success" : "alert-warning"} shadow mb-0 py-2 small`} role="status">
              <i className={`fa-solid ${s.loai === "don-moi" ? "fa-cart-shopping" : "fa-box-open"} me-2`} aria-hidden="true" /><NoiDung s={s} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
