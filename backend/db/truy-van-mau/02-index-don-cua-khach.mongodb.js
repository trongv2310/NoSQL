// 02. Index kép cho "Đơn của tôi" (slide 90, 110–116): so ba kế hoạch thực thi bằng explain("executionStats").
//   Truy vấn thật trong DonHangController: find({ khachHang }).sort({ ngayDat: -1, soDonHang: -1 })
//   (1) không index      → COLLSCAN đọc cả collection rồi SORT trong bộ nhớ
//   (2) index đơn khachHang → IXSCAN nhưng vẫn phải SORT trong bộ nhớ
//   (3) index kép don_cua_khach {khachHang:1, ngayDat:-1, soDonHang:-1} → IXSCAN đã đúng thứ tự, KHÔNG còn SORT
// Script tạo tạm index đơn để so (nếu chưa có) và xoá lại sau khi đo. Chạy SAU `npm run db:setup`.
// Chạy: mongosh mongodb://127.0.0.1:27017/shop_caulong db/truy-van-mau/02-index-don-cua-khach.mongodb.js

const top = db.donhangs.aggregate([{ $group: { _id: '$khachHang', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 }]).toArray()[0];
print(`Khách có nhiều đơn nhất: ${top._id} (${top.n} đơn / ${db.donhangs.estimatedDocumentCount()} đơn)\n`);

const coIndexDon = db.donhangs.getIndexes().some((i) => i.name === 'khachHang_1');
if (!coIndexDon) db.donhangs.createIndex({ khachHang: 1 }, { name: 'khachHang_1' });

/** Gom tên các stage trong kế hoạch thắng (đọc được cả dạng cổ điển lẫn dạng SBE của MongoDB 7+). */
function cacStage(plan) {
  const ra = [];
  (function di(n) {
    if (!n || typeof n !== 'object') return;
    if (typeof n.stage === 'string') ra.push(n.stage + (n.indexName ? `(${n.indexName})` : ''));
    for (const k of ['inputStage', 'queryPlan']) di(n[k]);
    for (const c of n.inputStages ?? []) di(c);
  })(plan);
  return ra;
}

function do_(ten, goiY) {
  const e = db.donhangs.find({ khachHang: top._id }).sort({ ngayDat: -1, soDonHang: -1 }).hint(goiY).explain('executionStats');
  const st = cacStage(e.queryPlanner.winningPlan);
  const s = e.executionStats;
  print(`${ten}`);
  print(`  stage: ${st.join(' ← ')}`);
  print(`  nReturned=${s.nReturned}  totalKeysExamined=${s.totalKeysExamined}  totalDocsExamined=${s.totalDocsExamined}  SORT trong bộ nhớ: ${st.some((x) => x.startsWith('SORT')) ? 'CÓ' : 'không'}`);
}

do_('(1) Không dùng index ($natural)', { $natural: 1 });
do_('(2) Index đơn khachHang_1', 'khachHang_1');
do_('(3) Index kép don_cua_khach', 'don_cua_khach');

if (!coIndexDon) db.donhangs.dropIndex('khachHang_1');
print('\nGhi chú: với vài chục đơn, thời gian chạy gần như bằng nhau; điều cần nhìn là số tài liệu phải đọc và việc có/không có bước SORT.');
