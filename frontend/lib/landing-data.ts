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

/**
 * Ảnh sản phẩm đã kiểm duyệt là sạch (nền đơn giản, đủ nét, không nhãn giá hay logo cửa hàng khác), theo thứ tự đứng ở hàng nổi bật.
 * Phần lớn ảnh nguồn của kho còn watermark hoặc nền chụp lộn xộn nên hàng nổi bật (và thứ tự gợi ý vợt theo lối chơi) ưu tiên danh sách này khi có thể;
 * ảnh mới đạt chuẩn thì thêm tên file vào đây. Chỉ ảnh tĩnh trong /images được tính.
 */
const ANH_SACH = [
  "astrox99pro.jpg", // 10/11/2026: duyệt bằng mắt 30 ảnh vợt trong /images; chỉ ảnh này vừa dựng đứng vừa không có dấu cửa hàng/chữ mờ. Còn lại nằm chéo hoặc bị cắt, hoặc có dấu (HVshop, TDS, COVI SPORT, Quốc Việt…).
]
const SO_NOI_BAT = 4;

const tenFileAnh = (p?: string | null) => (p ?? "").split("/").pop() ?? "";

/**
 * Hàng nổi bật ở đầu trang: bốn sản phẩm còn hàng có ảnh trong `ANH_SACH`. Thiếu (hết hàng, đổi ảnh, đổi dữ liệu) thì bù bằng
 * sản phẩm còn hàng giảm sâu nhất, hòa thì giá cao hơn, để hàng luôn đủ bốn thẻ.
 */
export function chonNoiBat(ds: SanPhamLanding[]): SanPhamLanding[] {
  const sach = ANH_SACH.flatMap((f) => ds.filter((sp) => conHang(sp) && tenFileAnh(sp.hinhAnhDaiDien) === f).slice(0, 1));
  if (sach.length >= SO_NOI_BAT) return sach.slice(0, SO_NOI_BAT);
  const da = new Set(sach.map((sp) => sp.id));
  const bu = ds
    .filter((sp) => conHang(sp) && !da.has(sp.id))
    .sort((x, y) => phanTramGiam(y) - phanTramGiam(x) || y.giaSauKhuyenMai - x.giaSauKhuyenMai)
    .slice(0, SO_NOI_BAT - sach.length);
  return [...sach, ...bu];
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
  { khoa: "cong", nhan: "Uy lực", mota: "Tấn công: đập cầu, dồn điểm" },
  { khoa: "toc", nhan: "Tốc độ", mota: "Vung nhanh, phản tạt, đổi hướng liên tục" },
  { khoa: "toan", nhan: "Kiểm soát", mota: "Công thủ cân bằng, đặt cầu chính xác" },
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

/**
 * Những lối chơi mà một phiên bản vợt "hợp" theo thông số (cùng quy tắc với backend `loiChoiCuaVot`): Uy lực = nặng đầu từ "hơi nặng",
 * Tốc độ = nhẹ đầu, Kiểm soát = cân bằng hoặc hơi nặng đầu. Thiếu độ cân bằng hoặc độ cứng thì không thuộc lối chơi nào.
 */
export function loiChoiCuaThongSo(ts: ThongSoVot | null): LoiChoi[] {
  const b = bacCanBang(ts);
  if (b === null || bacDoCung(ts) === null) return [];
  const r: LoiChoi[] = [];
  if (b >= 1) r.push("cong");
  if (b <= -1) r.push("toc");
  if (b === 0 || b === 1) r.push("toan");
  return r;
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
    const x = chamVot(sp, kn, lc);
    if (x) xet.push(x);
  }
  xet.sort((a, b) => b.diem - a.diem || a.sp.giaSauKhuyenMai - b.sp.giaSauKhuyenMai);
  const khop = xet.filter((x) => x.khop);
  return {
    goiY: (khop.length ? khop : xet).slice(0, toiDa),
    khopHoanToan: khop.length > 0,
    soVotTrongTamGia: trongTam.length,
  };
}

