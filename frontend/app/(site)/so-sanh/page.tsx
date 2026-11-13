import type { Metadata } from "next";
import { Suspense } from "react";
import { SoSanhVot } from "@/components/so-sanh/SoSanhVot";
import { Page } from "@/components/Ui";

export const metadata: Metadata = {
  title: "So sánh vợt cầu lông - Cửa Hàng Cầu Lông",
  description: "So sánh 2–3 vợt theo giá, tồn kho và thông số ghi trong kho; liên kết chia sẻ được.",
};

export default function Trang() {
  return (
    <Suspense fallback={<Page><p>Đang tải so sánh…</p></Page>}>
      <SoSanhVot />
    </Suspense>
  );
}
