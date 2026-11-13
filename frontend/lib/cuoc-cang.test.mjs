// Parse sức căng, đổi đơn vị, biên/bước của Trạm căng cước. Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { LBS_MOI_KG, buocCang, canhBaoCang, chuanHoaCang, docSucCang, doiDonVi, hienThiCang, nhapCang } from "./cuoc-cang.ts";

const ok = (s) => { const r = docSucCang(s); assert.equal(r.ok, true, `phải đọc được: ${s}`); return r.khoang; };

test("đọc đúng các dạng ghi sức căng có trong kho và dạng phổ biến khác", () => {
  assert.deepEqual(ok("20-28 lbs"), { min: 20, max: 28, donVi: "lbs", nguon: "20-28 lbs" });
  assert.deepEqual(ok("9 – 13 kg"), { min: 9, max: 13, donVi: "kg", nguon: "9 – 13 kg" });
  assert.equal(ok("10,5-12kg").min, 10.5);
  assert.equal(ok("19~27 LBS").donVi, "lbs");
});

test("chỉ có mức tối đa thì KHÔNG tự đặt cận dưới", () => {
  assert.deepEqual(ok("tối đa 28 lbs"), { min: null, max: 28, donVi: "lbs", nguon: "tối đa 28 lbs" });
  assert.equal(ok("≤ 13kg").min, null);
  assert.equal(ok("11,5 kg").min, null); // số trần = mức tối đa, không có cận dưới
});

test("thiếu đơn vị, khoảng đảo ngược, rỗng, chữ lạ → không dựng thanh trượt", () => {
  assert.deepEqual(docSucCang("20-28"), { ok: false, lyDo: "thieu-don-vi" });
  assert.deepEqual(docSucCang("28-20 lbs"), { ok: false, lyDo: "khoang-sai" });
  assert.deepEqual(docSucCang("0 lbs"), { ok: false, lyDo: "khoang-sai" });
  assert.deepEqual(docSucCang(""), { ok: false, lyDo: "trong" });
  assert.deepEqual(docSucCang(null), { ok: false, lyDo: "trong" });
  assert.deepEqual(docSucCang("căng thoải mái"), { ok: false, lyDo: "khong-doc-duoc" });
});

test("đổi đơn vị dùng đúng 1 kg = 2,20462262 lbs và khứ hồi không trôi số", () => {
  assert.equal(LBS_MOI_KG, 2.20462262);
  assert.ok(Math.abs(doiDonVi(10, "kg", "lbs") - 22.0462262) < 1e-9);
  assert.ok(Math.abs(doiDonVi(22.0462262, "lbs", "kg") - 10) < 1e-9);
  assert.equal(doiDonVi(5, "lbs", "lbs"), 5);
  const k = ok("20-28 lbs");
  assert.equal(hienThiCang(24, k, "kg"), 10.9); // 24 / 2.20462262 = 10.886…
  assert.equal(hienThiCang(24, k, "lbs"), 24);
});

test("chuẩn hóa kẹp trong [min,max], canh theo bước và không bao giờ vượt max", () => {
  const k = ok("20-28 lbs");
  assert.equal(chuanHoaCang(24.3, k), 24.5);
  assert.equal(chuanHoaCang(24.2, k), 24);
  assert.equal(chuanHoaCang(99, k), 28);
  assert.equal(chuanHoaCang(1, k), 20);
  assert.equal(chuanHoaCang(NaN, k), null);
  // max không nằm trên lưới bước (20, 20.5, …): 24.3 → không làm tròn lên vượt max
  const le = { min: 20, max: 24.3, donVi: "lbs", nguon: "x" };
  assert.equal(chuanHoaCang(24.3, le), 24);
  assert.ok(chuanHoaCang(30, le) <= 24.3);
});

test("nhập theo kg: đổi về lbs gốc, kẹp theo giới hạn nhà sản xuất", () => {
  const k = ok("20-28 lbs");
  assert.equal(nhapCang("10", "kg", k), 22); // 22.046 lbs → bước 0,5 → 22
  assert.equal(nhapCang("15", "kg", k), 28); // 33 lbs vượt max → kẹp 28
  assert.equal(nhapCang("5", "kg", k), 20); // 11 lbs dưới min → kẹp 20
  assert.equal(nhapCang("10,5", "kg", k), 23);
  assert.equal(nhapCang("abc", "kg", k), null);
  assert.equal(nhapCang("-3", "kg", k), null);
  assert.equal(nhapCang("22", "lbs", k), 22);
});

test("không có cận dưới thì chỉ chặn ở max và không tự đặt min", () => {
  const k = ok("tối đa 13 kg");
  assert.equal(buocCang(k.donVi), 0.1);
  assert.equal(chuanHoaCang(15, k), 13);
  assert.equal(chuanHoaCang(0.01, k), 0.1);
  assert.equal(canhBaoCang(13, k), "bang-toi-da");
  assert.equal(canhBaoCang(10, k), "chua-co-can-duoi");
});

test("cảnh báo chỉ theo giới hạn thực", () => {
  const k = ok("20-28 lbs");
  assert.equal(canhBaoCang(20, k), "sat-toi-thieu");
  assert.equal(canhBaoCang(28, k), "bang-toi-da");
  assert.equal(canhBaoCang(24, k), "trong-khoang");
});
