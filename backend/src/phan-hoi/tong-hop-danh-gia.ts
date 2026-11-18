import { PipelineStage } from 'mongoose';

/**
 * Computed pattern cho điểm đánh giá: `sanphams.danhGiaTongHop = { so, tong, trungBinh }` được lưu sẵn để trang danh sách, trang chủ,
 * chatbot đọc thẳng thay vì gom (aggregate) toàn bộ `phanhois` ở mỗi lần tải trang.
 *
 * Chỉ tính đánh giá CÔNG KHAI THẬT: đã xác minh và không phải dữ liệu mẫu (máy demo bật HIEN_DU_LIEU_MAU thì đọc theo đường gom cũ).
 * - Ghi: mỗi đánh giá mới cộng vào bằng MỘT lệnh update pipeline (đọc giá trị cũ, cộng, tính lại trung bình trong cùng lệnh) và, khi
 *   có replica set, chung transaction với việc thêm đánh giá.
 * - Đối soát: `npm run db:tinh-lai-danh-gia` tính lại từ đầu bằng $lookup rồi $merge ngược vào sanphams (sửa mọi sai lệch nếu có).
 */
export const LOC_DANH_GIA_THAT = { daXacMinh: true, laDuLieuMau: { $ne: true } } as const;

/** Cộng một đánh giá `sao` sao vào tổng hợp của sản phẩm. */
export function pipelineCongDanhGia(sao: number): PipelineStage[] {
  return [
    {
      $set: {
        danhGiaTongHop: {
          so: { $add: [{ $ifNull: ['$danhGiaTongHop.so', 0] }, 1] },
          tong: { $add: [{ $ifNull: ['$danhGiaTongHop.tong', 0] }, { $literal: sao }] },
        },
      },
    },
    { $set: { 'danhGiaTongHop.trungBinh': { $round: [{ $divide: ['$danhGiaTongHop.tong', '$danhGiaTongHop.so'] }, 1] } } },
  ] as PipelineStage[];
}

/**
 * Tính lại tổng hợp cho MỌI sản phẩm từ phanhois rồi ghi đè vào sanphams bằng $merge (cùng collection nguồn: hỗ trợ từ MongoDB 4.4).
 * Sản phẩm chưa có đánh giá nhận { so: 0, tong: 0, trungBinh: null } (không mặc định 5 sao).
 */
export function pipelineTinhLaiTongHop(): PipelineStage[] {
  return [
    { $project: { _id: 1 } },
    {
      $lookup: {
        from: 'phanhois', localField: '_id', foreignField: 'sanPham', as: 'dg',
        pipeline: [{ $match: LOC_DANH_GIA_THAT }, { $group: { _id: null, so: { $sum: 1 }, tong: { $sum: '$danhGia' } } }],
      },
    },
    {
      $project: {
        danhGiaTongHop: {
          so: { $ifNull: [{ $first: '$dg.so' }, 0] },
          tong: { $ifNull: [{ $first: '$dg.tong' }, 0] },
          trungBinh: { $cond: [{ $gt: [{ $ifNull: [{ $first: '$dg.so' }, 0] }, 0] }, { $round: [{ $divide: [{ $first: '$dg.tong' }, { $first: '$dg.so' }] }, 1] }, null] },
        },
      },
    },
    { $merge: { into: 'sanphams', on: '_id', whenMatched: 'merge', whenNotMatched: 'discard' } },
  ] as PipelineStage[];
}

/** Đọc tổng hợp dưới dạng cũ của API (trungBinhDanhGia, soDanhGia). */
export const docTongHop = (sp: { danhGiaTongHop?: { so?: number; trungBinh?: number | null } | null }) => ({
  trungBinhDanhGia: sp.danhGiaTongHop?.so ? (sp.danhGiaTongHop.trungBinh ?? null) : null,
  soDanhGia: sp.danhGiaTongHop?.so ?? 0,
});
