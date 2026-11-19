// Làm sạch dữ liệu gợi ý mua cùng / combo (Top-K, phía khách). Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { chonComboHienThi, chonGoiYMuaCung, ketQuaKiemTon, tongGiaCombo } from "./goi-y.ts";

const sp = (id, gia = 100000, extra = {}) => ({ id, tenSanPham: `SP ${id}`, hinhAnhDaiDien: `${id}.jpg`, gia, chiTietMacDinh: `ct-${id}`, ...extra });

test("combo: tối đa 3, giữ thứ tự, tổng giá = tổng giá các món hiển thị", () => {
  const combos = ["a", "b", "c", "d"].map((x, i) => ({ khoa: `k${i}`, tongGia: 1, sanPhams: [sp(`${x}1`, 100), sp(`${x}2`, 250)] }));
  const kq = chonComboHienThi({ combos });
  assert.deepEqual(kq.map((c) => c.khoa), ["k0", "k1", "k2"]);
  assert.equal(kq[0].tongGia, 350, "tính lại từ món, không tin tongGia của API");
  assert.equal(chonComboHienThi({ combos }, 2).length, 2);
});

test("combo: món hỏng bị bỏ; còn dưới 2 món thì bỏ cả combo", () => {
  const kq = chonComboHienThi({ combos: [
    { khoa: "ok", sanPhams: [sp("a"), sp("b"), { id: "x", tenSanPham: "Thiếu biến thể", gia: 1 }] },
    { khoa: "thieu", sanPhams: [sp("a"), { ...sp("b"), gia: NaN }] },
    { khoa: "am", sanPhams: [sp("a"), sp("b", -5)] },
    { khoa: "tronglap", sanPhams: [sp("a"), sp("a")] },
    { khoa: "ten-rong", sanPhams: [sp("a"), { ...sp("b"), tenSanPham: "  " }] },
  ] });
  assert.deepEqual(kq.map((c) => c.khoa), ["ok"]);
  assert.deepEqual(kq[0].sanPhams.map((s) => s.id), ["a", "b"]);
});

test("combo: dữ liệu lạ (null, thiếu, sai kiểu) → rỗng, không ném lỗi", () => {
  for (const raw of [null, undefined, {}, { combos: null }, { combos: "x" }, { combos: [null, 1, "a", {}] }, [], 5, "x"]) assert.deepEqual(chonComboHienThi(raw), [], JSON.stringify(raw));
});

test("combo: thiếu khoa thì ghép từ id; chỉ lấy các trường kết quả sản phẩm", () => {
  const kq = chonComboHienThi({ combos: [{ sanPhams: [sp("a", 1, { loiNhuan: 999, hang: 1, k: 5 }), sp("b")] }] });
  assert.equal(kq[0].khoa, "a,b");
  assert.deepEqual(Object.keys(kq[0].sanPhams[0]).sort(), ["chiTietMacDinh", "gia", "hinhAnhDaiDien", "id", "tenSanPham"]);
});

test("gợi ý trang chi tiết: tối đa 4, bỏ chính nó và trùng, ảnh thiếu vẫn giữ", () => {
  const raw = { sanPhams: [sp("me"), sp("a"), sp("a"), sp("b", 5, { hinhAnhDaiDien: undefined }), sp("c"), sp("d"), sp("e")] };
  const kq = chonGoiYMuaCung(raw, "me");
  assert.deepEqual(kq.map((s) => s.id), ["a", "b", "c", "d"]);
  assert.equal(kq[1].hinhAnhDaiDien, undefined);
  assert.equal(chonGoiYMuaCung(raw, undefined, 2).length, 2);
  for (const r of [null, undefined, {}, { sanPhams: 3 }, { sanPhams: [] }]) assert.deepEqual(chonGoiYMuaCung(r, "me"), []);
});

test("tổng giá: rỗng = 0, cộng đúng số nguyên đồng", () => {
  assert.equal(tongGiaCombo([]), 0);
  assert.equal(tongGiaCombo([{ gia: 1290000 }, { gia: 85000 }]), 1375000);
});

const dongBg = (id, trangThai, ton = 5, soLuong = 1) => ({ id, trangThai, soLuong, bienThe: { soLuongTon: ton } });

test("kiểm tồn giỏ khách: chỉ trạng thái ok mới cho thêm, lấy tồn từ biến thể", () => {
  assert.deepEqual(ketQuaKiemTon({ items: [dongBg("ct-a", "ok", 7)] }, "ct-a"), { ok: true, soLuongTon: 7 });
  assert.deepEqual(ketQuaKiemTon({ items: [dongBg("CT-A", "ok", 3)] }, "ct-a"), { ok: true, soLuongTon: 3 }, "id không phân biệt hoa/thường");
  assert.deepEqual(ketQuaKiemTon({ items: [{ id: "ct-a", trangThai: "ok", soLuong: 2, bienThe: null }] }, "ct-a"), { ok: true, soLuongTon: 2 }, "thiếu tồn thì dùng số lượng đã được chấp nhận");
});

test("kiểm tồn giỏ khách: hết hàng / thiếu hàng / ngừng bán / không còn đều bị từ chối kèm lý do", () => {
  for (const tt of ["het_hang", "giam_so_luong", "ngung_kinh_doanh", "khong_ton_tai"]) {
    const r = ketQuaKiemTon({ items: [dongBg("ct-a", tt, 0)] }, "ct-a");
    assert.equal(r.ok, false, tt);
    assert.ok(r.thongBao.length > 0, tt);
  }
  assert.match(ketQuaKiemTon({ items: [dongBg("ct-a", "het_hang", 0)] }, "ct-a").thongBao, /hết hàng/);
});

test("kiểm tồn giỏ khách: phản hồi hỏng hoặc thiếu dòng của món thì không cho thêm", () => {
  for (const bg of [null, undefined, {}, { items: null }, { items: [] }, { items: [dongBg("ct-khac", "ok")] }, { items: [null, 5] }, { items: [dongBg("ct-a", "la-hoac")] }, "x"]) {
    assert.equal(ketQuaKiemTon(bg, "ct-a").ok, false, JSON.stringify(bg));
  }
});
