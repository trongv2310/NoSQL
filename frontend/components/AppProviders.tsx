"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FlashNotice } from "./FlashNotice";
import { api, apiPost, loiTuApi } from "@/lib/api";
import { dongBoTaiKhoan, type DongBoPhanHoi } from "@/lib/dong-bo-gio";
import {
  banChupDangCho, chuyenSangCho, coDuLieuCanDongBo, dangKyGio, doiTokenBanChup, gioMayChu, layGio, tongSoLuongGio, xoaBanChup,
} from "@/lib/gio-khach";
import { tomTatDongBo } from "@/lib/gio-khach-bao-cao";
import type { KetQuaGopV, LienHeV } from "@/lib/types";

export interface NguoiDungV {
  id: string; tenDangNhap: string; email?: string; maQuyen: number; hoTen: string; khachHangId: string | null; gioHangCount: number;
}
export interface SiteInfo { tenSite: string; moTaSite: string; logo: string; lienHe?: LienHeV }
type FlashKind = "success" | "danger";

/** Tình trạng đồng bộ giỏ khách vào MỘT tài khoản. `lanXong` tăng mỗi lần một lượt đồng bộ của tài khoản đó kết thúc. */
export interface DongBoGio { trangThai: "rong" | "dang" | "loi"; soBanChupCho: number; lanXong: number; loi: string | null }
const RONG: DongBoGio = { trangThai: "rong", soBanChupCho: 0, lanXong: 0, loi: null };

interface Ctx {
  user: NguoiDungV | null;
  ready: boolean;
  site: SiteInfo;
  /** Số sản phẩm trong giỏ: của tài khoản khi đã đăng nhập, của giỏ lưu trên trình duyệt khi chưa đăng nhập. */
  cartCount: number;
  /** Cập nhật số lượng giỏ của TÀI KHOẢN (dùng sau các thao tác với giỏ trên server). */
  setCartCount: (n: number) => void;
  /**
   * Id tài khoản đang đăng nhập trong giao diện, đọc ĐỒNG BỘ ngay lúc gọi (không phải giá trị của lần render cũ); null = khách.
   * Dùng cho các thao tác chạy nhiều bước/bất đồng bộ để biết danh tính còn như lúc bắt đầu hay không.
   */
  taiKhoanHienTai: () => string | null;
  refreshUser: () => Promise<NguoiDungV | null>;
  setUser: (u: NguoiDungV | null) => void;
  flash: (kind: FlashKind, msg: string) => void;
  /** Tình trạng đồng bộ của TÀI KHOẢN ĐANG ĐĂNG NHẬP (không bao giờ là của tài khoản trước đó). */
  dongBo: DongBoGio;
  thuLaiDongBo: () => void;
}

