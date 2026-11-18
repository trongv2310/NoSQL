"use client";

import Link from "next/link";
import { duongDanSoSanh, TOI_THIEU_SO_SANH } from "@/lib/so-sanh";
import { NOI_DUNG_LOI_LUU } from "@/lib/luu-tru";
import { xoaHetSoSanh, useSoSanh } from "./so-sanh-store";
import s from "@/components/product/bento.module.css";

/** Khay so sánh nằm trong dòng nội dung (không cố định, không che nút mua/chat): chỉ hiện khi đã chọn ít nhất một vợt. */
export function KhaySoSanh() {
  const { muc, loiLuu } = useSoSanh();
  if (!muc.length) return null;
  const du = muc.length >= TOI_THIEU_SO_SANH;
  return (
    <div className={s.khay} role="region" aria-label="Khay so sánh vợt">
      <span><strong>So sánh:</strong> đã chọn {muc.length}/3 vợt.</span>
      {du ? <Link href={duongDanSoSanh(muc)}>Xem so sánh</Link> : <span>Chọn thêm ít nhất 1 vợt nữa để so sánh.</span>}
      <button type="button" className={s.lienKet} style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={xoaHetSoSanh}>Xóa hết</button>
      {loiLuu && <span className={s.loi} role="status">{NOI_DUNG_LOI_LUU[loiLuu]} Lựa chọn chỉ giữ trong phiên này.</span>}
    </div>
  );
}
