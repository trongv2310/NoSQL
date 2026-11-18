"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { imgUrl } from "@/lib/format";

const ANH_MAC_DINH = "/images/default-product.jpg";

/** Màu trung bình của viền ảnh (vẽ ảnh vào canvas 24×24). Canvas bị chặn (ảnh khác nguồn) thì trả null. */
function mauVien(img: HTMLImageElement): [number, number, number] | null {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 24;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(img, 0, 0, 24, 24);
    const d = g.getImageData(0, 0, 24, 24).data;
    let r = 0, v = 0, b = 0, n = 0;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        if (y > 1 && y < 22 && x > 1 && x < 22) continue;
        const i = (y * 24 + x) * 4;
        r += d[i]; v += d[i + 1]; b += d[i + 2]; n++;
      }
    }
    return [r / n, v / n, b / n];
  } catch {
    return null;
  }
}

/**
 * Ảnh sản phẩm tối ưu bằng next/image, tự rơi về ảnh mặc định khi ảnh lỗi. Ảnh upload đi qua rewrite sang backend nên không qua bộ tối ưu.
 * `hoaNen`: chuẩn hóa nền khung ảnh khi ảnh nạp xong. Ảnh nền trắng hòa vào khung sáng (multiply); ảnh nền tối hoặc xám thì khung đổi
 * sang đúng màu viền ảnh (biến `--nen` và `data-nen="mau"` đặt lên phần tử cha) và mép ảnh được làm mờ dần (biến `--ix`, `--iy` = phần
 * khung nằm ngoài ảnh) nên không lộ hình chữ nhật; ảnh nhỏ hơn vùng hiển thị (sẽ bị phóng và mờ) được đánh dấu `data-nho`
 * để CSS chừa viền rộng hơn. Khung ảnh phải vuông (CSS đảm bảo) và ảnh vẽ kiểu `contain`.
 */
export function ProductImage({ src, alt, sizes, className, hoaNen = false }: {
  src?: string | null; alt: string; sizes: string; className?: string; hoaNen?: boolean;
}) {
  const goc = imgUrl(src);
  const [loi, setLoi] = useState(false);
  const duong = loi ? ANH_MAC_DINH : goc;

  const apDung = useCallback((img: HTMLImageElement) => {
    if (!hoaNen || !img.naturalWidth) return;
    const cha = img.parentElement;
    if (!cha) return;
    const can = img.clientWidth * (window.devicePixelRatio || 1) * 0.8;
    if (img.naturalWidth < can) img.dataset.nho = ""; else delete img.dataset.nho;
    const m = mauVien(img);
    if (!m) return;
    const sang = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    if (sang >= 244) {
      delete cha.dataset.nen;
      cha.style.removeProperty("--nen");
      return;
    }
    // Vùng ảnh thật sự chiếm trong khung vuông (đã trừ viền padding) → phần khung nằm ngoài ảnh, tính theo % cạnh khung.
    const rong = img.clientWidth || 1;
    const pad = (parseFloat(getComputedStyle(img).paddingLeft) / rong) * 100;
    const nd = 100 - 2 * pad;
    const tl = img.naturalWidth / img.naturalHeight;
    const rw = tl >= 1 ? nd : nd * tl, rh = tl >= 1 ? nd / tl : nd;
    img.style.setProperty("--ix", `${((100 - rw) / 2).toFixed(2)}%`);
    img.style.setProperty("--iy", `${((100 - rh) / 2).toFixed(2)}%`);
    cha.dataset.nen = "mau";
    cha.style.setProperty("--nen", `rgb(${Math.round(m[0])} ${Math.round(m[1])} ${Math.round(m[2])})`);
  }, [hoaNen]);
  // Ảnh đã nằm trong cache có thể nạp xong trước khi React gắn onLoad.
  const gan = useCallback((img: HTMLImageElement | null) => { if (img?.complete) apDung(img); }, [apDung]);

  return (
    <Image
      ref={gan}
      src={duong}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      unoptimized={duong.startsWith("/uploads/") || /^https?:/i.test(duong)}
      onLoad={(e) => apDung(e.currentTarget)}
      onError={() => setLoi(true)}
    />
  );
}
