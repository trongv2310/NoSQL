// 10. Tìm kiếm sản phẩm: text index + mảng từ không dấu (multikey, tìm tiền tố) + bộ ba ký tự (chịu lỗi chính tả).
// Bản trong ứng dụng: backend/src/catalog/tim-kiem.ts. Trường sanphams.timKiem do hook schema dựng, dữ liệu cũ: npm run db:chuan-hoa-tim-kiem.
// Chỉ đọc sanphams (mục 2 tạo rồi xoá ngay collection tạm thu_chu_d). Chạy: mongosh "<chuỗi kết nối>" db/truy-van-mau/10-tim-kiem.mongodb.js

const tenIndex = (p) => [p?.indexName, ...(p?.inputStage ? tenIndex(p.inputStage) : []), ...(p?.inputStages ?? []).flatMap(tenIndex)].filter(Boolean);
const docDung = (c) => { const e = c.explain('executionStats'); return `index ${tenIndex(e.queryPlanner.winningPlan).join(', ') || '(không)'}, đọc ${e.executionStats.totalDocsExamined} document`; };

print('Index tìm kiếm trên sanphams:');
db.sanphams.getIndexes().filter((i) => /tim_kiem|tu_khoa|ba_ky_tu/.test(i.name)).forEach((i) => print(`   ${i.name}: ${JSON.stringify(i.weights ?? i.key)}${i.partialFilterExpression ? '  (một phần: deletedAt null)' : ''}`));

// 1) $text: mỗi từ trong ngoặc kép → phải có đủ mọi từ. Xếp theo textScore (tên trọng số 10, mô tả trọng số 1).
print('\n1) $text "vot yonex" (gõ không dấu):');
const c1 = db.sanphams.find({ deletedAt: null, $text: { $search: '"vot" "yonex"' } }, { tenSanPham: 1, diem: { $meta: 'textScore' } }).sort({ diem: { $meta: 'textScore' } }).limit(5);
c1.forEach((d) => print(`   ${d.diem.toFixed(2)}  ${d.tenSanPham}`));
print(`   → ${docDung(db.sanphams.find({ deletedAt: null, $text: { $search: '"vot" "yonex"' } }))}`);

// 2) Vì sao cần trường chuẩn hoá riêng: text index v3 bỏ dấu "ợ" nhưng KHÔNG đổi "đ" thành "d".
print('\n2) Chữ "đ": tìm "dau" trên tên gốc bằng text index tạm (collection riêng) và trên timKiem.chuoi:');
db.thu_chu_d.drop();
db.thu_chu_d.insertOne({ ten: 'Cầu Lông Thi Đấu' });
db.thu_chu_d.createIndex({ ten: 'text' }, { default_language: 'none' });
print(`   text index trên tên gốc: ${db.thu_chu_d.countDocuments({ $text: { $search: 'dau' } })} kết quả`);
db.thu_chu_d.drop();
print(`   text index trên timKiem.chuoi: ${db.sanphams.countDocuments({ deletedAt: null, $text: { $search: '"dau"' } })} kết quả`);

// 3) Tiền tố khi đang gõ: regex neo ^ trên mảng từ (multikey) dùng được khoảng index [ "astr", "asts" ).
print('\n3) Gõ dở "astr":');
const loc3 = { deletedAt: null, 'timKiem.tu': { $regex: '^astr' } };
db.sanphams.find(loc3, { tenSanPham: 1 }).limit(5).forEach((d) => print(`   ${d.tenSanPham}`));
print(`   → ${docDung(db.sanphams.find(loc3))}`);

// 4) Gõ sai: so tập bộ ba ký tự bằng $setIntersection, điểm = phần trùng / số bộ ba của từ khoá.
const boBa = (w) => (w.length < 3 ? [w] : [...new Set([`^${w.slice(0, 2)}`, ...Array.from({ length: w.length - 2 }, (_, i) => w.slice(i, i + 3))])]);
const q = [...new Set(['yonx', 'astrok'].flatMap(boBa))];
print(`\n4) Gõ sai "yonx astrok" → bộ ba: ${q.join(' ')}`);
db.sanphams.aggregate([
  { $match: { deletedAt: null, 'timKiem.baKyTu': { $in: q } } },
  { $set: { diem: { $divide: [{ $size: { $setIntersection: ['$timKiem.baKyTu', q] } }, q.length] } } },
  { $match: { diem: { $gte: 0.4 } } },
  { $sort: { diem: -1 } }, { $limit: 5 }, { $project: { _id: 0, tenSanPham: 1, diem: 1 } },
]).forEach((d) => print(`   ${d.diem.toFixed(2)}  ${d.tenSanPham}`));
