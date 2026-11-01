import { Suspense } from "react";
import { Chatbot, Footer, Header } from "@/components/SiteChrome";

/** Khung chung của trang khách: header + nội dung + footer + chatbot. CSS riêng của site nạp ở đây. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link href="/css/Site.css" rel="stylesheet" />
      <Header />
      <Suspense fallback={null}>{children}</Suspense>
      <Footer />
      <Chatbot />
    </>
  );
}