/** Chấm một cây vợt theo kinh nghiệm và lối chơi. `null` nếu kho thiếu thông số hoặc vợt không hợp lối chơi. `diemLoiChoi` ∈ {2, 3}. */
function chamVot(sp: SanPhamLanding, kn: KinhNghiem, lc: LoiChoi): (GoiYVot & { diemLoiChoi: number }) | null {
  const b = bacCanBang(sp.thongSoVot);
  const c = bacDoCung(sp.thongSoVot);
  if (b === null || c === null) return null;
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
  if (dLoiChoi === 0) return null;

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
  return {
    sp,
    diem: dLoiChoi * 2 + dKinhNghiem + (kn === "moi" && nhe ? 0.5 : 0),
    diemLoiChoi: dLoiChoi,
    khop: dLoiChoi >= 2 && dKinhNghiem >= 1,
    lyDo,
    thongSo: [canBang, NHAN_DO_CUNG[c], sp.thongSoVot?.trongLuong].filter(Boolean) as string[],
  };
}

/**
 * Ba lối chơi ở khu "chọn lối chơi" của trang chủ, gắn với `LoiChoi` của bộ chọn vợt (Uy lực = tấn công, Tốc độ = nhanh phản tạt,
 * Kiểm soát = công thủ cân bằng). `mau` là màu nhấn của lối chơi (cùng gam với màu trong cảnh 3D).
 */
export const PHONG_CACH = [
  { khoa: "cong", ten: "Uy lực", mota: "Đập cầu, dồn điểm", dacTrung: "Nặng đầu, thân cứng", mau: "#f4691a" },
  { khoa: "toc", ten: "Tốc độ", mota: "Vung nhanh, phản tạt, đổi hướng liên tục", dacTrung: "Nhẹ đầu, dễ vung", mau: "#33e0a8" },
  { khoa: "toan", ten: "Kiểm soát", mota: "Đặt cầu chính xác, linh hoạt công thủ", dacTrung: "Cân bằng, dễ chuyển công thủ", mau: "#f1e6c8" },
] as const satisfies readonly { khoa: LoiChoi; ten: string; mota: string; dacTrung: string; mau: string }[];

/**
 * Vợt hợp một lối chơi, dùng cho hàng gợi ý ngay dưới phần chọn: chỉ vợt còn hàng, có thông số, hợp lối chơi (xếp theo độ hợp rồi
 * theo ảnh sạch, mức giảm giá), tối đa 2 vợt mỗi hãng để hàng không toàn một dòng sản phẩm; thiếu thì bù thêm vợt cùng hãng.
 * `ns` (có thể bỏ trống) giới hạn tầm giá. Mức "kinh nghiệm" lấy trung tính (chơi đều); bộ chọn vợt bên dưới tinh chỉnh tiếp.
 */
export function votTheoPhongCach(ds: SanPhamLanding[], lc: LoiChoi, ns: NganSachVot | null, toiDa = 4): GoiYVot[] {
  const pool = ns ? votTrongTamGia(ds, ns) : ds.filter((sp) => khoaLoai(sp.loai?.tenLoai) === "vot" && conHang(sp));
  const sach = new Set(ANH_SACH);
  const xet = pool.flatMap((sp) => { const x = chamVot(sp, "deu", lc); return x ? [x] : []; });
  xet.sort((a, b) =>
    b.diemLoiChoi - a.diemLoiChoi
    || Number(sach.has(tenFileAnh(b.sp.hinhAnhDaiDien))) - Number(sach.has(tenFileAnh(a.sp.hinhAnhDaiDien)))
    || b.diem - a.diem
    || phanTramGiam(b.sp) - phanTramGiam(a.sp)
    || a.sp.giaSauKhuyenMai - b.sp.giaSauKhuyenMai);
  const theoHang = new Map<string, number>();
  const chon: GoiYVot[] = [];
  for (const x of xet) {
    const h = x.sp.hang?.tenHang ?? "";
    if ((theoHang.get(h) ?? 0) >= 2) continue;
    theoHang.set(h, (theoHang.get(h) ?? 0) + 1);
    chon.push(x);
    if (chon.length >= toiDa) break;
  }
  if (chon.length < toiDa) for (const x of xet) { if (!chon.includes(x)) chon.push(x); if (chon.length >= toiDa) break; }
  return chon;
}

