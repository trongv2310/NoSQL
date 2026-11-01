"use client";

import { useParams } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <ProductForm id={id} />;
}
