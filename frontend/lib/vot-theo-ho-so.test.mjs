// Chọn vợt cho màn hình đầu từ hồ sơ: chỉ vợt khớp, không tự nới bộ lọc, thiếu thì nói rõ. Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { anhDaKiemDuyet, loiChoiCuaThongSo, votTheoHoSo } from "./landing-data.ts";

let n = 0;
const vot = (ten, doCanBang, giaSauKhuyenMai, o = {}) => ({
  id: `sp${++n}`, tenSanPham: ten, giaGoc: giaSauKhuyenMai, giaSauKhuyenMai, dangGiamGia: false, hinhAnhDaiDien: o.anh ?? "x.jpg",
  loai: { id: "L", tenLoai: "Vợt cầu lông" }, hang: { id: "H", tenHang: o.hang ?? "Yonex" }, trungBinhDanhGia: null,
  tongTonKho: o.ton ?? 5, thongSoVot: o.ts === null ? null : { doCanBang, doCung: o.doCung ?? "Cứng", trongLuong: "3U (85-89g)", ...(o.ts ?? {}) },
});
const kho = [
  vot("Nặng A", "Nặng đầu", 4_000_000, { anh: "astrox99pro.jpg" }),
  vot("Nặng B", "Nặng đầu", 3_000_000),
  vot("Nặng C", "Hơi nặng đầu", 5_000_000),
  vot("Nặng D", "Rất nặng đầu", 2_000_000),
  vot("Cân bằng E", "Cân bằng", 3_800_000),
  vot("Nhẹ F", "Nhẹ đầu", 3_000_000),
  vot("Hết hàng G", "Nặng đầu", 3_000_000, { ton: 0 }),
  vot("Thiếu thông số H", undefined, 3_000_000, { ts: null }),
  vot("Khác nhau I", undefined, 3_000_000, { ts: { doCanBang: undefined } }), // các phiên bản khác nhau về cân bằng → không có giá trị
];
const hs = (o) => ({ lc: null, kn: null, ns: null, ...o });
const ten = (r) => r.ds.map((x) => x.sp.tenSanPham);

test("chưa chọn lối chơi: 3 vợt nổi bật còn hàng có thông số, ảnh đã duyệt đứng đầu, không có lý do bịa", () => {
  const r = votTheoHoSo(kho, hs({}));
  assert.equal(r.cheDo, "noi-bat");
  assert.equal(r.ds.length, 3);
  assert.equal(r.ds[0].sp.tenSanPham, "Nặng A");
  assert.ok(anhDaKiemDuyet(r.ds[0].sp));
  assert.ok(r.ds.every((x) => x.lyDo.length === 0));
  assert.ok(!ten(r).some((t) => /Hết hàng|Thiếu|Khác nhau/.test(t)), "loại hết hàng, thiếu/không rõ thông số");
});

test("đã chọn Uy lực: đúng 3 vợt KHỚP, mỗi vợt có lý do từ thông số thật; không chèn vợt nhẹ đầu hay cân bằng", () => {
  const r = votTheoHoSo(kho, hs({ lc: "cong" }));
  assert.equal(r.cheDo, "khop");
  assert.equal(r.ds.length, 3);
  assert.ok(r.ds.every((x) => x.khop && x.lyDo.length > 0));
  assert.ok(!ten(r).some((t) => /Cân bằng|Nhẹ/.test(t)));
  assert.deepEqual(r.ganKhop, []);
});

test("ngân sách giới hạn kết quả; ít hơn 3 vợt khớp thì trả ít hơn và nói rõ (không nới bộ lọc), kèm danh sách 'gần khớp' tách riêng", () => {
  const r = votTheoHoSo(kho, hs({ lc: "cong", ns: "re" })); // dưới 3,5 triệu: Nặng B (3,0), Nặng D (2,0); Nhẹ F cũng trong tầm giá
  assert.equal(r.cheDo, "it-khop");
  assert.deepEqual(ten(r).sort(), ["Nặng B", "Nặng D"]);
  assert.equal(r.soKhop, 2);
  assert.ok(r.ganKhop.every((x) => !x.khop), "gần khớp là những vợt chưa khớp đủ");
  assert.ok(!ten(r).includes("Nhẹ F"));
});

test("không có vợt khớp: ds rỗng, cheDo khong-khop (không tự điền vợt không hợp)", () => {
  const chiNhe = [vot("Nhẹ 1", "Nhẹ đầu", 3_000_000), vot("Nhẹ 2", "Nhẹ đầu", 3_100_000)];
  const r = votTheoHoSo(chiNhe, hs({ lc: "cong" }));
  assert.equal(r.cheDo, "khong-khop");
  assert.deepEqual(r.ds, []);
  assert.equal(r.soTrongTamGia, 2);
});

test("trình độ thay đổi kết quả theo chamVot (người mới ưu tiên vợt dễ chơi)", () => {
  const dsKho = [vot("Cứng nặng", "Rất nặng đầu", 3_000_000, { doCung: "Rất cứng" }), vot("Vừa nặng", "Hơi nặng đầu", 3_000_000, { doCung: "Trung bình" })];
  assert.deepEqual(ten(votTheoHoSo(dsKho, hs({ lc: "cong", kn: "moi" }))), ["Vừa nặng"]);
  assert.deepEqual(ten(votTheoHoSo(dsKho, hs({ lc: "cong", kn: "thi" }))).sort(), ["Cứng nặng", "Vừa nặng"]);
});

test("loiChoiCuaThongSo khớp quy tắc backend: cần cả cân bằng và độ cứng, không đoán khi thiếu", () => {
  assert.deepEqual(loiChoiCuaThongSo({ doCanBang: "Nặng đầu", doCung: "Cứng" }), ["cong"]);
  assert.deepEqual(loiChoiCuaThongSo({ doCanBang: "Hơi nặng đầu", doCung: "Trung bình" }), ["cong", "toan"]);
  assert.deepEqual(loiChoiCuaThongSo({ doCanBang: "Cân bằng", doCung: "Trung bình" }), ["toan"]);
  assert.deepEqual(loiChoiCuaThongSo({ doCanBang: "Nhẹ đầu", doCung: "Cứng" }), ["toc"]);
  assert.deepEqual(loiChoiCuaThongSo({ doCanBang: "Nhẹ đầu" }), []);
  assert.deepEqual(loiChoiCuaThongSo(null), []);
});
