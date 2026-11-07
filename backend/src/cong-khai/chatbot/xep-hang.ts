import { SanPhamKho } from './kho';
import { chuanHoa, LoaiSP, LoiChoi, NhomPhuKien, SapXep, TrinhDo } from './nlu';

export interface TieuChi {
  loai?: LoaiSP;
  nhom?: NhomPhuKien;
  hang?: string;
  giaMin?: number;
  giaMax?: number;
  trinhDo?: TrinhDo;
  loiChoi?: LoiChoi;
  nheTay?: boolean;
  kichCo?: string;
  tuKhoa?: string[];
  sapXep?: SapXep;
  /** Loại các sản phẩm đã gợi ý rồi ("xem mẫu khác"). */
  loaiTru?: Set<string>;
  chiKhuyenMai?: boolean;
}

export type GhiChuXepHang =
  | 'ngoai_ngan_sach'
  | 'het_hang'
  | 'khong_co_hang'
  | 'bo_tu_khoa'
  | 'khong_co_size'
  | 'het_mau_khac'
  | 'het_mau_trong_tam_gia';

export interface MucXepHang {
  sp: SanPhamKho;
  diem: number;
  lyDo: string[];
  ngoaiNganSach: boolean;
}

export interface KetQuaXepHang {
  muc: MucXepHang[];
  ghiChu: GhiChuXepHang[];
  /** Tổng số sản phẩm khớp tiêu chí (trước khi cắt `gioiHan`). */
  tongKhop: number;
}

export const dinhDangTien = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

type CanBang = 'rat_nang' | 'nang' | 'hoi_nang' | 'can_bang' | 'nhe';
type DoCung = 'mem' | 'trung_binh' | 'cung' | 'rat_cung';

export function loaiCanBang(sp: SanPhamKho): CanBang | null {
  const t = chuanHoa(sp.thongSo.canBang[0] ?? '');
  if (!t) return null;
  if (t.includes('rat nang')) return 'rat_nang';
  if (t.includes('hoi nang')) return 'hoi_nang';
  if (t.includes('nang')) return 'nang';
  if (t.includes('nhe')) return 'nhe';
  if (t.includes('can bang')) return 'can_bang';
  return null;
}

export function loaiDoCung(sp: SanPhamKho): DoCung | null {
  const t = chuanHoa(sp.thongSo.doCung[0] ?? '');
  if (!t) return null;
  if (t.includes('rat cung')) return 'rat_cung';
  if (t.includes('cung')) return 'cung';
  if (t.includes('trung binh')) return 'trung_binh';
  if (t.includes('deo') || t.includes('mem')) return 'mem';
  return null;
}

/** Các cỡ "3U/4U/5U" của vợt, ví dụ "4U (80-84g)" -> "4U". */
export function cacCoU(sp: SanPhamKho): string[] {
  return [...new Set(sp.thongSo.trongLuong.map((x) => /([2-6])U/i.exec(x)?.[1]).filter((x): x is string => !!x).map((x) => `${x}U`))];
}

/** Mô tả thông số ngắn của vợt cho thẻ sản phẩm; chuỗi rỗng nếu không có dữ liệu. */
export function moTaThongSo(sp: SanPhamKho): string {
  const phan = [sp.thongSo.canBang[0], sp.thongSo.doCung[0] ? `Thân ${chuanHoaThuong(sp.thongSo.doCung[0])}` : '', cacCoU(sp).join('/')];
  return phan.filter(Boolean).join(' · ');
}
const chuanHoaThuong = (s: string) => s.trim().toLocaleLowerCase('vi');

interface Diem {
  diem: number;
  lyDo: string[];
}

