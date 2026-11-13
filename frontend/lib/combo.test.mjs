// Thêm bộ vợt + quấn cán: bấm đúp, lỗi một phần, thử lại chỉ món thiếu, lỗi mạng "chưa rõ". Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { taoBoCombo } from "./combo.ts";

const MON = [{ khoa: "vot", nhan: "Vợt" }, { khoa: "quan", nhan: "Quấn cán" }];
const trangThai = (b) => Object.fromEntries(b.doc().mon.map((m) => [m.khoa, m.trangThai]));
const cho = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("thêm đủ hai món → trọn bộ, mỗi món đúng một lần", async () => {
  const goi = [];
  const b = taoBoCombo(MON, async (k) => { goi.push(k); return { ok: true }; });
  await b.chay();
  assert.deepEqual(goi, ["vot", "quan"]);
  assert.equal(b.doc().tongKet, "tron-bo");
});

test("bấm đúp khi đang chạy chỉ chạy một lần (không thêm trùng)", async () => {
  const goi = [];
  const b = taoBoCombo(MON, async (k) => { goi.push(k); await cho(); return { ok: true }; });
  const p1 = b.chay(), p2 = b.chay();
  assert.equal(p1, p2);
  assert.equal(b.doc().dangChay, true);
  assert.equal(b.doc().tongKet, "dang-chay");
  await Promise.all([p1, p2]);
  await b.chay(); // bấm lại sau khi xong: các món đã xong không thêm nữa
  assert.deepEqual(goi, ["vot", "quan"]);
});

test("một món lỗi: KHÔNG báo trọn bộ, món kia vẫn được thêm, thử lại chỉ món thiếu", async () => {
  const goi = [];
  let lan = 0;
  const b = taoBoCombo(MON, async (k) => { goi.push(k); if (k === "quan" && ++lan === 1) return { ok: false, thongBao: "Hết hàng" }; return { ok: true }; });
  await b.chay();
  assert.deepEqual(trangThai(b), { vot: "xong", quan: "loi" });
  assert.equal(b.doc().tongKet, "thieu");
  assert.equal(b.doc().mon[1].thongBao, "Hết hàng");
  await b.chay();
  assert.deepEqual(goi, ["vot", "quan", "quan"], "vợt đã vào giỏ không bị thêm lại");
  assert.equal(b.doc().tongKet, "tron-bo");
});

test("món đầu lỗi, món sau thành công; thử lại chỉ thêm món đầu", async () => {
  const goi = [];
  let lan = 0;
  const b = taoBoCombo(MON, async (k) => { goi.push(k); if (k === "vot" && ++lan === 1) return { ok: false }; return { ok: true }; });
  await b.chay();
  assert.deepEqual(trangThai(b), { vot: "loi", quan: "xong" });
  await b.chay();
  assert.deepEqual(goi, ["vot", "quan", "vot"]);
});

test("lỗi mạng (không biết giỏ đã nhận chưa) → 'chưa rõ', không tự thử lại cho tới khi người dùng xác nhận", async () => {
  const goi = [];
  const b = taoBoCombo(MON, async (k) => { goi.push(k); if (k === "quan") throw new Error("mạng đứt"); return { ok: true }; });
  await b.chay();
  assert.deepEqual(trangThai(b), { vot: "xong", quan: "chua-ro" });
  assert.equal(b.doc().tongKet, "thieu");
  await b.chay(); // chưa xác nhận: không thêm lại
  assert.deepEqual(goi, ["vot", "quan"]);
  b.xacNhanThuLai("quan");
  await b.chay();
  assert.deepEqual(goi, ["vot", "quan", "quan"]);
});

test("đổi vợt/biến thể: đặt lại bộ, bỏ trạng thái cũ; không đặt lại khi đang chạy", async () => {
  const b = taoBoCombo(MON, async () => { await cho(); return { ok: true }; });
  const p = b.chay();
  b.datLai([{ khoa: "vot2", nhan: "Vợt khác" }]);
  assert.equal(b.doc().mon.length, 2, "đang chạy thì không đổi");
  await p;
  b.datLai([{ khoa: "vot2", nhan: "Vợt khác" }]);
  assert.deepEqual(b.doc().mon.map((m) => [m.khoa, m.trangThai]), [["vot2", "cho"]]);
  assert.equal(b.doc().tongKet, "chua-chay");
});

