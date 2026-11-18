// Biểu đồ so sánh vợt: thang minh họa, radar, thanh giá/tồn, điểm khác biệt, gợi ý cặp. Chỉ dữ liệu thật, thiếu thì bỏ. Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { doiChieu } from "./so-sanh.ts";
import { diemKhacBiet, diemTrenTruc, gocTruc, goiYCapVot, moTaBieuDo, SAN_BAN_KINH, SO_TRUC, taoRadar, THANG, tinhThanhGia, tinhThanhTon, tinhTruc } from "./so-sanh-bieu-do.ts";

const h = (o = {}) => ({ ten: "x", gia: 4_000_000, ton: 5, canBang: { bac: 0, chu: "Cân bằng" }, trongLuong: { so: 4, chu: "4U (80-84g)" }, doCung: { bac: 1, chu: "Trung bình" }, chieuDaiMm: 675, cangToiDa: { giaTri: 28, donVi: "lbs" }, tuyPhienBan: [], ...o });
const truc = (ds, khoa) => tinhTruc(ds).find((t) => t.khoa === khoa);
const gan = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} khác ${b}`);

test("thang: 5 trục, vị trí 0..1 đúng công thức, U nhỏ = nặng = vị trí cao", () => {
  const ds = [h({ canBang: { bac: 2, chu: "Nặng đầu" }, trongLuong: { so: 3, chu: "3U (85-89g)" }, doCung: { bac: 3, chu: "Rất cứng" } }), h({ canBang: { bac: -1, chu: "Nhẹ đầu" }, doCung: { bac: 0, chu: "Mềm" } })];
  assert.equal(tinhTruc(ds).length, SO_TRUC);
  gan(truc(ds, "canBang").diem[0].vitri, 4 / 5); // (2+2)/5
  gan(truc(ds, "canBang").diem[1].vitri, 1 / 5); // (-1+2)/5
  gan(truc(ds, "doCung").diem[0].vitri, 1);
  gan(truc(ds, "doCung").diem[1].vitri, 0);
  gan(truc(ds, "trongLuong").diem[0].vitri, 3 / 5); // 3U nặng hơn 4U
  gan(truc(ds, "trongLuong").diem[1].vitri, 2 / 5);
  assert.deepEqual(truc(ds, "trongLuong").idxCao, [0]);
  assert.deepEqual(truc(ds, "trongLuong").idxThap, [1]);
  assert.deepEqual(truc(ds, "canBang").idxCao, [0]);
  assert.equal(truc(ds, "canBang").trangThai, "khac");
});

test("cùng giá trị: giống nhau, không đánh dấu cao/thấp, vị trí trùng nhau", () => {
  const ds = [h(), h()];
  for (const t of tinhTruc(ds)) {
    assert.equal(t.trangThai, "giong", t.khoa);
    assert.deepEqual(t.idxCao, []);
    assert.deepEqual(t.idxThap, []);
    assert.equal(t.diem[0].vitri, t.diem[1].vitri);
  }
  assert.equal(tinhThanhGia(ds).giongNhau, true);
  assert.ok(tinhThanhGia(ds).thanh.every((b) => !b.reNhat && !b.datNhat));
});

test("thiếu dữ liệu: vị trí null, không tự đặt giá trị, radar bỏ trục đó và nói thiếu", () => {
  const ds = [h({ doCung: null, chieuDaiMm: null }), h({ canBang: { bac: 2, chu: "Nặng đầu" } })];
  const t = tinhTruc(ds);
  const dc = t.find((x) => x.khoa === "doCung");
  assert.equal(dc.diem[0].vitri, null);
  assert.equal(dc.diem[0].chu, null);
  assert.deepEqual(dc.thieu, [0]);
  assert.equal(dc.trangThai, "chua-du"); // chỉ một vợt có dữ liệu → không dựng cao/thấp
  assert.deepEqual(dc.idxCao, []);
  const cd = t.find((x) => x.khoa === "chieuDai");
  assert.equal(cd.diem[0].vitri, null);
  const r = taoRadar(t, 2, { x: 100, y: 100 }, 80);
  assert.equal(r.vot[0].soDiem, 3);
  assert.equal(r.vot[0].khuyet, true);
  assert.deepEqual(r.vot[0].thieu, ["Độ cứng thân", "Chiều dài"]);
  assert.equal(r.vot[0].diem[1], null); // trục độ cứng (chỉ số 1) bị bỏ
  assert.equal(r.vot[1].khuyet, false);
  assert.match(r.vot[1].duong, /Z$/);
  const khac = diemKhacBiet(ds);
  assert.ok(khac.some((m) => m.kieu === "thieu" && m.khoa === "doCung-thieu" && m.huyHieu[0].idx === 0));
});

test("không vợt nào có dữ liệu trục đó: trục trống, radar không có điểm ở trục ấy", () => {
  const ds = [h({ cangToiDa: null }), h({ cangToiDa: null })];
  const sc = truc(ds, "sucCang");
  assert.equal(sc.trong, true);
  assert.deepEqual(sc.thieu, [0, 1]);
  assert.ok(taoRadar(tinhTruc(ds), 2, { x: 0, y: 0 }, 50).vot.every((v) => v.soDiem === 4));
});

test("sức căng khác đơn vị: không dựng thang chung, không xếp cao/thấp; cùng đơn vị kg dùng thang kg", () => {
  const khac = [h({ cangToiDa: { giaTri: 28, donVi: "lbs" } }), h({ cangToiDa: { giaTri: 13, donVi: "kg" } })];
  const sc = truc(khac, "sucCang");
  assert.equal(sc.trangThai, "khac-don-vi");
  assert.ok(sc.diem.every((d) => d.vitri === null));
  assert.deepEqual(sc.diem.map((d) => d.chu), ["tối đa 28 lbs", "tối đa 13 kg"]);
  assert.deepEqual(sc.idxCao, []);
  const mucKhac = diemKhacBiet(khac).find((m) => m.khoa === "sucCang");
  assert.equal(mucKhac.kieu, "khac-don-vi");
  assert.match(doiChieu(khac).join("\n"), /đơn vị khác nhau/); // nhất quán với lời đối chiếu cũ
  const kg = truc([h({ cangToiDa: { giaTri: 9, donVi: "kg" } }), h({ cangToiDa: { giaTri: 13.5, donVi: "kg" } })], "sucCang");
  gan(kg.diem[0].vitri, 9 / THANG.sucCangKg.max);
  gan(kg.diem[1].vitri, 13.5 / THANG.sucCangKg.max);
  const lbs = truc([h({ cangToiDa: { giaTri: 20, donVi: "lbs" } }), h()], "sucCang");
  gan(lbs.diem[0].vitri, 20 / THANG.sucCangLbs.max);
});

test("biên: kẹp ở mép thang và đánh dấu ngoài thang, vẫn phân biệt theo giá trị gốc", () => {
  const ds = [
    h({ canBang: { bac: -2, chu: "Rất nhẹ đầu" }, chieuDaiMm: 600, trongLuong: { so: 1, chu: "1U" }, cangToiDa: { giaTri: 50, donVi: "lbs" } }),
    h({ canBang: { bac: 3, chu: "Rất nặng đầu" }, chieuDaiMm: 580, trongLuong: { so: 6, chu: "6U" }, cangToiDa: { giaTri: 60, donVi: "lbs" } }),
  ];
  assert.equal(truc(ds, "canBang").diem[0].vitri, 0);
  assert.equal(truc(ds, "canBang").diem[1].vitri, 1);
  assert.equal(truc(ds, "canBang").diem[0].ngoaiThang, false);
  const cd = truc(ds, "chieuDai");
  assert.deepEqual(cd.diem.map((d) => d.vitri), [0, 0]);
  assert.ok(cd.diem.every((d) => d.ngoaiThang));
  assert.deepEqual(cd.idxCao, [0]); // 600 > 580 dù cùng bị kẹp ở 0
  assert.equal(truc(ds, "trongLuong").diem[0].vitri, 1); // 1U nặng nhất
  assert.equal(truc(ds, "trongLuong").diem[1].vitri, 0); // 6U nhẹ nhất
  const sc = truc(ds, "sucCang");
  assert.deepEqual(sc.diem.map((d) => d.vitri), [1, 1]);
  assert.deepEqual(sc.idxCao, [1]);
  gan(truc([h({ chieuDaiMm: 700 }), h({ chieuDaiMm: 640 })], "chieuDai").diem[0].vitri, 1);
  assert.equal(truc([h({ chieuDaiMm: 640 })], "chieuDai").diem[0].vitri, 0);
});

test("3 vợt: có đầu cao, đầu thấp và ở giữa; hai vợt bằng nhau cùng nằm ở đầu cao", () => {
  const ds = [h({ canBang: { bac: -1, chu: "Nhẹ đầu" } }), h({ canBang: { bac: 0, chu: "Cân bằng" } }), h({ canBang: { bac: 2, chu: "Nặng đầu" } })];
  const t = truc(ds, "canBang");
  assert.deepEqual(t.idxCao, [2]);
  assert.deepEqual(t.idxThap, [0]);
  const m = diemKhacBiet(ds).find((x) => x.khoa === "canBang");
  assert.deepEqual(m.huyHieu.map((x) => x.nhan), ["nhẹ đầu hơn", "ở giữa", "nặng đầu hơn"]);
  const hoa = truc([h({ canBang: { bac: 2, chu: "Nặng đầu" } }), h({ canBang: { bac: 2, chu: "Nặng đầu" } }), h({ canBang: { bac: 0, chu: "Cân bằng" } })], "canBang");
  assert.deepEqual(hoa.idxCao, [0, 1]);
  assert.deepEqual(hoa.idxThap, [2]);
  assert.equal(taoRadar(tinhTruc(ds), 3, { x: 0, y: 0 }, 50).vot.length, 3);
});

test("radar: trục đầu hướng lên, đi theo chiều kim đồng hồ, tâm/rìa đúng, null thì không có điểm", () => {
  const tam = { x: 200, y: 150 };
  const dinh = diemTrenTruc(1, 0, 5, tam, 100);
  gan(dinh.x, 200); gan(dinh.y, 50);
  const tr = diemTrenTruc(0, 0, 5, tam, 100);
  gan(tr.y, 150 - 100 * SAN_BAN_KINH);
  assert.equal(diemTrenTruc(null, 0, 5, tam, 100), null);
  assert.equal(diemTrenTruc(Number.NaN, 0, 5, tam, 100), null);
  assert.ok(diemTrenTruc(1, 1, 5, tam, 100).x > 200); // trục thứ hai nằm bên phải
  gan(gocTruc(0, 5), -Math.PI / 2);
  gan(diemTrenTruc(7, 0, 5, tam, 100).y, 50); // vị trí ngoài 0..1 bị kẹp
});

test("radar: đa giác cho 3+ điểm, đoạn thẳng cho 2, rỗng cho 1; đủ 4 vòng lưới", () => {
  const mau = { khoa: "", ten: "", dauThap: "", dauCao: "", huongDoc: "", moc: [], trangThai: "khac", idxCao: [], idxThap: [], thieu: [], trong: false };
  const dung = (v) => v.map((vi, k) => ({ ...mau, khoa: String(k), ten: `T${k}`, diem: [{ idx: 0, raw: vi, vitri: vi, chu: "x", ngoaiThang: false }] }));
  const r5 = taoRadar(dung([0.5, 0.5, 0.5, 0.5, 0.5]), 1, { x: 100, y: 100 }, 80);
  assert.match(r5.vot[0].duong, / Z$/);
  assert.equal(r5.vot[0].duong.split("L").length, 5);
  assert.equal(r5.vong.length, 4);
  assert.equal(r5.dauTruc.length, 5);
  const r2 = taoRadar(dung([0.5, null, null, 0.7, null]), 1, { x: 100, y: 100 }, 80);
  assert.equal(r2.vot[0].soDiem, 2);
  assert.doesNotMatch(r2.vot[0].duong, /Z/);
  const r1 = taoRadar(dung([0.5, null, null, null, null]), 1, { x: 100, y: 100 }, 80);
  assert.equal(r1.vot[0].duong, "");
  assert.equal(r1.vot[0].soDiem, 1);
});

test("thanh giá và tồn kho: tỉ lệ từ 0, đánh dấu rẻ/đắt nhất, hết hàng thanh rỗng", () => {
  const g = tinhThanhGia([h({ gia: 3_000_000 }), h({ gia: 4_500_000 }), h({ gia: 3_600_000 })]);
  assert.equal(g.giongNhau, false);
  assert.deepEqual(g.thanh.map((b) => [b.reNhat, b.datNhat]), [[true, false], [false, true], [false, false]]);
  gan(g.thanh[1].ti, 1);
  gan(g.thanh[0].ti, 3 / 4.5);
  const t = tinhThanhTon([h({ ton: 0 }), h({ ton: 40 }), h({ ton: 10 })]);
  assert.deepEqual(t.thanh.map((b) => b.het), [true, false, false]);
  assert.equal(t.thanh[0].ti, 0);
  gan(t.thanh[2].ti, 0.25);
  assert.equal(tinhThanhTon([h({ ton: 0 }), h({ ton: 0 })]).thanh[0].ti, 0);
  assert.equal(tinhThanhGia([h({ gia: 0 })]).thanh[0].ti, 0);
});

test("điểm khác biệt: chỉ nêu chênh lệch dữ liệu, không kết luận hơn-kém, ít hơn 2 vợt thì rỗng", () => {
  const ds = [h({ canBang: { bac: 2, chu: "Nặng đầu" }, gia: 4_500_000, ton: 0, tuyPhienBan: ["trọng lượng"] }), h({ canBang: { bac: -1, chu: "Nhẹ đầu" }, gia: 3_000_000 })];
  const ra = diemKhacBiet(ds);
  assert.doesNotMatch(JSON.stringify(ra), /tốt hơn|hay hơn|nên mua|thắng|mạnh hơn|nhanh hơn|điểm tổng|%/i);
  assert.ok(ra.some((m) => m.khoa === "chieuDai" && m.kieu === "giong"));
  assert.deepEqual(ra.find((m) => m.khoa === "gia").huyHieu.map((x) => x.nhan), ["đắt hơn", "rẻ hơn"]);
  assert.ok(ra.some((m) => m.kieu === "het-hang" && m.huyHieu[0].idx === 0));
  assert.ok(ra.some((m) => m.kieu === "phien-ban"));
  assert.deepEqual(diemKhacBiet([h()]), []);
  // cùng hướng với lời đối chiếu cũ
  assert.match(doiChieu(ds.map((x, i) => ({ ...x, nhan: `Vợt ${i + 1}` }))).join("\n"), /Vợt 1 nặng đầu hơn/);
  assert.deepEqual(truc(ds, "canBang").idxCao, [0]);
});

test("mô tả chữ cho trình đọc màn hình có đủ số liệu và nhắc thang minh họa", () => {
  const ds = [h({ nhan: "Vợt 1", ten: "Mizuno A" }), h({ nhan: "Vợt 2", ten: "Victor B", doCung: null, cangToiDa: { giaTri: 13, donVi: "kg" } })];
  const t = moTaBieuDo(ds);
  assert.match(t, /Vợt 1 \(Mizuno A\)/);
  assert.match(t, /trọng lượng 4U \(80-84g\)/);
  assert.match(t, /chiều dài 675mm/);
  assert.match(t, /tối đa 13 kg/);
  assert.match(t, /Chưa có thông tin: độ cứng thân/);
  assert.match(t, /không phải điểm chất lượng/);
});

const uv = (id, o = {}) => ({ id, ten: `Vợt ${id}`, hang: "H", gia: 3_000_000, ton: 10, canBang: { bac: 0, chu: "Cân bằng" }, doCung: { bac: 1, chu: "Trung bình" }, ...o });

test("gợi ý cặp: chỉ vợt còn hàng, chỉ cặp có khác biệt, không lặp vợt, giữ vợt đã chọn", () => {
  const ds = [
    uv("a", { canBang: { bac: -1, chu: "Nhẹ đầu" } }), uv("b", { canBang: { bac: 2, chu: "Nặng đầu" }, doCung: { bac: 2, chu: "Cứng" } }),
    uv("c", { ton: 0, canBang: { bac: 3, chu: "Rất nặng đầu" } }), uv("d"), uv("e", { canBang: { bac: 2, chu: "Nặng đầu" } }), uv("f", { canBang: null, doCung: null }),
  ];
  const cap = goiYCapVot(ds);
  assert.ok(cap.length >= 1 && cap.length <= 3);
  const dung = cap.flatMap((c) => [c.a.id, c.b.id]);
  assert.equal(new Set(dung).size, dung.length);
  assert.ok(!dung.includes("c"), "vợt hết hàng không được gợi ý");
  assert.ok(!dung.includes("f"), "vợt không có thông số nào không được gợi ý");
  assert.ok(cap.every((c) => c.khacNhau.length > 0 && c.diem > 0));
  assert.deepEqual([cap[0].a.id, cap[0].b.id].sort(), ["a", "b"]); // khác nhiều nhất
  const rieng = goiYCapVot(ds, { giu: "d", toiDa: 2 });
  assert.equal(rieng.length, 2);
  assert.ok(rieng.every((c) => c.a.id === "d" && c.b.id !== "d" && c.b.id !== "c"));
  assert.deepEqual(goiYCapVot(ds, { giu: "khong-co" }), []);
  assert.deepEqual(goiYCapVot([uv("x"), uv("y")]), []); // giống hệt nhau → không có gì để gợi ý
  assert.deepEqual(goiYCapVot([]), []);
});

test("khác đơn vị sức căng (M4-R03): có số liệu nhưng không vẽ chung thang — nói khác đơn vị, KHÔNG nói chưa có thông tin", () => {
  const ds = [h({ cangToiDa: { giaTri: 28, donVi: "lbs" } }), h({ cangToiDa: { giaTri: 13, donVi: "kg" } }), h({ cangToiDa: null })];
  const t = tinhTruc(ds);
  const sc = t.find((x) => x.khoa === "sucCang");
  assert.equal(sc.trangThai, "khac-don-vi");
  assert.equal(sc.diem[0].vitri, null);
  assert.equal(sc.diem[0].chu !== null, true); // số vẫn có để hiển thị
  const r = taoRadar(t, 3, { x: 100, y: 100 }, 80);
  assert.deepEqual(r.vot[0].thieu, []);
  assert.deepEqual(r.vot[0].khacDonVi, ["Sức căng tối đa"]);
  assert.deepEqual(r.vot[1].khacDonVi, ["Sức căng tối đa"]);
  assert.deepEqual(r.vot[2].thieu, ["Sức căng tối đa"]); // vợt không ghi sức căng mới là thiếu thông tin
  assert.deepEqual(r.vot[2].khacDonVi, []);
});
