import type { SanPhamV } from "./types";

/** Dữ liệu và luật thuần cho landing (không phụ thuộc React) để dùng được ở cả server lẫn client. */

export interface ThongSoVot { doCanBang?: string; trongLuong?: string; doCung?: string; chieuDai?: string; sucCang?: string }
/** Một phần tử của `/api/san-pham/trang-chu`: sản phẩm kèm tồn kho và (với vợt) thông số kỹ thuật. */
export interface SanPhamLanding extends SanPhamV { tongTonKho: number; thongSoVot: ThongSoVot | null }

export type KhoaLoai = "vot" | "giay" | "aoquan" | "phukien";

export const LOAI: Record<KhoaLoai, { slug: string; ten: string; tenNgan: string }> = {
  vot: { slug: "Vot", ten: "Vợt cầu lông", tenNgan: "Vợt" },
  giay: { slug: "Giay", ten: "Giày cầu lông", tenNgan: "Giày" },
  aoquan: { slug: "AoQuan", ten: "Trang phục", tenNgan: "Trang phục" },
  phukien: { slug: "PhuKien", ten: "Phụ kiện", tenNgan: "Phụ kiện" },
};

/** Cùng cách nhận diện loại với backend (`catalog.service` → loc) để liên kết lọc cho kết quả khớp. */
export function khoaLoai(tenLoai?: string | null): KhoaLoai | null {
  const t = (tenLoai ?? "").toLocaleLowerCase("vi");
  if (t.includes("vợt")) return "vot";
  if (t.includes("giày")) return "giay";
  if (t.includes("áo") || t.includes("quần")) return "aoquan";
  if (t.includes("phụ")) return "phukien";
  return null;
}

export const dangGiam = (sp: SanPhamV) => sp.dangGiamGia && sp.giaGoc > sp.giaSauKhuyenMai;
export const phanTramGiam = (sp: SanPhamV) => (dangGiam(sp) ? Math.round((1 - sp.giaSauKhuyenMai / sp.giaGoc) * 100) : 0);
export const conHang = (sp: SanPhamLanding) => sp.tongTonKho > 0;

/** Các khoảng giá có sẵn của danh sách sản phẩm (trùng `KHOANG_GIA` ở backend, cả hai đầu đều tính). */
export const KHOANG_GIA = [
  { khoa: "0-1000000", nhan: "Dưới 1 triệu", tu: 0, den: 1_000_000 },
  { khoa: "1000000-2000000", nhan: "1 – 2 triệu", tu: 1_000_000, den: 2_000_000 },
  { khoa: "2000000-3000000", nhan: "2 – 3 triệu", tu: 2_000_000, den: 3_000_000 },
  { khoa: "3000000-5000000", nhan: "3 – 5 triệu", tu: 3_000_000, den: 5_000_000 },
  { khoa: "5000000-", nhan: "Trên 5 triệu", tu: 5_000_000, den: Infinity },
] as const;
export type KhoangGia = (typeof KHOANG_GIA)[number];
export const trongKhoang = (gia: number, k: KhoangGia) => gia >= k.tu && gia <= k.den;

/** Sản phẩm của một tab: ưu đãi thật (giảm nhiều trước) hoặc một loại (còn hàng trước, giữ thứ tự mới nhất). */
export function locTab(ds: SanPhamLanding[], tab: KhoaLoai | "giam", khoang: KhoangGia | null): SanPhamLanding[] {
  let r = tab === "giam" ? ds.filter(dangGiam) : ds.filter((sp) => khoaLoai(sp.loai?.tenLoai) === tab);
  if (khoang) r = r.filter((sp) => trongKhoang(sp.giaSauKhuyenMai, khoang));
  return tab === "giam"
    ? [...r].sort((a, b) => phanTramGiam(b) - phanTramGiam(a))
    : [...r].sort((a, b) => Number(conHang(b)) - Number(conHang(a)));
}

/* ───────────── Bộ chọn vợt ───────────── */