/* ───── M3-QA1-02 / H1: ý định thêm combo thuộc về MỘT danh tính; đổi danh tính hoặc gỡ component thì món còn lại không được gửi ───── */
test("danh tính đổi SAU món đầu (đã vào giỏ cũ): món sau KHÔNG gửi, món đầu vẫn 'xong', tổng kết gián đoạn chứ không trọn bộ", async () => {
  let nguoi = "A";
  const goi = [];
  const b = taoBoCombo(MON, async (k) => { goi.push(`${k}@${nguoi}`); if (k === "vot") nguoi = "B"; return { ok: true }; }, undefined, () => nguoi === "A");
  await b.chay();
  assert.deepEqual(goi, ["vot@A"]); // quấn cán không bao giờ được gửi cho B
  assert.deepEqual(trangThai(b), { vot: "xong", quan: "bo-qua" });
  assert.equal(b.doc().tongKet, "gian-doan");
  await b.chay(); // bấm lại trên bộ đã gián đoạn: vẫn không gửi gì
  assert.deepEqual(goi, ["vot@A"]);
});

test("danh tính đổi ngay sau MÓN CUỐI: không được báo trọn bộ", async () => {
  let nguoi = "A";
  const goi = [];
  const b = taoBoCombo(MON, async (k) => { goi.push(k); if (k === "quan") nguoi = null; return { ok: true }; }, undefined, () => nguoi === "A");
  await b.chay();
  assert.deepEqual(goi, ["vot", "quan"]);
  assert.equal(b.doc().tongKet, "gian-doan");
});

test("máy chủ từ chối món 2 vì phiên đã đổi (cookie đổi mà giao diện chưa biết): dừng, không thử lại, không 'thieu' thường", async () => {
  const goi = [];
  const b = taoBoCombo(MON, async (k) => {
    goi.push(k);
    return k === "vot" ? { ok: true } : { ok: false, doiTaiKhoan: true, thongBao: "Phiên đã đổi" };
  });
  await b.chay();
  assert.deepEqual(goi, ["vot", "quan"]);
  assert.deepEqual(trangThai(b), { vot: "xong", quan: "bo-qua" });
  assert.equal(b.doc().tongKet, "gian-doan");
  await b.chay();
  assert.deepEqual(goi, ["vot", "quan"]); // không gửi lại
});

test("huy() giữa lúc phản hồi món đầu còn treo (gỡ component/đổi danh tính): món 2 không bao giờ được gửi", async () => {
  const goi = [];
  let thaPhanHoi;
  const treo = new Promise((r) => { thaPhanHoi = r; });
  const b = taoBoCombo(MON, async (k) => { goi.push(k); if (k === "vot") await treo; return { ok: true }; });
  const p = b.chay();
  await cho();
  b.huy(); // component bị gỡ trong lúc phản hồi đầu chưa về
  thaPhanHoi();
  await p;
  assert.deepEqual(goi, ["vot"]);
  assert.deepEqual(trangThai(b), { vot: "xong", quan: "bo-qua" });
  assert.equal(b.doc().tongKet, "gian-doan");
});

test("món đầu bị máy chủ từ chối vì phiên đổi: món 2 không được gửi và không có món nào 'xong'", async () => {
  const goi = [];
  const b = taoBoCombo(MON, async (k) => { goi.push(k); return { ok: false, doiTaiKhoan: true }; });
  await b.chay();
  assert.deepEqual(goi, ["vot"]);
  assert.deepEqual(trangThai(b), { vot: "bo-qua", quan: "bo-qua" });
  assert.equal(b.doc().tongKet, "gian-doan");
});

test("hồi quy cùng danh tính: bấm đúp, lỗi một phần, thử lại chỉ món thiếu và 'chưa rõ' vẫn đúng khi có hàng rào", async () => {
  const nguoi = "A";
  const goi = [];
  let quanLoi = true;
  const b = taoBoCombo(MON, async (k) => { goi.push(k); await cho(2); return k === "quan" && quanLoi ? { ok: false, thongBao: "hết hàng" } : { ok: true }; }, undefined, () => nguoi === "A");
  const p1 = b.chay(), p2 = b.chay();
  assert.equal(p1, p2);
  await p1;
  assert.equal(b.doc().tongKet, "thieu");
  quanLoi = false;
  await b.chay();
  assert.deepEqual(goi, ["vot", "quan", "quan"]); // vợt không bị thêm lần hai
  assert.equal(b.doc().tongKet, "tron-bo");
});
