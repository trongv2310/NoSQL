"use client";

import { useParams } from "next/navigation";
import { TaiKhoanForm } from "@/components/admin/TaiKhoanForm";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <TaiKhoanForm id={id} />;
}
