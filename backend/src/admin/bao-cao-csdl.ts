import { PipelineStage } from 'mongoose';

/**
 * Báo cáo thống kê cho quản trị (M6): mỗi hàm trả MỘT aggregation pipeline (test được, chạy được nguyên văn trong mongosh — xem
 * db/truy-van-mau/08-bao-cao.mongodb.js). `locMau` = điều kiện bỏ dữ liệu mẫu (rỗng khi muốn xem cả dữ liệu mẫu).
 */
export type LocMau = Record<string, unknown>;
export const locMau = (coMau: boolean): LocMau => (coMau ? {} : { laDuLieuMau: { $ne: true } });

/** lancangs: mức căng theo trình độ người căng ($group + $avg/$min/$max/$stdDevPop). */
export const pipelineMucCangTheoTrinhDo = (loc: LocMau): PipelineStage[] => [
  { $match: { ...loc, 'nguoiDanhChup.trinhDo': { $exists: true } } },
  {
    $group: {
      _id: '$nguoiDanhChup.trinhDo', tb: { $avg: '$mucCangLbs' }, thapNhat: { $min: '$mucCangLbs' }, caoNhat: { $max: '$mucCangLbs' },
      doLech: { $stdDevPop: '$mucCangLbs' }, so: { $sum: 1 },
    },
  },
];

/** lancangs: phân bố mức căng theo khoảng 2 lbs ($bucket). */
export const pipelinePhanBoMucCang = (loc: LocMau): PipelineStage[] => [
  { $match: loc },
  { $bucket: { groupBy: '$mucCangLbs', boundaries: [14, 18, 20, 22, 24, 26, 28, 30, 32, 40], default: 'khac', output: { so: { $sum: 1 } } } },
];

/** lancangs: 3 loại dây được dùng nhiều nhất cho mỗi lối chơi ($group hai tầng + $push + $slice). */
export const pipelineDayTheoLoiChoi = (loc: LocMau): PipelineStage[] => [
  { $match: { ...loc, tenDay: { $type: 'string' }, 'nguoiDanhChup.loiChoi': { $exists: true } } },
  { $group: { _id: { loiChoi: '$nguoiDanhChup.loiChoi', day: '$tenDay' }, so: { $sum: 1 } } },
  { $sort: { so: -1, '_id.day': 1 } },
  { $group: { _id: '$_id.loiChoi', day: { $push: { ten: '$_id.day', so: '$so' } }, tong: { $sum: '$so' } } },
  { $project: { day: { $slice: ['$day', 3] }, tong: 1 } },
  { $sort: { _id: 1 } },
];

/**
 * lancangs: chu kỳ căng lại THỰC TẾ = khoảng cách giữa hai lần căng liên tiếp của cùng một cây vợt.
 * $setWindowFields + $shift lấy ngày của lần trước trong cùng "cửa sổ" (partition theo cây vợt, sắp theo ngày), $dateDiff ra số ngày,
 * rồi $group theo trình độ với $avg và $median.
 */
export const pipelineChuKyThucTe = (loc: LocMau): PipelineStage[] => [
  { $match: loc },
  { $setWindowFields: { partitionBy: '$votCaNhan', sortBy: { ngay: 1 }, output: { lanTruoc: { $shift: { output: '$ngay', by: -1 } } } } },
  { $match: { lanTruoc: { $ne: null } } },
  { $set: { khoangNgay: { $dateDiff: { startDate: '$lanTruoc', endDate: '$ngay', unit: 'day' } } } },
  {
    $group: {
      _id: '$nguoiDanhChup.trinhDo', tb: { $avg: '$khoangNgay' }, trungVi: { $median: { input: '$khoangNgay', method: 'approximate' } }, so: { $sum: 1 },
    },
  },
];

/** lancangs: tỉ lệ lần căng vượt mức tối đa nhà sản xuất, tách theo nơi căng. */
export const pipelineVuotMucNSX = (loc: LocMau): PipelineStage[] => [
  { $match: loc },
  { $group: { _id: '$noiCang', tong: { $sum: 1 }, vuot: { $sum: { $cond: ['$vuotMucNSX', 1, 0] } } } },
];

/**
 * phanhois: vợt được chấm cao nhất trong từng trình độ người viết (chỉ tính khi ≥ `toiThieu` đánh giá), kèm tên sản phẩm qua $lookup.
 * Đánh giá công khai (đã xác minh); `loc` quyết định có tính dữ liệu mẫu không.
 */
export const pipelineVotTheoTrinhDo = (loc: LocMau, toiThieu = 3): PipelineStage[] => [
  { $match: { ...loc, daXacMinh: true, 'nguoiDanh.trinhDo': { $exists: true } } },
  { $group: { _id: { trinhDo: '$nguoiDanh.trinhDo', sanPham: '$sanPham' }, tb: { $avg: '$danhGia' }, so: { $sum: 1 } } },
  { $match: { so: { $gte: toiThieu } } },
  { $sort: { tb: -1, so: -1 } },
  { $group: { _id: '$_id.trinhDo', top: { $push: { sanPham: '$_id.sanPham', tb: '$tb', so: '$so' } } } },
  { $project: { top: { $slice: ['$top', 3] } } },
  { $unwind: '$top' },
  { $lookup: { from: 'sanphams', localField: 'top.sanPham', foreignField: '_id', as: 'sp', pipeline: [{ $project: { tenSanPham: 1 } }] } },
  { $project: { _id: 0, trinhDo: '$_id', sanPham: '$top.sanPham', ten: { $first: '$sp.tenSanPham' }, tb: { $round: ['$top.tb', 2] }, so: '$top.so' } },
  { $sort: { trinhDo: 1, tb: -1 } },
];

/** votcanhans: vợt đã đến hạn / sắp đến hạn căng lại (dùng index sparse han_nhac). */
export const pipelineDenHan = (loc: LocMau, now: Date): PipelineStage[] => [
  { $match: { ...loc, deletedAt: null, hanNhacLuc: { $lte: new Date(now.getTime() + 7 * 86_400_000) } } },
  { $group: { _id: { $cond: [{ $lte: ['$hanNhacLuc', now] }, 'daDenHan', 'trong7Ngay'] }, so: { $sum: 1 } } },
];
