"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  const [toast, setToast] = useState<{ kind: FlashKind; msg: string } | null>(null);

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const flash = useCallback((kind: FlashKind, msg: string) => setToast({ kind, msg }), []);

  const value = useMemo<Ctx>(
    () => ({ user, ready, site, cartCount, setCartCount, refreshUser, setUser, flash }),
    [user, ready, site, cartCount, refreshUser, setUser, flash],
  );

  return (
    <AppCtx.Provider value={value}>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 3000, maxWidth: 420 }}>
          <div className={`alert alert-${toast.kind} shadow`} role="alert">
            <i className={`fa-solid ${toast.kind === "success" ? "fa-circle-check" : "fa-triangle-exclamation"}`} /> {toast.msg}
            <button type="button" className="btn-close ms-2" aria-label="Đóng" onClick={() => setToast(null)} />
          </div>
        </div>
      )}
      {children}
    </AppCtx.Provider>
  );
}
