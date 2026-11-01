/**
 * Hiểu câu hỏi của khách bằng luật (không cần AI): chuẩn hóa tiếng Việt, trích ngân sách, loại hàng,
 * hãng, trình độ, lối chơi và nhận diện ý định. Toàn bộ là hàm thuần để dễ kiểm thử.
 */
export type LoaiSP = 'vot' | 'giay' | 'aoquan' | 'phukien';
export type TrinhDo = 'moi' | 'trung_binh' | 'nang_cao';
export type LoiChoi = 'cong' | 'thu' | 'toan_dien';
export type SapXep = 're' | 'cao';
export type NhomPhuKien = 'cau' | 'tui' | 'cuon_can';
export type YDinh =
  | 'chao_hoi'
  | 'cam_on'
  | 'tam_biet'
  | 'tro_giup'
  | 'don_hang'
  | 'chinh_sach'
  | 'khuyen_mai'
  | 'ton_kho'
  | 'hoi_gia'
  | 'so_sanh'
  | 'dat_hang'
  | 'huong_dan'
  | 'tu_van'
  | 'khac';

export type ChuDeChinhSach = 'dat_hang' | 'thanh_toan' | 'huy_don' | 'giao_hang' | 'bao_hanh' | 'doi_tra' | 'cua_hang' | 'chinh_hang' | 'chung';
export type ChuDeHuongDan = 'trong_luong' | 'can_bang' | 'do_cung' | 'suc_cang' | 'chon_vot' | 'chon_giay' | 'chung';

/** Trạng thái hội thoại: client gửi lại nguyên văn ở mỗi lượt để server giữ được ngữ cảnh (server không lưu session). */
export interface NguCanh {
  loai?: LoaiSP;
  /** Nhóm nhỏ trong phụ kiện (quả cầu, túi vợt, quấn cán). */
  nhom?: NhomPhuKien;
  hang?: string;
  giaMin?: number;
  giaMax?: number;
  /** Mức giá khách nói "tầm/khoảng" (giaMin/giaMax là khoảng quanh mức này). */
  giaTam?: number;
  trinhDo?: TrinhDo;
  loiChoi?: LoiChoi;
  nheTay?: boolean;
  kichCo?: string;
  tuKhoa?: string[];
  sapXep?: SapXep;
  /** Các sản phẩm vừa hiển thị ở lượt trước (đúng thứ tự thẻ) để hiểu "cái này", "cái thứ 2". */
  sanPhamIds?: string[];
  /** Tất cả sản phẩm đã gợi ý trong cuộc trò chuyện, dùng cho "xem mẫu khác". */
  daGoiY?: string[];
  /** Giá của mẫu đứng đầu lượt trước để hiểu "rẻ hơn", "cao cấp hơn". */
  giaThamChieu?: number;
  yDinhTruoc?: YDinh;
}

export type SlotMoi = Pick<NguCanh, 'loai' | 'nhom' | 'hang' | 'giaMin' | 'giaMax' | 'giaTam' | 'trinhDo' | 'loiChoi' | 'nheTay' | 'kichCo' | 'tuKhoa' | 'sapXep'>;

export interface KetQuaPhanTich {
  yDinh: YDinh;
  chuan: string;
  slot: SlotMoi;
  datLai: boolean;
  xemThem: boolean;
  soDonHang?: number;
  /** Số lượng khách muốn đặt (chỉ có khi nêu rõ). */
  soLuong?: number;
  thuTu?: number | 'cuoi';
  daiTu: boolean;
  tuongDoi?: 're_hon' | 'dat_hon';
  chuDeChinhSach?: ChuDeChinhSach;
  chuDeHuongDan?: ChuDeHuongDan;
  nhacKhuyenMai: boolean;
}

export interface TuDienPhanTich {
  /** Tên các hãng đang có trong kho (nguyên văn, có dấu). */
  hang: string[];
  /** Các từ khóa đặc trưng trong tên sản phẩm (đã bỏ dấu), ví dụ "astrox", "88d". */
  tuKhoaTen: Set<string>;
}

// ---------------------------------------------------------------------------
// Chuẩn hóa
// ---------------------------------------------------------------------------

