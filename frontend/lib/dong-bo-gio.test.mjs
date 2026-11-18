// Kiểm thử bộ máy đồng bộ giỏ khách khi tài khoản/cookie đổi giữa chừng (M1-R1-03). Chạy: npm test
// Dùng kho giỏ THẬT (gio-khach.ts) và một "máy chủ giả" giữ giỏ thật của từng tài khoản theo cookie tại thời điểm yêu cầu TỚI NƠI;
// các khẳng định nhìn vào giỏ của A/B và hàng đợi của A/B, không chỉ vào log.
import assert from "node:assert/strict";
import { test } from "node:test";

const V1 = "a".repeat(24), V2 = "b".repeat(24), V3 = "c".repeat(24);
let dem = 0;

function taoKho() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
}

async function khoiTao() {
  globalThis.window = { localStorage: taoKho(), addEventListener() {} };
  const kho = await import(`./gio-khach.ts?lan=${++dem}`);
  const { dongBoTaiKhoan } = await import(`./dong-bo-gio.ts?lan=${dem}`);
  return { kho, dongBoTaiKhoan };
}

/** Máy chủ giả: giỏ theo tài khoản, mã đã áp dụng theo (tài khoản, syncId); cookie quyết định tài khoản tại lúc yêu cầu tới nơi. */
function taoMayChu() {
  const may = {
    cookie: null, gui: [], giỏ: new Map(), daDung: new Set(), chan: null,
    cartCua(id) { return [...(may.giỏ.get(id) ?? new Map()).values()].reduce((t, n) => t + n, 0); },
    qty(id, v) { return may.giỏ.get(id)?.get(v) ?? 0; },
    async goi(req) {
      const idx = may.gui.push({ ...req }) - 1;
      if (may.chan) await may.chan(idx); // yêu cầu "đang trên đường": cookie có thể đổi trước khi tới nơi
      const chu = may.cookie; // tài khoản của phiên TẠI LÚC TỚI NƠI
      may.gui[idx].duoiCookie = chu;
      if (chu !== req.taiKhoanId) throw { status: 403, body: { maLoi: "sai_tai_khoan" } };
      const khoa = `${chu}:${req.syncId}`;
      const daApDungTruoc = may.daDung.has(khoa);
      if (!daApDungTruoc) {
        const g = may.giỏ.get(chu) ?? new Map();
        for (const d of req.dong) g.set(d.chiTietId, (g.get(d.chiTietId) ?? 0) + d.soLuong);
        may.giỏ.set(chu, g);
        may.daDung.add(khoa);
      }
      return { taiKhoanId: chu, cartCount: may.cartCua(chu), daApDungTruoc, ketQua: [] };
    },
  };
  return may;
}

const cong = () => { let mo; const p = new Promise((r) => { mo = r; }); return { p, mo }; };
const tongQueue = (kho, uid) => kho.banChupDangCho(uid).map((b) => b.dong.map((d) => `${d.id.slice(0, 1)}${d.sl}`).join("+"));
function xepHaiBanChup(kho, uid) {
  kho.themVaoGio(V1, 2); kho.chuyenSangCho(uid); // bản chụp 1 = 2×V1
  kho.themVaoGio(V2, 3); kho.chuyenSangCho(uid); // bản chụp 2 = 3×V2
}
const deps = (kho, may, uid, ext = {}) => ({
  layGio: kho.layGio, chuyenSangCho: kho.chuyenSangCho, banChupDangCho: kho.banChupDangCho, xoaBanChup: kho.xoaBanChup, doiTokenBanChup: kho.doiTokenBanChup,
  goi: (r) => may.goi(r), conDung: () => true, taiKhoanHienTai: async () => may.cookie, ...ext,
});
const voiHanChot = (p, ms = 3000) => Promise.race([p, new Promise((_, j) => setTimeout(() => j(new Error(`quá ${ms}ms`)), ms))]);

