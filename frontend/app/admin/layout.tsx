import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: "Quản Trị Hệ Thống - Shop Cầu Lông" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link href="/css/admin.css" rel="stylesheet" />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
