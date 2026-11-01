"use client";

import { useParams } from "next/navigation";
import { TranDauForm } from "@/components/admin/TranDauForm";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <TranDauForm id={id} />;
}
