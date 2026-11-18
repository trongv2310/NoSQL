import { BoLocThongSo, bacCanBang, bacDoCung, loiChoiCuaVot, ThongSoVotTho } from './vot-thong-so';

/**
 * Attribute pattern: thông số vợt (5 chuỗi để hiển thị trong `thongSo`) được chép thêm thành mảng cặp { k, v } có giá trị SỐ
 * trong `chitietsanphams.thuocTinh`. Một index { "thuocTinh.k": 1, "thuocTinh.v": 1 } phục vụ mọi thuộc tính, kể cả thuộc tính thêm
 * về sau (giày, áo...), và MongoDB lọc được thẳng bằng $elemMatch thay vì tải hết về rồi đọc chuỗi bằng JS.
 *
 * Nguyên tắc: chỉ ghi những gì đọc được từ chuỗi gốc. Không đọc được thì BỎ thuộc tính đó, không đoán, không điền mặc định.
 * Độ cân bằng trong dữ liệu chỉ có dạng chữ ("Nặng đầu"), nên lưu theo BẬC giống `bacCanBang`, tuyệt đối không quy ra mm.
 */

export const KHOA_THUOC_TINH = [
  'canBangBac', // -2 rất nhẹ đầu … 3 rất nặng đầu (bacCanBang)
  'doCungBac', // 0 mềm/dẻo … 3 rất cứng (bacDoCung)
  'trongLuongU', // 2..6 (số U)
  'trongLuongMinG',
  'trongLuongMaxG',
  'chieuDaiMm',
  'sucCangMinLbs', // chỉ có khi nguồn ghi cận dưới
  'sucCangMaxLbs',
  'loiChoi', // chuỗi: cong | toc | toan (có thể nhiều phần tử)
] as const;
export type KhoaThuocTinh = (typeof KHOA_THUOC_TINH)[number];
export interface ThuocTinh {
  k: KhoaThuocTinh;
  v: number | string;
}

export const LBS_MOI_KG = 2.20462262; // cùng hằng số với frontend/lib/cuoc-cang.ts

const so = (s: string) => Number(s.replace(',', '.'));

/** "3U (85-89g)" → { u: 3, min: 85, max: 89 }; "4U" → { u: 4 }. */
export function docTrongLuong(s?: string | null): { u?: number; minG?: number; maxG?: number } {
  const t = String(s ?? '');
  const r: { u?: number; minG?: number; maxG?: number } = {};
  const mu = /^\s*(\d)\s*U\b/i.exec(t);
  if (mu) r.u = Number(mu[1]);
  const mg = /(\d{2,3})\s*[-–]\s*(\d{2,3})\s*g\b/i.exec(t);
  if (mg && Number(mg[1]) <= Number(mg[2])) {
    r.minG = Number(mg[1]);
    r.maxG = Number(mg[2]);
  }
  return r;
}

/** "675mm" / "675 mm" → 675. */
export function docChieuDai(s?: string | null): number | undefined {
  const m = /^\s*(\d{3})\s*mm\s*$/i.exec(String(s ?? ''));
  return m ? Number(m[1]) : undefined;
}

/**
 * Sức căng → lbs. Cùng cách đọc với `docSucCang` ở frontend: "20-28 lbs", "9 – 13 kg", "tối đa 28 lbs", một số trần = mức tối đa.
 * Thiếu đơn vị thì không đọc (không đoán là kg hay lbs). kg đổi sang lbs bằng hằng số, làm tròn 2 chữ số.
 */
export function docSucCangLbs(chuoi?: string | null): { minLbs: number | null; maxLbs: number } | null {
  const s = String(chuoi ?? '').trim();
  if (!s) return null;
  const SO = '(\\d{1,3}(?:[.,]\\d{1,2})?)';
  const DV = '(kgs?|kilogram|lbs?|pounds?)';
  let m: RegExpExecArray | null;
  let min: number | null = null;
  let max: number;
  let dv: string | undefined;
  if ((m = new RegExp(`^${SO}\\s*(?:-|–|—|~|đến|to)\\s*${SO}\\s*${DV}?$`, 'i').exec(s))) [min, max, dv] = [so(m[1]), so(m[2]), m[3]];
  else if ((m = new RegExp(`^(?:tối đa|toi da|max|up to|<=|≤|dưới)\\s*${SO}\\s*${DV}?$`, 'i').exec(s))) [max, dv] = [so(m[1]), m[2]];
  else if ((m = new RegExp(`^${SO}\\s*${DV}?$`, 'i').exec(s))) [max, dv] = [so(m[1]), m[2]];
  else return null;
  if (!dv || !(max > 0) || (min !== null && !(min > 0 && min <= max))) return null;
  const heSo = /^k/i.test(dv) ? LBS_MOI_KG : 1;
  const lam = (x: number) => Math.round(x * heSo * 100) / 100;
  return { minLbs: min === null ? null : lam(min), maxLbs: lam(max) };
}

