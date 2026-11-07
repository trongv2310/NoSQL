import { Barlow_Condensed } from "next/font/google";

/** Chữ tiêu đề riêng cho landing (đủ dấu tiếng Việt). Chỉ nạp ở trang dùng nó, không đụng font toàn site. */
export const fontTieuDe = Barlow_Condensed({
  subsets: ["vietnamese", "latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});
