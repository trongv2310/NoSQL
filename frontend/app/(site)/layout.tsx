import { Suspense } from "react";
import { Chatbot, Footer, Header } from "@/components/SiteChrome";
import { SiteMotion } from "@/components/Motion";

/** Khung chung của trang khách: header + nội dung + footer + chatbot. CSS riêng của site nạp ở đây. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link href="/css/Site.css" rel="stylesheet" />
      <link href="/css/storefront.css" rel="stylesheet" />
      <link href="/css/storefront-pages.css" rel="stylesheet" />
      <link href="/css/storefront-news.css" rel="stylesheet" />
      <link href="/css/storefront-shop.css" rel="stylesheet" />
      <Header />
      <Suspense fallback={null}>{children}</Suspense>
      <Footer />
      <Chatbot />
      <SiteMotion />
    </>
  );
}