function chamVot(sp: SanPhamKho, tc: TieuChi): Diem {
  let diem = 0;
  const lyDo: string[] = [];
  const cb = loaiCanBang(sp);
  const dc = loaiDoCung(sp);
  const u = cacCoU(sp);
  const moTa = sp.moTaChuan;
  const nang = cb === 'nang' || cb === 'rat_nang';

  switch (tc.loiChoi) {
    case 'cong':
      if (cb === 'rat_nang') { diem += 18; lyDo.push('Rất nặng đầu, lực đập mạnh – hợp lối chơi tấn công'); }
      else if (cb === 'nang') { diem += 16; lyDo.push('Nặng đầu, hỗ trợ lực đập – hợp lối chơi tấn công'); }
      else if (cb === 'hoi_nang') { diem += 10; lyDo.push('Hơi nặng đầu, thiên công nhưng vẫn linh hoạt'); }
      else if (cb === 'can_bang') diem += 2;
      else if (cb === 'nhe') diem -= 8;
      if (dc === 'cung' || dc === 'rat_cung') diem += 4;
      break;
    case 'thu':
      if (cb === 'nhe') { diem += 16; lyDo.push('Nhẹ đầu, vung nhanh – hợp phản tạt và phòng thủ'); }
      else if (cb === 'can_bang') { diem += 8; lyDo.push('Cân bằng, xoay vợt nhanh khi phòng thủ'); }
      else if (nang) diem -= 8;
      break;
    case 'toan_dien':
      if (cb === 'can_bang') { diem += 16; lyDo.push('Cân bằng, công thủ đều'); }
      else if (cb === 'hoi_nang') { diem += 10; lyDo.push('Hơi nặng đầu, công thủ toàn diện'); }
      else if (cb === 'nhe') diem += 6;
      else if (nang) diem -= 2;
      break;
  }

  switch (tc.trinhDo) {
    case 'moi':
      if (dc === 'trung_binh' || dc === 'mem') { diem += 14; lyDo.push('Thân vợt mềm vừa, dễ làm quen cho người mới'); }
      else if (dc === 'rat_cung') diem -= 14;
      if (u.some((x) => x === '5U' || x === '4U')) diem += 6;
      else if (u.includes('3U') && u.length === 1) diem -= 4;
      if (nang) diem -= 6;
      else if (cb === 'can_bang' || cb === 'nhe') diem += 6;
      if (/phong trao|de choi|de thuan|de dieu khien|de su dung/.test(moTa)) { diem += 8; lyDo.push('Mô tả sản phẩm: dễ chơi, hợp người chơi phong trào'); }
      if (/chuyen nghiep|vdv|van dong vien/.test(moTa)) diem -= 8;
      break;
    case 'trung_binh':
      if (dc === 'trung_binh' || dc === 'cung') diem += 6;
      else if (dc === 'rat_cung') diem -= 8;
      if (/phong trao|de choi|de thuan/.test(moTa)) diem += 6;
      break;
    case 'nang_cao':
      if (dc === 'rat_cung' || dc === 'cung') { diem += 8; lyDo.push('Thân vợt cứng, phản hồi tốt cho người chơi nâng cao'); }
      else if (dc === 'trung_binh') diem -= 2;
      if (u.includes('3U')) diem += 4;
      if (/chuyen nghiep|vdv|van dong vien/.test(moTa)) diem += 6;
      break;
  }

  if (tc.nheTay) {
    if (cb === 'nhe' || dc === 'trung_binh' || dc === 'mem') { diem += 12; lyDo.push('Nhẹ tay, đỡ mỏi cổ tay'); }
    if (nang) diem -= 14;
    if (dc === 'cung') diem -= 6;
    else if (dc === 'rat_cung') diem -= 14;
    if (u.some((x) => x === '5U' || x === '4U')) diem += 6;
  }
  return { diem, lyDo };
}

function chamChung(sp: SanPhamKho, tc: TieuChi): Diem {
  let diem = 0;
  const lyDo: string[] = [];
  const khop = (tc.tuKhoa ?? []).filter((k) => sp.tuKhoa.includes(k)).length;
  diem += Math.min(16, khop * 8);
  if (khop) lyDo.push('Đúng dòng bạn quan tâm');
  if (sp.phanTramGiam > 0) {
    diem += Math.min(12, sp.phanTramGiam / 2.5);
    lyDo.push(`Đang giảm ${sp.phanTramGiam}%, tiết kiệm ${dinhDangTien(sp.giaGoc - sp.gia)}`);
  }
  if (sp.soDanhGia > 0) {
    diem += (sp.diem - 4) * 4;
    if (sp.diem >= 4.5) lyDo.push(`Khách đánh giá ${sp.diem}/5`);
  }
  if (tc.giaMax && sp.gia <= tc.giaMax) {
    diem += 12 * Math.min(1, sp.gia / tc.giaMax);
    lyDo.push('Nằm trong ngân sách');
  }
  if (tc.kichCo) {
    const c = chuanHoa(tc.kichCo);
    if (sp.bienThe.some((b) => b.ton > 0 && chuanHoa(b.size ?? '') === c)) lyDo.push(`Còn size ${tc.kichCo.toUpperCase()}`);
  }
  if (sp.tonKho > 0 && sp.tonKho <= 3) diem -= 3;
  return { diem, lyDo };
}

