import { Suspense } from "react";

/** Cho phép dựng tĩnh các trang dùng useSearchParams. Khung chờ giữ chiều cao để tránh nhảy bố cục. */
export function PageSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div style={{ minHeight: "60vh" }} aria-hidden="true" />}>{children}</Suspense>;
}
