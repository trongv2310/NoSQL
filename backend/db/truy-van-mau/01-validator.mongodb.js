// 01. Validator ($jsonSchema + $expr): MongoDB tự chặn dữ liệu sai, kể cả khi ghi thẳng bằng mongosh/Compass (không qua API).
// Chạy SAU `npm run db:setup`. Mọi lệnh ghi bên dưới đều cố tình sai, nên bị từ chối: CSDL không thay đổi.
// Chạy: mongosh mongodb://127.0.0.1:27017/shop_caulong db/truy-van-mau/01-validator.mongodb.js

// a) Xem validator đang gắn trên collection donhangs
const info = db.getCollectionInfos({ name: 'donhangs' })[0];
print('Validator donhangs: ' + (info.options.validator ? `có (${info.options.validationLevel}/${info.options.validationAction})` : 'CHƯA áp, hãy chạy npm run db:setup'));

// b) Tìm tài liệu đang vi phạm: $nor phủ định đúng biểu thức validator (cách db:setup kiểm trước khi áp)
for (const c of ['sanphams', 'chitietsanphams', 'donhangs', 'khachhangs', 'phanhois', 'taikhoans']) {
  const v = db.getCollectionInfos({ name: c })[0]?.options?.validator;
  if (v) print(`  ${c}: ${db.getCollection(c).countDocuments({ $nor: [v] })} tài liệu vi phạm`);
}

// c) Thử ghi dữ liệu sai. Hàm thu() in lý do MongoDB từ chối (errInfo.details) thay vì dừng script.
function thu(moTa, lenh) {
  try {
    lenh();
    print(`\n[KHÔNG BỊ CHẶN] ${moTa}: kiểm tra lại validator!`);
  } catch (e) {
    const chiTiet = e.errInfo?.details?.schemaRulesNotSatisfied ?? e.errInfo?.details ?? e.message;
    print(`\n[BỊ CHẶN] ${moTa}\n  ${e.codeName ?? e.code}: ${JSON.stringify(chiTiet).slice(0, 300)}`);
  }
}

const bienThe = db.chitietsanphams.findOne({}, { _id: 1, soLuongTon: 1 });
thu(`Trừ tồn kho xuống âm (biến thể ${bienThe._id}, đang còn ${bienThe.soLuongTon})`, () =>
  db.chitietsanphams.updateOne({ _id: bienThe._id }, { $inc: { soLuongTon: -(bienThe.soLuongTon + 1) } }),
);

thu('Đơn hàng có tổng tiền không khớp các dòng hàng ($expr)', () =>
  db.donhangs.insertOne({
    soDonHang: 999999, ngayDat: new Date(), trangThai: 'Đang xử lý',
    tongTien: 100, tongTienSauGiam: 100, tienGiam: 0,
    chiTiet: [{ soLuong: 2, donGia: 30, thanhTien: 60 }],
  }),
);

thu('Đơn hàng có trạng thái lạ', () =>
  db.donhangs.insertOne({ soDonHang: 999998, ngayDat: new Date(), trangThai: 'Đã giao xong', tongTien: 0, tongTienSauGiam: 0, tienGiam: 0, chiTiet: [] }),
);

thu('Tài khoản lưu mật khẩu dạng chữ thường (không băm bcrypt)', () =>
  db.taikhoans.insertOne({ tenDangNhap: 'thu_validator', matKhau: '123456', maQuyen: 3 }),
);

thu('Đánh giá 6 sao', () => db.phanhois.insertOne({ sanPham: new ObjectId(), danhGia: 6, noiDung: 'quá tuyệt' }));

print(`\nTồn kho biến thể ${bienThe._id} sau các lần thử: ${db.chitietsanphams.findOne({ _id: bienThe._id }).soLuongTon} (phải bằng ${bienThe.soLuongTon}).`);
