// 00. Môi trường MongoDB đang chạy (chỉ đọc).
// Chạy: mongosh mongodb://127.0.0.1:27017/shop_caulong db/truy-van-mau/00-moi-truong.mongodb.js

const hello = db.adminCommand({ hello: 1 });
print(`MongoDB ${db.version()} | CSDL: ${db.getName()}`);
print(hello.setName ? `Replica set "${hello.setName}": có transaction.` : 'Standalone: CHƯA có transaction (xem db/README.md).');

print('\nSố tài liệu và validator của từng collection:');
const ds = db.getCollectionInfos({ type: 'collection' }).sort((a, b) => a.name.localeCompare(b.name));
for (const c of ds) {
  const coVal = c.options && c.options.validator ? `validator (${c.options.validationLevel}/${c.options.validationAction})` : '-';
  const soIndex = db.getCollection(c.name).getIndexes().length;
  print(`  ${c.name.padEnd(22)} ${String(db.getCollection(c.name).estimatedDocumentCount()).padStart(5)} tài liệu  ${String(soIndex).padStart(2)} index  ${coVal}`);
}