/** Ảnh đại diện nằm trong danh sách ảnh đã kiểm duyệt là sạch (xem `ANH_SACH`). */
export const anhDaKiemDuyet = (sp: { hinhAnhDaiDien?: string | null }) => ANH_SACH.includes(tenFileAnh(sp.hinhAnhDaiDien));

export interface HoSoChon { lc: LoiChoi | null; kn: KinhNghiem | null; ns: NganSachVot["khoa"] | null }
export interface KetQuaHoSo {
  /** `noi-bat`: chưa chọn lối chơi, các vợt nổi bật; `khop`: đủ vợt khớp; `it-khop`: có vợt khớp nhưng ít hơn số cần; `khong-khop`: không vợt nào khớp. */
  cheDo: "noi-bat" | "khop" | "it-khop" | "khong-khop";
  /** Các vợt hiển thị: chỉ vợt KHỚP khi đã chọn lối chơi (không tự nới bộ lọc). Tối đa `toiDa`. */
  ds: GoiYVot[];
  /** Chỉ khi thiếu vợt khớp: vài vợt gần với lựa chọn nhưng chưa khớp đủ, để giao diện ghi rõ là "gần khớp". */
  ganKhop: GoiYVot[];
  soKhop: number;
  soTrongTamGia: number;
}

/**
 * Chọn vợt cho màn hình đầu từ hồ sơ người chơi. Chưa chọn lối chơi: vợt còn hàng nổi bật (ảnh đã duyệt trước, rồi giảm giá, rồi giá),
 * không kèm lý do vì chưa có gì để so. Đã chọn: chỉ vợt KHỚP (cùng quy tắc `chamVot`), mỗi vợt có lý do tính từ thông số thật;
 * thiếu thì báo `it-khop`/`khong-khop` và đưa `ganKhop` riêng thay vì lẳng lặng nới điều kiện. Chỉ tính vợt còn hàng, có thông số, đúng ngân sách.
 */
export function votTheoHoSo(ds: SanPhamLanding[], hs: HoSoChon, toiDa = 3): KetQuaHoSo {
  const ns = NGAN_SACH_VOT.find((n) => n.khoa === hs.ns) ?? null;
  const pool = (ns ? votTrongTamGia(ds, ns) : ds.filter((sp) => khoaLoai(sp.loai?.tenLoai) === "vot" && conHang(sp)))
    .filter((sp) => bacCanBang(sp.thongSoVot) !== null && bacDoCung(sp.thongSoVot) !== null);
  const sach = (x: GoiYVot) => Number(anhDaKiemDuyet(x.sp));
  if (!hs.lc) {
    const noiBat = pool
      .map<GoiYVot>((sp) => ({ sp, diem: 0, lyDo: [], thongSo: [], khop: true }))
      .sort((a, b) => sach(b) - sach(a) || phanTramGiam(b.sp) - phanTramGiam(a.sp) || b.sp.giaSauKhuyenMai - a.sp.giaSauKhuyenMai);
    return { cheDo: "noi-bat", ds: noiBat.slice(0, toiDa), ganKhop: [], soKhop: noiBat.length, soTrongTamGia: pool.length };
  }
  const xet = pool.flatMap((sp) => { const x = chamVot(sp, hs.kn ?? "deu", hs.lc as LoiChoi); return x ? [x] : []; });
  const thuTu = (a: GoiYVot, b: GoiYVot) => b.diem - a.diem || sach(b) - sach(a) || a.sp.giaSauKhuyenMai - b.sp.giaSauKhuyenMai;
  const khop = xet.filter((x) => x.khop).sort(thuTu);
  const chon = khop.slice(0, toiDa);
  const ganKhop = khop.length >= toiDa ? [] : xet.filter((x) => !x.khop).sort(thuTu).slice(0, toiDa - chon.length);
  return {
    cheDo: khop.length >= toiDa ? "khop" : khop.length > 0 ? "it-khop" : "khong-khop",
    ds: chon, ganKhop, soKhop: khop.length, soTrongTamGia: pool.length,
  };
}

