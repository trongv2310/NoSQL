/**
 * Kiểm tra file ảnh trước khi gửi lên backend (sản phẩm, biến thể). Cùng quy tắc với backend/src/common/upload.ts:
 * đuôi jpg/jpeg/png/webp/gif (không phân biệt hoa thường, lấy sau dấu chấm cuối; ".png" không có tên thì backend coi là không có đuôi), tối đa 5MB, mime `image/*`.
 * Backend vẫn là nơi kiểm tra cuối cùng; đây chỉ để báo lỗi sớm.
 */
export const DUOI_ANH = ["jpg", "jpeg", "png", "webp", "gif"];
export const ANH_TOI_DA_BYTE = 5 * 1024 * 1024;

const LOI_DINH_DANG = "Hình ảnh phải có định dạng jpg, jpeg, png, webp hoặc gif.";

/** null = hợp lệ (không chọn file cũng là hợp lệ); còn lại là thông báo tiếng Việt. */
export function kiemTraAnh(file: { name: string; size: number; type?: string } | null | undefined): string | null {
  if (!file) return null;
  const cham = file.name.lastIndexOf(".");
  const duoi = cham > 0 ? file.name.slice(cham + 1).toLowerCase() : "";
  if (!DUOI_ANH.includes(duoi)) return LOI_DINH_DANG;
  if (file.type && !file.type.startsWith("image/")) return LOI_DINH_DANG;
  if (file.size === 0) return "File ảnh rỗng.";
  if (file.size > ANH_TOI_DA_BYTE) return "Ảnh vượt quá 5MB.";
  return null;
}

/**
 * Ảnh chính ở trang chi tiết sản phẩm. Trang tự chọn sẵn một biến thể (để có giá/tồn kho) nên khách mới mở trang phải thấy ảnh đại diện hiện tại của sản phẩm,
 * không phải ảnh của biến thể đó (có thể còn là bản sao ảnh đại diện cũ). Chỉ khi khách tự chọn màu/size mới dùng ảnh riêng của biến thể; biến thể không có ảnh thì dùng ảnh đại diện.
 */
export function anhChinhChiTiet({ anhDaiDien, anhBienThe, daChonPhienBan }: { anhDaiDien: string; anhBienThe?: string | null; daChonPhienBan: boolean }): string {
  return daChonPhienBan ? anhBienThe || anhDaiDien : anhDaiDien;
}
