import type { Metadata } from "next";
import { Suspense } from "react";
import { TuVot } from "@/components/tu-vot/TuVot";
import { Page } from "@/components/Ui";

export const metadata: Metadata = {
  title: "Tủ vợt của tôi - Cửa Hàng Cầu Lông",
  description: "Ghi vợt đang dùng, ngày căng và chu kỳ nhắc do bạn đặt; lưu trên trình duyệt này.",
};

export default function Trang() {
  return (
    <Suspense fallback={<Page><p>Đang tải tủ vợt…</p></Page>}>
      <TuVot />
    </Suspense>
  );
}