/** Liên kết danh sách vợt đã lọc theo tầm giá (backend lọc được theo giá, chưa lọc theo thông số). */
export function lienKetVotTheoGia(ns: NganSachVot): string {
  const q = new URLSearchParams({ loai: LOAI.vot.slug });
  if (ns.tu > 0) q.set("gia_tu", String(ns.tu));
  if (Number.isFinite(ns.den)) q.set("gia_den", String(ns.den - 1));
  return `/SanPham/Index?${q.toString()}`;
}

/* ───────────── Số liệu cho các khu của trang chủ (đếm và chọn từ dữ liệu thật, không số nào tự đặt) ───────────── */

export const laVot = (sp: SanPhamLanding) => khoaLoai(sp.loai?.tenLoai) === "vot";

export interface ThongKeKho { soSanPham: number; soConHang: number; soVot: number; soHang: number; soDangGiam: number; giamToiDa: number }

/** Các con số ở dải "Trong kho hôm nay": mọi số đều đếm từ danh sách sản phẩm đang bán (hãng đếm theo tên, sản phẩm không ghi hãng thì không tính). */
export function thongKeKho(ds: SanPhamLanding[]): ThongKeKho {
  const hang = new Set(ds.map((sp) => sp.hang?.tenHang).filter(Boolean));
  const giam = ds.filter(dangGiam);
  return {
    soSanPham: ds.length,
    soConHang: ds.filter(conHang).length,
    soVot: ds.filter(laVot).length,
    soHang: hang.size,
    soDangGiam: giam.length,
    giamToiDa: giam.reduce((m, sp) => Math.max(m, phanTramGiam(sp)), 0),
  };
}

export interface ChuongTrinhGiam { id: string; ten: string; giamToiDa: number; ngayKetThuc: string | null; soSanPham: number }

/**
 * Các chương trình khuyến mãi đang áp dụng cho sản phẩm trong kho, gộp theo chương trình. `giamToiDa` là mức giảm THỰC TẾ cao nhất trong các sản phẩm của
 * chương trình (đã tính trần giảm), không lấy con số danh nghĩa. Chương trình giảm nhiều đứng trước, hòa thì nhiều sản phẩm hơn.
 */
export function chuongTrinhGiam(ds: SanPhamLanding[]): ChuongTrinhGiam[] {
  const m = new Map<string, ChuongTrinhGiam>();
  for (const sp of ds) {
    if (!dangGiam(sp) || !sp.khuyenMai) continue;
    const k = sp.khuyenMai;
    const cu = m.get(k.id) ?? { id: k.id, ten: k.tenChuongTrinh, giamToiDa: 0, ngayKetThuc: k.ngayKetThuc, soSanPham: 0 };
    cu.giamToiDa = Math.max(cu.giamToiDa, phanTramGiam(sp));
    cu.soSanPham += 1;
    m.set(k.id, cu);
  }
  return [...m.values()].sort((a, b) => b.giamToiDa - a.giamToiDa || b.soSanPham - a.soSanPham || a.ten.localeCompare(b.ten, "vi"));
}

/** Sản phẩm đang giảm giá và còn hàng cho khu khuyến mãi: giảm nhiều (theo %) trước, hòa thì tiết kiệm nhiều tiền hơn, rồi theo tên cho ổn định. */
export function chonKhuyenMai(ds: SanPhamLanding[], toiDa = 8): SanPhamLanding[] {
  return ds
    .filter((sp) => dangGiam(sp) && conHang(sp))
    .sort((a, b) => phanTramGiam(b) - phanTramGiam(a) || (b.giaGoc - b.giaSauKhuyenMai) - (a.giaGoc - a.giaSauKhuyenMai) || a.tenSanPham.localeCompare(b.tenSanPham, "vi"))
    .slice(0, toiDa);
}

