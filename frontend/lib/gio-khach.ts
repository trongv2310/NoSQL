/**
 * Giỏ khách lưu mã biến thể, số lượng, thời điểm thêm và token đồng bộ trong localStorage.
 * Server tính lại giá và tồn kho. Bản chụp chờ đồng bộ gắn với tài khoản và chỉ bị xóa khi server xác nhận.
 */

export interface DongKhach { id: string; sl: number; ts: number }
export interface GioKhach { v: 1; dong: DongKhach[]; token: string; capNhat: number }
export interface BanChup { token: string; dong: DongKhach[]; ts: number }

export const TOI_DA_DONG = 50;
export const TOI_DA_SO_LUONG = 100;
const KHOA_GIO = "shop-cl:gio-khach:v1";
const khoaCho = (userId: string) => `shop-cl:gio-cho:v1:${userId}`;
/** Ngắn hơn thời hạn 30 ngày của biên nhận/sổ cái ở server, để không bao giờ gửi lại một mã mà server đã quên. */
const HAN_CHO_MS = 14 * 24 * 3600 * 1000;
const ID_HOP_LE = /^[0-9a-f]{24}$/;
const TOKEN_HOP_LE = /^[A-Za-z0-9_-]{16,64}$/;

const TRONG: GioKhach = { v: 1, dong: [], token: "", capNhat: 0 };

