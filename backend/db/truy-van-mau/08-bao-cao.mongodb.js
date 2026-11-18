// 08. Báo cáo thống kê (slide 62–82 Aggregation và phần mở rộng): cùng các pipeline trong backend/src/admin/bao-cao-csdl.ts.
// Cần dữ liệu để có số: `npm run db:du-lieu-mau` sinh dữ liệu MẪU (laDuLieuMau: true). Biến LAY_MAU = false để chỉ tính dữ liệu thật.
// Chỉ đọc. Chạy: mongosh "<chuỗi kết nối>" db/truy-van-mau/08-bao-cao.mongodb.js

const LAY_MAU = true;
const loc = LAY_MAU ? {} : { laDuLieuMau: { $ne: true } };
const TEN = { moi: 'Mới chơi', deu: 'Chơi đều', thi: 'Thi đấu', cong: 'Uy lực', toc: 'Tốc độ', toan: 'Kiểm soát' };
const s1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
print(`Dữ liệu: ${db.lancangs.countDocuments(loc)} lần căng, ${db.phanhois.countDocuments({ ...loc, daXacMinh: true })} đánh giá công khai, ` +
  `${db.votcanhans.countDocuments({ ...loc, deletedAt: null })} hộ chiếu vợt${LAY_MAU ? ' (gồm cả dữ liệu mẫu)' : ''}`);

// 1) $group + $avg/$min/$max/$stdDevPop: mức căng theo trình độ người căng (bản chụp trong lancangs, không cần $lookup).
print('\n1) Mức căng theo trình độ:');
db.lancangs.aggregate([
  { $match: { ...loc, 'nguoiDanhChup.trinhDo': { $exists: true } } },
  { $group: { _id: '$nguoiDanhChup.trinhDo', tb: { $avg: '$mucCangLbs' }, thap: { $min: '$mucCangLbs' }, cao: { $max: '$mucCangLbs' }, lech: { $stdDevPop: '$mucCangLbs' }, so: { $sum: 1 } } },
  { $sort: { tb: 1 } },
]).forEach((r) => print(`   ${TEN[r._id].padEnd(9)} TB ${s1(r.tb)} lbs  (${r.thap}–${r.cao}, độ lệch ${s1(r.lech)})  ${r.so} lần`));

// 2) $bucket: phân bố mức căng theo khoảng 2 lbs.
print('\n2) Phân bố mức căng ($bucket):');
db.lancangs.aggregate([
  { $match: loc },
  { $bucket: { groupBy: '$mucCangLbs', boundaries: [14, 18, 20, 22, 24, 26, 28, 30, 32, 40], default: 'khac', output: { so: { $sum: 1 } } } },
]).forEach((b) => print(`   từ ${String(b._id).padStart(4)} lbs: ${'█'.repeat(Math.round(b.so / 8))} ${b.so}`));

// 3) $group hai tầng + $push + $slice: 3 loại dây dùng nhiều nhất cho mỗi lối chơi.
print('\n3) Dây dùng nhiều nhất theo lối chơi:');
db.lancangs.aggregate([
  { $match: { ...loc, tenDay: { $type: 'string' }, 'nguoiDanhChup.loiChoi': { $exists: true } } },
  { $group: { _id: { loiChoi: '$nguoiDanhChup.loiChoi', day: '$tenDay' }, so: { $sum: 1 } } },
  { $sort: { so: -1, '_id.day': 1 } },
  { $group: { _id: '$_id.loiChoi', day: { $push: { ten: '$_id.day', so: '$so' } } } },
  { $project: { day: { $slice: ['$day', 3] } } },
  { $sort: { _id: 1 } },
]).forEach((r) => print(`   ${TEN[r._id].padEnd(9)} ${r.day.map((d) => `${d.ten} (${d.so})`).join(', ')}`));

