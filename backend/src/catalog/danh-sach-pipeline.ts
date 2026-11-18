import { PipelineStage, Types } from 'mongoose';

/**
 * Trang danh sách sản phẩm chạy TRONG MongoDB bằng MỘT aggregation: $lookup danh mục + khuyến mãi + tồn kho, tính giá sau khuyến mãi
 * bằng biểu thức, lọc, rồi $facet trả cùng lúc:
 *   - items  : trang hiện tại (sort + skip + limit),
 *   - tong   : tổng số kết quả,
 *   - theoHang: số sản phẩm theo từng hãng (bỏ qua bộ lọc hãng, để người dùng biết chọn hãng khác sẽ ra bao nhiêu),
 *   - theoGia: phân bố giá bằng $bucket (các khoảng [a, b) không chồng nhau, để vẽ biểu đồ),
 *   - demKhoangGia: số sản phẩm của TỪNG lựa chọn khoảng giá trong bộ lọc ($group + $cond). Bộ lọc tính cả hai đầu mút (giá đúng
 *     2.000.000 thuộc cả "1–2 triệu" lẫn "2–3 triệu") nên không dùng chung được kết quả $bucket.
 *   Hai nhánh giá bỏ qua bộ lọc giá; nhánh hãng bỏ qua bộ lọc hãng (người dùng thấy chọn lựa chọn khác sẽ ra bao nhiêu).
 * Ngữ nghĩa lọc/sắp xếp giữ y hệt bản lọc trong bộ nhớ cũ (CatalogService.danhSachTrongBoNho), có test so khớp.
 */

export const MOC_GIA = [0, 1_000_000, 2_000_000, 3_000_000, 5_000_000, 1e15];

export interface DieuKienDanhSach {
  loai?: string;
  hang?: string;
  ten?: string;
  keyword?: string;
  /** Kết quả tìm kiếm toàn văn (đã xếp hạng): chỉ giữ các id này, sắp theo điểm khi không chọn kiểu sắp xếp khác. */
  timKiem?: { ids: Types.ObjectId[] } | null;
  giaTu: number | null;
  giaDen: number | null;
  hangIds: string[];
  giamGia: boolean;
  conHang: boolean;
  /** Sản phẩm khớp bộ lọc thông số vợt (M1), null = không lọc. */
  spKhopThongSo: Set<string> | null;
  sapXep?: string;
  trang: number;
  moiTrang: number;
}

const thoat = (s: string) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const chua = (truong: string, tu: string) => ({ [truong]: { $regex: thoat(tu), $options: 'i' } });

/** Ngữ nghĩa lọc loại giống CatalogService cũ: id, hoặc nhóm theo từ khoá (vợt/giày/áo/phụ kiện), hoặc chứa chuỗi. */
function locLoai(loai: string): Record<string, unknown> {
  if (/^[0-9a-f]{24}$/i.test(loai)) return { 'loai._id': new Types.ObjectId(loai) };
  const key = loai.trim().toLocaleLowerCase('vi');
  const motTrong = (...mau: string[]) => ({ $or: mau.map((m) => chua('loai.tenLoai', m)) });
  if (key.includes('vot')) return motTrong('vợt', 'vot');
  if (key.includes('giay') || key.includes('giày')) return motTrong('giày', 'giay');
  if (['ao', 'áo', 'quan', 'quần'].some((k) => key.includes(k))) return motTrong('áo', 'ao');
  if (key.includes('phu') || key.includes('phụ')) return motTrong('phụ kiện', 'phu');
  return chua('loai.tenLoai', key);
}

/** Đầu ngày theo lịch của máy chủ (cùng cách `dauNgay` trong common/pricing.ts dùng giờ địa phương của tiến trình Node). */
const dauNgay = (bieuThuc: unknown, tz: string) => ({ $dateTrunc: { date: bieuThuc, unit: 'day', timezone: tz } });

/** Các stage tính `gia` (giá sau khuyến mãi) và `dangGiamGia`, bám đúng giaSauKhuyenMai / dangGiamGia của common/pricing.ts. */
export function stageGia(now: Date, tz: string): PipelineStage[] {
  const homNay = dauNgay({ $literal: now }, tz);
  const hieuLuc = {
    $and: [
      { $ne: [{ $type: '$khuyenMai._id' }, 'missing'] },
      { $or: [{ $not: ['$khuyenMai.ngayBatDau'] }, { $lte: [dauNgay('$khuyenMai.ngayBatDau', tz), homNay] }] },
      { $or: [{ $not: ['$khuyenMai.ngayKetThuc'] }, { $gte: [dauNgay('$khuyenMai.ngayKetThuc', tz), homNay] }] },
    ],
  };
  const giamTho = { $divide: [{ $multiply: ['$giaGoc', { $ifNull: ['$khuyenMai.phanTramGiam', 0] }] }, 100] };
  const giam = {
    $cond: [
      { $and: [{ $toBool: { $ifNull: ['$khuyenMai.giamToiDa', 0] } }, { $gt: [giamTho, '$khuyenMai.giamToiDa'] }] },
      '$khuyenMai.giamToiDa',
      giamTho,
    ],
  };
  return [
    { $set: { _kmHieuLuc: hieuLuc } },
    {
      $set: {
        gia: { $cond: [{ $lte: ['$giaGoc', 0] }, 0, { $cond: ['$_kmHieuLuc', { $max: [0, { $subtract: ['$giaGoc', giam] }] }, '$giaGoc'] }] },
        dangGiamGia: { $and: ['$_kmHieuLuc', { $gt: [{ $ifNull: ['$khuyenMai.phanTramGiam', 0] }, 0] }] },
      },
    },
    { $unset: '_kmHieuLuc' },
  ] as PipelineStage[];
}