/** Chuỗi thông số → mảng thuộc tính số. Không có thông số hoặc không đọc được gì → mảng rỗng. */
export function thuocTinhTuThongSo(ts?: ThongSoVotTho | null): ThuocTinh[] {
  if (!ts) return [];
  const r: ThuocTinh[] = [];
  const them = (k: KhoaThuocTinh, v: number | string | null | undefined) => {
    if (v !== null && v !== undefined && !(typeof v === 'number' && !Number.isFinite(v))) r.push({ k, v });
  };
  them('canBangBac', bacCanBang(ts));
  them('doCungBac', bacDoCung(ts));
  const tl = docTrongLuong(ts.trongLuong);
  them('trongLuongU', tl.u);
  them('trongLuongMinG', tl.minG);
  them('trongLuongMaxG', tl.maxG);
  them('chieuDaiMm', docChieuDai(ts.chieuDai));
  const sc = docSucCangLbs(ts.sucCang);
  them('sucCangMinLbs', sc?.minLbs);
  them('sucCangMaxLbs', sc?.maxLbs);
  for (const l of loiChoiCuaVot(ts)) them('loiChoi', l);
  return r;
}

/** So hai mảng thuộc tính không phụ thuộc thứ tự (để script chuẩn hoá biết bản ghi nào lệch). */
export function cungThuocTinh(a?: ThuocTinh[] | null, b?: ThuocTinh[] | null): boolean {
  const khoa = (x?: ThuocTinh[] | null) => (x ?? []).map((t) => `${t.k}=${typeof t.v}:${t.v}`).sort().join('|');
  return khoa(a) === khoa(b);
}

const thuoc = (k: KhoaThuocTinh, v: unknown) => ({ thuocTinh: { $elemMatch: { k, v } } });

/**
 * Bộ lọc thông số của trang danh sách → điều kiện MongoDB trên `chitietsanphams`. Ngữ nghĩa giữ y hệt `bienTheKhopBoLoc`:
 * MỘT phiên bản phải thoả MỌI nhóm đã chọn ($and), trong mỗi nhóm khớp MỘT giá trị ($or). Vì cả điều kiện nằm trên cùng một
 * tài liệu biến thể, không có chuyện thuộc tính của phiên bản 3U ghép với thuộc tính của phiên bản 4U.
 * Không chọn nhóm nào → null (không lọc).
 */
export function dieuKienThuocTinh(b: BoLocThongSo): Record<string, unknown> | null {
  const nhom: Record<string, unknown>[][] = [];
  const CAN_BANG: Record<string, unknown> = { nang: { $gt: 0 }, 'can-bang': 0, nhe: { $lt: 0 } };
  const DO_CUNG: Record<string, unknown> = { cung: { $gte: 2 }, vua: 1, mem: 0 };
  // Đã chọn một nhóm mà không giá trị nào hợp lệ thì nhóm đó không khớp được gì (giống bienTheKhopBoLoc), chứ không phải "bỏ lọc".
  const KHONG_KHOP = { $expr: false };
  const them = (ds: Record<string, unknown>[]) => nhom.push(ds.length ? ds : [KHONG_KHOP]);
  if (b.canBang.length) them(b.canBang.filter((x) => Object.hasOwn(CAN_BANG, x)).map((x) => thuoc('canBangBac', CAN_BANG[x])));
  if (b.doCung.length) them(b.doCung.filter((x) => Object.hasOwn(DO_CUNG, x)).map((x) => thuoc('doCungBac', DO_CUNG[x])));
  if (b.trongLuong.length) {
    const u = b.trongLuong.map((x) => /^(\d)u$/.exec(x)).filter((m): m is RegExpExecArray => !!m).map((m) => Number(m[1]));
    them(u.length ? [thuoc('trongLuongU', { $in: u })] : []);
  }
  if (b.loiChoi.length) them([thuoc('loiChoi', { $in: b.loiChoi })]);
  if (!nhom.length) return null;
  const dieuKien = nhom.map((ds) => (ds.length === 1 ? ds[0] : { $or: ds }));
  return dieuKien.length === 1 ? dieuKien[0] : { $and: dieuKien };
}
