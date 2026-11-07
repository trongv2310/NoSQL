"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useApi } from "@/lib/hooks";
import type { SanPhamLanding } from "@/lib/landing-data";

type TrangThai =
  | { trangThai: "loading"; items: SanPhamLanding[]; thuLai: () => void }
  | { trangThai: "error"; items: SanPhamLanding[]; thuLai: () => void; loi: string }
  | { trangThai: "ok"; items: SanPhamLanding[]; thuLai: () => void };

const Ctx = createContext<TrangThai | null>(null);

/**
 * Chia sẻ danh sách sản phẩm cho bộ chọn vợt và khu sản phẩm. Server đã lấy được dữ liệu thì dùng luôn (`initial`);
 * nếu server không lấy được (API lỗi/chậm lúc dựng trang) thì tự tải lại phía client, có trạng thái loading,
 * lỗi và nút thử lại.
 */
/** Quá ngưỡng này mà API chưa trả lời thì báo "chậm" và cho thử lại, thay vì quay loading mãi. */
const NGUONG_CHAM_MS = 8000;

export function CatalogProvider({ initial, children }: { initial: SanPhamLanding[] | null; children: React.ReactNode }) {
  const tuClient = useApi<{ sanPhams: SanPhamLanding[] }>(initial ? null : "/san-pham/trang-chu");
  const { data, error, loading, reload } = tuClient;
  const [cham, setCham] = useState(false);

  useEffect(() => {
    if (initial || data || !loading) return;
    const hen = window.setTimeout(() => setCham(true), NGUONG_CHAM_MS);
    return () => { window.clearTimeout(hen); setCham(false); };
  }, [initial, data, loading]);

  const value = useMemo<TrangThai>(() => {
    if (initial) return { trangThai: "ok", items: initial, thuLai: () => {} };
    if (data) return { trangThai: "ok", items: data.sanPhams, thuLai: reload };
    if (error && !loading) return { trangThai: "error", items: [], thuLai: reload, loi: error };
    if (cham) return { trangThai: "error", items: [], thuLai: reload, loi: "Máy chủ phản hồi chậm." };
    return { trangThai: "loading", items: [], thuLai: reload };
  }, [initial, data, error, loading, cham, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog(): TrangThai {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCatalog phải nằm trong <CatalogProvider>");
  return v;
}