test("R1-03: A có 2 bản chụp, giao diện chuyển sang B giữa lúc bản 1 đang trên đường → bản 2 không được gửi, giỏ B trống, hàng đợi A còn bản 2", async () => {
  const { kho, dongBoTaiKhoan } = await khoiTao();
  const may = taoMayChu();
  may.cookie = "A";
  xepHaiBanChup(kho, "A");
  assert.deepEqual(tongQueue(kho, "A"), ["a2", "b3"]);
  let dungA = true;
  const cuaVao = cong();
  may.chan = async (i) => { if (i === 0) await cuaVao.p; }; // bản 1 "kẹt trên đường"
  const chay = dongBoTaiKhoan("A", deps(kho, may, "A", { conDung: () => dungA }));
  // Trong lúc chờ: đăng xuất A, đăng nhập B (giao diện VÀ cookie đều là B) rồi mới cho bản 1 tới nơi.
  dungA = false; may.cookie = "B";
  cuaVao.mo();
  const kq = await voiHanChot(chay);
  assert.equal(may.gui.length, 1, "bản 2 tuyệt đối không được gửi");
  assert.equal(may.gui[0].duoiCookie, "B", "bản 1 tới nơi khi cookie đã là B");
  assert.equal(kq.phienDoi, true);
  assert.equal(may.cartCua("B"), 0, "giỏ B không nhận gì của A");
  assert.equal(may.cartCua("A"), 0);
  assert.deepEqual(tongQueue(kho, "A"), ["a2", "b3"], "hàng đợi A còn nguyên cả hai bản");
  assert.deepEqual(kho.banChupDangCho("B"), []);
  // A đăng nhập lại: cả hai bản vào giỏ A đúng một lần.
  may.cookie = "A";
  const lai = await voiHanChot(dongBoTaiKhoan("A", deps(kho, may, "A")));
  assert.equal(lai.loi, null);
  assert.equal(may.qty("A", V1), 2);
  assert.equal(may.qty("A", V2), 3);
  assert.equal(may.cartCua("B"), 0);
  assert.deepEqual(kho.banChupDangCho("A"), []);
});

test("R1-03: bản 1 tới nơi khi cookie vẫn là A rồi mới đổi sang B → bản 1 vào giỏ A, bản 2 KHÔNG gửi, chỉ xóa bản 1 khỏi hàng đợi A", async () => {
  const { kho, dongBoTaiKhoan } = await khoiTao();
  const may = taoMayChu();
  may.cookie = "A";
  xepHaiBanChup(kho, "A");
  let dungA = true;
  const phanHoiTrenDuong = cong();
  let soLanGoi = 0;
  // Bản 1 được server nhận cho A, nhưng PHẢN HỒI bị giữ lại trên đường; trong lúc đó giao diện và cookie đổi sang B.
  const goi = async (r) => { const res = await may.goi(r); if (++soLanGoi === 1) await phanHoiTrenDuong.p; return res; };
  const chay = dongBoTaiKhoan("A", deps(kho, may, "A", { conDung: () => dungA, goi }));
  await new Promise((r) => setImmediate(r));
  assert.equal(may.gui.length, 1);
  dungA = false; may.cookie = "B";
  phanHoiTrenDuong.mo();
  const kq = await voiHanChot(chay);
  assert.equal(may.gui.length, 1);
  assert.equal(may.qty("A", V1), 2, "bản 1 thuộc A và đã được server nhận cho A");
  assert.equal(may.cartCua("B"), 0);
  assert.equal(kq.biHuy, true);
  assert.deepEqual(tongQueue(kho, "A"), ["b3"], "đúng bản 1 bị xóa, bản 2 còn");
});

test("R1-03: cookie đổi sang B nhưng giao diện vẫn là A (đổi ở thẻ khác) → server từ chối 403, hàng đợi A nguyên vẹn, giỏ A và B đều không đổi", async () => {
  const { kho, dongBoTaiKhoan } = await khoiTao();
  const may = taoMayChu();
  may.cookie = "B"; // phiên thực là B; giao diện vẫn tưởng là A (conDung luôn true)
  xepHaiBanChup(kho, "A");
  const kq = await voiHanChot(dongBoTaiKhoan("A", deps(kho, may, "A")));
  assert.equal(kq.phienDoi, true);
  assert.equal(may.gui.length, 1, "dừng ngay sau lần bị từ chối đầu tiên");
  assert.equal(may.cartCua("A"), 0);
  assert.equal(may.cartCua("B"), 0, "giỏ của A không rò vào B");
  assert.deepEqual(tongQueue(kho, "A"), ["a2", "b3"]);
});

