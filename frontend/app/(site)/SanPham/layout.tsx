import { PageSuspense } from "@/components/PageSuspense";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PageSuspense>{children}</PageSuspense>;
}
