// Số liệu và luật chọn cho các khu của trang chủ: mọi số đếm từ dữ liệu, không bịa. Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NGAN_SACH_VOT, chonKhuyenMai, chonTheoLoai, chuongTrinhGiam, conNhieuHang, demTheoHang, demTheoLoai, lienKetHang, soVotTheoLoiChoi,
  khuyenMaiConHang, thongKeKho, votCoSucCang, votHopLoiChoi, votTheoTamGia,
} from "./landing-data.ts";

let n = 0;
const KM = { id: "k1", tenChuongTrinh: "Chào hè", moTa: null, ngayBatDau: null, ngayKetThuc: "2027-06-29T17:00:00.000Z", phanTramGiam: 12, giamToiDa: null, soLuongSuDung: null, conHieuLuc: true };
const TS_MAC_DINH = { doCanBang: "Nặng đầu", doCung: "Cứng" };
const sp = (ten, o = {}) => {
  const sau = o.sau ?? o.goc ?? 1_000_000;
  const goc = o.goc ?? sau; // không nêu giá gốc thì không giảm giá
  const loai = o.loai ?? "Vợt cầu lông";
  return {
    id: `sp${++n}`, tenSanPham: ten, giaGoc: goc, giaSauKhuyenMai: sau, dangGiamGia: sau < goc, hinhAnhDaiDien: "x.jpg",
    loai: { id: "L", tenLoai: loai }, hang: o.hang === null ? null : { id: "H", tenHang: o.hang ?? "Yonex" },
    khuyenMai: sau < goc ? (o.km ?? KM) : null, trungBinhDanhGia: null, ngayTao: "2026-11-01T00:00:00.000Z",
    tongTonKho: o.ton ?? 5,
    thongSoVot: o.ts !== undefined ? o.ts : loai.includes("Vợt") ? TS_MAC_DINH : null,
  };
};
const kho = [
  sp("Vợt A", { goc: 4_000_000, sau: 3_000_000, ton: 50 }), // giảm 25%
  sp("Vợt B", { goc: 4_000_000, sau: 3_800_000, hang: "Victor", km: { ...KM, id: "k2", tenChuongTrinh: "Thân thiết" } }), // giảm 5%
  sp("Vợt C", { sau: 2_000_000, hang: "Lining", ts: { doCanBang: "Nhẹ đầu", doCung: "Cứng", sucCang: "20-28 lbs" }, ton: 9 }),
  sp("Vợt hết hàng", { goc: 3_000_000, sau: 1_500_000, ton: 0 }), // giảm 50% nhưng hết hàng
  sp("Vợt thiếu thông số", { sau: 3_000_000, ts: null, hang: "Victor" }),
  sp("Giày D", { loai: "Giày cầu lông", goc: 2_000_000, sau: 1_200_000, hang: "Victor", ton: 70 }), // giảm 40%
  sp("Giày E", { loai: "Giày cầu lông", sau: 1_800_000, hang: "Victor" }),
  sp("Giày F", { loai: "Giày cầu lông", sau: 1_700_000, hang: "Victor" }),
  sp("Giày G", { loai: "Giày cầu lông", sau: 1_600_000, hang: "Lining" }),
  sp("Quần H", { loai: "Áo quần thể thao", sau: 100_000, hang: "Lining", ton: 200 }),
  sp("Cầu I", { loai: "Phụ kiện cầu lông", sau: 200_000, hang: null }),
];

test("thongKeKho: đếm đúng từ danh sách, sản phẩm không hãng không tính vào số hãng, giảm tối đa là mức thực tế", () => {
  const t = thongKeKho(kho);
  assert.deepEqual(t, { soSanPham: 11, soConHang: 10, soVot: 5, soHang: 3, soDangGiam: 4, giamToiDa: 50 });
  assert.deepEqual(thongKeKho([]), { soSanPham: 0, soConHang: 0, soVot: 0, soHang: 0, soDangGiam: 0, giamToiDa: 0 });
});

test("chuongTrinhGiam: gộp theo chương trình, giảm nhiều trước, mức giảm là thực tế lớn nhất", () => {
  const c = chuongTrinhGiam(kho);
  assert.deepEqual(c.map((x) => [x.ten, x.giamToiDa, x.soSanPham]), [["Chào hè", 50, 3], ["Thân thiết", 5, 1]]);
  assert.equal(c[0].ngayKetThuc, KM.ngayKetThuc);
  assert.deepEqual(chuongTrinhGiam([sp("Không giảm")]), []);
});

test("chonKhuyenMai: chỉ sản phẩm đang giảm VÀ còn hàng, giảm nhiều trước, tôn trọng giới hạn", () => {
  const ten = chonKhuyenMai(kho).map((x) => x.tenSanPham);
  assert.deepEqual(ten, ["Giày D", "Vợt A", "Vợt B"]); // "Vợt hết hàng" giảm sâu nhất nhưng hết hàng nên bị loại
  assert.equal(chonKhuyenMai(kho, 2).length, 2);
  assert.deepEqual(chonKhuyenMai([]), []);
});

test("votTheoTamGia: đếm vợt còn hàng theo tầm giá, giá thấp/cao nhất thật; tầm rỗng thì null", () => {
  const t = votTheoTamGia(kho);
  assert.equal(t.length, NGAN_SACH_VOT.length);
  const tam = (k) => t.find((x) => x.ns.khoa === k);
  const gom = (x) => [x.so, x.giaThapNhat, x.giaCaoNhat];
  assert.deepEqual(gom(tam("re")), [3, 2_000_000, 3_000_000]); // C 2tr, A 3tr, và vợt thiếu thông số 3tr (vẫn là vợt còn hàng); vợt hết hàng không tính
  assert.deepEqual(gom(tam("vua")), [1, 3_800_000, 3_800_000]);
  assert.deepEqual(gom(tam("cao")), [0, null, null]);
});

