import { ViewTransition } from "react";

/**
 * Template được tạo lại mỗi lần chuyển trang nên <ViewTransition> ở đây chạy enter/exit theo từng lần điều hướng
 * (layout thì giữ nguyên nên header/footer đứng yên). Hiệu ứng khai báo trong storefront.css (.sf-page-in/.sf-page-out).
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="sf-page-in" exit="sf-page-out" default="none">
      {children}
    </ViewTransition>
  );
}
