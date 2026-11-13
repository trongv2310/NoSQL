// So sánh 2–3 vợt: URL, ID/biến thể sai, thêm/bỏ/thay, lời đối chiếu từ chênh lệch dữ liệu thật. Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { boKhoiSoSanh, docUrlSoSanh, doiChieu, duongDanSoSanh, soMm, soU, taoQuerySoSanh, thayTrongSoSanh, themVaoSoSanh } from "./so-sanh.ts";

const A = "6ae71c0ce9fc9d4b5a69ff01", B = "6ae71c0ce9fc9d4b5a69ff02", C = "6ae71c0ce9fc9d4b5a69ff03", D = "6ae71c0ce9fc9d4b5a69ff04";
const bA = "6ae71c0ce9fc9d4b5a6a0a1f", bB = "6ae71c0ce9fc9d4b5a6a0b2f";
const q = (s) => new URLSearchParams(s);

test("đọc URL: ID sản phẩm + biến thể tương ứng, khe trống được nén, khứ hồi ổn định", () => {
  const r = docUrlSoSanh(q(`v1=${A}&b1=${bA}&v3=${C}&v2=${B}&b2=${bB}`));
  assert.deepEqual(r.muc, [{ sanPhamId: A, bienTheId: bA }, { sanPhamId: B, bienTheId: bB }, { sanPhamId: C, bienTheId: null }]);
  assert.deepEqual(r.loi, []);
  assert.equal(taoQuerySoSanh(r.muc), `v1=${A}&b1=${bA}&v2=${B}&b2=${bB}&v3=${C}`);
  assert.deepEqual(docUrlSoSanh(q(taoQuerySoSanh(r.muc))).muc, r.muc);
  assert.equal(duongDanSoSanh([]), "/so-sanh");
});

test("ID sai/trùng/biến thể sai/quá ba/b lẻ được báo, không làm hỏng phần còn lại", () => {
  const r = docUrlSoSanh(q(`v1=${A}&v2=khong-phai-id&v3=${A}&b3=${bA}&v4=${B}&b4=sai&v5=${C}&v6=${D}`));
  assert.deepEqual(r.muc.map((m) => m.sanPhamId), [A, B, C]);
  assert.deepEqual(r.loi.map((l) => `${l.khoa}:${l.loai}`), ["v2:id-sai", "v3:trung", "b4:bien-the-sai", "v6:vuot-ba"]);
  assert.equal(r.muc[1].bienTheId, null);
  assert.equal(docUrlSoSanh(q(`b1=${bA}`)).loi[0].loai, "thieu-id");
  assert.equal(docUrlSoSanh(q("")).muc.length, 0);
});

test("thêm: không trùng, tối đa ba, thêm lại chỉ cập nhật phiên bản", () => {
  let ds = [];
  ds = themVaoSoSanh(ds, { sanPhamId: A, bienTheId: null }).muc;
  ds = themVaoSoSanh(ds, { sanPhamId: B, bienTheId: bB }).muc;
  const lai = themVaoSoSanh(ds, { sanPhamId: A, bienTheId: bA });
  assert.deepEqual(lai.muc, [{ sanPhamId: A, bienTheId: bA }, { sanPhamId: B, bienTheId: bB }]);
  ds = themVaoSoSanh(lai.muc, { sanPhamId: C, bienTheId: null }).muc;
  const day = themVaoSoSanh(ds, { sanPhamId: D, bienTheId: null });
  assert.deepEqual(day, { ok: false, lyDo: "day", muc: ds });
  assert.equal(themVaoSoSanh(ds, { sanPhamId: "xx", bienTheId: null }).ok, false);
});

test("bỏ và thay vợt (không tạo trùng)", () => {
  const ds = [{ sanPhamId: A, bienTheId: null }, { sanPhamId: B, bienTheId: null }];
  assert.deepEqual(boKhoiSoSanh(ds, A).map((m) => m.sanPhamId), [B]);
  assert.deepEqual(thayTrongSoSanh(ds, 0, { sanPhamId: C, bienTheId: bA }).map((m) => m.sanPhamId), [C, B]);
  assert.deepEqual(thayTrongSoSanh(ds, 0, { sanPhamId: B, bienTheId: null }), ds);
  assert.deepEqual(thayTrongSoSanh(ds, 5, { sanPhamId: C, bienTheId: null }), ds);
});

test("trích số mm và số U từ chữ ghi trong kho", () => {
  assert.equal(soMm("675mm"), 675);
  assert.equal(soMm("không rõ"), null);
  assert.equal(soU("4U (80-84g)"), 4);
  assert.equal(soU(undefined), null);
});

const h = (o) => ({ ten: "x", gia: 4_000_000, ton: 5, canBang: { bac: 0, chu: "Cân bằng" }, trongLuong: { so: 4, chu: "4U (80-84g)" }, doCung: { bac: 1, chu: "Trung bình" }, chieuDaiMm: 675, cangToiDa: { giaTri: 28, donVi: "lbs" }, tuyPhienBan: [], ...o });

test("đối chiếu: nói chênh lệch thật, hướng đúng, không kết luận cây nào hay hơn", () => {
  const dong = doiChieu([
    h({ canBang: { bac: 2, chu: "Nặng đầu" }, trongLuong: { so: 3, chu: "3U (85-89g)" }, gia: 4_500_000 }),
    h({ canBang: { bac: -1, chu: "Nhẹ đầu" }, trongLuong: { so: 4, chu: "4U (80-84g)" }, gia: 3_000_000 }),
  ]);
  const t = dong.join("\n");
  assert.match(t, /Điểm cân bằng: Vợt 1 nặng đầu hơn \(Nặng đầu\); Vợt 2 nhẹ đầu hơn \(Nhẹ đầu\)/);
  assert.match(t, /Trọng lượng: Vợt 2 nhẹ hơn \(số U lớn hơn\) \(4U[^)]*\)[^;]*; Vợt 1 nặng hơn \(số U nhỏ hơn\) \(3U/);
  assert.match(t, /Giá: Vợt 1 đắt hơn \(4\.500\.000 đ\); Vợt 2 rẻ hơn \(3\.000\.000 đ\)/);
  assert.match(t, /Chiều dài: giống nhau \(675mm\)/);
  assert.doesNotMatch(t, /tốt hơn|hay hơn|nên mua|thắng|mạnh hơn|%|nhanh hơn/i);
});

test("đối chiếu: thiếu dữ liệu, khác đơn vị, hết hàng và phiên bản khác nhau được nói rõ", () => {
  const t = doiChieu([
    h({ doCung: null, cangToiDa: { giaTri: 28, donVi: "lbs" }, ton: 0 }),
    h({ cangToiDa: { giaTri: 13, donVi: "kg" }, tuyPhienBan: ["trọng lượng"] }),
  ]).join("\n");
  assert.match(t, /Độ cứng thân: chưa có thông tin của Vợt 1/);
  assert.match(t, /đơn vị khác nhau nên chưa đối chiếu/);
  assert.match(t, /Vợt 1 hiện hết hàng/);
  assert.match(t, /Vợt 2: trọng lượng thay đổi theo phiên bản/);
  assert.deepEqual(doiChieu([h({})]), []);
});
