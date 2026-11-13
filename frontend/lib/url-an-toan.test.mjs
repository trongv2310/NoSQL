// returnUrl an toàn (M5A-06): chỉ đường dẫn nội bộ; các dạng lách bộ lọc open-redirect bị từ chối. Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { returnUrlAnToan } from "./url-an-toan.ts";

const GACH_NGUOC = String.fromCharCode(92);

test("nhận đường dẫn nội bộ kèm query/hash", () => {
  assert.equal(returnUrlAnToan("/"), "/");
  assert.equal(returnUrlAnToan("/DonHang/Checkout"), "/DonHang/Checkout");
  assert.equal(returnUrlAnToan("/so-sanh?v1=a&v2=b#x"), "/so-sanh?v1=a&v2=b#x");
});

test("từ chối URL ngoài và mọi cách lách: //, slash+gạch ngược, ký tự điều khiển, scheme", () => {
  const xau = [
    "//evil.com", `/${GACH_NGUOC}evil.com/path`, `/${GACH_NGUOC}${GACH_NGUOC}evil.com`, `/a${GACH_NGUOC}b`, "/\t/evil.com", "/\n/evil.com", "/\u0000/x",
    "http://evil.com", "https://evil.com/x", "javascript:alert(1)", "evil.com", "",
  ];
  for (const u of xau) assert.equal(returnUrlAnToan(u), null, JSON.stringify(u));
  assert.equal(returnUrlAnToan(null), null);
  assert.equal(returnUrlAnToan(undefined), null);
});

test("dạng %5C còn mã hóa chỉ là một đoạn đường dẫn nội bộ, không đổi origin", () => {
  assert.equal(returnUrlAnToan("/%5Cevil.com"), "/%5Cevil.com");
});
