"use client";

import { useCallback } from "react";
import { useApp } from "@/components/AppProviders";
import { ApiError, apiPost, loiTuApi } from "@/lib/api";
import { layGio, soLuongTrongGio, themVaoGio as themVaoGioKhach } from "@/lib/gio-khach";

export type KetQuaThemBienThe =
  | { ok: true; doiTaiKhoan?: boolean }
  | { ok: false; chuaRo: boolean; thongBao: string; doiTaiKhoan?: boolean };

/** Máy chủ từ chối vì phiên đăng nhập không còn là tài khoản mà giao diện định thêm giỏ cho (xem `taiKhoanDuKien` ở POST /gio-hang). */
export function laLoiSaiTaiKhoan(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403 && (e.body as { maLoi?: string } | null)?.maLoi === "sai_tai_khoan";
}

export const THONG_BAO_DOI_TAI_KHOAN = "Tài khoản đăng nhập đã đổi trong lúc thêm vào giỏ nên thao tác này đã dừng. Không có sản phẩm nào được thêm vào tài khoản hiện tại.";
const THONG_BAO_DA_VAO_GIO_CU = "Tài khoản đăng nhập đã đổi trong lúc thêm. Sản phẩm vừa rồi nằm trong giỏ của tài khoản trước, không phải tài khoản hiện tại.";

/**
 * Đọc phiên hiện tại lúc thêm vợt và gửi kèm `taiKhoanDuKien` để máy chủ đối chiếu trước khi ghi.
 * Phản hồi từ phiên cũ không cập nhật giỏ đang hiển thị. `chuaRo` báo kết quả chưa xác định khi lỗi mạng.
 */
export function useThemBienTheKq() {
  const { ready, setCartCount, flash, taiKhoanHienTai, refreshUser } = useApp();
  return useCallback(async (bien: { id: string; soLuongTon: number }, soLuong = 1, ten = "Sản phẩm", baoLoi = true, chu?: string | null): Promise<KetQuaThemBienThe> => {
    const that = (thongBao: string, chuaRo = false): KetQuaThemBienThe => { if (baoLoi) flash("danger", thongBao); return { ok: false, chuaRo, thongBao }; };
    const doi = (): KetQuaThemBienThe => { if (baoLoi) flash("danger", THONG_BAO_DOI_TAI_KHOAN); return { ok: false, chuaRo: false, thongBao: THONG_BAO_DOI_TAI_KHOAN, doiTaiKhoan: true }; };
    if (!ready) return that("Đang kiểm tra phiên đăng nhập, vui lòng thử lại sau giây lát.");
    const nguoi = taiKhoanHienTai();
    if (chu !== undefined && chu !== nguoi) return doi();
    if (bien.soLuongTon <= 0 || soLuong > bien.soLuongTon) return that("Phiên bản này đã hết hàng hoặc không đủ số lượng.");
    if (!nguoi) {
      const co = soLuongTrongGio(layGio(), bien.id);
      if (co + soLuong > Math.min(100, bien.soLuongTon)) return that(`Giỏ hàng đã có ${co} sản phẩm này, thêm nữa sẽ vượt tồn kho hoặc giới hạn 100.`);
      const kq = themVaoGioKhach(bien.id, soLuong);
      if (!kq.ok) return that(kq.lyDo === "tran-dong" ? "Giỏ hàng chưa đăng nhập chỉ chứa tối đa 50 sản phẩm khác nhau." : "Không thêm được sản phẩm này vào giỏ hàng.");
      if (baoLoi) flash("success", `Đã thêm ${ten} vào giỏ hàng.`);
      return { ok: true };
    }
    try {
      const r = await apiPost<{ message: string; cartCount: number }>("/gio-hang", { chiTietId: bien.id, quantity: soLuong, taiKhoanDuKien: nguoi });
      if (taiKhoanHienTai() !== nguoi) {
        // Máy chủ đã nhận món này cho `nguoi` (tài khoản cũ) nhưng giao diện đã sang danh tính khác: giữ nguyên giỏ cũ, không cập nhật huy hiệu/thông báo.
        if (baoLoi) flash("danger", THONG_BAO_DA_VAO_GIO_CU);
        return { ok: true, doiTaiKhoan: true };
      }
      setCartCount(r.cartCount);
      if (baoLoi) flash("success", `Đã thêm ${ten} vào giỏ hàng.`);
      return { ok: true };
    } catch (e) {
      if (laLoiSaiTaiKhoan(e)) { void refreshUser(); return doi(); } // máy chủ từ chối trước khi ghi: giỏ tài khoản mới không bị đụng
      if (taiKhoanHienTai() !== nguoi) return doi();
      // ApiError 4xx = máy chủ trả lời và từ chối (chắc chắn chưa thêm); lỗi mạng/hết giờ/5xx = chưa rõ máy chủ đã nhận hay chưa.
      return that(loiTuApi(e), !(e instanceof ApiError) || e.status >= 500);
    }
  }, [ready, setCartCount, flash, taiKhoanHienTai, refreshUser]);
}

/** Bản tối giản trả true/false cho các chỗ chỉ cần biết thành công hay không (thẻ sản phẩm thêm nhanh). Thêm vào giỏ của tài khoản đã đổi tính là chưa thành công. */
export function useThemBienThe() {
  const them = useThemBienTheKq();
  return useCallback(async (bien: { id: string; soLuongTon: number }, soLuong = 1, ten = "Sản phẩm"): Promise<boolean> => {
    const kq = await them(bien, soLuong, ten);
    return kq.ok && !kq.doiTaiKhoan;
  }, [them]);
}
