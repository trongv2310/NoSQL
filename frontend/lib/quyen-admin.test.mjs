// Quyền vào khu quản trị theo vai trò (C-3): đường dẫn được phép, mục menu, chuyển trang nhân viên, trang sau đăng nhập. Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { TRANG_NHAN_VIEN, canChuyenVeTrangNhanVien, coQuyenXoa, duongDanDuocPhep, mucMenuTheoQuyen, trangSauDangNhap } from "./quyen-admin.ts";

const ADMIN = 1, NV = 2, KHACH = 3;
const NV_DUOC = [
  "/admin/san-pham", "/admin/san-pham/create", "/admin/san-pham/abc123", "/admin/san-pham/abc123/edit",
  "/admin/bien-the/abc123/edit",
  "/admin/don-hang", "/admin/don-hang/1001",
  "/admin/ban-tin", "/admin/ban-tin/create", "/admin/ban-tin/abc/edit",
  "/admin/tran-dau", "/admin/tran-dau/create", "/admin/tran-dau/abc/edit",
];
const NV_CAM = [
  "/admin", "/admin/bao-cao-csdl", "/admin/lich-cang", "/admin/thong-bao",
  "/admin/khuyen-mai", "/admin/khuyen-mai/create", "/admin/khuyen-mai/abc/edit",
  "/admin/tai-khoan", "/admin/tai-khoan/create", "/admin/tai-khoan/abc/edit", "/admin/logo",
  "/", "/Home", "/admin-x",
];

test("nhân viên: đúng 4 tab (kèm trang con và biến thể) được vào", () => {
  for (const p of NV_DUOC) assert.equal(duongDanDuocPhep(NV, p), true, p);
});

test("nhân viên: mọi trang còn lại của khu quản trị bị chặn", () => {
  for (const p of NV_CAM) assert.equal(duongDanDuocPhep(NV, p), false, p);
});

test("quản trị: mọi /admin/** được vào, ngoài /admin thì không", () => {
  for (const p of [...NV_DUOC, "/admin", "/admin/", "/admin/bao-cao-csdl", "/admin/lich-cang", "/admin/thong-bao", "/admin/khuyen-mai/create", "/admin/tai-khoan/abc/edit", "/admin/logo"]) {
    assert.equal(duongDanDuocPhep(ADMIN, p), true, p);
  }
  for (const p of ["/", "/Home", "/admin-x", "/administrator", "admin"]) assert.equal(duongDanDuocPhep(ADMIN, p), false, p);
});

test("khách, chưa đăng nhập, vai trò lạ: không đường dẫn nào được phép", () => {
  for (const q of [KHACH, null, undefined, 0, 4, NaN]) {
    for (const p of [...NV_DUOC, "/admin", "/admin/tai-khoan"]) assert.equal(duongDanDuocPhep(q, p), false, `${q} ${p}`);
  }
});

test("khớp theo đoạn đường dẫn, không khớp chuỗi thô", () => {
  for (const p of ["/admin/san-pham-x", "/admin/san-phamx/1", "/admin/don-hangs", "/admin/ban-tin2", "/admin/tran-dau.evil", "/admin/bien-thexyz"]) {
    assert.equal(duongDanDuocPhep(NV, p), false, p);
  }
});

test("biên: dấu / cuối, query, hash được bỏ; '..', '.', '//', '\\', %2e, %2f, ký tự điều khiển bị từ chối", () => {
  for (const p of ["/admin/san-pham/", "/admin/don-hang?trangThai=Chờ", "/admin/ban-tin#top", "/admin/tran-dau/create?x=1#y"]) assert.equal(duongDanDuocPhep(NV, p), true, p);
  assert.equal(duongDanDuocPhep(NV, "/admin?x=/admin/san-pham"), false, "query không được coi là đường dẫn");
  assert.equal(duongDanDuocPhep(NV, "/admin#/admin/san-pham"), false, "hash không được coi là đường dẫn");
  for (const p of [
    "/admin/san-pham/../khuyen-mai", "/admin/san-pham/..", "/admin/san-pham/./1", "//admin/san-pham", "/admin//san-pham", "/admin/san-pham//1",
    "/admin/san-pham/%2e%2e/khuyen-mai", "/admin/san-pham%2f..%2fkhuyen-mai", "/admin/san-pham/%2E%2E/tai-khoan", "/admin\\san-pham", "/admin/san-pham\\..\\logo",
    "/admin/san-pham/\u0000", "/admin/san-pham/\n", "/admin/san-pham/%00", "/admin/san-pham/%zz", "", "admin/san-pham", null, undefined,
  ]) {
    assert.equal(duongDanDuocPhep(NV, p), false, JSON.stringify(p));
    assert.equal(duongDanDuocPhep(ADMIN, p), false, `admin ${JSON.stringify(p)}`);
  }
});

test("chữ hoa: phân biệt hoa thường như router, nên biến thể viết hoa không lọt", () => {
  for (const p of ["/Admin/san-pham", "/admin/San-Pham", "/admin/DON-HANG", "/ADMIN"]) assert.equal(duongDanDuocPhep(NV, p), false, p);
  for (const p of ["/Admin/san-pham", "/ADMIN"]) assert.equal(duongDanDuocPhep(ADMIN, p), false, `admin ${p}`);
  assert.equal(duongDanDuocPhep(ADMIN, "/admin/San-Pham"), true, "admin vào mọi /admin/**, kể cả trang không tồn tại (router sẽ báo 404)");
});