/**
 * Khuyến mãi của những món CÒN MUA ĐƯỢC (khu "Đang giảm giá"): tiêu đề, danh sách chương trình và số sản phẩm đều tính từ cùng một nguồn còn hàng, để mức "cao nhất X%"
 * luôn khớp với món khách bấm vào được (không lấy mức của hàng đã hết).
 */
export function khuyenMaiConHang(ds: SanPhamLanding[]): { chuongTrinh: ChuongTrinhGiam[]; giamToiDa: number } {
  const con = ds.filter(conHang);
  return { chuongTrinh: chuongTrinhGiam(con), giamToiDa: con.filter(dangGiam).reduce((m, sp) => Math.max(m, phanTramGiam(sp)), 0) };
}

/** Lọc theo đúng lối chơi trước khi xếp hạng để kết quả chỉ chứa các vợt phù hợp. */
export function votHopLoiChoi(ds: SanPhamLanding[], lc: LoiChoi, toiDa = 4): GoiYVot[] {
  return votTheoPhongCach(ds.filter((sp) => loiChoiCuaThongSo(sp.thongSoVot).includes(lc)), lc, null, toiDa);
}

export interface TamGiaVot { ns: NganSachVot; so: number; giaThapNhat: number | null; giaCaoNhat: number | null }

/** Số vợt còn hàng trong từng tầm giá của bộ chọn vợt (cùng cách đếm với `votTrongTamGia`) và giá thấp nhất/cao nhất thật của tầm đó. */
export function votTheoTamGia(ds: SanPhamLanding[]): TamGiaVot[] {
  return NGAN_SACH_VOT.map((ns) => {
    const gia = votTrongTamGia(ds, ns).map((sp) => sp.giaSauKhuyenMai);
    return { ns, so: gia.length, giaThapNhat: gia.length ? Math.min(...gia) : null, giaCaoNhat: gia.length ? Math.max(...gia) : null };
  });
}

export interface HangCuaShop { ten: string; soSanPham: number; theoLoai: Partial<Record<KhoaLoai, number>>; giaTu: number; soDangGiam: number }

/** Thương hiệu đang có trong kho: tên hãng và số sản phẩm đếm từ dữ liệu (đông nhất trước). Sản phẩm không ghi hãng không thuộc hãng nào. */
export function demTheoHang(ds: SanPhamLanding[]): HangCuaShop[] {
  const m = new Map<string, HangCuaShop>();
  for (const sp of ds) {
    const ten = sp.hang?.tenHang;
    if (!ten) continue;
    const h = m.get(ten) ?? { ten, soSanPham: 0, theoLoai: {}, giaTu: Infinity, soDangGiam: 0 };
    h.soSanPham += 1;
    const k = khoaLoai(sp.loai?.tenLoai);
    if (k) h.theoLoai[k] = (h.theoLoai[k] ?? 0) + 1;
    h.giaTu = Math.min(h.giaTu, sp.giaSauKhuyenMai);
    if (dangGiam(sp)) h.soDangGiam += 1;
    m.set(ten, h);
  }
  return [...m.values()].sort((a, b) => b.soSanPham - a.soSanPham || a.ten.localeCompare(b.ten, "vi"));
}

export interface DemLoai { so: number; soConHang: number; soDangGiam: number; giaTu: number | null }

