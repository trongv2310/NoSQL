import { Model, Types } from 'mongoose';

/**
 * Tìm kiếm sản phẩm: không dấu, gợi ý khi đang gõ, chịu lỗi chính tả. Ba tầng, tầng sau chỉ chạy khi tầng trước không ra gì:
 *   1. $text trên text index `tim_kiem_toan_van` (timKiem.chuoi trọng số 10, moTa trọng số 1), xếp theo textScore.
 *      Mỗi từ đặt trong ngoặc kép nên phải có ĐỦ mọi từ ("vot yonex" không trả mọi cây vợt).
 *   2. Tiền tố: mỗi từ là đầu của một phần tử trong mảng timKiem.tu (index multikey `tu_khoa_tien_to`, regex neo ^ dùng được index).
 *      Dùng cho gợi ý khi người dùng mới gõ dở ("astr" → Astrox).
 *   3. Gần đúng: so khớp tập "bộ ba ký tự" (trigram) của từ khoá với timKiem.baKyTu (index multikey `ba_ky_tu`), điểm = tỉ lệ bộ ba
 *      trùng ($setIntersection). "yonx astrox" vẫn ra Yonex Astrox, kèm gợi ý "Có phải bạn muốn tìm".
 *
 * Vì sao cần trường chuẩn hoá riêng: text index phiên bản 3 tự bỏ dấu phần lớn chữ Việt (ợ → o) nhưng KHÔNG đổi "đ" thành "d",
 * và không tìm được theo tiền tố hay khi gõ sai. timKiem được hook schema dựng lại mỗi lần đổi tên/mô tả; dữ liệu cũ thì chạy
 * `npm run db:chuan-hoa-tim-kiem`.
 */

