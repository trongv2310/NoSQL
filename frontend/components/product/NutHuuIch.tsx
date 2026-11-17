"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProviders";
import { apiPost, loiTuApi } from "@/lib/api";

/**
 * Nút "Hữu ích": bật/tắt bằng POST /phan-hoi/:id/huu-ich. Backend ghi $addToSet/$pull cùng $inc trong MỘT lệnh có điều kiện,
 * nên bấm nhanh nhiều lần cũng không cộng đôi; số hiển thị luôn lấy từ kết quả server trả về.
 */
export function NutHuuIch({ danhGiaId, soBanDau }: { danhGiaId: string; soBanDau: number }) {
  const { user, flash } = useApp();
  const [so, setSo] = useState(soBanDau);
  const [daBam, setDaBam] = useState(false);
  const [dang, setDang] = useState(false);

  const bam = async () => {
    if (!user) { flash("danger", "Đăng nhập để đánh dấu đánh giá hữu ích."); return; }
    setDang(true);
    try {
      const r = await apiPost<{ daBam: boolean; soHuuIch: number }>(`/phan-hoi/${danhGiaId}/huu-ich`);
      setSo(r.soHuuIch);
      setDaBam(r.daBam);
    } catch (e) {
      flash("danger", loiTuApi(e));
    } finally {
      setDang(false);
    }
  };

  return (
    <button type="button" className={`btn btn-sm rounded-pill ${daBam ? "btn-primary" : "btn-outline-secondary"}`} disabled={dang} aria-pressed={daBam} onClick={bam}>
      <i className="fa-regular fa-thumbs-up" aria-hidden="true" /> Hữu ích{so > 0 ? ` (${so})` : ""}
    </button>
  );
}