const MAC_DINH: SiteInfo = { tenSite: "Shop Cầu Lông", moTaSite: "", logo: "images/HUIT.jpg" };
const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp phải nằm trong AppProviders");
  return c;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<NguoiDungV | null>(null);
  const [ready, setReady] = useState(false);
  const [site, setSite] = useState<SiteInfo>(MAC_DINH);
  const [soLuongTaiKhoan, setSoLuongTaiKhoan] = useState(0);
  const [toast, setToast] = useState<{ id: number; kind: FlashKind; msg: string } | null>(null);
  const [dongBoTheo, setDongBoTheo] = useState<Record<string, DongBoGio>>({});
  const [lanThu, setLanThu] = useState(0);
  const toastId = useRef(0);
  /** Tài khoản đang đăng nhập trong giao diện, cập nhật ĐỒNG BỘ ở `setUser` (không chờ render) để kiểm tra `conDung` luôn đúng. */
  const userRef = useRef<NguoiDungV | null>(null);
  /** Khóa theo TỪNG tài khoản: lượt đồng bộ của A đang chờ không chặn lượt của B (và ngược lại). */
  const dangChay = useRef(new Map<string, Promise<void>>());
  const dongThongBao = useCallback(() => setToast(null), []);
  const taiKhoanHienTai = useCallback(() => userRef.current?.id ?? null, []);

  const gioKhach = useSyncExternalStore(dangKyGio, layGio, gioMayChu);

  const setUser = useCallback((u: NguoiDungV | null) => {
    userRef.current = u;
    setUserState(u);
    setSoLuongTaiKhoan(u?.gioHangCount ?? 0);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const r = await api<{ user: NguoiDungV | null }>("/auth/me");
      setUser(r.user);
      return r.user;
    } catch {
      setUser(null);
      return null;
    }
  }, [setUser]);

  useEffect(() => {
    // Tải người dùng và thông tin site một lần khi mở ứng dụng.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUser().finally(() => setReady(true));
    api<SiteInfo>("/site").then(setSite).catch(() => undefined);
  }, [refreshUser]);

  const flash = useCallback((kind: FlashKind, msg: string) => setToast({ id: ++toastId.current, kind, msg }), []);

  const capNhatDongBo = useCallback((id: string, f: (cu: DongBoGio) => DongBoGio) => {
    setDongBoTheo((m) => ({ ...m, [id]: f(m[id] ?? RONG) }));
  }, []);

  /**
   * Gộp giỏ của khách chưa đăng nhập vào tài khoản `u`. Chạy ở cấp ứng dụng (không gắn riêng vào form nào) nên bao phủ đăng nhập,
   * đăng ký và cả phiên còn hiệu lực khi mở lại trang. Toàn bộ logic ở `lib/dong-bo-gio.ts`; ở đây chỉ nối với React:
   *  - khóa và trạng thái theo từng tài khoản (A đang chờ mạng không làm B bị bỏ đói hay hiển thị nhầm trạng thái của A);
   *  - `conDung()` đọc `userRef` đồng bộ; server còn đối chiếu `taiKhoanId` với phiên đăng nhập nên cookie đổi ở thẻ khác cũng an toàn;
   *  - kết quả của tài khoản không còn là tài khoản hiện tại thì KHÔNG đụng tới huy hiệu, thông báo hay trạng thái của tài khoản hiện tại.
   */
  const chayDongBo = useCallback(
    (u: NguoiDungV): Promise<void> => {
      const dangCo = dangChay.current.get(u.id);
      if (dangCo) return dangCo;
      const p = (async () => {
        capNhatDongBo(u.id, (cu) => ({ ...cu, trangThai: "dang", loi: null }));
        const kq = await dongBoTaiKhoan(u.id, {
          layGio, chuyenSangCho, banChupDangCho, xoaBanChup, doiTokenBanChup,
          goi: (yc) => apiPost<DongBoPhanHoi>("/gio-hang/dong-bo", yc as unknown as Record<string, unknown>),
          conDung: () => userRef.current?.id === u.id,
          taiKhoanHienTai: async () => (await api<{ user: { id: string } | null }>("/auth/me")).user?.id ?? null,
        });
        const conDung = userRef.current?.id === u.id;
        const loi = kq.loi ? loiTuApi(kq.loi) : null;
        capNhatDongBo(u.id, (cu) => ({ trangThai: loi ? "loi" : "rong", soBanChupCho: banChupDangCho(u.id).length, lanXong: cu.lanXong + 1, loi }));
        if (kq.phienDoi) {
          // Phiên ở server không còn là u: hỏi lại để giao diện theo đúng tài khoản thật (hàng đợi của u vẫn được giữ cho u).
          void refreshUser();
          return;
        }
        if (!conDung) {
          // Giao diện đã sang tài khoản khác giữa chừng. Nếu u quay lại ngay thì lượt này đã bỏ lỡ: kích lại.
          if (kq.biHuy && userRef.current?.id === u.id) setLanThu((n) => n + 1);
          return;
        }
        if (kq.soLuongMoi !== null) setSoLuongTaiKhoan(kq.soLuongMoi);
        if (loi) {
          flash("danger", "Chưa đồng bộ được giỏ hàng bạn thêm trước khi đăng nhập. Giỏ vẫn được giữ lại, mở Giỏ hàng để thử lại.");
          return;
        }
        const tt = tomTatDongBo(kq.baoCao as KetQuaGopV[]);
        if (tt) flash(tt.loai === "ok" ? "success" : "danger", tt.noiDung);
      })().finally(() => {
        dangChay.current.delete(u.id);
      });
      dangChay.current.set(u.id, p);
      return p;
    },
    [capNhatDongBo, flash, refreshUser],
  );

  useEffect(() => {
    if (!ready || !user?.khachHangId || !coDuLieuCanDongBo(user.id)) return;
    void chayDongBo(user);
  }, [ready, user, lanThu, chayDongBo]);

  useEffect(() => {
    const khiCoMang = () => setLanThu((n) => n + 1);
    window.addEventListener("online", khiCoMang);
    return () => window.removeEventListener("online", khiCoMang);
  }, []);

  const thuLaiDongBo = useCallback(() => setLanThu((n) => n + 1), []);
  const cartCount = user ? soLuongTaiKhoan : tongSoLuongGio(gioKhach);
  const dongBo = (user && dongBoTheo[user.id]) || RONG;

  const value = useMemo<Ctx>(
    () => ({ user, ready, site, cartCount, setCartCount: setSoLuongTaiKhoan, taiKhoanHienTai, refreshUser, setUser, flash, dongBo, thuLaiDongBo }),
    [user, ready, site, cartCount, taiKhoanHienTai, refreshUser, setUser, flash, dongBo, thuLaiDongBo],
  );

  return (
    <AppCtx.Provider value={value}>
      <div className="flash-dock" aria-label="Thông báo">
        {toast && <FlashNotice key={toast.id} kind={toast.kind} msg={toast.msg} onClose={dongThongBao} />}
      </div>
      {children}
    </AppCtx.Provider>
  );
}
