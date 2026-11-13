// Chạy: npm test. Luật thuần của hồ sơ người chơi: URL > đã nhớ theo từng trường, giá trị lạ, di chuyển dữ liệu cũ, ghi lại URL.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  docDaNho, docTuQuery, ghiVaoQuery, giongNhau, hoSoTrong, hopNhat, lamSachHoSo, nhanHoSo, HO_SO_TRONG,
} from "./ho-so-choi.ts";

const q = (s) => new URLSearchParams(s);

test("docTuQuery chỉ nhận giá trị hợp lệ; giá trị lạ hoặc thiếu bị bỏ", () => {
  assert.deepEqual(docTuQuery(q("loi_choi=cong&trinh_do=thi&ngan_sach=cao")), { lc: "cong", kn: "thi", ns: "cao" });
  assert.deepEqual(docTuQuery(q("loi_choi=nhanh&trinh_do=&ngan_sach=re")), { ns: "re" });
  assert.deepEqual(docTuQuery(q("loi_choi=CONG")), {}, "phân biệt hoa thường: giá trị lạ bị bỏ");
  assert.deepEqual(docTuQuery(q("")), {});
});

test("URL ghi đè hồ sơ đã nhớ THEO TỪNG TRƯỜNG; trường không có trong URL giữ giá trị đã nhớ", () => {
  const luu = { lc: "toc", kn: "moi", ns: "vua" };
  assert.deepEqual(hopNhat({ lc: "cong" }, luu), { lc: "cong", kn: "moi", ns: "vua" });
  assert.deepEqual(hopNhat({}, luu), luu);
  assert.deepEqual(hopNhat(docTuQuery(q("loi_choi=khong-hop-le")), luu), luu, "giá trị URL không hợp lệ không xóa hồ sơ đã nhớ");
  assert.deepEqual(hopNhat({ lc: "toan", kn: "thi", ns: "re" }, HO_SO_TRONG), { lc: "toan", kn: "thi", ns: "re" });
});

test("lamSachHoSo bỏ giá trị lạ và kiểu sai", () => {
  assert.deepEqual(lamSachHoSo({ lc: "cong", kn: 5, ns: "x", extra: 1 }), { lc: "cong", kn: null, ns: null });
  assert.deepEqual(lamSachHoSo(null), HO_SO_TRONG);
  assert.deepEqual(lamSachHoSo("chuỗi"), HO_SO_TRONG);
});

test("docDaNho: hồ sơ mới thắng; thiếu thì chuyển từ khóa sessionStorage cũ; JSON hỏng không gây lỗi", () => {
  const moi = JSON.stringify({ lc: "toc", kn: "deu", ns: null });
  const cu = JSON.stringify({ lc: "cong", ns: "vua" });
  assert.deepEqual(docDaNho(moi, cu), { lc: "toc", kn: "deu", ns: null });
  assert.deepEqual(docDaNho(null, cu), { lc: "cong", kn: null, ns: "vua" }, "chuyển từ khóa cũ");
  assert.deepEqual(docDaNho("{hỏng", "cũng hỏng"), HO_SO_TRONG);
  assert.deepEqual(docDaNho(JSON.stringify({ lc: "bậy" }), cu), { lc: "cong", kn: null, ns: "vua" }, "hồ sơ mới rỗng/không hợp lệ thì dùng bản cũ");
  assert.ok(hoSoTrong(docDaNho(null, null)));
});

test("ghiVaoQuery đặt/bỏ đúng 3 tham số, giữ nguyên mọi tham số khác, không thêm page", () => {
  assert.equal(ghiVaoQuery("?loai=Vot&sap_xep=gia_tang", { lc: "cong", kn: null, ns: "vua" }), "loai=Vot&sap_xep=gia_tang&loi_choi=cong&ngan_sach=vua");
  assert.equal(ghiVaoQuery("loai=Vot&loi_choi=toc&trinh_do=moi&page=3", { lc: null, kn: null, ns: null }), "loai=Vot&page=3", "xóa hồ sơ chỉ bỏ 3 tham số hồ sơ");
  assert.equal(ghiVaoQuery("", { lc: "toan", kn: "thi", ns: "cao" }), "loi_choi=toan&trinh_do=thi&ngan_sach=cao");
  // vòng khứ hồi: URL → hồ sơ → URL giữ nguyên nội dung
  const ban = "loi_choi=toc&hang=Yonex";
  assert.deepEqual(docTuQuery(q(ghiVaoQuery(ban, hopNhat(docTuQuery(q(ban)), HO_SO_TRONG)))), { lc: "toc" });
});

test("nhanHoSo và giongNhau", () => {
  assert.deepEqual(nhanHoSo({ lc: "cong", kn: "deu", ns: "re" }), ["Uy lực", "Chơi đều", "Dưới 3,5 triệu"]);
  assert.deepEqual(nhanHoSo(HO_SO_TRONG), []);
  assert.ok(giongNhau({ lc: "cong", kn: null, ns: null }, { lc: "cong", kn: null, ns: null }));
  assert.ok(!giongNhau({ lc: "cong", kn: null, ns: null }, { lc: "toc", kn: null, ns: null }));
});