test("R1-03: phản hồi không nêu đúng tài khoản thì KHÔNG xóa bản chụp (không tin phản hồi của người khác)", async () => {
  const { kho, dongBoTaiKhoan } = await khoiTao();
  const may = taoMayChu();
  may.cookie = "A";
  xepHaiBanChup(kho, "A");
  const kq = await voiHanChot(dongBoTaiKhoan("A", deps(kho, may, "A", { goi: async () => ({ taiKhoanId: "B", cartCount: 9, daApDungTruoc: false, ketQua: [] }) })));
  assert.equal(kq.phienDoi, true);
  assert.deepEqual(tongQueue(kho, "A"), ["a2", "b3"]);
});

test("R1-03: giỏ khách chỉ được chuyển cho A khi server xác nhận phiên là A; nếu phiên là B thì giỏ khách để nguyên", async () => {
  const { kho, dongBoTaiKhoan } = await khoiTao();
  const may = taoMayChu();
  may.cookie = "B";
  kho.themVaoGio(V3, 4); // khách chưa đăng nhập vừa thêm
  const kq = await voiHanChot(dongBoTaiKhoan("A", deps(kho, may, "A")));
  assert.equal(kq.phienDoi, true);
  assert.equal(may.gui.length, 0);
  assert.deepEqual(kho.banChupDangCho("A"), [], "không chuyển sang hàng đợi A");
  assert.equal(kho.soLuongTrongGio(kho.layGio(), V3), 4, "giỏ khách còn nguyên");
  // Chạy đúng cho B: giỏ khách thuộc B.
  const kqB = await voiHanChot(dongBoTaiKhoan("B", deps(kho, may, "B")));
  assert.equal(kqB.loi, null);
  assert.equal(may.qty("B", V3), 4);
  assert.equal(may.cartCua("A"), 0);
  assert.equal(kho.tongSoLuongGio(kho.layGio()), 0);
});

test("R1-03: mất tài khoản giữa lúc xác minh (conDung=false sau await) → không chuyển giỏ khách cho tài khoản cũ", async () => {
  const { kho, dongBoTaiKhoan } = await khoiTao();
  const may = taoMayChu();
  may.cookie = "A";
  kho.themVaoGio(V1, 1);
  let dung = true;
  const kq = await voiHanChot(dongBoTaiKhoan("A", deps(kho, may, "A", { conDung: () => dung, taiKhoanHienTai: async () => { dung = false; return "A"; } })));
  assert.equal(kq.biHuy, true);
  assert.deepEqual(kho.banChupDangCho("A"), []);
  assert.equal(kho.soLuongTrongGio(kho.layGio(), V1), 1);
});

test("lỗi mạng giữ nguyên hàng đợi; 409 đổi token; thành công xóa đúng từng bản chụp và báo số lượng mới", async () => {
  const { kho, dongBoTaiKhoan } = await khoiTao();
  const may = taoMayChu();
  may.cookie = "A";
  xepHaiBanChup(kho, "A");
  let lan = 0;
  const kq1 = await voiHanChot(dongBoTaiKhoan("A", deps(kho, may, "A", { goi: async (r) => { if (++lan === 2) throw new TypeError("Failed to fetch"); return may.goi(r); } })));
  assert.ok(kq1.loi instanceof TypeError);
  assert.deepEqual(tongQueue(kho, "A"), ["b3"], "bản 1 đã xong, bản 2 còn để thử lại");
  const tokenCu = kho.banChupDangCho("A")[0].token;
  const kq409 = await voiHanChot(dongBoTaiKhoan("A", deps(kho, may, "A", { goi: async () => { throw { status: 409, body: {} }; } })));
  assert.equal(kq409.loi.status, 409);
  assert.notEqual(kho.banChupDangCho("A")[0].token, tokenCu, "409 → đổi token");
  const kq3 = await voiHanChot(dongBoTaiKhoan("A", deps(kho, may, "A")));
  assert.equal(kq3.loi, null);
  assert.equal(kq3.soLuongMoi, 5);
  assert.deepEqual(kho.banChupDangCho("A"), []);
});
