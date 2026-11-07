import { giaBienThe, giaSauKhuyenMai, khuyenMaiConHieuLuc } from '../../common/pricing';
import { chuanHoa, LoaiSP, NhomPhuKien, tachTu, tachTuGhep } from './nlu';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface BienTheKho {
  id: string;
  mau: string | null;
  size: string | null;
  ton: number;
  gia: number;
  giaGoc: number;
}

export interface ThongSoKho {
  canBang: string[];
  doCung: string[];
  trongLuong: string[];
  sucCang: string[];
}

/** Ảnh chụp một sản phẩm trong kho dưới dạng phẳng, đủ để tra cứu/xếp hạng mà không cần chạm DB nữa. */
export interface SanPhamKho {
  id: string;
  ten: string;
  tenChuan: string;
  moTaChuan: string;
  moTa: string;
  loai: LoaiSP | null;
  tenLoai: string | null;
  /** Nhóm nhỏ của phụ kiện suy ra từ tên (quả cầu, túi, quấn cán). */
  nhom: NhomPhuKien | null;
  hang: string | null;
  hinhAnh: string;
  /** Giá sau khuyến mãi thấp nhất trong các biến thể còn hàng (hoặc tất cả nếu hết hàng). */
  gia: number;
  /** Giá trước khuyến mãi tương ứng với `gia`. */
  giaGoc: number;
  giaCao: number;
  phanTramGiam: number;
  tenKhuyenMai: string | null;
  tonKho: number;
  diem: number;
  soDanhGia: number;
  bienThe: BienTheKho[];
  thongSo: ThongSoKho;
  /** Từ khóa đặc trưng của tên (không tính từ chung và tên hãng). */
  tuKhoa: string[];
}

const TU_CHUNG = new Set(['vot', 'cau', 'long', 'giay', 'ao', 'quan', 'cuoi', 'bo', 'cap', 'combo', 'cuon', 'can', 'day', 'ong', 'qua', 'don', 'cho', 'va', 'the', 'thao', 'thi', 'dau', 'tap', 'luyen', 'cao', 'cuoc']);

export function nhomTuTen(tenChuan: string): NhomPhuKien | null {
  if (/^cau long /.test(tenChuan)) return 'cau';
  if (/(^| )(tui|balo)( |$)/.test(tenChuan)) return 'tui';
  if (/(cuon can|quan can|day cuon)/.test(tenChuan)) return 'cuon_can';
  return null;
}

export function loaiTuTen(tenLoai: string | null | undefined, tenSanPham = ''): LoaiSP | null {
  const t = chuanHoa(tenLoai ?? '') || chuanHoa(tenSanPham).split(' ').slice(0, 2).join(' ');
  if (/phu kien|(^|\s)(tui|balo|day cuon|long vit|long ngong)(\s|$)/.test(t)) return 'phukien';
  if (/(^|\s)vot(\s|$)/.test(t)) return 'vot';
  if (/(^|\s)giay(\s|$)/.test(t)) return 'giay';
  if (/(^|\s)(ao|quan)(\s|$)/.test(t)) return 'aoquan';
  return null;
}

export const TEN_LOAI: Record<LoaiSP, string> = {
  vot: 'vợt',
  giay: 'giày',
  aoquan: 'áo quần',
  phukien: 'phụ kiện',
};

const tapGiaTri = (ds: (string | undefined | null)[]) => [...new Set(ds.map((x) => String(x ?? '').trim()).filter(Boolean))];