// 4) $setWindowFields + $shift + $dateDiff + $median: chu kỳ căng lại THỰC TẾ (khoảng giữa hai lần căng liên tiếp của cùng cây vợt).
print('\n4) Chu kỳ căng lại thực tế:');
db.lancangs.aggregate([
  { $match: loc },
  { $setWindowFields: { partitionBy: '$votCaNhan', sortBy: { ngay: 1 }, output: { lanTruoc: { $shift: { output: '$ngay', by: -1 } } } } },
  { $match: { lanTruoc: { $ne: null } } },
  { $set: { khoang: { $dateDiff: { startDate: '$lanTruoc', endDate: '$ngay', unit: 'day' } } } },
  { $group: { _id: '$nguoiDanhChup.trinhDo', tb: { $avg: '$khoang' }, trungVi: { $median: { input: '$khoang', method: 'approximate' } }, so: { $sum: 1 } } },
  { $sort: { tb: 1 } },
]).forEach((r) => print(`   ${(TEN[r._id] ?? 'Không rõ').padEnd(9)} TB ${s1(r.tb)} ngày, trung vị ${r.trungVi} ngày (${r.so} khoảng)`));

// 5) $cond trong $group: tỉ lệ căng vượt mức tối đa nhà sản xuất theo nơi căng (shop chặn ngay khi đặt nên phải bằng 0).
print('\n5) Căng vượt mức tối đa nhà sản xuất:');
db.lancangs.aggregate([{ $match: loc }, { $group: { _id: '$noiCang', tong: { $sum: 1 }, vuot: { $sum: { $cond: ['$vuotMucNSX', 1, 0] } } } }])
  .forEach((r) => print(`   ${r._id === 'shop' ? 'Tại shop' : 'Ở ngoài '}: ${r.vuot}/${r.tong} (${s1((100 * r.vuot) / r.tong)}%)`));

// 6) Vợt được chấm cao nhất theo trình độ người viết (≥ 3 đánh giá) + $lookup (≈ JOIN, slide 82) lấy tên sản phẩm.
print('\n6) Vợt được chấm cao nhất theo trình độ người viết:');
db.phanhois.aggregate([
  { $match: { ...loc, daXacMinh: true, 'nguoiDanh.trinhDo': { $exists: true } } },
  { $group: { _id: { trinhDo: '$nguoiDanh.trinhDo', sanPham: '$sanPham' }, tb: { $avg: '$danhGia' }, so: { $sum: 1 } } },
  { $match: { so: { $gte: 3 } } },
  { $sort: { tb: -1, so: -1 } },
  { $group: { _id: '$_id.trinhDo', top: { $push: { sanPham: '$_id.sanPham', tb: '$tb', so: '$so' } } } },
  { $project: { top: { $slice: ['$top', 2] } } },
  { $unwind: '$top' },
  { $lookup: { from: 'sanphams', localField: 'top.sanPham', foreignField: '_id', as: 'sp', pipeline: [{ $project: { tenSanPham: 1 } }] } },
  { $sort: { _id: 1, 'top.tb': -1 } },
]).forEach((r) => print(`   ${TEN[r._id].padEnd(9)} ${s1(r.top.tb)}★ (${r.top.so} ĐG)  ${r.sp[0]?.tenSanPham}`));

// 7) $facet: một lượt đọc votcanhans cho ba con số về lịch nhắc (index sparse han_nhac phục vụ nhánh đến hạn).
const now = new Date();
const [f] = db.votcanhans.aggregate([
  { $match: { ...loc, deletedAt: null } },
  { $facet: {
    daDenHan: [{ $match: { hanNhacLuc: { $lte: now } } }, { $count: 'so' }],
    trong7Ngay: [{ $match: { hanNhacLuc: { $gt: now, $lte: new Date(now.getTime() + 7 * 86400000) } } }, { $count: 'so' }],
    khongNhac: [{ $match: { hanNhacLuc: { $exists: false } } }, { $count: 'so' }],
  } },
]).toArray();
print(`\n7) Lịch nhắc: đã đến hạn ${f.daDenHan[0]?.so ?? 0}, trong 7 ngày tới ${f.trong7Ngay[0]?.so ?? 0}, không đặt nhắc ${f.khongNhac[0]?.so ?? 0}`);
