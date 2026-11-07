"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FlashNotice } from "./FlashNotice";
import { api } from "@/lib/api";

export interface NguoiDungV {
  id: string; tenDangNhap: string; email?: string; maQuyen: number; hoTen: string; khachHangId: string | null; gioHangCount: number;
}
export interface SiteInfo { tenSite: string; moTaSite: string; logo: string }
type FlashKind = "success" | "danger";

interface Ctx {
  user: NguoiDungV | null;
  ready: boolean;
  site: SiteInfo;
  cartCount: number;
  setCartCount: (n: number) => void;
  refreshUser: () => Promise<NguoiDungV | null>;
  setUser: (u: NguoiDungV | null) => void;
  flash: (kind: FlashKind, msg: string) => void;
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
  const [cartCount, setCartCount] = useState(0);
  const [toast, setToast] = useState<{ id: number; kind: FlashKind; msg: string } | null>(null);
  const toastId = useRef(0);
  const dongThongBao = useCallback(() => setToast(null), []);

  const setUser = useCallback((u: NguoiDungV | null) => {
    setUserState(u);
    setCartCount(u?.gioHangCount ?? 0);
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

  const value = useMemo<Ctx>(
    () => ({ user, ready, site, cartCount, setCartCount, refreshUser, setUser, flash }),
    [user, ready, site, cartCount, refreshUser, setUser, flash],
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
