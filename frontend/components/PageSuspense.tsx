import { Suspense } from "react";

/**
 * Ranh giới Suspense cho nhóm trang có client component dùng `useSearchParams` (bắt buộc khi trang được dựng tĩnh).
 * Đặt ở layout của từng nhóm thay vì ở layout chung của site, để các trang không cần nó (trang chủ…) có HTML hoàn chỉnh ngay từ đầu.
 * Khung giữ chỗ có chiều cao tối thiểu để footer không bị vẽ sát dưới header rồi nhảy xuống khi nội dung về.
 */
export function PageSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div style={{ minHeight: "60vh" }} aria-hidden="true" />}>{children}</Suspense>;
}
