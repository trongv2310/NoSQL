// Chạy: npm test   (Node có sẵn `node:test` và tự bỏ kiểu TypeScript, không cần thêm thư viện)
import assert from "node:assert/strict";
import { test } from "node:test";

const A = "a".repeat(24);
const B = "b".repeat(24);
const C = "c".repeat(24);

/** localStorage giả; `hong` mô phỏng trình duyệt chặn lưu trữ (chế độ riêng tư). */
function taoKho({ hong = false } = {}) {
  const m = new Map();
  const loi = () => { throw new Error("bị chặn"); };
  return {
    m,
    getItem: (k) => (hong ? loi() : (m.has(k) ? m.get(k) : null)),
    setItem: (k, v) => (hong ? loi() : m.set(k, String(v))),
    removeItem: (k) => (hong ? loi() : m.delete(k)),
  };
}

let dem = 0;
/** Nạp một bản MỚI của module (mô phỏng mở lại trang) trên cùng một kho lưu trữ. */
async function napModule(kho) {
  globalThis.window = { localStorage: kho, addEventListener() {} };
  return import(`./gio-khach.ts?lan=${++dem}`);
}

test("lamSachDong bỏ dòng sai, gộp dòng trùng, chặn 100 và 50 dòng", async () => {
  const g = await napModule(taoKho());
  const kq = g.lamSachDong([
    { id: A, sl: 2, ts: 1 }, { id: A.toUpperCase(), sl: 3, ts: 5 }, { id: "xấu", sl: 1 }, { id: B, sl: 0 }, { id: B, sl: 1.5 },
    { id: C, sl: 500 }, null, "rác", { id: 123, sl: 1 },
  ]);
  assert.deepEqual(kq, [{ id: A, sl: 5, ts: 5 }, { id: C, sl: 100, ts: 0 }]);
  const nhieu = Array.from({ length: 80 }, (_, i) => ({ id: i.toString(16).padStart(24, "0"), sl: 1, ts: 0 }));
  assert.equal(g.lamSachDong(nhieu).length, 50);
  assert.deepEqual(g.lamSachDong("không phải mảng"), []);
});

test("giỏ khách chỉ lưu id, số lượng, thời điểm và token; không có giá hay tên", async () => {
  const kho = taoKho();
  const g = await napModule(kho);
  assert.deepEqual(g.themVaoGio(A, 2), { ok: true, soLuong: 2 });
  const luu = JSON.parse([...kho.m.values()][0]);
  assert.deepEqual(Object.keys(luu).sort(), ["capNhat", "dong", "token", "v"]);
  assert.deepEqual(Object.keys(luu.dong[0]).sort(), ["id", "sl", "ts"]);
  assert.match(luu.token, /^g-/);
});

test("giỏ khách còn nguyên sau khi tải lại trang, huy hiệu đếm đúng", async () => {
  const kho = taoKho();
  const g1 = await napModule(kho);
  g1.themVaoGio(A, 2);
  g1.themVaoGio(B, 3);
  g1.themVaoGio(A, 1);
  const g2 = await napModule(kho);
  assert.equal(g2.tongSoLuongGio(g2.layGio()), 6);
  assert.equal(g2.soLuongTrongGio(g2.layGio(), A), 3);
  g2.datSoLuongGio(A, 10);
  g2.xoaKhoiGio(B);
  const g3 = await napModule(kho);
  assert.equal(g3.tongSoLuongGio(g3.layGio()), 10);
  g3.xoaTatCaGio();
  const g4 = await napModule(kho);
  assert.equal(g4.tongSoLuongGio(g4.layGio()), 0);
  assert.equal(kho.m.size, 0, "giỏ rỗng thì xóa hẳn khóa lưu trữ");
});

