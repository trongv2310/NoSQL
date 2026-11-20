import { LuoiCombo } from "@/components/ComboGoiY";
import { Khu } from "@/components/quay/KhuChung";
import { chonComboHienThi } from "@/lib/goi-y";
import { layGoiYCombo } from "@/lib/server-api";

/**
 * Khối "Combo mua chung" ở trang chủ: tối đa 3 combo từ GET /goi-y/combo (lấy ở server, làm mới như dữ liệu sản phẩm của trang).
 * API lỗi/không trả lời hoặc không có combo hợp lệ thì KHÔNG hiện gì (không chen khu trống, không báo lỗi). Chỉ nói tổng giá hiện hành, không có mức giảm combo.
 */
export async function ComboMuaChung() {
  const combos = chonComboHienThi(await layGoiYCombo());
  if (combos.length === 0) return null;
  return (
    <Khu id="combo-mua-chung" kicker="Mua chung" tieuDe="Combo mua chung">
      <LuoiCombo combos={combos} />
    </Khu>
  );
}
