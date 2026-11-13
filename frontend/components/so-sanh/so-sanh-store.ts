"use client";

import { useEffect, useSyncExternalStore } from "react";
import { docJson, ghiJson, khoTrinhDuyet, type LyDoLoiLuu } from "@/lib/luu-tru";
import { boKhoiSoSanh, themVaoSoSanh, type MucSoSanh } from "@/lib/so-sanh";

/**
 * Lựa chọn so sánh hiện tại của khách (tối đa 3 vợt), nhớ trong localStorage của trình duyệt này để chọn từ thẻ ở nhiều trang rồi mở /so-sanh.
 * Nguồn chia sẻ là URL /so-sanh?v1=…; store này chỉ là nơi tập hợp lựa chọn trước khi mở trang. Lưu lỗi thì vẫn giữ trong phiên và nói thật.
 */
const KHOA = "so-sanh:v1";
const RONG: MucSoSanh[] = [];
let muc: MucSoSanh[] = RONG;
let daNap = false;
let loiLuu: LyDoLoiLuu | null = null;
const nguoiNghe = new Set<() => void>();
const phat = () => nguoiNghe.forEach((f) => f());

const hopLe = (x: unknown): x is { v: 1; muc: MucSoSanh[] } => !!x && typeof x === "object" && (x as { v?: number }).v === 1 && Array.isArray((x as { muc?: unknown }).muc);
const ID24 = /^[0-9a-f]{24}$/;

function nap() {
  const r = docJson(khoTrinhDuyet(), KHOA, hopLe);
  const ds = r.trangThai === "ok" ? r.giaTri.muc.filter((m) => m && ID24.test(m.sanPhamId)).slice(0, 3).map((m) => ({ sanPhamId: m.sanPhamId, bienTheId: m.bienTheId && ID24.test(m.bienTheId) ? m.bienTheId : null })) : RONG;
  daNap = true;
  const doi = JSON.stringify(ds) !== JSON.stringify(muc);
  if (doi) muc = ds.length ? ds : RONG;
  if (doi) phat();
}

function datMuc(moi: MucSoSanh[]) {
  muc = moi.length ? moi : RONG;
  const kq = ghiJson(khoTrinhDuyet(), KHOA, { v: 1, muc: moi });
  loiLuu = kq.ok ? null : kq.lyDo;
  phat();
}

export type KetQuaThemSoSanh = { ok: true } | { ok: false; lyDo: "day" | "id-sai" };
export function themSoSanh(m: MucSoSanh): KetQuaThemSoSanh {
  const kq = themVaoSoSanh(muc, m);
  if (!kq.ok) return { ok: false, lyDo: kq.lyDo };
  datMuc(kq.muc);
  return { ok: true };
}
export const boSoSanh = (sanPhamId: string) => datMuc(boKhoiSoSanh(muc, sanPhamId));
/** Trang /so-sanh đặt lại lựa chọn theo URL (URL là nguồn chính). */
export const datSoSanh = (ds: MucSoSanh[]) => { if (JSON.stringify(ds) !== JSON.stringify(muc)) datMuc(ds); };
export const xoaHetSoSanh = () => datMuc([]);

const dangKy = (f: () => void) => { nguoiNghe.add(f); return () => { nguoiNghe.delete(f); }; };

/** Hook: lựa chọn so sánh (rỗng ở server và lần render đầu của client, nạp sau khi mount nên không lệch hydration). */
export function useSoSanh(): { muc: MucSoSanh[]; loiLuu: LyDoLoiLuu | null } {
  const m = useSyncExternalStore(dangKy, () => muc, () => RONG);
  useEffect(() => {
    if (!daNap) nap();
    const khiDoiTab = (e: StorageEvent) => { if (e.key === KHOA || e.key === null) nap(); };
    window.addEventListener("storage", khiDoiTab);
    return () => window.removeEventListener("storage", khiDoiTab);
  }, []);
  return { muc: m, loiLuu };
}
