"use client";

import { useApp } from "@/components/AppProviders";
import { boSoSanh, themSoSanh, useSoSanh } from "./so-sanh-store";
import s from "@/components/product/bento.module.css";

/**
 * Nút "So sánh" gọn (vuông 40px, đặt chồng lên góc khung ảnh nên KHÔNG làm thẻ cao thêm). Có tên truy cập đầy đủ và trạng thái bấm;
 * đã đủ 3 vợt thì nói rõ bằng thông báo thay vì im lặng. `bienTheId` chỉ truyền khi người dùng đã chọn một phiên bản cụ thể.
 */
export function NutSoSanh({ sanPhamId, ten, bienTheId = null, kieu = "icon" }: { sanPhamId: string; ten: string; bienTheId?: string | null; kieu?: "icon" | "chu" }) {
  const { flash } = useApp();
  const { muc } = useSoSanh();
  const co = muc.some((m) => m.sanPhamId === sanPhamId);
  const bam = () => {
    if (co) { boSoSanh(sanPhamId); return; }
    const kq = themSoSanh({ sanPhamId, bienTheId });
    if (!kq.ok) flash("danger", kq.lyDo === "day" ? "Chỉ so sánh tối đa 3 vợt cùng lúc. Bỏ bớt một vợt trong khay so sánh rồi thêm lại." : "Không thêm được vợt này vào so sánh.");
  };
  return (
    <button type="button" className={kieu === "chu" ? s.nut : s.nutVuong} aria-pressed={co} aria-label={co ? `Bỏ ${ten} khỏi so sánh` : `So sánh ${ten}`} title={co ? "Bỏ khỏi so sánh" : "Thêm vào so sánh"} onClick={bam}>
      <i className={`fa-solid ${co ? "fa-check" : "fa-code-compare"}`} aria-hidden="true" />
      {kieu === "chu" && <span>{co ? "Đang so sánh" : "So sánh vợt"}</span>}
    </button>
  );
}