export function boDau(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/** Bỏ dấu, gom khoảng trắng, đổi "li-ning" / "li ning" thành "lining". */
export function chuanHoa(s: string): string {
  return boDau(s)
    .replace(/li[\s-]+ning/g, 'lining')
    .replace(/[^a-z0-9#.,%<>~\-+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const cacheRegex = new Map<string, RegExp>();
/** Có chứa nguyên cụm (ranh giới từ) trong chuỗi đã chuẩn hóa không. */
export function coCum(t: string, ...cum: string[]): boolean {
  return cum.some((c) => {
    let re = cacheRegex.get(c);
    if (!re) {
      re = new RegExp(`(^|[^a-z0-9])(?:${c})(?=$|[^a-z0-9])`);
      cacheRegex.set(c, re);
    }
    return re.test(t);
  });
}

export function tachTu(t: string): string[] {
  return t.split(/[^a-z0-9]+/).filter(Boolean);
}

/** Từ đơn + từ ghép với số/ký hiệu ngắn đứng sau ("tectonic 7" -> "tectonic7") để khớp mã model một chữ số. */
export function tachTuGhep(t: string): string[] {
  const tu = tachTu(t);
  const kq = [...tu];
  for (let i = 1; i < tu.length; i++) {
    if (tu[i].length <= 2 && /\d/.test(tu[i])) kq.push(tu[i - 1] + tu[i]);
  }
  return kq;
}

// ---------------------------------------------------------------------------
// Ngân sách
// ---------------------------------------------------------------------------

const DON_VI: Record<string, number> = { trieu: 1e6, tr: 1e6, cu: 1e6, nghin: 1e3, ngan: 1e3, k: 1e3, d: 1, dong: 1, vnd: 1 };
const SO = String.raw`(\d+(?:[.,]\d+)*)`;
const DV = String.raw`(trieu|tr|cu|nghin|ngan|k|dong|vnd|d)`;

function soThapPhan(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

/** Đổi chuỗi số + đơn vị sang VNĐ. Trả null nếu không giống một số tiền. */
function giaTri(so: string, donVi: string | undefined, ruoi: boolean): number | null {
  if (donVi && DON_VI[donVi] >= 1000) {
    const n = soThapPhan(so);
    return Number.isFinite(n) ? Math.round(n * DON_VI[donVi] + (ruoi ? DON_VI[donVi] / 2 : 0)) : null;
  }
  if (/^\d{1,3}([.,]\d{3})+$/.test(so)) {
    return parseInt(so.replace(/[.,]/g, ''), 10);
  }
  const n = parseInt(so, 10);
  return Number.isFinite(n) && n >= 10000 ? n : null;
}

const CUE_TREN = ['tren', 'hon', 'it nhat', 'toi thieu', 'lon hon', '>', 'min'];
const CUE_DUOI = ['duoi', 'toi da', 'khong qua', 'khong vuot', 'ko qua', 'nho hon', 'max', 'trong vong', 'chua toi', 'khong hon', '<', 'chi', 'ngan sach'];
const CUE_XAP_XI = ['tam', 'khoang', 'quanh', 'xap xi', 'ngang'];

export interface NganSach {
  giaMin?: number;
  giaMax?: number;
  giaTam?: number;
  sapXep?: SapXep;
}

/** Trích khoảng giá từ câu hỏi: "dưới 3 triệu", "2-4tr", "tầm 3tr5", "500k", "từ 2 triệu trở lên"... */
export function phanTichNganSach(chu: string): NganSach {
  let t = chuanHoa(chu).replace(/(\d+)\s*(trieu|tr|cu)\s*(\d{1,2})(?!\d)/g, '$1.$3 $2');
  const kq: NganSach = {};

  // Khoảng: "2-4 triệu", "từ 2 đến 4 triệu", "2tr đến 3tr5"
  const m = new RegExp(`${SO}\\s*${DV}?\\s*(?:-|~|den|toi)\\s*${SO}\\s*${DV}`).exec(t);
  if (m) {
    const dv2 = m[4];
    const a = giaTri(m[1], m[2] ?? dv2, false);
    const b = giaTri(m[3], dv2, false);
    if (a !== null && b !== null) {
      kq.giaMin = Math.min(a, b);
      kq.giaMax = Math.max(a, b);
      return kq;
    }
  }

  const re = new RegExp(`${SO}\\s*${DV}?(?=$|[^a-z0-9])(\\s*ruoi)?`, 'g');
  for (const x of t.matchAll(re)) {
    const so = x[1];
    const dv = x[2];
    const truoc = t.slice(Math.max(0, (x.index ?? 0) - 16), x.index ?? 0);
    const sau = t.slice((x.index ?? 0) + x[0].length, (x.index ?? 0) + x[0].length + 14);
    const coCue = (ds: string[]) => ds.some((c) => (c.length === 1 ? truoc.includes(c) : coCum(truoc, c)));
    let v = giaTri(so, dv, !!x[3]);
    if (v === null && !dv && coCue([...CUE_TREN, ...CUE_DUOI, ...CUE_XAP_XI]) && Number(so) >= 1 && Number(so) <= 99 && !/^\s*(u|size|cm|mm|g|lbs|sao|%|nam|tuoi|ngay|thang|doi|cay)/.test(sau)) {
      v = Number(so) * 1e6;
    }
    if (v === null || v < 1000) {
      continue;
    }
    const tuMin = /(?:^|\s)tu\s*$/.test(truoc);
    if (coCum(sau, 'tro len', 'tro nguoc len', 'or more') || tuMin || (coCue(CUE_TREN) && !coCue(CUE_DUOI))) {
      kq.giaMin = v;
    } else if (coCum(sau, 'tro xuong', 'tro lai', 'do lai') || coCue(CUE_DUOI)) {
      kq.giaMax = v;
    } else {
      kq.giaMin = Math.round(v * 0.75);
      kq.giaMax = Math.round(v * 1.15);
      kq.giaTam = v;
    }
    break;
  }

  if (coCum(t, 're nhat', 'gia re', 'binh dan', 'tiet kiem', 'sinh vien', 're re', 'mem gia', 'it tien')) {
    kq.sapXep = 're';
  } else if (coCum(t, 'cao cap', 'dat nhat', 'flagship', 'xin nhat', 'tot nhat', 'dinh nhat', 'hang khung', 'dat tien')) {
    kq.sapXep = 'cao';
  }
  return kq;
}

// ---------------------------------------------------------------------------
// Loại, hãng, trình độ, lối chơi, kích cỡ
// ---------------------------------------------------------------------------

const LOAI_MAU: [LoaiSP, RegExp][] = [
  [
    'phukien',
    /(?:^|[^a-z0-9])(phu kien|tui vot|tui dung|tui cau long|balo|ba lo|cuon can|quan can|day can|day cuon|grip|bang tay|bang tran|bang dau|qua cau|ong cau|hop cau|long vit|long ngong|cau thi dau|cau tap|cau luyen)(?=$|[^a-z0-9])/,
  ],
  ['vot', /(?:^|[^a-z0-9])(vot|racket|racquet)(?=$|[^a-z0-9])/],
  ['giay', /(?:^|[^a-z0-9])(giay|sneaker|shoes?)(?=$|[^a-z0-9])/],
  ['aoquan', /(?:^|[^a-z0-9])(ao|quan(?!\s+(?:tam|trong|ly|he))|do the thao|trang phuc|bo do|jersey|short)(?=$|[^a-z0-9])/],
];

export function nhanLoai(t: string): LoaiSP | undefined {
  let tot: { loai: LoaiSP; vt: number } | undefined;
  for (const [loai, re] of LOAI_MAU) {
    const m = re.exec(t);
    if (m && (!tot || m.index < tot.vt)) {
      tot = { loai, vt: m.index };
    }
  }
  return tot?.loai;
}

export function nhanNhom(t: string): NhomPhuKien | undefined {
  if (coCum(t, 'qua cau', 'ong cau', 'hop cau', 'cau thi dau', 'cau tap', 'cau luyen', 'long vit', 'long ngong')) return 'cau';
  if (coCum(t, 'tui vot', 'tui dung', 'tui cau long', 'balo', 'ba lo', 'tui')) return 'tui';
  if (coCum(t, 'cuon can', 'quan can', 'day cuon', 'grip', 'day can')) return 'cuon_can';
  return undefined;
}

export function nhanHang(t: string, dsHang: string[]): string | undefined {
  for (const h of dsHang) {
    const c = chuanHoa(h);
    if (c && coCum(t, c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) {
      return h;
    }
  }
  return undefined;
}

export function nhanTrinhDo(t: string): TrinhDo | undefined {
  if (coCum(t, 'moi choi', 'moi tap', 'moi bat dau', 'nguoi moi', 'tap choi', 'newbie', 'beginner', 'so cap', 'nhap mon', 'lan dau', 'chua biet choi', 'moi vao', 'moi lam quen', 'tap tanh', 'hoc choi', 'co ban')) {
    return 'moi';
  }
  if (coCum(t, 'nang cao', 'chuyen nghiep', 'vdv', 'cao thu', 'choi lau nam', 'choi nhieu nam', 'ban chuyen', 'trinh do cao', 'pro player', 'choi gioi', 'choi kha', 'thi giai', 'choi giai', 'di thi dau')) {
    return 'nang_cao';
  }
  if (coCum(t, 'phong trao', 'trung binh', 'choi vua', 'biet choi', 'choi duoc', 'giai tri', 'cuoi tuan', 'choi thuong xuyen', 'tam trung')) {
    return 'trung_binh';
  }
  return undefined;
}

export function nhanLoiChoi(t: string): LoiChoi | undefined {
  if (coCum(t, 'cong thu', 'toan dien', 'can bang', 'linh hoat', 'da nang', 'all round', 'attack and defense')) {
    return 'toan_dien';
  }
  if (coCum(t, 'tan cong', 'thien cong', 'chuyen cong', 'smash', 'dap cau', 'dap manh', 'luc dap', 'nang dau', 'uy luc', 'danh cong', 'loi cong', 'choi cong', 'cau sau', 'hau ve', 'dap', 'attack')) {
    return 'cong';
  }
  if (coCum(t, 'phong thu', 'thien thu', 'phan tat', 'toc do', 'nhe dau', 'vung nhanh', 'danh luoi', 'cau truoc', 'dieu cau', 'dat cau', 'defense', 'speed')) {
    return 'thu';
  }
  return undefined;
}

export function nhanNheTay(t: string): boolean {
  return coCum(t, 'tay yeu', 'dau tay', 'dau co tay', 'dau khuyu', 'hay dau tay', 'tay hay dau', 'chan thuong tay', 'moi tay', 'nhe tay', 'vot nhe', 'de vung');
}

/** Kích cỡ khách nhắc tới: "size 42", "size M", "4U", "5U". Chuẩn hóa chữ hoa để so với tên size trong kho. */
export function nhanKichCo(t: string): string | undefined {
  const u = /(?:^|[^a-z0-9])([2-6]u)(?=$|[^a-z0-9])/.exec(t);
  if (u) {
    return u[1].toUpperCase();
  }
  const so = /(?:^|[^a-z0-9])(?:size|sz|co|so)\s*(\d{2})(?=$|[^a-z0-9])/.exec(t);
  if (so) {
    return so[1];
  }
  const chu = /(?:^|[^a-z0-9])(?:size|sz)\s*([2-4]?xl|xxl|xs|[sml])(?=$|[^a-z0-9])/.exec(t);
  return chu ? chu[1].toUpperCase().replace(/^XXL$/, '2XL') : undefined;
}

// ---------------------------------------------------------------------------
// Tham chiếu hội thoại, mã đơn
// ---------------------------------------------------------------------------

const THU_TU: Record<string, number> = { nhat: 1, mot: 1, hai: 2, ba: 3, tu: 4, bon: 4, nam: 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };

export function nhanThuTu(t: string): number | 'cuoi' | undefined {
  let m = /(?:cai|mau|cay|doi|san pham|lua chon|goi y|so|phuong an)\s*(?:thu\s*)?(nhat|mot|hai|ba|tu|bon|nam|[1-5])(?=$|[^a-z0-9])/.exec(t);
  if (!m) {
    m = /(?:^|\s)thu\s*(nhat|hai|ba|tu|nam|[1-5])(?=$|[^a-z0-9])/.exec(t);
  }
  if (m) {
    return THU_TU[m[1]];
  }
  if (/(?:cai|mau|cay|doi)\s*(?:dau tien|dau)(?=$|[^a-z0-9])/.test(t) || coCum(t, 'dau tien')) {
    return 1;
  }
  if (/(?:cai|mau|cay|doi)\s*(?:cuoi cung|cuoi)(?=$|[^a-z0-9])/.test(t) || coCum(t, 'cuoi cung')) {
    return 'cuoi';
  }
  return undefined;
}

const SO_CHU: Record<string, number> = { mot: 1, hai: 2, ba: 3, bon: 4, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 };
const DON_VI_DEM = 'cay|doi|cai|chiec|cuon|ong|hop|bo|san pham|mon';

/** Số lượng khách nêu khi đặt hàng: "số lượng 2", "2 cây", "hai đôi", "x3", "mua 2". */
export function nhanSoLuong(t: string): number | undefined {
  const so = (s: string) => (/^\d+$/.test(s) ? parseInt(s, 10) : SO_CHU[s]);
  const m =
    /(?:so luong|sl)\s*(?:la\s*)?(\d{1,3})(?!\d)/.exec(t) ??
    /(?:^|[^a-z0-9])x\s*(\d{1,3})(?!\d)/.exec(t) ??
    new RegExp(`(?:^|[^a-z0-9])(\\d{1,3}|mot|hai|ba|bon|sau|bay|tam|chin|muoi)\\s*(?:${DON_VI_DEM})(?=$|[^a-z0-9])`).exec(t) ??
    /(?:mua|dat|lay)\s+(\d{1,3})(?=\s|$)/.exec(t);
  return m ? so(m[1]) : undefined;
}

export function nhanDaiTu(t: string): boolean {
  return coCum(t, 'cai nay', 'mau nay', 'cay nay', 'doi nay', 'san pham nay', 'cai do', 'mau do', 'cay do', 'doi do', 'no', 'cai tren', 'mau tren', 'vua roi', 'vua goi y', 'o tren', 'mau vua', 'cay vua', 'doi vua');
}

export function nhanSoDonHang(t: string): number | undefined {
  const m = /(?:#\s*|(?:^|[^a-z0-9])(?<!danh\s)don(?:\s+hang)?\s*(?:so|ma|la)?\s*#?\s*)(\d{1,7})(?=$|[^a-z0-9])/.exec(t) ?? /(?:^|[^a-z0-9])ma\s*(?:don|dh)\s*[:#]?\s*(\d{1,7})(?=$|[^a-z0-9])/.exec(t);
  return m ? parseInt(m[1], 10) : undefined;
}

// ---------------------------------------------------------------------------
// Ý định
// ---------------------------------------------------------------------------

function nhanChuDeChinhSach(t: string): ChuDeChinhSach | undefined {
  if (coCum(t, 'lam sao dat', 'lam sao de dat', 'cach de dat', 'lam the nao de dat', 'cach dat', 'dat hang nhu the nao', 'huong dan dat', 'dat hang the nao', 'dat hang ra sao')) return 'dat_hang';
  if (coCum(t, 'bao hanh')) return 'bao_hanh';
  if (coCum(t, 'doi tra', 'doi hang', 'tra hang', 'hoan tien', 'hoan hang', 'doi size', 'doi mau', 'tra lai')) return 'doi_tra';
  if (coCum(t, 'huy don', 'huy dat hang', 'khong mua nua', 'huy hang')) return 'huy_don';
  if (coCum(t, 'van chuyen', 'giao hang', 'ship', 'freeship', 'phi giao', 'phi ship', 'nhan hang', 'bao lau', 'mat may ngay', 'cod')) return 'giao_hang';
  if (coCum(t, 'thanh toan', 'momo', 'chuyen khoan', 'tra gop', 'visa', 'the ngan hang', 'tien mat', 'hinh thuc tra tien', 'cach tra tien')) return 'thanh_toan';
  if (coCum(t, 'chinh hang', 'hang that', 'hang gia', 'hang fake', 'hang nhai', 'xuat xu', 'nguon goc', 'authentic')) return 'chinh_hang';
  if (coCum(t, 'dia chi', 'o dau', 'gio mo cua', 'gio lam viec', 'mo cua', 'dong cua', 'hotline', 'so dien thoai', 'sdt', 'lien he', 'email', 'cua hang', 'chi nhanh', 'ghe shop', 'xem hang truc tiep')) return 'cua_hang';
  if (coCum(t, 'chinh sach', 'quy dinh', 'dieu khoan', 'quyen loi')) return 'chung';
  return undefined;
}

function nhanChuDeHuongDan(t: string): ChuDeHuongDan | undefined {
  const hoi = coCum(t, 'la gi', 'nghia la gi', 'co nghia', 'la sao', 'khac nhau', 'phan biet', 'giai thich', 'y nghia', 'cach chon', 'chon .* nhu the nao', 'chon .* the nao', 'chon .* sao', 'huong dan chon', 'meo chon', 'kinh nghiem chon', 'luu y khi chon', 'khi chon');
  if (!hoi) return undefined;
  if (coCum(t, '[2-6]u', 'trong luong', 'bao nhieu gam', 'nang bao nhieu')) return 'trong_luong';
  if (coCum(t, 'nang dau', 'nhe dau', 'can bang', 'diem can bang')) return 'can_bang';
  if (coCum(t, 'do cung', 'than deo', 'than cung', 'deo', 'cung')) return 'do_cung';
  if (coCum(t, 'suc cang', 'lbs', 'cang cuoc', 'cuoc')) return 'suc_cang';
  if (coCum(t, 'giay')) return 'chon_giay';
  if (coCum(t, 'vot')) return 'chon_vot';
  return 'chung';
}

export const TU_CHUNG_TU_VAN = ['tu van', 'goi y', 'de xuat', 'nen mua', 'nen chon', 'tim', 'muon mua', 'can mua', 'mua', 'xem', 'cho minh', 'cho toi', 'co (cai|mau|cay|doi|loai)', 'loai nao', 'mau nao', 'cai nao', 'cay nao', 'hang nao', 'nen dung', 'phu hop', 'hop voi', 'danh gia', 'ban chay', 'hot', 'pho bien', 'danh sach', 'liet ke', 'show', 'thong so'];

export function phanTich(van: string, tuDien: TuDienPhanTich, soSanPhamKhopTen = 0, coSanPhamTruoc = false): KetQuaPhanTich {
  const t = chuanHoa(van);
  const slot: SlotMoi = {};

  const loai = nhanLoai(t);
  if (loai) slot.loai = loai;
  const nhom = nhanNhom(t);
  if (nhom) slot.nhom = nhom;
  const hang = nhanHang(t, tuDien.hang);
  if (hang) slot.hang = hang;
  const ns = phanTichNganSach(van);
  if (ns.giaMin !== undefined) slot.giaMin = ns.giaMin;
  if (ns.giaMax !== undefined) slot.giaMax = ns.giaMax;
  if (ns.giaTam !== undefined) slot.giaTam = ns.giaTam;
  if (ns.sapXep) slot.sapXep = ns.sapXep;
  const td = nhanTrinhDo(t);
  if (td) slot.trinhDo = td;
  const lc = nhanLoiChoi(t);
  if (lc) slot.loiChoi = lc;
  if (nhanNheTay(t)) slot.nheTay = true;
  const kc = nhanKichCo(t);
  if (kc) slot.kichCo = kc;
  const tuKhoa = tachTuGhep(t).filter((w) => tuDien.tuKhoaTen.has(w));
  if (tuKhoa.length) slot.tuKhoa = [...new Set(tuKhoa)];
  // Suy ra loại hàng khi khách chỉ nói đặc điểm riêng của loại đó (đập cầu -> vợt, quả cầu -> phụ kiện).
  if (!slot.loai) {
    if (slot.nhom) slot.loai = 'phukien';
    else if (slot.loiChoi || slot.nheTay || /^[2-6]U$/.test(slot.kichCo ?? '')) slot.loai = 'vot';
  }

  const soDonHang = nhanSoDonHang(t);
  const thuTu = nhanThuTu(t);
  const daiTu = nhanDaiTu(t);
  const datLai = coCum(t, 'bat dau lai', 'lam lai', 'tim moi', 'tim lai', 'xoa het', 'reset', 'tu dau', 'chu de khac', 'hoi cai khac');
  const xemThem = coCum(t, 'mau khac', 'cai khac', 'cay khac', 'doi khac', 'xem them', 'con gi nua', 'con khong nua', 'goi y them', 'them nua', 'lua chon khac', 'con mau nao khac', 'khac nua', 'khac di');
  const tuongDoi: KetQuaPhanTich['tuongDoi'] = coCum(t, 're hon', 'mem hon', 'giam gia hon', 'it tien hon', 'thap hon', 'binh dan hon')
    ? 're_hon'
    : coCum(t, 'dat hon', 'cao cap hon', 'tot hon', 'xin hon', 'cao hon', 'manh hon', 'nhieu tien hon')
      ? 'dat_hon'
      : undefined;
  const nhacKhuyenMai = coCum(t, 'khuyen mai', 'giam gia', 'sale', 'uu dai', 'voucher', 'ma giam', 'black friday', 'xa kho', 'giam sau', 'dang giam', 'dang sale', 'khuyen mai nao', 'km', 'ma khuyen mai', 'chuong trinh');

  const chuDeCS = nhanChuDeChinhSach(t);
  const chuDeHD = nhanChuDeHuongDan(t);
  const lienQuanSanPham = !!(slot.loai || slot.hang || slot.tuKhoa || soSanPhamKhopTen > 0 || daiTu || thuTu !== undefined);

  const soLuong = nhanSoLuong(t);
  const base = { chuan: t, slot, datLai, xemThem, soDonHang, soLuong, thuTu, daiTu, tuongDoi, nhacKhuyenMai };
  const ra = (yDinh: YDinh, them: Partial<KetQuaPhanTich> = {}): KetQuaPhanTich => ({ ...base, yDinh, ...them });

  const tu = tachTu(t);
  const ngan = tu.length <= 6;

  const hoiThongTin = coCum(t, 'gia bao nhieu', 'bao nhieu tien', 'con hang', 'het hang', 'don hang cua', 'don da dat', 'don vua dat', 'trang thai', 'kiem tra', 'tra cuu', 'theo doi', 'so sanh');
  const cueDat = coCum(t, 'dat hang', 'dat mua', 'dat giup', 'dat cho', 'dat luon', 'dat ngay', 'mua ngay', 'mua luon', 'mua giup', 'mua cho', 'lay cho', 'lay luon', 'chot don', 'order', 'them vao gio', 'cho vao gio', 'bo vao gio', 'thanh toan luon', 'muon dat', 'toi dat', 'minh dat', 'cho minh dat');
  const cueMua = coCum(t, 'muon mua', 'can mua', 'mua', 'lay');
  const datTheoSanPham = coCum(t, 'dat') && lienQuanSanPham && !hoiThongTin;
  if (!chuDeCS && ((cueDat && !(hoiThongTin && !coCum(t, 'dat cho', 'dat giup', 'dat luon', 'dat ngay'))) || datTheoSanPham || (cueMua && (soSanPhamKhopTen > 0 || !!slot.tuKhoa) && !hoiThongTin))) {
    return ra('dat_hang');
  }
  if (soDonHang !== undefined || coCum(t, 'don hang', 'ma don', 'kiem tra don', 'trang thai don', 'don cua toi', 'don cua minh', 'theo doi don', 'tra cuu don', 'don da dat', 'don vua dat', 'don dat hom', 'hang cua toi', 'hang cua minh')) {
    if (!(chuDeCS === 'huy_don' && soDonHang === undefined && coCum(t, 'chinh sach', 'quy dinh', 'co the huy', 'duoc huy'))) {
      return ra('don_hang', { chuDeChinhSach: chuDeCS });
    }
  }
  if (chuDeHD) {
    return ra('huong_dan', { chuDeHuongDan: chuDeHD });
  }
  if (chuDeCS && !(nhacKhuyenMai && chuDeCS === 'giao_hang' && lienQuanSanPham)) {
    return ra('chinh_sach', { chuDeChinhSach: chuDeCS });
  }
  if (coCum(t, 'so sanh', 'khac gi', 'khac nhau', 'vs', 'hay la', 'hon kem', 'nen chon .* hay') && (soSanPhamKhopTen >= 2 || thuTu !== undefined || coCum(t, 'so sanh'))) {
    return ra('so_sanh');
  }
  if (coCum(t, 'con hang', 'het hang', 'ton kho', 'con size', 'con mau', 'con ko', 'con k', 'co san', 'con khong', 'con ko', 'con hok', 'con hong', 'co hang', 'con trong kho', 'so luong', 'het chua', 'con may') ) {
    if (!(xemThem && !soSanPhamKhopTen && !daiTu && thuTu === undefined)) {
      return ra('ton_kho');
    }
  }
  if (nhacKhuyenMai) {
    return ra('khuyen_mai');
  }
  if (coCum(t, 'gia bao nhieu', 'bao nhieu tien', 'gia sao', 'gia the nao', 'gia ra sao', 'may trieu', 'gia khong', 'gia nhieu', 'bao nhieu', 'gia hien tai', 'gia ban', 'gia gi', 'gia ca', 'gia thanh') && (soSanPhamKhopTen > 0 || daiTu || thuTu !== undefined || (coSanPhamTruoc && ngan))) {
    return ra('hoi_gia');
  }
  if (coCum(t, 'cam on', 'thanks', 'thank you', 'thank', 'tks', 'cam on shop', 'cam on ban', 'ok cam on', 'tuyet voi', 'hay qua', 'tot qua') && ngan && !lienQuanSanPham) {
    return ra('cam_on');
  }
  if (coCum(t, 'tam biet', 'bye', 'bye bye', 'hen gap lai', 'chao nhe', 'thoi nhe', 'het roi', 'khong can nua') && ngan && !lienQuanSanPham) {
    return ra('tam_biet');
  }
  if (coCum(t, 'ban la ai', 'ban lam duoc gi', 'giup gi', 'giup duoc gi', 'huong dan', 'help', 'tro giup', 'ban biet gi', 'ban co the', 'chuc nang', 'ho tro gi') && !lienQuanSanPham) {
    return ra('tro_giup');
  }
  const coTinHieuTuVan = coCum(t, ...TU_CHUNG_TU_VAN) || slot.giaMin !== undefined || slot.giaMax !== undefined || !!slot.trinhDo || !!slot.loiChoi || !!slot.nheTay || !!slot.sapXep || !!slot.kichCo;
  if (lienQuanSanPham || coTinHieuTuVan || tuongDoi || xemThem) {
    if (soSanPhamKhopTen > 0 && !coTinHieuTuVan && !slot.loai) {
      return ra('hoi_gia'); // chỉ nhắc tên một mẫu: cho xem chi tiết/giá của mẫu đó
    }
    return ra('tu_van');
  }
  if (coCum(t, 'xin chao', 'chao', 'hello', 'hi', 'hey', 'alo', 'shop oi', 'ad oi', 'ban oi', 'chao shop', 'chao ban', 'good morning', 'hola') && ngan) {
    return ra('chao_hoi');
  }
  return ra('khac');
}

/**
 * Gộp thông tin mới của lượt này vào ngữ cảnh cũ (thông tin mới thắng). Khi khách chuyển sang loại hàng khác
 * thì bắt đầu lại từ câu hỏi mới (ngân sách, hãng, lối chơi của loại cũ không còn ý nghĩa).
 */
export function gopNguCanh(cu: NguCanh, pt: KetQuaPhanTich): NguCanh {
  const s = pt.slot;
  if (pt.datLai || (s.loai && cu.loai && s.loai !== cu.loai)) {
    return { ...s };
  }
  const moi: NguCanh = { ...cu };
  for (const [k, v] of Object.entries(s)) {
    if (v !== undefined) {
      (moi as Record<string, unknown>)[k] = v;
    }
  }
  // Báo khoảng giá mới thì thay hẳn khoảng cũ (không giữ giaMin cũ khi chỉ nói "dưới ...").
  if (s.giaMax !== undefined && s.giaMin === undefined) delete moi.giaMin;
  if (s.giaMin !== undefined && s.giaMax === undefined) delete moi.giaMax;
  if ((s.giaMax !== undefined || s.giaMin !== undefined) && s.giaTam === undefined) delete moi.giaTam;
  if (s.tuKhoa === undefined && (s.hang || s.loai) && !pt.xemThem) {
    delete moi.tuKhoa;
  }
  return moi;
}
