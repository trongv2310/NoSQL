import type { Metadata } from "next";
import { Suspense } from "react";
import { TuVotTheoTaiKhoan } from "@/components/tu-vot/TuVotTheoTaiKhoan";
import { Page } from "@/components/Ui";

export const metadata: Metadata = {
  title: "Tủ vợt của tôi - Cửa Hàng Cầu Lông",
  description: "Hộ chiếu cây vợt: khoảng căng nhà sản xuất, sổ căng cước và lịch nhắc do bạn đặt.",
};

export default function Trang() {
  return (
    <Suspense fallback={<Page><p>Đang tải tủ vợt…</p></Page>}>
      <TuVotTheoTaiKhoan />
    </Suspense>
  );
}