/** Dựng kho phẳng từ dữ liệu đã `populate` (loai, hang, khuyenMai ở sản phẩm; mau, size ở biến thể). */
export function dungKho(
  sanPhams: any[],
  bienThes: any[],
  danhGia: Map<string, { tb: number; so: number }> = new Map(),
  now: Date = new Date(),
): SanPhamKho[] {
  const theoSp = new Map<string, any[]>();
  for (const b of bienThes) {
    const k = String(b.sanPham?._id ?? b.sanPham);
    (theoSp.get(k) ?? theoSp.set(k, []).get(k)!).push(b);
  }
  const tuHang = new Set<string>();
  for (const sp of sanPhams) {
    if (sp.hang?.tenHang) tachTu(chuanHoa(sp.hang.tenHang)).forEach((w) => tuHang.add(w));
  }

  return sanPhams.map((sp) => {
    const id = String(sp._id);
    const km = sp.khuyenMai && sp.khuyenMai._id && khuyenMaiConHieuLuc(sp.khuyenMai, now) ? sp.khuyenMai : null;
    const dsBt = (theoSp.get(id) ?? []).map((b): BienTheKho => {
      const goc = Number(b.giaBan ?? sp.giaGoc ?? 0);
      return {
        id: String(b._id),
        mau: b.mau?.tenMau ?? null,
        size: b.size?.tenSize ?? null,
        ton: Number(b.soLuongTon ?? 0),
        gia: giaBienThe(b, { giaGoc: sp.giaGoc, khuyenMai: km }, now),
        giaGoc: goc,
      };
    });
    const conHang = dsBt.filter((b) => b.ton > 0);
    const nguon = conHang.length ? conHang : dsBt;
    const re = nguon.length ? nguon.reduce((a, b) => (b.gia < a.gia ? b : a)) : null;
    const gia = re ? re.gia : giaSauKhuyenMai(sp.giaGoc, km, now);
    const giaGoc = re ? re.giaGoc : Number(sp.giaGoc ?? 0);
    const dg = danhGia.get(id);
    const ten = String(sp.tenSanPham ?? '');
    const thongSo: ThongSoKho = { canBang: [], doCung: [], trongLuong: [], sucCang: [] };
    const ts = (theoSp.get(id) ?? []).map((b) => b.thongSo).filter(Boolean);
    thongSo.canBang = tapGiaTri(ts.map((x) => x.doCanBang));
    thongSo.doCung = tapGiaTri(ts.map((x) => x.doCung));
    thongSo.trongLuong = tapGiaTri(ts.map((x) => x.trongLuong));
    thongSo.sucCang = tapGiaTri(ts.map((x) => x.sucCang));
    const tenChuan = chuanHoa(ten);
    return {
      id,
      ten,
      tenChuan,
      moTa: String(sp.moTa ?? ''),
      moTaChuan: chuanHoa(sp.moTa ?? ''),
      loai: loaiTuTen(sp.loai?.tenLoai, ten),
      nhom: nhomTuTen(tenChuan),
      tenLoai: sp.loai?.tenLoai ?? null,
      hang: sp.hang?.tenHang ?? null,
      hinhAnh: sp.hinhAnhDaiDien || 'default-product.jpg',
      gia,
      giaGoc,
      giaCao: dsBt.length ? Math.max(...dsBt.map((b) => b.gia)) : gia,
      phanTramGiam: giaGoc > 0 && gia < giaGoc ? Math.round(((giaGoc - gia) / giaGoc) * 100) : 0,
      tenKhuyenMai: km && Number(km.phanTramGiam) > 0 ? km.tenChuongTrinh : null,
      tonKho: dsBt.reduce((s, b) => s + b.ton, 0),
      diem: dg ? Math.round(dg.tb * 10) / 10 : 0,
      soDanhGia: dg?.so ?? 0,
      bienThe: dsBt,
      thongSo,
      tuKhoa: tuKhoaCuaTen(tenChuan, tuHang),
    };
  });
}

/** Từ khóa đặc trưng của tên: bỏ từ chung/tên hãng, ghép số một chữ số vào từ đứng trước ("tectonic 7" -> "tectonic7"). */
export function tuKhoaCuaTen(tenChuan: string, tuHang: Set<string>): string[] {
  const tu = tachTu(tenChuan);
  const kq: string[] = [];
  tu.forEach((w, i) => {
    if (TU_CHUNG.has(w) || tuHang.has(w)) return;
    if (w.length === 1) {
      const truoc = tu[i - 1];
      if (/\d/.test(w) && truoc && !TU_CHUNG.has(truoc) && !tuHang.has(truoc)) kq.push(truoc + w);
      return;
    }
    kq.push(w);
  });
  return [...new Set(kq)];
}

export function tuKhoaTrongKho(kho: SanPhamKho[]): Set<string> {
  const s = new Set<string>();
  kho.forEach((sp) => sp.tuKhoa.forEach((w) => s.add(w)));
  return s;
}

export function dsHangTrongKho(kho: SanPhamKho[]): string[] {
  return [...new Set(kho.map((sp) => sp.hang).filter((h): h is string => !!h))];
}

export interface KhopTen {
  sp: SanPhamKho;
  diem: number;
}

const trongSoTu = (w: string) => (/\d/.test(w) ? 3 : 1.5);

/**
 * Tìm sản phẩm khách nhắc tên trong câu ("astrox 100zz", "88d pro", "aerus"...).
 * Cần ít nhất một mã model (có chữ số) hoặc hai từ khóa trùng; số đứng đầu mã ("88") được coi là tiền tố ("88d", "88s").
 */
export function timTheoTen(kho: SanPhamKho[], chuan: string, toiDa = 3): KhopTen[] {
  // "size 42", "4U" là kích cỡ chứ không phải mã model (tránh nhầm size 99 với Astrox 99).
  const tu = tachTuGhep(chuan.replace(/(?:^|\s)(?:size|sz|co|so)\s*\d{2}(?=\s|$)/g, ' '));
  const ds: KhopTen[] = [];
  for (const sp of kho) {
    let khop = chuan.includes(sp.tenChuan) ? 100 : 0; // gõ đủ tên sản phẩm thì chắc chắn là mẫu đó
    for (const w of sp.tuKhoa) {
      const dung = tu.includes(w) || tu.some((m) => /^\d{2,}$/.test(m) && w.startsWith(m) && w.length <= m.length + 2);
      if (dung) khop += trongSoTu(w);
    }
    if (khop >= 3) ds.push({ sp, diem: khop });
  }
  ds.sort((a, b) => b.diem - a.diem);
  if (!ds.length) return [];
  const tot = ds[0].diem;
  return ds.filter((x) => x.diem >= tot - 0.01).slice(0, toiDa);
}
