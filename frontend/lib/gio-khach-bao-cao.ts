import type { KetQuaGopV } from "./types";

/**
 * Tóm tắt báo cáo đồng bộ giỏ khách thành một câu cho thông báo. Trả về null khi không có gì đáng nói (ví dụ lần gửi lại đã áp dụng).
 * `loai = "loi"` khi không dòng nào vào được giỏ tài khoản mà có dòng bị bỏ qua.
 */
export function tomTatDongBo(ds: KetQuaGopV[]): { loai: "ok" | "loi"; noiDung: string } | null {
  if (!ds.length) return null;
  const daThem = ds.reduce((t, d) => t + d.daThem, 0);
  const ten = (d: KetQuaGopV) => d.tenSanPham ?? "một sản phẩm không còn trong cửa hàng";
  const biBo = ds.filter((d) => d.trangThai === "het_hang" || d.trangThai === "ngung_kinh_doanh" || d.trangThai === "khong_ton_tai");
  const biGiam = ds.filter((d) => d.trangThai === "giam_so_luong" && d.daThem < d.yeuCau);
  const luuY: string[] = [];
  if (biBo.length) {
    luuY.push(`${biBo.length} sản phẩm không thêm được vì hết hàng hoặc ngừng kinh doanh (${biBo.slice(0, 2).map(ten).join(", ")}${biBo.length > 2 ? "…" : ""})`);
  }
  if (biGiam.length) {
    luuY.push(`${biGiam.length} sản phẩm bị giảm số lượng cho khớp tồn kho`);
  }
  if (!daThem && !luuY.length) return null;
  const dau = daThem ? `Đã chuyển giỏ hàng của bạn vào tài khoản (${daThem} sản phẩm).` : "Giỏ hàng chưa đăng nhập của bạn chưa thêm được sản phẩm nào.";
  return { loai: daThem ? "ok" : "loi", noiDung: luuY.length ? `${dau} Lưu ý: ${luuY.join("; ")}.` : dau };
}