test("từ chối thêm vượt 100 sản phẩm/dòng, quá 50 dòng, id hoặc số lượng sai", async () => {
  const g = await napModule(taoKho());
  assert.deepEqual(g.themVaoGio(A, 60), { ok: true, soLuong: 60 });
  assert.deepEqual(g.themVaoGio(A, 41), { ok: false, lyDo: "tran-so-luong" });
  assert.equal(g.soLuongTrongGio(g.layGio(), A), 60);
  for (let i = 1; i < 50; i++) assert.equal(g.themVaoGio(i.toString(16).padStart(24, "0"), 1).ok, true);
  assert.deepEqual(g.themVaoGio(B, 1), { ok: false, lyDo: "tran-dong" });
  assert.equal(g.themVaoGio("khong-hop-le", 1).ok, false);
  assert.equal(g.themVaoGio(A, 0).ok, false);
  assert.equal(g.themVaoGio(A, 1.5).ok, false);
});

test("dữ liệu hỏng hoặc bị sửa tay không làm hỏng giỏ", async () => {
  const kho = taoKho();
  kho.setItem("shop-cl:gio-khach:v1", "{không phải json");
  const g1 = await napModule(kho);
  assert.equal(g1.tongSoLuongGio(g1.layGio()), 0);
  kho.setItem("shop-cl:gio-khach:v1", JSON.stringify({ v: 1, token: "x'; drop", dong: [{ id: A, sl: 2, ts: 1, gia: 1 }, { id: "bậy", sl: 9 }] }));
  const g2 = await napModule(kho);
  assert.deepEqual(g2.layGio().dong, [{ id: A, sl: 2, ts: 1 }]);
  assert.equal(g2.layGio().token, "", "token sai định dạng bị bỏ");
});

test("localStorage bị chặn thì vẫn dùng được trong phiên (dự phòng bộ nhớ)", async () => {
  const g = await napModule(taoKho({ hong: true }));
  assert.equal(g.themVaoGio(A, 2).ok, true);
  assert.equal(g.tongSoLuongGio(g.layGio()), 2);
});

test("chuyenSangCho: giỏ khách được chuyển nguyên bản chụp sang hàng đợi của đúng tài khoản và giỏ khách mới là giỏ khác", async () => {
  const kho = taoKho();
  const g = await napModule(kho);
  g.themVaoGio(A, 2);
  g.themVaoGio(B, 1);
  const tokenCu = g.layGio().token;
  const ds = g.chuyenSangCho("user-1");
  assert.equal(ds.length, 1);
  assert.equal(ds[0].token, tokenCu);
  assert.deepEqual(ds[0].dong.map((d) => [d.id, d.sl]).sort(), [[A, 2], [B, 1]]);
  assert.equal(g.tongSoLuongGio(g.layGio()), 0, "giỏ khách đã được dọn");
  // Tài khoản khác không bao giờ thấy hàng đợi của user-1.
  assert.deepEqual(g.banChupDangCho("user-2"), []);
  assert.deepEqual(g.chuyenSangCho("user-2"), []);
  // Khách thêm món mới trong lúc đang đồng bộ: nằm trong giỏ khách mới với token khác, không dính vào bản chụp cũ.
  g.themVaoGio(C, 5);
  assert.notEqual(g.layGio().token, tokenCu);
  assert.deepEqual(g.banChupDangCho("user-1")[0].dong.map((d) => d.id).sort(), [A, B]);
});

test("xoaBanChup chỉ xóa đúng bản chụp đã được server xác nhận, giữ món mới thêm trong lúc đồng bộ", async () => {
  const g = await napModule(taoKho());
  g.themVaoGio(A, 1);
  const [ban] = g.chuyenSangCho("user-1");
  g.themVaoGio(B, 2); // thêm trong lúc đồng bộ
  g.xoaBanChup("user-1", ban.token);
  assert.deepEqual(g.banChupDangCho("user-1"), []);
  assert.equal(g.soLuongTrongGio(g.layGio(), B), 2, "món mới thêm không bị mất");
});