function khoangCach(gia: number, tc: TieuChi): number {
  if (tc.giaMin !== undefined && gia < tc.giaMin) return tc.giaMin - gia;
  if (tc.giaMax !== undefined && gia > tc.giaMax) return gia - tc.giaMax;
  return 0;
}

/**
 * Lọc + xếp hạng sản phẩm theo nhu cầu. Luôn ưu tiên hàng còn trong kho; hết ngân sách/hãng/kích cỡ thì nới lỏng
 * và ghi lại trong `ghiChu` để lời đáp nói rõ với khách (không im lặng đổi tiêu chí).
 */
export function xepHang(kho: SanPhamKho[], tc: TieuChi, gioiHan = 4): KetQuaXepHang {
  const ghiChu: GhiChuXepHang[] = [];
  let ds = kho.filter((sp) => !tc.loai || sp.loai === tc.loai);

  if (tc.nhom) {
    ds = ds.filter((sp) => sp.nhom === tc.nhom);
  }
  if (tc.hang) {
    const h = chuanHoa(tc.hang);
    const theoHang = ds.filter((sp) => chuanHoa(sp.hang ?? '') === h);
    if (theoHang.length) ds = theoHang;
    else ghiChu.push('khong_co_hang');
  }
  if (tc.chiKhuyenMai) {
    ds = ds.filter((sp) => sp.phanTramGiam > 0);
  }
  if (tc.loaiTru?.size) {
    const con = ds.filter((sp) => !tc.loaiTru!.has(sp.id));
    if (con.some((sp) => sp.tonKho > 0)) ds = con;
    else ghiChu.push('het_mau_khac');
  }
  if (tc.tuKhoa?.length) {
    const theoTu = ds.filter((sp) => tc.tuKhoa!.some((k) => sp.tuKhoa.includes(k)));
    if (theoTu.length) ds = theoTu;
    else ghiChu.push('bo_tu_khoa');
  }

  const conHang = ds.filter((sp) => sp.tonKho > 0);
  if (conHang.length) ds = conHang;
  else if (ds.length) ghiChu.push('het_hang');

  if (tc.kichCo) {
    const c = chuanHoa(tc.kichCo);
    const theoSize = ds.filter((sp) => sp.bienThe.some((b) => b.ton > 0 && chuanHoa(b.size ?? '') === c));
    if (theoSize.length) ds = theoSize;
    else if (ds.length) ghiChu.push('khong_co_size');
  }

  const coKhoang = tc.giaMin !== undefined || tc.giaMax !== undefined;
  let ngoai = false;
  if (coKhoang) {
    const trong = ds.filter((sp) => khoangCach(sp.gia, tc) === 0);
    if (trong.length) {
      ds = trong;
    } else if (ds.length) {
      ds = [...ds].sort((a, b) => khoangCach(a.gia, tc) - khoangCach(b.gia, tc)).slice(0, gioiHan);
      ngoai = true;
      ghiChu.push(tc.loaiTru?.size ? 'het_mau_trong_tam_gia' : 'ngoai_ngan_sach');
    }
  }

  const muc: MucXepHang[] = ds.map((sp) => {
    let tong = 50;
    const lyDo: string[] = [];
    if (sp.loai === 'vot') {
      const v = chamVot(sp, tc);
      tong += v.diem;
      lyDo.push(...v.lyDo);
    }
    const c = chamChung(sp, tc);
    tong += c.diem;
    lyDo.push(...c.lyDo);
    if (tc.sapXep === 're') tong -= sp.gia / 100_000;
    else if (tc.sapXep === 'cao') tong += sp.gia / 100_000;
    if (ngoai) tong -= khoangCach(sp.gia, tc) / 100_000;
    if (sp.tonKho === 0) tong -= 100;
    return { sp, diem: tong, lyDo: [...new Set(lyDo)].slice(0, 3), ngoaiNganSach: ngoai };
  });

  muc.sort((a, b) => b.diem - a.diem || a.sp.gia - b.sp.gia || a.sp.ten.localeCompare(b.sp.ten, 'vi'));
  return { muc: muc.slice(0, gioiHan), ghiChu, tongKhop: muc.length };
}
