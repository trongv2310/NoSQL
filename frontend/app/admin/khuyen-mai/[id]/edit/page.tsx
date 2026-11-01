"use client";

import { useParams } from "next/navigation";
import { KhuyenMaiForm } from "@/components/admin/KhuyenMaiForm";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <KhuyenMaiForm id={id} />;
}
