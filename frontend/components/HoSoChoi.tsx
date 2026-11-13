"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import {
  HO_SO_TRONG, KHOA_LUU, KHOA_PHIEN_CU, docDaNho, docTuQuery, ghiVaoQuery, giongNhau, hopNhat, hoSoTrong, nhanHoSo, type HoSo,
} from "@/lib/ho-so-choi";

/**
 * Hồ sơ người chơi dùng chung cả site (store ngoài React). Nguồn chính là URL (`loi_choi`, `trinh_do`, `ngan_sach`); giá trị hợp lệ trong URL
 * ghi đè bản đã nhớ theo từng trường và được nhớ lại trong localStorage. Mọi thao tác lưu trữ bọc try/catch (chế độ riêng tư/chặn lưu trữ
 * thì chỉ là không nhớ). Trạng thái ban đầu rỗng cả ở server lẫn lần render đầu của client, nên không có lệch hydration; `HoSoDongBo` nạp thật sau khi mount.
 */
let hien: HoSo = HO_SO_TRONG;
const nguoiNghe = new Set<() => void>();

function datStore(moi: HoSo) {
  if (giongNhau(hien, moi)) return;
  hien = moi;
  nguoiNghe.forEach((f) => f());
}

function docLuu(): HoSo {
  try {
    return docDaNho(window.localStorage.getItem(KHOA_LUU), window.sessionStorage.getItem(KHOA_PHIEN_CU));
  } catch {
    return HO_SO_TRONG;
  }
}

function ghiLuu(h: HoSo) {
  try {
    if (hoSoTrong(h)) window.localStorage.removeItem(KHOA_LUU);
    else window.localStorage.setItem(KHOA_LUU, JSON.stringify(h));
  } catch {
    /* không nhớ được thì thôi */
  }
}

/** Nạp hồ sơ từ URL hiện tại và bản đã nhớ; có giá trị hợp lệ trong URL thì nhớ lại ngay (URL là nguồn chính). */
export function napHoSo() {
  const tuUrl = docTuQuery(new URLSearchParams(window.location.search));
  const hopNhatMoi = hopNhat(tuUrl, docLuu());
  if (Object.keys(tuUrl).length || !hoSoTrong(hopNhatMoi)) ghiLuu(hopNhatMoi);
  datStore(hopNhatMoi);
}

/** Đổi hồ sơ (một phần). `ghiUrl` (mặc định bật) cập nhật query của trang hiện tại bằng replaceState, không thêm mục lịch sử. */
export function datHoSo(patch: Partial<HoSo>, ghiUrl = true) {
  const moi = { ...hien, ...patch };
  ghiLuu(moi);
  datStore(moi);
  if (ghiUrl) {
    const url = new URL(window.location.href);
    url.search = ghiVaoQuery(url.search, moi);
    window.history.replaceState(window.history.state, "", url);
  }
}

/** Xóa hồ sơ: bỏ khỏi bộ nhớ, localStorage và các tham số hồ sơ trên URL hiện tại. */
export function xoaHoSo() {
  try { window.sessionStorage.removeItem(KHOA_PHIEN_CU); } catch { /* bỏ qua */ }
  datHoSo({ lc: null, kn: null, ns: null });
}

const dangKy = (f: () => void) => { nguoiNghe.add(f); return () => { nguoiNghe.delete(f); }; };
export const useHoSo = (): HoSo => useSyncExternalStore(dangKy, () => hien, () => HO_SO_TRONG);

/** Giữ hồ sơ khớp URL khi vào trang, đổi trang, bấm Back/Forward. Đặt một lần trong layout của site. */
export function HoSoDongBo() {
  const pathname = usePathname();
  useEffect(() => {
    napHoSo();
    window.addEventListener("popstate", napHoSo);
    return () => window.removeEventListener("popstate", napHoSo);
  }, [pathname]);
  return null;
}

/** Hồ sơ gọn trên header: nhãn, liên kết về khu chọn và nút xóa. Không có hồ sơ thì không hiện gì. */
export function HoSoChip() {
  const h = useHoSo();
  const nhan = nhanHoSo(h);
  if (!nhan.length) return null;
  return (
    <div className="sf-hoso" role="group" aria-label="Hồ sơ người chơi">
      <Link href={`/?${ghiVaoQuery("", h)}#quay-tu-van`} className="sf-hoso-nhan" title={`Hồ sơ của bạn: ${nhan.join(" · ")}. Bấm để đổi.`}>
        <i className="fa-solid fa-user-gear" aria-hidden="true" />
        <span>{nhan.join(" · ")}</span>
      </Link>
      <button type="button" className="sf-hoso-xoa" onClick={xoaHoSo} aria-label="Xóa hồ sơ người chơi" title="Xóa hồ sơ">
        <i className="fa-solid fa-xmark" aria-hidden="true" />
      </button>
    </div>
  );
}
