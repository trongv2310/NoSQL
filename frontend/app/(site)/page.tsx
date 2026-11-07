import type { Metadata } from "next";
import { Catalog } from "@/components/landing/Catalog";
import { ChapterRail } from "@/components/landing/ChapterRail";
import { Categories } from "@/components/landing/Categories";
import { HeroCourt } from "@/components/landing/Hero";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { Story } from "@/components/landing/Story";
import { Brands, FinalCta, Reviews } from "@/components/landing/Trust";
import s from "@/components/landing/landing.module.css";

const MO_TA = "Vợt, giày, trang phục và phụ kiện cầu lông từ Yonex, Li-Ning, Victor, Mizuno. Lọc theo ngân sách, tìm vợt phù hợp và xem tồn kho trước khi đặt.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "Khám phá cửa hàng cầu lông - Cửa Hàng Cầu Lông",
  description: MO_TA,
  openGraph: {
    title: "Cửa Hàng Cầu Lông — Đúng vợt, đúng giày, vào trận",
    description: MO_TA,
    images: [{ url: "/images/landing/hero-court.webp", width: 1600, height: 667 }],
    locale: "vi_VN",
    type: "website",
  },
};

/**
 * Trang tĩnh làm mới theo hạn của dữ liệu giá/tồn kho (phải là literal để Next đọc lúc build; bằng LAM_MOI_SAN_PHAM_GIAY trong lib/server-api.ts).
 * Dữ liệu được lấy lúc dựng/làm mới trang (mỗi lần gọi chờ tối đa 2,5 giây, quá hạn thì coi như chưa có), nên người xem nhận HTML đủ nội dung
 * ngay từ byte đầu, không có khối nào được chèn muộn làm footer nhảy. Hero và danh mục không đọc API. Khối nào thiếu dữ liệu thì tự tải lại
 * phía client với trạng thái loading/lỗi/thử lại riêng (xem CatalogProvider).
 */
export const revalidate = 120;

export default function TrangChu() {
  return (
    <main className={s.root} data-landing>
      <LandingMotion />
      <ChapterRail />
      <HeroCourt />
      <Categories />
      <Catalog />
      <Story />
      <Reviews />
      <Brands />
      <FinalCta />
    </main>
  );
}
