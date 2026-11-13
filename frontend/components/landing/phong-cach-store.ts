import { useEffect, useSyncExternalStore } from "react";
import { NGAN_SACH_VOT, PHONG_CACH, type LoiChoi, type NganSachVot } from "@/lib/landing-data";
import { docLuaChon, ghiLuaChon } from "./luu-lua-chon";

/**
 * Lối chơi và tầm giá khách đã chọn ở khu "chọn lối chơi", dùng chung cho cả trang (khu chọn, bộ chọn vợt, cảnh 3D).
 * Là một store nhỏ ngoài React: `lc` được ghi lên thuộc tính `data-pc` của trang để CSS đổi màu nhấn và cảnh 3D đổi quỹ đạo cầu
 * mà không phải truyền prop qua các khối server component. Nhớ trong phiên (sessionStorage); đọc lại sau hydrate để HTML server không lệch.
 */
export interface PhongCachState {
  lc: LoiChoi | null;
  ns: NganSachVot["khoa"] | null;
}

const KHOA = "landing:phong-cach";
const TRONG: PhongCachState = { lc: null, ns: null };
let hien: PhongCachState = TRONG;
let daNap = false;
const nguoiNghe = new Set<() => void>();

function apLenTrang() {
  const goc = document.querySelector<HTMLElement>("[data-landing]");
  if (!goc) return;
  if (hien.lc) goc.dataset.pc = hien.lc;
  else delete goc.dataset.pc;
}

function doi(moi: PhongCachState) {
  hien = moi;
  ghiLuaChon(KHOA, moi);
  apLenTrang();
  nguoiNghe.forEach((f) => f());
}

export function datLoiChoi(lc: LoiChoi | null) {
  if (hien.lc !== lc) doi({ ...hien, lc });
}

export function datNganSach(ns: NganSachVot["khoa"] | null) {
  if (hien.ns !== ns) doi({ ...hien, ns });
}

function nap() {
  if (daNap) return;
  daNap = true;
  const r = docLuaChon<Partial<PhongCachState>>(KHOA);
  if (!r) return;
  const lc = PHONG_CACH.some((p) => p.khoa === r.lc) ? (r.lc as LoiChoi) : null;
  const ns = NGAN_SACH_VOT.some((n) => n.khoa === r.ns) ? (r.ns as NganSachVot["khoa"]) : null;
  if (!lc && !ns) return;
  hien = { lc, ns };
  apLenTrang();
  nguoiNghe.forEach((f) => f());
}

function dangKy(f: () => void) {
  nguoiNghe.add(f);
  return () => { nguoiNghe.delete(f); };
}

export function usePhongCach(): PhongCachState {
  useEffect(() => { nap(); apLenTrang(); }, []);
  return useSyncExternalStore(dangKy, () => hien, () => TRONG);
}
