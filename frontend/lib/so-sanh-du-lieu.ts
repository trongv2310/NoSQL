import { docSucCang } from "./cuoc-cang";
import { bacCanBang, bacDoCung } from "./landing-data";
import { soMm, soU, type HoSoDoiChieu } from "./so-sanh";
import type { UngVienSoSanh } from "./so-sanh-bieu-do";
import type { BienTheV, SanPhamV } from "./types";

export const NHAN_TRUONG_THONG_SO: Record<string, string> = { doCanBang: "điểm cân bằng", trongLuong: "trọng lượng", doCung: "độ cứng", chieuDai: "chiều dài", sucCang: "sức căng" };

/** Phiên bản đại diện khi liên kết không nêu phiên bản: phiên bản còn hàng đầu tiên, không thì phiên bản đầu. */
export const bienTheMacDinh = (ds: BienTheV[]): BienTheV | null => ds.find((b) => b.soLuongTon > 0) ?? ds[0] ?? null;

/** Nhãn phiên bản dễ đọc: "Trắng / 4U". */
export const nhanBienThe = (b: BienTheV): string => [b.mau?.tenMau, b.size?.tenSize].filter(Boolean).join(" / ") || b.sku || "Tiêu chuẩn";

/** Chuẩn hóa một vợt + phiên bản thành số để đối chiếu (xem `doiChieu`). Trường không có hoặc không đọc được thì null, không đoán. */
export function taoHoSoDoiChieu(sp: SanPhamV, b: BienTheV): HoSoDoiChieu {
  const ts = b.thongSo ?? null;
  const cang = docSucCang(ts?.sucCang);
  const cb = bacCanBang(ts), dc = bacDoCung(ts), u = soU(ts?.trongLuong);
  return {
    ten: sp.tenSanPham,
    gia: b.giaThucTe,
    ton: b.soLuongTon,
    canBang: cb !== null && ts?.doCanBang ? { bac: cb, chu: ts.doCanBang } : null,
    trongLuong: u !== null && ts?.trongLuong ? { so: u, chu: ts.trongLuong } : null,
    doCung: dc !== null && ts?.doCung ? { bac: dc, chu: ts.doCung } : null,
    chieuDaiMm: soMm(ts?.chieuDai),
    cangToiDa: cang.ok ? { giaTri: cang.khoang.max, donVi: cang.khoang.donVi } : null,
    tuyPhienBan: Object.keys(sp.thongSoKhacNhau ?? {}).map((k) => NHAN_TRUONG_THONG_SO[k] ?? k),
  };
}

/** Tên ngắn để ghi trên biểu đồ: bỏ tiền tố "Vợt Cầu Lông". */
export const tenNganVot = (ten: string): string => ten.replace(/^Vợt( Cầu Lông)?\s+/i, "").trim() || ten;

/** Vợt trong danh sách → ứng viên gợi ý cặp. Thông số lấy từ phần chung của các phiên bản (trường khác nhau giữa phiên bản thì không có ở đây nên là null, không đoán). */
export function taoUngVien(sp: SanPhamV): UngVienSoSanh {
  const cb = bacCanBang(sp.thongSoVot ?? null), dc = bacDoCung(sp.thongSoVot ?? null);
  return {
    id: sp.id, ten: sp.tenSanPham, hang: sp.hang?.tenHang ?? null, gia: sp.giaSauKhuyenMai, ton: sp.tongTonKho ?? 0,
    canBang: cb !== null && sp.thongSoVot?.doCanBang ? { bac: cb, chu: sp.thongSoVot.doCanBang } : null,
    doCung: dc !== null && sp.thongSoVot?.doCung ? { bac: dc, chu: sp.thongSoVot.doCung } : null,
  };
}
