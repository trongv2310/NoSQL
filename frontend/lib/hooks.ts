"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, loiTuApi } from "./api";

/** Tải dữ liệu GET từ API; truyền path = null để tạm dừng. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (my === seq.current) {
        setData(d);
        setError(null);
        setStatus(null);
      }
    } catch (e) {
      if (my === seq.current) {
        setError(loiTuApi(e));
        setStatus((e as { status?: number }).status ?? 0);
      }
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { data, error, status, loading, reload: load };
}
