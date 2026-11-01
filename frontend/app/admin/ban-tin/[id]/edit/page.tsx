"use client";

import { useParams } from "next/navigation";
import { BanTinForm } from "@/components/admin/BanTinForm";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <BanTinForm id={id} />;
}
