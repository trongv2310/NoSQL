import assert from "node:assert/strict";
import { test } from "node:test";
import { nhanNguoiDanh, thamSoNhom } from "./danh-gia.ts";
import { NHAN_LOI_CHOI, NHAN_TRINH_DO } from "./ho-so-choi.ts";

test("nhãn chép lại khớp với lib/ho-so-choi.ts", () => {
  for (const [k, v] of Object.entries(NHAN_TRINH_DO)) assert.ok(nhanNguoiDanh({ trinhDo: k }) === v);
  for (const [k, v] of Object.entries(NHAN_LOI_CHOI)) assert.ok(nhanNguoiDanh({ loiChoi: k }) === v);
});

test("nhãn người viết chỉ ghép phần đã chia sẻ", () => {
  assert.equal(nhanNguoiDanh({ trinhDo: "deu", noiDung: ["don", "doi"], loiChoi: "toc" }), "Chơi đều · đánh đơn, đánh đôi · Tốc độ");
  assert.equal(nhanNguoiDanh({ trinhDo: "thi" }), "Thi đấu");
  assert.equal(nhanNguoiDanh({}), null);
  assert.equal(nhanNguoiDanh(null), null);
});

test("tham số nhóm: ưu tiên hồ sơ tài khoản, không có thì trình độ ở Quầy tư vấn", () => {
  assert.equal(thamSoNhom({ trinhDo: "deu", noiDung: ["doi"] }, "thi"), "?trinhDo=deu&noiDung=doi");
  assert.equal(thamSoNhom(null, "moi"), "?trinhDo=moi");
  assert.equal(thamSoNhom({ noiDung: ["doi"] }, "thi"), "?trinhDo=thi");
  assert.equal(thamSoNhom(null, null), "");
});
