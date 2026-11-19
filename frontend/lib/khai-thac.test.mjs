// Combo bán chạy (Top-K, admin): kiểm đầu vào số combo (K) / số tháng và định dạng thời gian. Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { K_TOI_DA, THANG_TOI_DA, dinhDangThoiGian, kiemTraThamSo } from "./khai-thac.ts";

test("hợp lệ: biên 1 và 50 / 1 và 12, có khoảng trắng hai đầu, số 0 đứng đầu", () => {
  assert.deepEqual(kiemTraThamSo("5", "3"), { ok: true, k: 5, soThang: 3 });
  assert.deepEqual(kiemTraThamSo("1", "1"), { ok: true, k: 1, soThang: 1 });
  assert.deepEqual(kiemTraThamSo("50", "12"), { ok: true, k: 50, soThang: 12 });
  assert.deepEqual(kiemTraThamSo(" 10 ", " 6 "), { ok: true, k: 10, soThang: 6 });
  assert.deepEqual(kiemTraThamSo("007", "03"), { ok: true, k: 7, soThang: 3 });
  assert.equal(K_TOI_DA, 50);
  assert.equal(THANG_TOI_DA, 12);
});

test("K sai: 0, 51, âm, thập phân, ký hiệu khoa học, rỗng, chữ, quá lớn", () => {
  for (const k of ["0", "51", "-1", "5.5", "1e1", "", "  ", "abc", "5a", "1 0", "99999999999999999999", "+5"]) {
    const r = kiemTraThamSo(k, "3");
    assert.equal(r.ok, false, JSON.stringify(k));
    assert.match(r.loiK, /từ 1 đến 50/, JSON.stringify(k));
    assert.equal(r.loiThang, undefined, "số tháng hợp lệ thì không báo lỗi tháng");
  }
});

test("số tháng sai: 0, 13, âm, thập phân, rỗng", () => {
  for (const t of ["0", "13", "-3", "2.5", "", "x"]) {
    const r = kiemTraThamSo("5", t);
    assert.equal(r.ok, false, JSON.stringify(t));
    assert.match(r.loiThang, /từ 1 đến 12/, JSON.stringify(t));
    assert.equal(r.loiK, undefined);
  }
});

test("cả hai sai: báo cả hai lỗi", () => {
  const r = kiemTraThamSo("0", "99");
  assert.equal(r.ok, false);
  assert.ok(r.loiK && r.loiThang);
});

test("định dạng thời gian: mili giây, giây, giá trị lạ", () => {
  assert.equal(dinhDangThoiGian(0), "0 ms");
  assert.equal(dinhDangThoiGian(12.4), "12 ms");
  assert.equal(dinhDangThoiGian(999), "999 ms");
  assert.equal(dinhDangThoiGian(1000), "1,00 giây");
  assert.equal(dinhDangThoiGian(2345), "2,35 giây");
  for (const x of [-1, NaN, Infinity, null, undefined, "5"]) assert.equal(dinhDangThoiGian(x), "—", String(x));
});