test("menu: quản trị thấy mọi mục, nhân viên đúng 4 mục, còn lại không có gì", () => {
  const TAT_CA = ["/admin", "/admin/bao-cao-csdl", "/admin/san-pham", "/admin/don-hang", "/admin/lich-cang", "/admin/khuyen-mai", "/admin/ban-tin", "/admin/tran-dau", "/admin/tai-khoan", "/admin/logo", "/admin/thong-bao"];
  assert.deepEqual(TAT_CA.filter((h) => mucMenuTheoQuyen(ADMIN, h)), TAT_CA);
  assert.deepEqual(TAT_CA.filter((h) => mucMenuTheoQuyen(NV, h)), ["/admin/san-pham", "/admin/don-hang", "/admin/ban-tin", "/admin/tran-dau"]);
  for (const q of [KHACH, null, undefined, 0]) assert.deepEqual(TAT_CA.filter((h) => mucMenuTheoQuyen(q, h)), []);
  assert.equal(mucMenuTheoQuyen(NV, "/admin/bien-the"), false, "biến thể không có mục menu riêng");
});

test("mọi mục menu của nhân viên đều là trang nhân viên được vào (hai bảng không lệch)", () => {
  for (const h of ["/admin/san-pham", "/admin/don-hang", "/admin/ban-tin", "/admin/tran-dau"]) {
    assert.equal(mucMenuTheoQuyen(NV, h), true, h);
    assert.equal(duongDanDuocPhep(NV, h), true, h);
  }
});

test("chỉ nhân viên ở đúng /admin mới bị chuyển về trang đơn hàng", () => {
  assert.equal(canChuyenVeTrangNhanVien(NV, "/admin"), true);
  assert.equal(canChuyenVeTrangNhanVien(NV, "/admin/"), true);
  assert.equal(canChuyenVeTrangNhanVien(NV, "/admin?nam=2025"), true);
  assert.equal(canChuyenVeTrangNhanVien(NV, "/admin/tai-khoan"), false, "trang khác: hiện khối không có quyền, không chuyển");
  assert.equal(canChuyenVeTrangNhanVien(NV, "/admin/don-hang"), false);
  assert.equal(canChuyenVeTrangNhanVien(NV, "/admin/../admin"), false);
  for (const q of [ADMIN, KHACH, null, undefined]) assert.equal(canChuyenVeTrangNhanVien(q, "/admin"), false, String(q));
});

test("trang sau đăng nhập: nhân viên → đơn hàng; quản trị /admin; khách / như cũ", () => {
  assert.equal(TRANG_NHAN_VIEN, "/admin/don-hang");
  assert.equal(trangSauDangNhap(NV, true), "/admin/don-hang");
  assert.equal(trangSauDangNhap(NV, false), "/admin/don-hang");
  assert.equal(trangSauDangNhap(ADMIN, true), "/admin");
  assert.equal(trangSauDangNhap(ADMIN, false), "/", "hành vi cũ: admin đăng nhập ở form khách vẫn về /");
  assert.equal(trangSauDangNhap(KHACH, false), "/");
  assert.equal(trangSauDangNhap(KHACH, true), "/admin", "hành vi cũ: form quản trị luôn /admin (BE đã chặn khách)");
});

test("T-204: nhân viên vào trang con hợp lệ và không khớp tên gần giống", () => {
  for (const p of ["/admin/bien-the/abc/edit", "/admin/don-hang/DH001", "/admin/ban-tin/create", "/admin/tran-dau/x/edit"]) assert.equal(duongDanDuocPhep(NV, p), true, p);
  for (const p of ["/admin/san-pham.json", "/admin/sanpham", "/admin/logo"]) assert.equal(duongDanDuocPhep(NV, p), false, p);
});

test("C-4: chỉ quản trị có quyền xóa; nhân viên, khách, chưa đăng nhập, vai trò lạ thì không", () => {
  assert.equal(coQuyenXoa(ADMIN), true);
  for (const q of [NV, KHACH, null, undefined, 0, 4, NaN, "1"]) assert.equal(coQuyenXoa(q), false, String(q));
});

test("T-802: menu và đường dẫn Combo bán chạy chỉ dành cho quản trị", () => {
  assert.equal(mucMenuTheoQuyen(ADMIN, "/admin/khai-thac"), true);
  assert.equal(mucMenuTheoQuyen(NV, "/admin/khai-thac"), false);
  assert.equal(duongDanDuocPhep(ADMIN, "/admin/khai-thac"), true);
  assert.equal(duongDanDuocPhep(NV, "/admin/khai-thac"), false);
});

test("Combo bán chạy: /admin/khai-thac chỉ quản trị (trang, trang con, menu); nhân viên, khách, chưa đăng nhập bị chặn", () => {
  const KT = ["/admin/khai-thac", "/admin/khai-thac/", "/admin/khai-thac/abc", "/admin/khai-thac?k=5"];
  for (const p of KT) {
    assert.equal(duongDanDuocPhep(ADMIN, p), true, `admin ${p}`);
    for (const q of [NV, KHACH, null, undefined]) assert.equal(duongDanDuocPhep(q, p), false, `${String(q)} ${p}`);
  }
  for (const p of ["/admin/khai-thac/../don-hang", "/admin//khai-thac", "/admin/khai%2Fthac"]) assert.equal(duongDanDuocPhep(NV, p), false, p);
  assert.equal(mucMenuTheoQuyen(ADMIN, "/admin/khai-thac"), true);
  for (const q of [NV, KHACH, null, undefined]) assert.equal(mucMenuTheoQuyen(q, "/admin/khai-thac"), false, String(q));
  // Thêm mục này không làm đổi các quyền cũ.
  for (const p of NV_DUOC) assert.equal(duongDanDuocPhep(NV, p), true, p);
  assert.equal(canChuyenVeTrangNhanVien(NV, "/admin/khai-thac"), false, "không chuyển trang, hiện khối không có quyền");
  assert.equal(trangSauDangNhap(NV, true), "/admin/don-hang");
});
