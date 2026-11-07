"use client";

import Image from "next/image";
import { useState } from "react";
import { imgUrl } from "@/lib/format";

const ANH_MAC_DINH = "/images/default-product.jpg";

/** Ảnh sản phẩm tối ưu bằng next/image, tự rơi về ảnh mặc định khi ảnh lỗi. Ảnh upload đi qua rewrite sang backend nên không qua bộ tối ưu. */
export function ProductImage({ src, alt, sizes, className }: { src?: string | null; alt: string; sizes: string; className?: string }) {
  const goc = imgUrl(src);
  const [loi, setLoi] = useState(false);
  const duong = loi ? ANH_MAC_DINH : goc;
  return (
    <Image
      src={duong}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      unoptimized={duong.startsWith("/uploads/") || /^https?:/i.test(duong)}
      onError={() => setLoi(true)}
    />
  );
}
