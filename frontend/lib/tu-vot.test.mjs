// Tủ vợt + nhắc lịch: ngày lịch địa phương, kiểm tra nhập, nhắc theo số ngày, lưu trữ trung thực. Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { docJson, ghiJson } from "./luu-tru.ts";
import { docBanGhiTu, hopLeDuDinh, hopLeDuLieu, homNayDiaPhuong, kiemTraVot, lamSachDuDinh, lamSachTu, lamSachTuChiTiet, loiNhac, ngayHopLe, soNgayGiua, soVotDenHan, tinhNhac } from "./tu-vot.ts";

const HOM_NAY = "2026-11-11";
const kt = (o) => kiemTraVot({ nguon: "tu-nhap", ten: "Vợt của tôi", ...o }, HOM_NAY);

test("ngày hợp lệ theo lịch, không nhận ngày không có thật", () => {
  assert.equal(ngayHopLe("2026-02-28"), true);
  assert.equal(ngayHopLe("2026-02-30"), false);
  assert.equal(ngayHopLe("2024-02-29"), true);
  assert.equal(ngayHopLe("2025-02-29"), false);
  assert.equal(ngayHopLe("11/11/2026"), false);
  assert.equal(ngayHopLe("1999-01-01"), false);
});

test("homNayDiaPhuong dùng lịch địa phương (không UTC)", () => {
  assert.equal(homNayDiaPhuong(new Date(2026, 10, 11, 0, 30)), "2026-11-11");
  assert.equal(homNayDiaPhuong(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("số ngày lịch giữa hai ngày, đúng qua tháng/năm và quanh đổi giờ", () => {
  assert.equal(soNgayGiua("2026-10-01", "2026-11-11"), 41);
  assert.equal(soNgayGiua("2025-12-31", "2026-01-01"), 1);
  assert.equal(soNgayGiua("2026-03-28", "2026-03-30"), 2);
  assert.equal(soNgayGiua("2026-11-11", "2026-11-11"), 0);
  assert.ok(Number.isNaN(soNgayGiua("x", "2026-11-11")));
});

test("kiểm tra nhập: tên, ngày tương lai/không hợp lệ, số căng, chu kỳ", () => {
  assert.equal(kt({ ten: "  " }).ok, false);
  assert.equal(kt({ ten: "A".repeat(81) }).ok, false);
  assert.match(kt({ ngayCang: "2026-11-12" }).loi.ngayCang, /tương lai/);
  assert.match(kt({ ngayCang: "2026-02-30" }).loi.ngayCang, /không hợp lệ/);
  assert.equal(kt({ ngayCang: "2026-11-11" }).ok, true); // hôm nay được phép
  assert.ok(kt({ cangGiaTri: "0", cangDonVi: "kg" }).loi.cang);
  assert.ok(kt({ cangGiaTri: "-2", cangDonVi: "kg" }).loi.cang);
  assert.ok(kt({ cangGiaTri: "abc", cangDonVi: "kg" }).loi.cang);
  assert.ok(kt({ cangGiaTri: "41", cangDonVi: "kg" }).loi.cang);
  assert.equal(kt({ cangGiaTri: "10,5", cangDonVi: "kg" }).vot.cang.giaTri, 10.5);
  assert.ok(kt({ chuKyNgay: "0", ngayCang: "2026-10-01" }).loi.chuKy);
  assert.ok(kt({ chuKyNgay: "2.5", ngayCang: "2026-10-01" }).loi.chuKy);
  assert.ok(kt({ chuKyNgay: "400", ngayCang: "2026-10-01" }).loi.chuKy);
  assert.ok(kt({ chuKyNgay: "30" }).loi.ngayCang, "muốn nhắc phải có ngày căng");
});

test("nhắc theo số ngày đã trôi qua; không ước lượng độ căng còn lại", () => {
  const v = (ngayCang, chuKyNgay) => ({ ngayCang, chuKyNgay });
  assert.deepEqual(tinhNhac(v(null, 30), HOM_NAY), { loai: "chua-co-ngay" });
  assert.deepEqual(tinhNhac(v("2026-10-20", null), HOM_NAY), { loai: "khong-nhac", daQuaNgay: 22 });
  assert.deepEqual(tinhNhac(v("2026-10-20", 30), HOM_NAY), { loai: "con-han", daQuaNgay: 22, conNgay: 8 });
  assert.deepEqual(tinhNhac(v("2026-10-12", 30), HOM_NAY), { loai: "den-han", daQuaNgay: 30, quaNgay: 0 });
  assert.deepEqual(tinhNhac(v("2026-09-01", 30), HOM_NAY), { loai: "den-han", daQuaNgay: 71, quaNgay: 41 });
  const chu = loiNhac(tinhNhac(v("2026-09-01", 30), HOM_NAY));
  assert.match(chu, /71 ngày/);
  assert.doesNotMatch(chu, /kg|lbs|giảm|thay cước|còn ~/i);
  assert.equal(soVotDenHan([v("2026-09-01", 30), v("2026-11-01", 30), v(null, 30)], HOM_NAY), 1);
});

test("làm sạch dữ liệu đọc từ kho: bỏ mục hỏng/trùng, giữ mục hợp lệ", () => {
  const tot = { id: "v-1", nguon: "tu-nhap", sanPhamId: null, bienTheId: null, ten: "Vợt A", ngayCang: "2026-10-01", cang: { giaTri: 11, donVi: "kg" }, chuKyNgay: 30, ghiChu: "", taoLuc: 1 };
  const ds = lamSachTu({ v: 1, vot: [tot, { ...tot }, { ...tot, id: "v-2", ngayCang: "2099-01-01" }, { ...tot, id: "v-3", ten: "" }, null, { ...tot, id: "v-4", ngayCang: "2026-02-30" }] }, HOM_NAY);
  assert.deepEqual(ds.map((x) => x.id), ["v-1"]);
  assert.equal(hopLeDuLieu({ v: 2, vot: [] }), false);
  assert.equal(hopLeDuLieu({ v: 1, vot: [] }), true);
});

test("dự định căng: chỉ nhận mục đủ id/giá trị/đơn vị", () => {
  const id = "6ae71c0ce9fc9d4b5a6a005c";
  const ds = lamSachDuDinh({ v: 1, muc: [{ bienTheId: id, sanPhamId: id, giaTri: 24, donVi: "lbs", luc: 1 }, { bienTheId: "x", sanPhamId: id, giaTri: 24, donVi: "lbs", luc: 1 }, { bienTheId: id, sanPhamId: id, giaTri: -1, donVi: "kg", luc: 1 }] });
  assert.equal(ds.length, 1);
  assert.equal(hopLeDuDinh({ v: 1 }), false);
});

/* ───── lưu trữ trung thực ───── */
function khoGia(o = {}) {
  const m = new Map();
  return {
    getItem: (k) => { if (o.docLoi) throw new Error("bị chặn"); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (o.ghiLoi) { const e = new Error("đầy"); e.name = "QuotaExceededError"; throw e; } if (!o.khongNho) m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
  };
}
const laObj = (x) => !!x && typeof x === "object";

test("ghi thành công chỉ khi đọc lại đúng", () => {
  const kho = khoGia();
  assert.deepEqual(ghiJson(kho, "k", { a: 1 }), { ok: true });
  assert.deepEqual(docJson(kho, "k", laObj), { trangThai: "ok", giaTri: { a: 1 } });
});

test("quota, lưu trữ bị chặn, và trình duyệt không giữ dữ liệu đều KHÔNG được báo thành công", () => {
  assert.deepEqual(ghiJson(khoGia({ ghiLoi: true }), "k", {}), { ok: false, lyDo: "day-bo-nho" });
  assert.deepEqual(ghiJson(null, "k", {}), { ok: false, lyDo: "khong-dung-duoc" });
  assert.deepEqual(ghiJson(khoGia({ khongNho: true }), "k", { a: 1 }), { ok: false, lyDo: "doc-lai-khong-khop" });
  assert.deepEqual(docJson(khoGia({ docLoi: true }), "k", laObj), { trangThai: "khong-dung-duoc" });
});

test("JSON hỏng hoặc sai hình được báo là hỏng (không âm thầm coi là rỗng)", () => {
  const kho = khoGia();
  kho.setItem("k", "{khong phai json");
  assert.equal(docJson(kho, "k", laObj).trangThai, "hong");
  kho.setItem("k", JSON.stringify("chuoi"));
  assert.equal(docJson(kho, "k", laObj).trangThai, "hong");
  assert.equal(docJson(khoGia(), "chua-co", laObj).trangThai, "rong");
});

/* ───── M3-QA1-01 / C01: JSON hợp lệ nhưng bản ghi sai kiểu không được làm sập đường đọc (cả header đọc cùng đường này) ───── */
// Đường đọc đầy đủ y như `docTu` trong tu-vot-store: docJson (kho thật) → hopLeDuLieu → lamSachTuChiTiet; header dùng thêm soVotDenHan.
function docDayDu(kho, homNay = HOM_NAY) {
  const r = docJson(kho, "tu-vot:v1", hopLeDuLieu);
  if (r.trangThai !== "ok") return { trangThai: r.trangThai, ds: [], phanHong: [] };
  const { ds, phanHong } = lamSachTuChiTiet(r.giaTri, homNay);
  return { trangThai: ds.length ? "ok" : "rong", ds, phanHong };
}
const VOT_TOT = { id: "good", nguon: "tu-nhap", sanPhamId: null, bienTheId: null, ten: "Vợt hợp lệ", ngayCang: "2026-11-01", cang: { giaTri: 11, donVi: "kg" }, chuKyNgay: 30, ghiChu: "ok", taoLuc: 1 };
const BAN_GHI_HONG = {
  "tên là số (repro QA1)": { ...VOT_TOT, id: "bad", ten: 123, ngayCang: null, cang: null, chuKyNgay: null, ghiChu: "", taoLuc: 2 },
  "ghi chú là đối tượng (repro Codex)": { ...VOT_TOT, id: "bad", ghiChu: { text: "bad" } },
  "tên là mảng": { ...VOT_TOT, id: "bad", ten: ["a"] },
  "tên là đối tượng": { ...VOT_TOT, id: "bad", ten: { x: 1 } },
  "ngày căng là số": { ...VOT_TOT, id: "bad", ngayCang: 20261101 },
  "ngày căng là đối tượng": { ...VOT_TOT, id: "bad", ngayCang: { d: 1 } },
  "cang là chuỗi": { ...VOT_TOT, id: "bad", cang: "11kg" },
  "cang.giaTri là chuỗi": { ...VOT_TOT, id: "bad", cang: { giaTri: "11", donVi: "kg" } },
  "cang.donVi lạ": { ...VOT_TOT, id: "bad", cang: { giaTri: 11, donVi: "oz" } },
  "chuKyNgay là chuỗi": { ...VOT_TOT, id: "bad", chuKyNgay: "30" },
  "chuKyNgay là NaN/null JSON": { ...VOT_TOT, id: "bad", chuKyNgay: { n: 30 } },
  "id không phải chuỗi": { ...VOT_TOT, id: 7 },
  "thiếu id": (() => { const r = { ...VOT_TOT }; delete r.id; return r; })(),
  "bản ghi là null": null,
  "bản ghi là số": 42,
  "bản ghi là chuỗi": "vợt",
  "bản ghi là mảng": [VOT_TOT],
  "sanPhamId là số": { ...VOT_TOT, id: "bad", sanPhamId: 5 },
};

for (const [ten, bad] of Object.entries(BAN_GHI_HONG)) {
  test(`đọc tủ vợt: ${ten} không ném lỗi, vợt hợp lệ bên cạnh còn nguyên, bản hỏng được giữ nguyên văn`, () => {
    const kho = khoGia();
    kho.setItem("tu-vot:v1", JSON.stringify({ v: 1, vot: [VOT_TOT, bad] }));
    let r;
    assert.doesNotThrow(() => { r = docDayDu(kho); });
    assert.equal(r.trangThai, "ok");
    assert.deepEqual(r.ds.map((x) => x.id), ["good"]);
    assert.equal(r.ds[0].ten, "Vợt hợp lệ");
    assert.deepEqual(r.phanHong, [JSON.parse(JSON.stringify(bad))]);
    assert.doesNotThrow(() => soVotDenHan(r.ds, HOM_NAY)); // đường của thanh điều hướng
    // Ghi lại sau khi người dùng sửa/xóa: bản hỏng KHÔNG bị âm thầm xóa, không bị biến thành "[object Object]".
    assert.deepEqual(ghiJson(kho, "tu-vot:v1", { v: 1, vot: [...r.ds, ...r.phanHong] }), { ok: true });
    const sauGhi = JSON.parse(kho.getItem("tu-vot:v1"));
    assert.equal(sauGhi.vot.length, 2);
    assert.equal(JSON.stringify(sauGhi.vot[1]), JSON.stringify(bad));
  });
}

test("đọc tủ vợt: toàn bộ bản ghi hỏng → trạng thái rỗng, KHÔNG phải 'hỏng JSON', và không mất bản nào", () => {
  const kho = khoGia();
  const xau = [{ id: "a", ten: 1 }, null, 3];
  kho.setItem("tu-vot:v1", JSON.stringify({ v: 1, vot: xau }));
  const r = docDayDu(kho);
  assert.equal(r.trangThai, "rong");
  assert.equal(r.ds.length, 0);
  assert.equal(r.phanHong.length, 3);
});

test("đọc tủ vợt: trùng id và vượt trần 30 cũng được giữ nguyên văn thay vì bị xóa âm thầm", () => {
  const nhieu = Array.from({ length: 32 }, (_, i) => ({ ...VOT_TOT, id: `v-${i}` }));
  const r = lamSachTuChiTiet({ v: 1, vot: [...nhieu, { ...VOT_TOT, id: "v-0", ten: "Bản trùng id" }] }, HOM_NAY);
  assert.equal(r.ds.length, 30);
  assert.equal(r.phanHong.length, 3);
  assert.ok(r.phanHong.some((x) => x.ten === "Bản trùng id"));
});

test("kiemTraVot và docBanGhiTu không ném lỗi với đầu vào chưa kiểm kiểu và không ép đối tượng thành chuỗi", () => {
  for (const ten of [123, null, undefined, {}, [], true]) assert.doesNotThrow(() => kiemTraVot({ nguon: "tu-nhap", ten }, HOM_NAY));
  assert.equal(kiemTraVot({ nguon: "tu-nhap", ten: { a: 1 } }, HOM_NAY).ok, false);
  assert.equal(kiemTraVot({ nguon: "tu-nhap", ten: "ok", ghiChu: { text: "x" } }, HOM_NAY).ok, false);
  assert.equal(docBanGhiTu({ ...VOT_TOT, ghiChu: { text: "bad" } }, HOM_NAY), null);
  assert.equal(docBanGhiTu(VOT_TOT, HOM_NAY)?.id, "good");
});

test("ngữ nghĩa lưu trung thực vẫn đúng sau sửa: JSON hỏng, hỏng cấu trúc cấp cao, lưu trữ chặn, quota", () => {
  const kho = khoGia();
  kho.setItem("tu-vot:v1", "{hỏng");
  assert.equal(docDayDu(kho).trangThai, "hong");
  kho.setItem("tu-vot:v1", JSON.stringify({ v: 1, vot: "không phải mảng" }));
  assert.equal(docDayDu(kho).trangThai, "hong");
  assert.equal(docDayDu(khoGia({ docLoi: true })).trangThai, "khong-dung-duoc");
  assert.equal(docDayDu(null).trangThai, "khong-dung-duoc");
  assert.deepEqual(ghiJson(khoGia({ ghiLoi: true }), "tu-vot:v1", { v: 1, vot: [] }), { ok: false, lyDo: "day-bo-nho" });
});
