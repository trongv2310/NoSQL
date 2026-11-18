// 13. Wildcard index (thongSo.$**) so với Attribute pattern (thuocTinh [{k, v}] + một index kép) — vì sao dự án KHÔNG dùng wildcard.
// Chỉ đọc chitietsanphams thật; index wildcard được tạo trên một collection TẠM (thu_wildcard) rồi xoá, không đụng dữ liệu thật.
// Chạy: mongosh "<chuỗi kết nối>" db/truy-van-mau/13-wildcard-vs-attribute.mongodb.js

const tam = db.thu_wildcard;
tam.drop();
tam.insertMany(db.chitietsanphams.find({ thongSo: { $ne: null } }, { thongSo: 1, thuocTinh: 1 }).toArray());
tam.createIndex({ 'thongSo.$**': 1 }, { name: 'wildcard_thong_so' });
tam.createIndex({ 'thuocTinh.k': 1, 'thuocTinh.v': 1 }, { name: 'thuoc_tinh' });
print(`Collection tạm: ${tam.countDocuments()} phiên bản có thông số.\n`);

const plan = (c) => {
  const e = c.explain('executionStats');
  const ten = (p) => [p?.indexName, ...(p?.inputStage ? ten(p.inputStage) : []), ...(p?.inputStages ?? []).flatMap(ten)].filter(Boolean);
  return `index ${ten(e.queryPlanner.winningPlan).join(', ') || 'không (COLLSCAN)'}, đọc ${e.executionStats.totalKeysExamined} khoá / ${e.executionStats.totalDocsExamined} document, ra ${e.executionStats.nReturned}`;
};

// 1) Cả hai đều dùng index. Nhưng chuỗi ghi tay có nhiều cách viết ("Cứng", "Rất cứng", "Hơi cứng"...): so bằng chuỗi bỏ sót,
//    còn thuocTinh.doCungBac đã quy về bậc 0..3 nên "cứng trở lên" là một điều kiện khoảng.
const cachViet = tam.distinct('thongSo.doCung');
print(`1) Độ cứng — các cách viết đang có: ${cachViet.map((x) => `"${x}"`).join(', ')}`);
print(`   wildcard  = "Cứng"      : ${plan(tam.find({ 'thongSo.doCung': 'Cứng' }))}`);
print(`   attribute doCungBac ≥ 2 : ${plan(tam.find({ thuocTinh: { $elemMatch: { k: 'doCungBac', v: { $gte: 2 } } } }))}`);

// 2) Khoảng số: thongSo lưu CHUỖI ("21-29 lbs", "4U (80-84g)") nên wildcard không so sánh số được; thuocTinh đã tách thành số.
print('\n2) Căng được tới ít nhất 28 lbs');
print(`   wildcard : không viết được: sucCang là chuỗi "${tam.findOne({ 'thongSo.sucCang': { $exists: true } })?.thongSo.sucCang}"; regex không so sánh số`);
print(`   attribute: ${plan(tam.find({ thuocTinh: { $elemMatch: { k: 'sucCangMaxLbs', v: { $gte: 28 } } } }))}`);

// 3) Hai điều kiện CÙNG LÚC: wildcard chỉ dùng được index cho MỘT trường rồi lọc phần còn lại (FETCH + filter).
print('\n3) Nặng đầu VÀ 3U');
print(`   wildcard : ${plan(tam.find({ 'thongSo.doCanBang': /nặng/i, 'thongSo.trongLuong': /^3U/ }))}`);
print(`   attribute: ${plan(tam.find({ $and: [{ thuocTinh: { $elemMatch: { k: 'canBangBac', v: { $gt: 0 } } } }, { thuocTinh: { $elemMatch: { k: 'trongLuongU', v: 3 } } }] }))}`);

// 4) Kích thước index.
const st = tam.aggregate([{ $collStats: { storageStats: {} } }]).toArray()[0].storageStats.indexSizes;
print(`\n4) Kích thước: wildcard ${st.wildcard_thong_so} byte, thuoc_tinh ${st.thuoc_tinh} byte`);

print('\nKết luận: thông số vợt có tập khoá CỐ ĐỊNH và cần so sánh SỐ (khoảng căng, bậc cân bằng), nên attribute pattern + một index kép');
print('hợp hơn. Wildcard index phù hợp khi khoá thật sự tự do (mỗi tài liệu một kiểu khoá) và chỉ cần so khớp bằng/chuỗi.');
tam.drop();