/** Bỏ dấu, đ → d, chữ thường, chỉ giữ chữ và số. */
export function khongDau(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const tachTu = (s: unknown): string[] => [...new Set(khongDau(s).split(' ').filter(Boolean))];

/** Bộ ba ký tự của một từ, có đánh dấu đầu từ ("^as") để từ khớp phần đầu được điểm cao hơn. Từ 1–2 ký tự lấy nguyên từ. */
export function baKyTuCuaTu(w: string): string[] {
  if (w.length < 3) return [w];
  const r = new Set<string>([`^${w.slice(0, 2)}`]);
  for (let i = 0; i + 3 <= w.length; i++) r.add(w.slice(i, i + 3));
  return [...r];
}
export const baKyTu = (tu: string[]): string[] => [...new Set(tu.flatMap(baKyTuCuaTu))];

export interface TruongTimKiem {
  chuoi: string;
  tu: string[];
  baKyTu: string[];
}

/** Trường `timKiem` lưu trên sanphams (extended reference của chính tên sản phẩm, đã chuẩn hoá). */
export function dungTruongTimKiem(tenSanPham: unknown): TruongTimKiem {
  const tu = tachTu(tenSanPham);
  return { chuoi: tu.join(' '), tu, baKyTu: baKyTu(tu) };
}

export const cungTruongTimKiem = (a: Partial<TruongTimKiem> | undefined | null, b: TruongTimKiem) =>
  !!a && a.chuoi === b.chuoi && JSON.stringify(a.tu) === JSON.stringify(b.tu) && JSON.stringify(a.baKyTu) === JSON.stringify(b.baKyTu);

export type CheDoTim = 'van-ban' | 'tien-to' | 'gan-dung' | 'trong';
export interface KetQuaTim {
  ids: Types.ObjectId[];
  cheDo: CheDoTim;
  /** Khi phải tìm gần đúng: từ khoá đã sửa theo tên sản phẩm khớp nhất. */
  goiY?: string;
}

const thoat = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DANG_BAN = { deletedAt: null };
const NGUONG_GAN_DUNG = 0.4;

const jaccard = (a: string[], b: string[]) => {
  const B = new Set(b);
  const chung = a.filter((x) => B.has(x)).length;
  return chung / (new Set([...a, ...b]).size || 1);
};

/** Sửa từng từ khoá theo từ giống nhất trong tên sản phẩm khớp nhất (cùng thước đo trigram). */
function suaTuKhoa(tuKhoa: string[], tuSanPham: string[]): string {
  return tuKhoa
    .map((w) => {
      let tot = w, diem = 0;
      for (const t of tuSanPham) {
        const d = jaccard(baKyTuCuaTu(w), baKyTuCuaTu(t));
        if (d > diem) [tot, diem] = [t, d];
      }
      return diem >= 0.25 ? tot : w;
    })
    .join(' ');
}

/** Chỉ gợi ý khi từ khoá sửa xong khác từ khoá người dùng gõ. */
const goiYKhac = (tu: string[], tuSanPham: string[]) => {
  const g = suaTuKhoa(tu, tuSanPham);
  return g !== tu.join(' ') ? g : undefined;
};

export function locTienTo(tu: string[]) {
  return { ...DANG_BAN, $and: tu.map((w) => ({ 'timKiem.tu': { $regex: `^${thoat(w)}` } })) };
}

export function pipelineGanDung(tu: string[], gioiHan: number) {
  const q = baKyTu(tu);
  return [
    { $match: { ...DANG_BAN, 'timKiem.baKyTu': { $in: q } } },
    { $set: { _diem: { $divide: [{ $size: { $setIntersection: ['$timKiem.baKyTu', q] } }, q.length] } } },
    { $match: { _diem: { $gte: NGUONG_GAN_DUNG } } },
    { $sort: { _diem: -1, ngayTao: -1, _id: -1 } },
    { $limit: gioiHan },
    { $project: { _id: 1, _diem: 1, 'timKiem.tu': 1 } },
  ] as any[];
}

export async function timKiemSanPham(model: Model<any>, tuKhoa: unknown, gioiHan = 200): Promise<KetQuaTim> {
  const tu = tachTu(tuKhoa);
  if (!tu.length) return { ids: [], cheDo: 'trong' };

  const vanBan = await model
    .find({ ...DANG_BAN, $text: { $search: tu.map((w) => `"${w}"`).join(' ') } }, { _diem: { $meta: 'textScore' } })
    .sort({ _diem: { $meta: 'textScore' }, ngayTao: -1, _id: -1 })
    .limit(gioiHan)
    .lean();
  if (vanBan.length) return { ids: vanBan.map((d) => d._id), cheDo: 'van-ban' };

  const tienTo = await model.find(locTienTo(tu), { _id: 1 }).sort({ ngayTao: -1, _id: -1 }).limit(gioiHan).lean();
  if (tienTo.length) return { ids: tienTo.map((d) => d._id), cheDo: 'tien-to' };

  const ganDung = await model.aggregate(pipelineGanDung(tu, gioiHan));
  if (ganDung.length) return { ids: ganDung.map((d) => d._id), cheDo: 'gan-dung', goiY: goiYKhac(tu, ganDung[0].timKiem?.tu ?? []) };
  return { ids: [], cheDo: 'trong' };
}

/** Gợi ý khi đang gõ: tiền tố trước (từ gõ xong cũng là tiền tố của chính nó), không có thì gần đúng. */
export async function goiYKhiGo(model: Model<any>, tuKhoa: unknown, soLuong = 8): Promise<KetQuaTim> {
  const tu = tachTu(tuKhoa);
  if (!tu.length) return { ids: [], cheDo: 'trong' };
  const tienTo = await model.find(locTienTo(tu), { _id: 1 }).sort({ ngayTao: -1, _id: -1 }).limit(soLuong).lean();
  if (tienTo.length) return { ids: tienTo.map((d) => d._id), cheDo: 'tien-to' };
  const ganDung = await model.aggregate(pipelineGanDung(tu, soLuong));
  if (ganDung.length) return { ids: ganDung.map((d) => d._id), cheDo: 'gan-dung', goiY: goiYKhac(tu, ganDung[0].timKiem?.tu ?? []) };
  return { ids: [], cheDo: 'trong' };
}