export type KinhNghiem = "moi" | "deu" | "thi";
export type LoiChoi = "cong" | "toc" | "toan";

export const NGAN_SACH_VOT = [
  { khoa: "re", nhan: "Dưới 3,5 triệu", tu: 0, den: 3_500_000 },
  { khoa: "vua", nhan: "3,5 – 4,5 triệu", tu: 3_500_000, den: 4_500_000 },
  { khoa: "cao", nhan: "Từ 4,5 triệu", tu: 4_500_000, den: Infinity },
] as const;
export type NganSachVot = (typeof NGAN_SACH_VOT)[number];

export const KINH_NGHIEM = [
  { khoa: "moi", nhan: "Mới chơi", mota: "Đang làm quen, cần cây vợt dễ chơi" },
  { khoa: "deu", nhan: "Chơi đều", mota: "Chơi vài buổi mỗi tuần" },
  { khoa: "thi", nhan: "Thi đấu", mota: "Đã có lực tay, tập và đấu thường xuyên" },
] as const;

export const LOI_CHOI = [
  { khoa: "cong", nhan: "Tấn công", mota: "Đập cầu, dồn điểm" },
  { khoa: "toc", nhan: "Nhanh, phản tạt", mota: "Vung nhanh, đổi hướng liên tục" },
  { khoa: "toan", nhan: "Công thủ cân bằng", mota: "Linh hoạt giữa công và thủ" },
] as const;

const thuong = (s?: string) => (s ?? "").toLocaleLowerCase("vi");

/** Độ cân bằng → số: dương là nặng đầu, âm là nhẹ đầu, 0 là cân bằng. `null` nếu kho không ghi hoặc không nhận ra. */
export function bacCanBang(ts: ThongSoVot | null): number | null {
  const s = thuong(ts?.doCanBang);
  if (!s) return null;
  if (s.includes("rất nặng")) return 3;
  if (s.includes("hơi nặng")) return 1;
  if (s.includes("nặng")) return 2;
  if (s.includes("cân bằng")) return 0;
  if (s.includes("rất nhẹ")) return -2;
  if (s.includes("nhẹ")) return -1;
  return null;
}

/** Độ cứng thân → số 0 (mềm) … 3 (rất cứng). */
export function bacDoCung(ts: ThongSoVot | null): number | null {
  const s = thuong(ts?.doCung);
  if (!s) return null;
  if (s.includes("rất cứng")) return 3;
  if (s.includes("cứng")) return 2;
  if (s.includes("trung bình")) return 1;
  if (s.includes("mềm") || s.includes("dẻo")) return 0;
  return null;
}

export interface GoiYVot { sp: SanPhamLanding; diem: number; lyDo: string[]; thongSo: string[]; khop: boolean }
export interface KetQuaGoiY { goiY: GoiYVot[]; khopHoanToan: boolean; soVotTrongTamGia: number }

const NHAN_DO_CUNG = ["Thân mềm", "Thân độ cứng trung bình", "Thân cứng", "Thân rất cứng"];

/** Còn hàng, nằm trong tầm giá. (Vợt thiếu thông số vẫn được đếm, nhưng `goiYVot` sẽ bỏ qua vì không có gì để đối chiếu.) */
export function votTrongTamGia(ds: SanPhamLanding[], ns: NganSachVot): SanPhamLanding[] {
  return ds.filter((sp) => khoaLoai(sp.loai?.tenLoai) === "vot" && conHang(sp) && sp.giaSauKhuyenMai >= ns.tu && sp.giaSauKhuyenMai < ns.den);
}

/**
 * Gợi ý tham khảo, chỉ dựa trên thông số ghi trong kho (độ cân bằng, độ cứng, trọng lượng) và giá.
 * Điểm lối chơi nặng gấp đôi điểm kinh nghiệm. Một vợt chỉ được coi là "khớp" khi hợp lối chơi (≥2/3)
 * và không trái với mức kinh nghiệm; nếu không có vợt nào khớp, trả vợt gần nhất và báo `khopHoanToan: false`.
 */
