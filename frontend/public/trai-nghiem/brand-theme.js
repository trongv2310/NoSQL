/*
 * BRAND_THEME — hợp đồng màu của Landing 3D "Shop Cầu Lông" (Claude lập từ web hiện tại, 13/11/2026).
 * Nguồn: frontend/public/css/storefront.css (--grad-brand #0b3b2b → #0f5a3f → #148f5f, --hot #ff6a13), chữ màu ấm #ffc98a ở hero,
 * chữ phụ trên nền xanh đậm #a9c5b8 (footer), font Inter (thân) + Barlow Condensed (tiêu đề), tên shop từ GET /api/site: "Shop Cầu Lông".
 * Nền 3D phải TỐI (AdditiveBlending + bloom ngưỡng 0.86 + ACES uExp 0.62): BG_DEEP/BG_SURFACE nội suy cùng sắc độ xanh của web (H ≈ 158°).
 * Ánh xạ biến cũ của Kage: --ink → BG_DEEP, --ink-2 → BG_SURFACE, --vermilion → PRIMARY, --ember → ACCENT, --gold → METAL, --bone → TEXT_MAIN, --bone-dim → TEXT_DIM.
 */
window.BRAND_THEME = (function () {
  function mk(hex) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return { hex: hex, rgb: r + ', ' + g + ', ' + b, n: [r / 255, g / 255, b / 255] };
  }
  return {
    NAME: 'Shop Cầu Lông',
    WORDMARK: 'SHOP CẦU LÔNG',
    FONT_HEAD: "'Barlow Condensed', 'Inter', system-ui, sans-serif",
    FONT_BODY: "'Inter', system-ui, sans-serif",
    BG_DEEP: mk('#07130f'),      // L ≈ 5%, cùng sắc xanh brand
    BG_SURFACE: mk('#0e261e'),   // L ≈ 10%: thảm sân, sương mù, chuyển đoạn
    PRIMARY: mk('#148f5f'),      // xanh brand (điểm sáng nhất của --grad-brand) — thay vermilion
    PRIMARY_DEEP: mk('#0b3b2b'), // xanh đậm của nút/điều hướng web — dùng cho nút nền
    ACCENT: mk('#ff6a13'),       // cam --hot của web — thay ember
    METAL: mk('#ffc98a'),        // vàng ấm (chữ nhấn hero) — thay gold
    TEXT_MAIN: mk('#f2efe6'),
    TEXT_DIM: mk('#a9c5b8'),
  };
})();
