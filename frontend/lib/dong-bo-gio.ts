/**
 * Đồng bộ từng bản chụp vào tài khoản đã được máy chủ xác nhận.
 * Kiểm tra phiên trước mỗi thao tác ghi. Chỉ xóa bản chụp khi phản hồi xác nhận đúng tài khoản.
 */

export interface DongBoYeuCau { taiKhoanId: string; syncId: string; dong: { chiTietId: string; soLuong: number }[] }
export interface DongBoPhanHoi { taiKhoanId?: string; cartCount: number; daApDungTruoc: boolean; ketQua: KetQuaGopTho[] }
export interface KetQuaGopTho { chiTietId: string; tenSanPham: string | null; yeuCau: number; daThem: number; trangThai: string }

interface BanChupTho { token: string; dong: { id: string; sl: number }[] }
interface KhoGio {
  layGio(): { dong: unknown[] };
  chuyenSangCho(userId: string): unknown;
  banChupDangCho(userId: string): BanChupTho[];
  xoaBanChup(userId: string, token: string): void;
  doiTokenBanChup(userId: string, token: string): void;
}

export interface DongBoDeps extends KhoGio {
  /** Gửi một bản chụp. Lỗi HTTP phải có dạng `{ status, body }` (như ApiError). */
  goi(yeuCau: DongBoYeuCau): Promise<DongBoPhanHoi>;
  /** Giao diện còn đang ở tài khoản `userId` không (kiểm tra ĐỒNG BỘ, ngay trước mỗi bước có tác dụng phụ). */
  conDung(): boolean;
  /** Tài khoản của phiên đăng nhập theo server (`null` nếu chưa đăng nhập). */
  taiKhoanHienTai(): Promise<string | null>;
}

export interface DongBoKetQua {
  /** Số lượng giỏ tài khoản sau lần gộp gần nhất thành công (null nếu chưa gộp lần nào). */
  soLuongMoi: number | null;
  baoCao: KetQuaGopTho[];
  /** Lỗi chặn đồng bộ (mạng/máy chủ); hàng đợi được giữ để thử lại. */
  loi: unknown | null;
  /** Phiên đăng nhập ở server khác với tài khoản của hàng đợi; hàng đợi được giữ cho đúng chủ. */
  phienDoi: boolean;
  /** Giao diện đã chuyển sang tài khoản khác giữa chừng; dừng, hàng đợi được giữ. */
  biHuy: boolean;
}

const SO_VONG_TOI_DA = 3;
const laSaiTaiKhoan = (e: unknown) => {
  const x = e as { status?: number; body?: { maLoi?: string } } | null;
  return x?.status === 403 && x?.body?.maLoi === "sai_tai_khoan";
};

export async function dongBoTaiKhoan(userId: string, deps: DongBoDeps): Promise<DongBoKetQua> {
  const kq: DongBoKetQua = { soLuongMoi: null, baoCao: [], loi: null, phienDoi: false, biHuy: false };
  vong: for (let lan = 0; lan < SO_VONG_TOI_DA; lan++) {
    if (!deps.conDung()) { kq.biHuy = true; break; }

    // Giỏ khách (nếu có) chỉ được chuyển cho userId khi server xác nhận phiên hiện tại đúng là userId.
    if (deps.layGio().dong.length > 0) {
      let hienTai: string | null;
      try {
        hienTai = await deps.taiKhoanHienTai();
      } catch (e) {
        kq.loi = e;
        break;
      }
      if (!deps.conDung()) { kq.biHuy = true; break; }
      if (hienTai !== userId) { kq.phienDoi = true; break; }
      deps.chuyenSangCho(userId); // ngay sau await, không còn điểm nhường nào giữa kiểm tra conDung và chuyển
    }

    const ds = deps.banChupDangCho(userId);
    if (!ds.length) break;
    for (const ban of ds) {
      if (!deps.conDung()) { kq.biHuy = true; break vong; }
      let r: DongBoPhanHoi;
      try {
        r = await deps.goi({ taiKhoanId: userId, syncId: ban.token, dong: ban.dong.map((d) => ({ chiTietId: d.id, soLuong: d.sl })) });
      } catch (e) {
        if (laSaiTaiKhoan(e)) { kq.phienDoi = true; break vong; }
        if ((e as { status?: number } | null)?.status === 409) deps.doiTokenBanChup(userId, ban.token);
        kq.loi = e;
        break vong;
      }
      // Phản hồi phải là của đúng tài khoản này thì mới được coi là server đã nhận bản chụp.
      if (r.taiKhoanId !== userId) { kq.phienDoi = true; break vong; }
      deps.xoaBanChup(userId, ban.token);
      kq.soLuongMoi = r.cartCount;
      if (!r.daApDungTruoc) kq.baoCao.push(...r.ketQua);
    }
  }
  return kq;
}