/** Số sản phẩm, số còn hàng, số đang giảm và giá thấp nhất theo từng loại (cùng cách nhận diện loại với liên kết lọc). */
export function demTheoLoai(ds: SanPhamLanding[]): Record<KhoaLoai, DemLoai> {
  const r = Object.fromEntries((Object.keys(LOAI) as KhoaLoai[]).map((k) => [k, { so: 0, soConHang: 0, soDangGiam: 0, giaTu: null as number | null }])) as Record<KhoaLoai, DemLoai>;
  for (const sp of ds) {
    const k = khoaLoai(sp.loai?.tenLoai);
    if (!k) continue;
    const d = r[k];
    d.so += 1;
    if (conHang(sp)) d.soConHang += 1;
    if (dangGiam(sp)) d.soDangGiam += 1;
    d.giaTu = d.giaTu === null ? sp.giaSauKhuyenMai : Math.min(d.giaTu, sp.giaSauKhuyenMai);
  }
  return r;
}

/** Vài sản phẩm còn hàng của một loại cho kệ giày / trang phục / phụ kiện: giảm nhiều trước, tối đa 2 sản phẩm mỗi hãng để kệ không toàn một dòng. */
export function chonTheoLoai(ds: SanPhamLanding[], khoa: KhoaLoai, toiDa = 4): SanPhamLanding[] {
  const xep = ds
    .filter((sp) => khoaLoai(sp.loai?.tenLoai) === khoa && conHang(sp))
    .sort((a, b) => phanTramGiam(b) - phanTramGiam(a) || b.giaSauKhuyenMai - a.giaSauKhuyenMai || a.tenSanPham.localeCompare(b.tenSanPham, "vi"));
  const dem = new Map<string, number>();
  const chon: SanPhamLanding[] = [];
  for (const sp of xep) {
    const h = sp.hang?.tenHang ?? "";
    if ((dem.get(h) ?? 0) >= 2) continue;
    dem.set(h, (dem.get(h) ?? 0) + 1);
    chon.push(sp);
    if (chon.length >= toiDa) break;
  }
  for (const sp of xep) { if (chon.length >= toiDa) break; if (!chon.includes(sp)) chon.push(sp); }
  return chon;
}

/** Những sản phẩm có số lượng tồn cao nhất (chỉ nói "còn nhiều", không suy ra lượt bán). */
export function conNhieuHang(ds: SanPhamLanding[], toiDa = 5): SanPhamLanding[] {
  return ds
    .filter(conHang)
    .sort((a, b) => b.tongTonKho - a.tongTonKho || a.tenSanPham.localeCompare(b.tenSanPham, "vi"))
    .slice(0, toiDa);
}

/** Số vợt còn hàng hợp từng lối chơi theo thông số (cùng quy tắc `loiChoiCuaThongSo`); vợt thiếu thông số không thuộc lối chơi nào nên không được đếm. */
export function soVotTheoLoiChoi(ds: SanPhamLanding[]): Record<LoiChoi, number> {
  const r: Record<LoiChoi, number> = { cong: 0, toc: 0, toan: 0 };
  for (const sp of ds) {
    if (!laVot(sp) || !conHang(sp)) continue;
    for (const lc of loiChoiCuaThongSo(sp.thongSoVot)) r[lc] += 1;
  }
  return r;
}

const duThongSo = (sp: SanPhamLanding) => bacCanBang(sp.thongSoVot) !== null && bacDoCung(sp.thongSoVot) !== null;

/** Một cây vợt còn hàng mà kho có ghi sức căng (ưu tiên vợt đủ cả cân bằng và độ cứng) để dẫn tới trạm căng cước ở trang chi tiết. `null` nếu không có. */
export function votCoSucCang(ds: SanPhamLanding[]): SanPhamLanding | null {
  const co = ds.filter((sp) => laVot(sp) && conHang(sp) && !!sp.thongSoVot?.sucCang);
  co.sort((a, b) => Number(duThongSo(b)) - Number(duThongSo(a)) || b.tongTonKho - a.tongTonKho || a.tenSanPham.localeCompare(b.tenSanPham, "vi"));
  return co[0] ?? null;
}

/** Liên kết danh sách sản phẩm theo hãng (backend lọc `hang` theo tên). */
export const lienKetHang = (ten: string) => `/SanPham/Index?hang=${encodeURIComponent(ten)}`;