test("demTheoHang: đếm theo tên hãng, nhiều trước, kèm số theo loại và giá thấp nhất; không hãng thì bỏ", () => {
  const h = demTheoHang(kho);
  assert.deepEqual(h.map((x) => [x.ten, x.soSanPham]), [["Victor", 5], ["Lining", 3], ["Yonex", 2]]);
  assert.deepEqual(h[0].theoLoai, { vot: 2, giay: 3 });
  assert.equal(h[0].giaTu, 1_200_000);
  assert.equal(h[0].soDangGiam, 2);
});

test("demTheoLoai: đếm từng loại; loại không có sản phẩm thì giaTu null", () => {
  const d = demTheoLoai(kho);
  assert.deepEqual(d.vot, { so: 5, soConHang: 4, soDangGiam: 3, giaTu: 1_500_000 });
  assert.deepEqual(d.giay, { so: 4, soConHang: 4, soDangGiam: 1, giaTu: 1_200_000 });
  assert.equal(d.phukien.so, 1);
  assert.deepEqual(demTheoLoai([]).vot, { so: 0, soConHang: 0, soDangGiam: 0, giaTu: null });
});

test("chonTheoLoai: đúng loại, còn hàng, tối đa 2 mỗi hãng nhưng bù cho đủ khi thiếu hãng khác", () => {
  assert.deepEqual(chonTheoLoai(kho, "giay", 3).map((x) => x.tenSanPham), ["Giày D", "Giày E", "Giày G"]); // Victor chỉ lấy 2, Lining lấp chỗ
  assert.equal(chonTheoLoai(kho, "giay", 4).length, 4); // đủ 4: bù Giày F
  assert.deepEqual(chonTheoLoai(kho, "aoquan").map((x) => x.tenSanPham), ["Quần H"]);
});

test("conNhieuHang: tồn kho cao nhất trước, bỏ hết hàng", () => {
  assert.deepEqual(conNhieuHang(kho, 3).map((x) => [x.tenSanPham, x.tongTonKho]), [["Quần H", 200], ["Giày D", 70], ["Vợt A", 50]]);
  assert.ok(conNhieuHang(kho, 20).every((x) => x.tongTonKho > 0));
});

test("soVotTheoLoiChoi: chỉ vợt còn hàng có đủ thông số; vợt thiếu thông số hoặc hết hàng không được đếm", () => {
  assert.deepEqual(soVotTheoLoiChoi(kho), { cong: 2, toc: 1, toan: 0 }); // A, B nặng đầu; C nhẹ đầu
});

test("votCoSucCang: chọn vợt còn hàng có sức căng; không có thì null", () => {
  assert.equal(votCoSucCang(kho)?.tenSanPham, "Vợt C");
  assert.equal(votCoSucCang(kho.filter((x) => x.tenSanPham !== "Vợt C")), null);
});

test("lienKetHang: mã hóa tên hãng cho URL", () => {
  assert.equal(lienKetHang("Li-Ning"), "/SanPham/Index?hang=Li-Ning");
  assert.equal(lienKetHang("Hãng X&Y"), "/SanPham/Index?hang=H%C3%A3ng%20X%26Y");
});

test("khuyenMaiConHang (M4-R05): mức giảm cao nhất và chương trình chỉ tính hàng còn mua được, không lấy mức của hàng hết kho", () => {
  const d = [sp("Còn 20%", { goc: 5_000_000, sau: 4_000_000, ton: 3 }), sp("Hết 50%", { goc: 4_000_000, sau: 2_000_000, ton: 0, km: { ...KM, id: "hết", tenChuongTrinh: "Chỉ hàng hết" } })];
  assert.equal(thongKeKho(d).giamToiDa, 50); // số toàn kho vẫn là 50 (không dùng cho tiêu đề khu khuyến mãi)
  const k = khuyenMaiConHang(d);
  assert.equal(k.giamToiDa, 20);
  assert.deepEqual(k.chuongTrinh.map((c) => c.id), ["k1"]); // chương trình chỉ có hàng hết kho không được quảng bá
  assert.equal(k.chuongTrinh[0].soSanPham, 1);
  assert.deepEqual(khuyenMaiConHang([]), { chuongTrinh: [], giamToiDa: 0 });
});

test("votHopLoiChoi (M4-R01): danh sách khớp bộ đếm, không nới sang vợt không hợp lối chơi; ít thì trả ít", () => {
  const d = [
    sp("Vợt cân bằng", { ts: { doCanBang: "Cân bằng", doCung: "Trung bình" } }),
    sp("Vợt nhẹ đầu", { ts: { doCanBang: "Nhẹ đầu", doCung: "Trung bình" } }),
  ];
  const dem = soVotTheoLoiChoi(d);
  for (const lc of ["cong", "toc", "toan"]) {
    const ds = votHopLoiChoi(d, lc, 4);
    assert.equal(ds.length, dem[lc], lc); // số vợt liệt kê = số đếm
  }
  assert.equal(votHopLoiChoi(d, "toc", 4).every((x) => x.sp.tenSanPham === "Vợt nhẹ đầu"), true);
  assert.deepEqual(votHopLoiChoi([], "cong", 4), []);
});
