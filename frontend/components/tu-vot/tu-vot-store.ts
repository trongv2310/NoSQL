"use client";

import { useEffect, useState } from "react";
import { NOI_DUNG_LOI_LUU, docJson, ghiJson, khoTrinhDuyet, xoaKhoa, type KetQuaGhi } from "@/lib/luu-tru";
import { KHOA_TU_VOT, homNayDiaPhuong, hopLeDuLieu, lamSachTuChiTiet, soVotDenHan, type VotTrongTu } from "@/lib/tu-vot";

export type TrangThaiTu = "dang-nap" | "ok" | "rong" | "hong" | "khong-dung-duoc";

export interface KetQuaDocTu {
  trangThai: Exclude<TrangThaiTu, "dang-nap">;
  ds: VotTrongTu[];
  /** Bản ghi sai định dạng/không hợp lệ, giữ nguyên văn (không hiển thị, không tự xóa). */
  phanHong: unknown[];
}

/** Đọc tủ vợt. Không bao giờ ném lỗi: JSON hợp lệ nhưng sai cấu trúc ở từng bản ghi chỉ đưa bản ghi đó vào `phanHong`. */
export function docTu(): KetQuaDocTu {
  try {
    const r = docJson(khoTrinhDuyet(), KHOA_TU_VOT, hopLeDuLieu);
    if (r.trangThai === "ok") { const { ds, phanHong } = lamSachTuChiTiet(r.giaTri); return { trangThai: ds.length ? "ok" : "rong", ds, phanHong }; }
    return { trangThai: r.trangThai, ds: [], phanHong: [] };
  } catch {
    return { trangThai: "hong", ds: [], phanHong: [] };
  }
}

/** Ghi tủ vợt. Các bản ghi không đọc được (`phanHong`) được ghi lại nguyên văn sau các vợt hợp lệ, trừ khi người dùng chủ động bỏ chúng. */
export const ghiTu = (ds: VotTrongTu[], phanHong: unknown[] = []): KetQuaGhi => ghiJson(khoTrinhDuyet(), KHOA_TU_VOT, { v: 1, vot: [...ds, ...phanHong] });
export const xoaHanTu = (): KetQuaGhi => xoaKhoa(khoTrinhDuyet(), KHOA_TU_VOT);
export const noiDungLoiLuu = (kq: Extract<KetQuaGhi, { ok: false }>) => NOI_DUNG_LOI_LUU[kq.lyDo];

/** Số vợt đã đến lịch nhắc (đọc sau khi mount; ngày theo lịch địa phương). Dùng cho dấu chấm nhắc trên thanh điều hướng. */
export function useSoVotDenHan(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    // Thanh điều hướng nằm trên MỌI trang: lỗi đọc ngoài dự kiến chỉ đưa dấu nhắc về 0, không được làm sập cả cửa hàng.
    const dem = () => { try { setN(soVotDenHan(docTu().ds, homNayDiaPhuong())); } catch { setN(0); } };
    dem();
    const khiDoi = (e: StorageEvent) => { if (e.key === KHOA_TU_VOT || e.key === null) dem(); };
    window.addEventListener("storage", khiDoi);
    window.addEventListener("tu-vot:doi", dem);
    return () => { window.removeEventListener("storage", khiDoi); window.removeEventListener("tu-vot:doi", dem); };
  }, []);
  return n;
}

export const baoTuVotDoi = () => window.dispatchEvent(new Event("tu-vot:doi"));