test("đồng bộ lỗi: bản chụp được giữ và gửi lại với CÙNG token; chuyển lại không tạo bản trùng", async () => {
  const kho = taoKho();
  const g1 = await napModule(kho);
  g1.themVaoGio(A, 3);
  const [lan1] = g1.chuyenSangCho("user-1");
  // Mô phỏng tải lại trang giữa chừng rồi đăng nhập lại cùng tài khoản.
  const g2 = await napModule(kho);
  const ds = g2.chuyenSangCho("user-1");
  assert.equal(ds.length, 1);
  assert.equal(ds[0].token, lan1.token);
  // Bị ngắt ngay sau khi ghi hàng đợi nhưng trước khi dọn giỏ khách: lần sau chuyển lại cùng token, không nhân đôi.
  kho.setItem("shop-cl:gio-khach:v1", JSON.stringify({ v: 1, token: lan1.token, dong: [{ id: A, sl: 3, ts: 1 }], capNhat: 1 }));
  const g3 = await napModule(kho);
  assert.equal(g3.chuyenSangCho("user-1").length, 1);
});

test("doiTokenBanChup đổi mã khi server báo trùng mã với nội dung khác", async () => {
  const g = await napModule(taoKho());
  g.themVaoGio(A, 1);
  const [ban] = g.chuyenSangCho("user-1");
  g.doiTokenBanChup("user-1", ban.token);
  const [moi] = g.banChupDangCho("user-1");
  assert.notEqual(moi.token, ban.token);
  assert.deepEqual(moi.dong, ban.dong);
});

test("coDuLieuCanDongBo: có giỏ khách hoặc hàng đợi của đúng tài khoản mới cần đồng bộ", async () => {
  const g = await napModule(taoKho());
  assert.equal(g.coDuLieuCanDongBo("user-1"), false);
  g.themVaoGio(A, 1);
  assert.equal(g.coDuLieuCanDongBo("user-1"), true);
  g.chuyenSangCho("user-1");
  assert.equal(g.coDuLieuCanDongBo("user-1"), true);
  assert.equal(g.coDuLieuCanDongBo("user-2"), false);
});

test("tomTatDongBo: nói đúng dòng nào vào được, dòng nào bị bỏ vì hết hàng/ngừng bán", async () => {
  const { tomTatDongBo } = await import("./gio-khach-bao-cao.ts");
  assert.equal(tomTatDongBo([]), null);
  const ok = tomTatDongBo([{ chiTietId: A, tenSanPham: "Vợt A", yeuCau: 2, daThem: 2, trangThai: "da_gop" }]);
  assert.equal(ok.loai, "ok");
  assert.match(ok.noiDung, /2 sản phẩm/);
  const lan = tomTatDongBo([
    { chiTietId: A, tenSanPham: "Vợt A", yeuCau: 2, daThem: 2, trangThai: "da_gop" },
    { chiTietId: B, tenSanPham: "Giày B", yeuCau: 1, daThem: 0, trangThai: "het_hang" },
    { chiTietId: C, tenSanPham: "Áo C", yeuCau: 9, daThem: 4, trangThai: "giam_so_luong" },
  ]);
  assert.equal(lan.loai, "ok");
  assert.match(lan.noiDung, /Giày B/);
  assert.match(lan.noiDung, /giảm số lượng/);
  const het = tomTatDongBo([{ chiTietId: B, tenSanPham: null, yeuCau: 1, daThem: 0, trangThai: "khong_ton_tai" }]);
  assert.equal(het.loai, "loi");
  assert.equal(tomTatDongBo([{ chiTietId: A, tenSanPham: "Vợt A", yeuCau: 2, daThem: 0, trangThai: "da_ap_dung" }]), null);
});

// ---------------------------------------------------------------------------
// M1-R1-01: ghi hàng đợi bị QuotaExceededError nhưng getItem/removeItem vẫn chạy
// ---------------------------------------------------------------------------

/** Kho giả: setItem ném QuotaExceededError với khóa khớp `chan`; getItem/removeItem vẫn bình thường. */
function taoKhoDay(chan) {
  const kho = taoKho();
  const goc = kho.setItem;
  kho.setItem = (k, v) => {
    if (chan.test(k)) {
      const e = new Error("The quota has been exceeded.");
      e.name = "QuotaExceededError";
      throw e;
    }
    return goc(k, v);
  };
  return kho;
}
const tongCho = (g, uid) => g.banChupDangCho(uid).reduce((t, b) => t + b.dong.reduce((s, d) => s + d.sl, 0), 0);