const motDoc = (from: string, as: string): PipelineStage[] => [
  { $lookup: { from, localField: as, foreignField: '_id', as } },
  { $set: { [as]: { $first: `$${as}` } } },
];

export function sapXepDanhSach(kieu?: string, coTimKiem = false): Record<string, 1 | -1 | { $meta: string }> {
  const moiNhat = { ngayTao: -1, _id: -1 } as const;
  switch (kieu) {
    case 'gia_tang': return { gia: 1, ...moiNhat };
    case 'gia_giam': return { gia: -1, ...moiNhat };
    case 'ten': return { tenSanPham: 1, ...moiNhat }; // cần collation { locale: 'vi' } để giống localeCompare(..., 'vi')
    default: return coTimKiem ? { _diemTimKiem: 1, ...moiNhat } : moiNhat;
  }
}

export function pipelineDanhSach(d: DieuKienDanhSach, now: Date, tz: string, khoangGia: Record<string, [number, number | null]>): PipelineStage[] {
  const dau: Record<string, unknown> = { deletedAt: null };
  if (d.spKhopThongSo) dau._id = { $in: [...d.spKhopThongSo].map((x) => new Types.ObjectId(x)) };
  if (d.timKiem) dau._id = { ...(dau._id as object), $in: d.timKiem.ids.filter((id) => !d.spKhopThongSo || d.spKhopThongSo.has(String(id))) };

  const loc: Record<string, unknown>[] = [];
  if (d.loai) loc.push(locLoai(d.loai));
  if (d.hang) loc.push(chua('hang.tenHang', d.hang));
  if (d.ten) loc.push(chua('tenSanPham', d.ten));
  if (d.keyword && !d.timKiem) loc.push({ $or: [chua('tenSanPham', d.keyword), chua('hang.tenHang', d.keyword), chua('loai.tenLoai', d.keyword)] });
  if (d.giamGia) loc.push({ dangGiamGia: true });
  if (d.conHang) loc.push({ tongTonKho: { $gt: 0 } });

  const locHang = d.hangIds.length ? { 'hang._id': { $in: d.hangIds.filter((x) => /^[0-9a-f]{24}$/i.test(x)).map((x) => new Types.ObjectId(x)) } } : null;
  const locGia: Record<string, unknown> = {};
  if (d.giaTu !== null && d.giaTu > 0) locGia.$gte = d.giaTu;
  if (d.giaDen !== null && d.giaDen > 0) locGia.$lte = d.giaDen;
  const coLocGia = Object.keys(locGia).length ? { gia: locGia } : null;
  const ca = [locHang, coLocGia].filter(Boolean) as Record<string, unknown>[];
  const m = (ds: Record<string, unknown>[]) => (ds.length ? [{ $match: ds.length === 1 ? ds[0] : { $and: ds } }] : []);

  return [
    { $match: dau },
    ...motDoc('loaisanphams', 'loai'),
    ...motDoc('hangs', 'hang'),
    ...motDoc('khuyenmais', 'khuyenMai'),
    ...motDoc('nhacungcaps', 'nhaCungCap'),
    {
      $lookup: {
        from: 'chitietsanphams', localField: '_id', foreignField: 'sanPham', as: '_ton',
        pipeline: [{ $group: { _id: null, t: { $sum: '$soLuongTon' } } }],
      },
    },
    { $set: { tongTonKho: { $ifNull: [{ $first: '$_ton.t' }, 0] } } },
    { $unset: '_ton' },
    ...stageGia(now, tz),
    ...(d.timKiem ? [{ $set: { _diemTimKiem: { $indexOfArray: [d.timKiem.ids, '$_id'] } } }] : []),
    ...m(loc),
    {
      $facet: {
        items: [...m(ca), { $sort: sapXepDanhSach(d.sapXep, !!d.timKiem) }, { $skip: (d.trang - 1) * d.moiTrang }, { $limit: d.moiTrang }],
        tong: [...m(ca), { $count: 'n' }],
        theoHang: [...m(coLocGia ? [coLocGia] : []), { $group: { _id: '$hang._id', so: { $sum: 1 } } }],
        theoGia: [
          ...m(locHang ? [locHang] : []),
          { $bucket: { groupBy: '$gia', boundaries: MOC_GIA, default: 'khac', output: { so: { $sum: 1 } } } },
        ],
        demKhoangGia: [
          ...m(locHang ? [locHang] : []),
          {
            $group: {
              _id: null,
              ...Object.fromEntries(Object.entries(khoangGia).map(([k, [tu, den]], i) => [`k${i}`, {
                $sum: { $cond: [{ $and: [...(tu > 0 ? [{ $gte: ['$gia', tu] }] : []), ...(den ? [{ $lte: ['$gia', den] }] : []), true] }, 1, 0] },
              }])),
            },
          },
        ],
      },
    },
  ] as PipelineStage[];
}

/** Kết quả $bucket → [{ tu, den, so }] để vẽ biểu đồ phân bố giá. */
export function phanBoGia(theoGia: { _id: number | string; so: number }[]): { tu: number; den: number | null; so: number }[] {
  return MOC_GIA.slice(0, -1).map((tu, i) => ({ tu, den: i + 1 < MOC_GIA.length - 1 ? MOC_GIA[i + 1] : null, so: theoGia.find((b) => b._id === tu)?.so ?? 0 }));
}

/** Kết quả nhánh demKhoangGia → { "<khoá khoảng giá>": số sản phẩm }. */
export function demTheoKhoang(dem: Record<string, number> | undefined, khoangGia: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(Object.keys(khoangGia).map((k, i) => [k, dem?.[`k${i}`] ?? 0]));
}
