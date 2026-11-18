// 09. Trang danh sách sản phẩm bằng MỘT aggregation: $lookup + giá sau khuyến mãi tính bằng biểu thức + $facet (+ $bucket).
// Bản trong ứng dụng: backend/src/catalog/danh-sach-pipeline.ts (có test so khớp với bản lọc bằng JavaScript cũ trên hơn 200 tổ hợp).
// Trước đây máy chủ tải TOÀN BỘ sản phẩm rồi lọc, sắp xếp, phân trang bằng JavaScript; giờ chỉ trang hiện tại rời khỏi MongoDB.
// Chỉ đọc. Chạy: mongosh "<chuỗi kết nối>" db/truy-van-mau/09-danh-sach-facet.mongodb.js

const TZ = 'Asia/Ho_Chi_Minh';
const MOI_TRANG = 12, TRANG = 1;
const MOC_GIA = [0, 1_000_000, 2_000_000, 3_000_000, 5_000_000, 1e15];
const HANG_CHON = []; // ví dụ: [ObjectId('...')] để lọc theo hãng
const homNay = { $dateTrunc: { date: '$$NOW', unit: 'day', timezone: TZ } };
const dauNgay = (x) => ({ $dateTrunc: { date: x, unit: 'day', timezone: TZ } });
const motDoc = (from, as) => [{ $lookup: { from, localField: as, foreignField: '_id', as } }, { $set: { [as]: { $first: `$${as}` } } }];

const pipeline = [
  // 1) Partial index dang_ban_moi_nhat chỉ chứa sản phẩm chưa xoá mềm.
  { $match: { deletedAt: null } },
  ...motDoc('loaisanphams', 'loai'),
  ...motDoc('hangs', 'hang'),
  ...motDoc('khuyenmais', 'khuyenMai'),
  // 2) $lookup có sub-pipeline: cộng tồn kho của các phiên bản ngay bên MongoDB.
  { $lookup: { from: 'chitietsanphams', localField: '_id', foreignField: 'sanPham', as: '_ton', pipeline: [{ $group: { _id: null, t: { $sum: '$soLuongTon' } } }] } },
  { $set: { tongTonKho: { $ifNull: [{ $first: '$_ton.t' }, 0] } } },
  // 3) Giá sau khuyến mãi: khuyến mãi còn hiệu lực theo NGÀY (giờ Việt Nam), mức giảm bị chặn bởi giamToiDa.
  { $set: { _hl: { $and: [
    { $ne: [{ $type: '$khuyenMai._id' }, 'missing'] },
    { $or: [{ $not: ['$khuyenMai.ngayBatDau'] }, { $lte: [dauNgay('$khuyenMai.ngayBatDau'), homNay] }] },
    { $or: [{ $not: ['$khuyenMai.ngayKetThuc'] }, { $gte: [dauNgay('$khuyenMai.ngayKetThuc'), homNay] }] },
  ] } } },
  { $set: { _giam: { $divide: [{ $multiply: ['$giaGoc', { $ifNull: ['$khuyenMai.phanTramGiam', 0] }] }, 100] } } },
  { $set: { gia: { $cond: ['$_hl', { $max: [0, { $subtract: ['$giaGoc', {
    $cond: [{ $and: [{ $toBool: { $ifNull: ['$khuyenMai.giamToiDa', 0] } }, { $gt: ['$_giam', '$khuyenMai.giamToiDa'] }] }, '$khuyenMai.giamToiDa', '$_giam'],
  }] }] }, '$giaGoc'] } } },
  { $unset: ['_ton', '_hl', '_giam'] },
  // 4) Bộ lọc chung (ví dụ: chỉ vợt, còn hàng).
  { $match: { 'loai.tenLoai': { $regex: 'vợt', $options: 'i' }, tongTonKho: { $gt: 0 } } },
  // 5) $facet: bốn nhánh chạy trên CÙNG tập kết quả, trả về trong một document.
  { $facet: {
    items: [
      ...(HANG_CHON.length ? [{ $match: { 'hang._id': { $in: HANG_CHON } } }] : []),
      { $sort: { gia: 1, ngayTao: -1, _id: -1 } }, { $skip: (TRANG - 1) * MOI_TRANG }, { $limit: MOI_TRANG },
      { $project: { _id: 0, tenSanPham: 1, hang: '$hang.tenHang', giaGoc: 1, gia: 1, tongTonKho: 1 } },
    ],
    tong: [...(HANG_CHON.length ? [{ $match: { 'hang._id': { $in: HANG_CHON } } }] : []), { $count: 'n' }],
    // Nhánh đếm theo hãng BỎ QUA bộ lọc hãng: người dùng thấy bấm hãng khác sẽ ra bao nhiêu sản phẩm.
    theoHang: [{ $group: { _id: '$hang.tenHang', so: { $sum: 1 } } }, { $sort: { so: -1 } }],
    // $bucket: phân bố giá theo các khoảng [a, b) không chồng nhau.
    theoGia: [{ $bucket: { groupBy: '$gia', boundaries: MOC_GIA, default: 'khác', output: { so: { $sum: 1 }, reNhat: { $min: '$gia' } } } }],
  } },
];

const [f] = db.sanphams.aggregate(pipeline, { collation: { locale: 'vi' } }).toArray();
const vnd = (x) => Math.round(x).toLocaleString('vi-VN');
print(`Tổng: ${f.tong[0]?.n ?? 0} vợt còn hàng. Trang ${TRANG}, sắp theo giá tăng:`);
f.items.forEach((x) => print(`   ${vnd(x.gia).padStart(11)} đ ${x.gia < x.giaGoc ? `(gốc ${vnd(x.giaGoc)})` : ''.padEnd(16)}  ${x.hang ?? '-'}  ${x.tenSanPham}  [tồn ${x.tongTonKho}]`));
print('\nTheo hãng:');
f.theoHang.forEach((h) => print(`   ${String(h._id ?? '(không hãng)').padEnd(10)} ${h.so}`));
print('\nPhân bố giá ($bucket):');
f.theoGia.forEach((b) => print(`   từ ${typeof b._id === 'number' ? vnd(b._id).padStart(9) : b._id}: ${'█'.repeat(b.so)} ${b.so}`));

// So sánh: bản cũ kéo về máy chủ bao nhiêu document, bản $facet kéo về bao nhiêu.
print(`\nDữ liệu rời MongoDB: bản cũ ${db.sanphams.countDocuments({ deletedAt: null })} sản phẩm + toàn bộ tồn kho; bản $facet: 1 document (${f.items.length} sản phẩm của trang + các con số đếm).`);