test("R1-01: ghi hàng đợi đầy bộ nhớ → không mất giỏ: bản chụp vẫn truy xuất được và giỏ gốc KHÔNG bị xóa", async () => {
  const kho = taoKhoDay(/shop-cl:gio-cho:/);
  const g = await napModule(kho);
  g.themVaoGio(A, 2);
  const truoc = g.tongSoLuongGio(g.layGio());
  g.chuyenSangCho("user-A");
  const tongGio = g.tongSoLuongGio(g.layGio());
  const tongQueue = tongCho(g, "user-A");
  assert.ok(tongQueue === 2 || tongGio === 2, `mọi lựa chọn phải còn truy xuất được (queue=${tongQueue}, giỏ=${tongGio})`);
  assert.equal(tongGio, truoc, "hàng đợi chưa lưu chắc chắn thì không được xóa giỏ gốc");
  assert.equal(tongQueue, 2, "bản chụp vẫn đọc lại được dù setItem lỗi");
});

test("R1-01: đồng bộ xong thì dọn đúng bản chụp khỏi hàng đợi và khỏi giỏ gốc; món thêm trong lúc đồng bộ ở lại", async () => {
  const kho = taoKhoDay(/shop-cl:gio-cho:/);
  const g = await napModule(kho);
  g.themVaoGio(A, 2);
  const [ban] = g.chuyenSangCho("user-A");
  g.themVaoGio(B, 1); // thêm trong lúc đồng bộ
  g.themVaoGio(A, 1);
  g.xoaBanChup("user-A", ban.token);
  assert.deepEqual(g.banChupDangCho("user-A"), []);
  assert.equal(g.soLuongTrongGio(g.layGio(), A), 1, "chỉ trừ phần đã đồng bộ (2), còn lại 1");
  assert.equal(g.soLuongTrongGio(g.layGio(), B), 1);
  assert.notEqual(g.layGio().token, ban.token, "phần còn lại là một giỏ mới → token mới");
});

test("R1-01: đồng bộ lỗi (hàng đợi đầy) thì giỏ gốc vẫn còn và gửi lại với CÙNG token", async () => {
  const kho = taoKhoDay(/shop-cl:gio-cho:/);
  const g1 = await napModule(kho);
  g1.themVaoGio(A, 3);
  const [lan1] = g1.chuyenSangCho("user-A");
  const g2 = await napModule(kho); // tải lại trang giữa chừng: bộ nhớ mất nhưng giỏ gốc còn
  assert.equal(g2.tongSoLuongGio(g2.layGio()), 3);
  const [lan2] = g2.chuyenSangCho("user-A");
  assert.equal(lan2.token, lan1.token);
});

test("R1-01: localStorage ghi lỗi toàn bộ nhưng đọc được → giỏ vẫn dùng được trong phiên; removeItem lỗi → vẫn coi là đã xóa", async () => {
  const kho = taoKhoDay(/./);
  const g = await napModule(kho);
  g.themVaoGio(A, 2);
  assert.equal(g.tongSoLuongGio(g.layGio()), 2);
  const g2 = await napModule(taoKho());
  g2.themVaoGio(B, 1);
  const kho3 = taoKho();
  const xoaGoc = kho3.removeItem;
  const g3 = await napModule(kho3);
  g3.themVaoGio(C, 1);
  kho3.removeItem = () => { throw new Error("bị chặn"); };
  g3.xoaTatCaGio();
  assert.equal(g3.tongSoLuongGio(g3.layGio()), 0);
  const g4 = await napModule(kho3);
  assert.equal(g4.tongSoLuongGio(g4.layGio()), 1, "sau khi tải lại, giá trị cũ còn vì removeItem lỗi (không thể làm khác)");
  kho3.removeItem = xoaGoc;
});
