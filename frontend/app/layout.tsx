import type { Metadata } from "next";
import { AppProviders } from "@/components/AppProviders";
// Font chữ và icon tự host từ npm (không phụ thuộc Google Fonts / CDN cdnjs: mất mạng vẫn build và hiển thị đủ).
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

export const metadata: Metadata = {
  title: "Cửa Hàng Cầu Lông Online",
  description: "Cửa hàng dụng cụ và phụ kiện cầu lông: vợt, giày, trang phục",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <head>
        <link href="/css/bootstrap.min.css" rel="stylesheet" />
        <link href="/css/theme.css" rel="stylesheet" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