export function goiYVot(ds: SanPhamLanding[], ns: NganSachVot, kn: KinhNghiem, lc: LoiChoi, toiDa = 3): KetQuaGoiY {
  const trongTam = votTrongTamGia(ds, ns);
  const xet: GoiYVot[] = [];
  for (const sp of trongTam) {
    const b = bacCanBang(sp.thongSoVot);
    const c = bacDoCung(sp.thongSoVot);
    if (b === null || c === null) continue;
    const lyDo: string[] = [];
    const canBang = sp.thongSoVot?.doCanBang ?? "";

    let dLoiChoi = 0;
    if (lc === "cong") {
      dLoiChoi = b >= 2 ? 3 : b === 1 ? 2 : 0;
      if (dLoiChoi > 0) lyDo.push(`${canBang}: dồn lực tốt cho cú đập`);
    } else if (lc === "toc") {
      dLoiChoi = b <= -1 ? 3 : b === 0 ? 1 : 0;
      if (dLoiChoi > 0) lyDo.push(`${canBang}: vung nhanh, hợp phản tạt`);
    } else {
      dLoiChoi = b === 0 ? 3 : b === 1 ? 2 : b === -1 ? 1 : 0;
      if (dLoiChoi > 0) lyDo.push(`${canBang}: dễ chuyển giữa công và thủ`);
    }
    if (dLoiChoi === 0) continue;

    // "Độ khó" của vợt: thân cứng và nặng đầu đòi hỏi lực tay và kỹ thuật hơn.
    const khoChoi = c + Math.max(b, 0);
    let dKinhNghiem = 0;
    if (kn === "moi") {
      dKinhNghiem = c <= 1 && b <= 1 ? 2 : khoChoi <= 3 ? 1 : 0;
      if (dKinhNghiem === 2) lyDo.push(`${NHAN_DO_CUNG[c]}, dễ làm quen hơn`);
    } else if (kn === "deu") {
      dKinhNghiem = khoChoi <= 4 ? 2 : khoChoi === 5 ? 1 : 0;
      if (dKinhNghiem === 2) lyDo.push(`${NHAN_DO_CUNG[c]}, vừa sức khi chơi đều`);
    } else {
      dKinhNghiem = khoChoi >= 3 ? 2 : khoChoi === 2 ? 1 : 0;
      if (dKinhNghiem === 2) lyDo.push(`${NHAN_DO_CUNG[c]}, hợp người đã có lực tay`);
    }
    const nhe = /^[45]U/i.test(sp.thongSoVot?.trongLuong ?? "");
    xet.push({
      sp,
      diem: dLoiChoi * 2 + dKinhNghiem + (kn === "moi" && nhe ? 0.5 : 0),
      khop: dLoiChoi >= 2 && dKinhNghiem >= 1,
      lyDo,
      thongSo: [canBang, NHAN_DO_CUNG[c], sp.thongSoVot?.trongLuong].filter(Boolean) as string[],
    });
  }
  xet.sort((a, b) => b.diem - a.diem || a.sp.giaSauKhuyenMai - b.sp.giaSauKhuyenMai);
  const khop = xet.filter((x) => x.khop);
  return {
    goiY: (khop.length ? khop : xet).slice(0, toiDa),
    khopHoanToan: khop.length > 0,
    soVotTrongTamGia: trongTam.length,
  };
}

/** Liên kết danh sách vợt đã lọc theo tầm giá (backend lọc được theo giá, chưa lọc theo thông số). */
export function lienKetVotTheoGia(ns: NganSachVot): string {
  const q = new URLSearchParams({ loai: LOAI.vot.slug });
  if (ns.tu > 0) q.set("gia_tu", String(ns.tu));
  if (Number.isFinite(ns.den)) q.set("gia_den", String(ns.den - 1));
  return `/SanPham/Index?${q.toString()}`;
}
