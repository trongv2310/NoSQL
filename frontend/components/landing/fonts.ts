/**
 * Chữ tiêu đề riêng cho landing (đủ dấu tiếng Việt): Barlow Condensed tự host qua gói @fontsource/barlow-condensed
 * (file font nằm trong node_modules, được nạp ở app/layout.tsx). Trước đây dùng next/font/google nên `npm run build`
 * thất bại khi máy build không ra được Google Fonts. Trình duyệt chỉ tải file font khi có chữ dùng font này.
 */
export const fontTieuDe = {
  className: "font-tieu-de",
  style: { fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif" },
} as const;