export function taoToken(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.randomUUID) return `g-${c.randomUUID()}`;
  const bytes = new Uint8Array(18);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return `g-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Làm sạch dữ liệu đọc từ localStorage (có thể bị sửa tay hoặc hỏng): bỏ dòng sai, gộp dòng trùng, chặn số lượng và số dòng. */
export function lamSachDong(raw: unknown): DongKhach[] {
  if (!Array.isArray(raw)) return [];
  const theoId = new Map<string, DongKhach>();
  for (const r of raw) {
    const o = r as Partial<DongKhach> | null;
    const id = typeof o?.id === "string" ? o.id.toLowerCase() : "";
    const sl = Number(o?.sl);
    if (!ID_HOP_LE.test(id) || !Number.isInteger(sl) || sl < 1) continue;
    const ts = Number.isFinite(Number(o?.ts)) ? Number(o?.ts) : 0;
    const cu = theoId.get(id);
    theoId.set(id, { id, sl: Math.min(TOI_DA_SO_LUONG, (cu?.sl ?? 0) + sl), ts: Math.max(cu?.ts ?? 0, ts) });
  }
  return [...theoId.values()].slice(0, TOI_DA_DONG);
}

function lamSachGio(raw: unknown): GioKhach {
  const o = raw as Partial<GioKhach> | null;
  const dong = lamSachDong(o?.dong);
  const token = typeof o?.token === "string" && TOKEN_HOP_LE.test(o.token) ? o.token : "";
  return { v: 1, dong, token, capNhat: Number(o?.capNhat) || 0 };
}

// ---------------------------------------------------------------------------
// Kho lưu trữ: localStorage là nơi bền; bộ nhớ chỉ là lớp phủ khi ghi vào localStorage thất bại
// ---------------------------------------------------------------------------

/**
 * Giá trị mới nhất của khóa mà localStorage KHÔNG nhận được (đầy bộ nhớ, bị chặn, đọc lại không khớp). `null` nghĩa là "đã xóa".
 * Có khóa trong đây thì đây là sự thật của phiên: `doc` đọc ở đây trước, nên một lần ghi lỗi không bao giờ làm dữ liệu
 * biến mất dù `getItem`/`removeItem` vẫn chạy bình thường (QuotaExceededError chỉ ném ở `setItem`).
 */
const boNho = new Map<string, string | null>();
function doc(khoa: string): unknown {
  let chuoi: string | null | undefined;
  if (boNho.has(khoa)) {
    chuoi = boNho.get(khoa);
  } else {
    try {
      chuoi = window.localStorage.getItem(khoa);
    } catch {
      chuoi = null;
    }
  }
  if (!chuoi) return null;
  try {
    return JSON.parse(chuoi);
  } catch {
    return null;
  }
}
/** Trả về `true` khi localStorage đã giữ đúng giá trị (đã đọc lại để chắc chắn); `false` khi chỉ còn trong bộ nhớ của phiên này. */
function ghi(khoa: string, giaTri: unknown | null): boolean {
  const chuoi = giaTri === null ? null : JSON.stringify(giaTri);
  try {
    if (chuoi === null) window.localStorage.removeItem(khoa);
    else window.localStorage.setItem(khoa, chuoi);
    if (window.localStorage.getItem(khoa) !== chuoi) throw new Error("đọc lại không khớp");
    boNho.delete(khoa);
    return true;
  } catch {
    boNho.set(khoa, chuoi);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Store ngoài React (useSyncExternalStore)
// ---------------------------------------------------------------------------

let hien: GioKhach = TRONG;
let daNap = false;
const nguoiNghe = new Set<() => void>();

function thongBao() {
  nguoiNghe.forEach((f) => f());
}

function nap() {
  if (daNap || typeof window === "undefined") return;
  daNap = true;
  hien = lamSachGio(doc(KHOA_GIO));
  window.addEventListener("storage", (e) => {
    if (e.key !== KHOA_GIO && e.key !== null) return;
    hien = lamSachGio(doc(KHOA_GIO));
    thongBao();
  });
}

export function layGio(): GioKhach {
  nap();
  return hien;
}

/** Giỏ rỗng thì không có token; giỏ có hàng giữ token cũ hoặc tạo mới. Token chỉ có nghĩa khi giỏ được chụp sang hàng đợi. */
function luuGio(dong: DongKhach[], token?: string) {
  hien = { v: 1, dong, token: dong.length ? token ?? (hien.token || taoToken()) : "", capNhat: Date.now() };
  ghi(KHOA_GIO, dong.length ? hien : null);
  thongBao();
}

export function dangKyGio(f: () => void) {
  nguoiNghe.add(f);
  return () => {
    nguoiNghe.delete(f);
  };
}
export const gioMayChu = (): GioKhach => TRONG;

export const tongSoLuongGio = (g: GioKhach) => g.dong.reduce((t, d) => t + d.sl, 0);
export const soLuongTrongGio = (g: GioKhach, id: string) => g.dong.find((d) => d.id === id.toLowerCase())?.sl ?? 0;

/** Thêm vào giỏ khách; trả về số lượng sau khi thêm. Một dòng không vượt `TOI_DA_SO_LUONG`, giỏ không quá `TOI_DA_DONG` dòng. */
export function themVaoGio(id: string, sl: number): { ok: true; soLuong: number } | { ok: false; lyDo: "tran-dong" | "tran-so-luong" | "khong-hop-le" } {
  const g = layGio();
  const khoa = id.toLowerCase();
  if (!ID_HOP_LE.test(khoa) || !Number.isInteger(sl) || sl < 1) return { ok: false, lyDo: "khong-hop-le" };
  const cu = g.dong.find((d) => d.id === khoa);
  if (!cu && g.dong.length >= TOI_DA_DONG) return { ok: false, lyDo: "tran-dong" };
  const moi = (cu?.sl ?? 0) + sl;
  if (moi > TOI_DA_SO_LUONG) return { ok: false, lyDo: "tran-so-luong" };
  const dong = cu ? g.dong.map((d) => (d.id === khoa ? { ...d, sl: moi, ts: Date.now() } : d)) : [{ id: khoa, sl: moi, ts: Date.now() }, ...g.dong];
  luuGio(dong);
  return { ok: true, soLuong: moi };
}

export function datSoLuongGio(id: string, sl: number) {
  const g = layGio();
  const khoa = id.toLowerCase();
  if (!Number.isInteger(sl) || sl < 1) return;
  luuGio(g.dong.map((d) => (d.id === khoa ? { ...d, sl: Math.min(TOI_DA_SO_LUONG, sl) } : d)));
}

export function xoaKhoiGio(id: string) {
  const g = layGio();
  luuGio(g.dong.filter((d) => d.id !== id.toLowerCase()));
}

export function xoaTatCaGio() {
  layGio();
  luuGio([]);
}

// ---------------------------------------------------------------------------
// Hàng đợi đồng bộ theo tài khoản
// ---------------------------------------------------------------------------

function docCho(userId: string): BanChup[] {
  const raw = doc(khoaCho(userId));
  if (!Array.isArray(raw)) return [];
  const homNay = Date.now();
  return raw
    .map((r): BanChup => {
      const o = r as Partial<BanChup> | null;
      return { token: typeof o?.token === "string" ? o.token : "", dong: lamSachDong(o?.dong), ts: Number(o?.ts) || 0 };
    })
    .filter((b) => TOKEN_HOP_LE.test(b.token) && b.dong.length > 0 && homNay - b.ts < HAN_CHO_MS);
}

function ghiCho(userId: string, ds: BanChup[]): boolean {
  return ghi(khoaCho(userId), ds.length ? ds : null);
}

export const banChupDangCho = (userId: string): BanChup[] => (typeof window === "undefined" ? [] : docCho(userId));

export function coDuLieuCanDongBo(userId: string): boolean {
  return layGio().dong.length > 0 || banChupDangCho(userId).length > 0;
}

/**
 * Chuyển giỏ khách hiện có sang hàng đợi của tài khoản `userId` rồi dọn giỏ khách (token mới cho giỏ khách kế tiếp).
 * Ghi hàng đợi TRƯỚC; chỉ dọn giỏ khách khi hàng đợi đã được localStorage giữ CHẮC CHẮN. Nếu ghi hàng đợi thất bại (đầy bộ nhớ…)
 * thì giỏ khách gốc được giữ nguyên (còn bản chụp trong bộ nhớ của phiên để đồng bộ ngay): tải lại trang giữa chừng vẫn còn giỏ gốc
 * với cùng token, và `xoaBanChup` sẽ trừ đúng phần đã đồng bộ khỏi giỏ gốc.
 * Nếu bị ngắt giữa chừng thì lần sau chuyển lại cùng token và được loại trùng ở đây.
 */
export function chuyenSangCho(userId: string): BanChup[] {
  const g = layGio();
  const ds = docCho(userId);
  if (g.dong.length > 0) {
    // Token phải cố định từ lúc chụp: nếu giỏ chưa có token thì gán và lưu trước khi chụp.
    if (!g.token) luuGio(g.dong);
    const token = layGio().token;
    if (!ds.some((b) => b.token === token)) ds.push({ token, dong: g.dong, ts: Date.now() });
    if (ghiCho(userId, ds)) luuGio([]);
  } else if (ds.length) {
    ghiCho(userId, ds);
  }
  return ds;
}

/** Trừ phần của bản chụp đã đồng bộ khỏi giỏ khách gốc (chỉ khi giỏ gốc còn cùng token, tức chưa được dọn và chưa là giỏ khác). */
function truBanChupKhoiGio(ban: BanChup) {
  const g = layGio();
  if (g.token !== ban.token) return;
  const dong: DongKhach[] = [];
  for (const d of g.dong) {
    const daGui = ban.dong.find((b) => b.id === d.id)?.sl ?? 0;
    if (d.sl > daGui) dong.push({ ...d, sl: d.sl - daGui });
  }
  // Phần còn lại là nội dung mới, không thuộc bản chụp cũ → token mới.
  luuGio(dong, dong.length ? taoToken() : undefined);
}

/** Chỉ xóa đúng bản chụp mà server đã xác nhận; các bản chụp khác (và giỏ khách mới) giữ nguyên. */
export function xoaBanChup(userId: string, token: string) {
  const ds = docCho(userId);
  const ban = ds.find((b) => b.token === token);
  ghiCho(userId, ds.filter((b) => b.token !== token));
  if (ban) truBanChupKhoiGio(ban);
}

/** Server báo mã đã dùng cho nội dung khác (hiếm): đổi sang mã mới để gửi lại. */
export function doiTokenBanChup(userId: string, token: string) {
  ghiCho(userId, docCho(userId).map((b) => (b.token === token ? { ...b, token: taoToken() } : b)));
}
