// Kiểm tra file ảnh trước khi upload (C-5): đuôi, dung lượng, mime, không chọn file. Chạy: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { ANH_TOI_DA_BYTE, DUOI_ANH, anhChinhChiTiet, kiemTraAnh } from "./anh-upload.ts";

const f = (name, size = 1000, type) => ({ name, size, ...(type === undefined ? {} : { type }) });
const LOI_DUOI = "Hình ảnh phải có định dạng jpg, jpeg, png, webp hoặc gif.";

test("không chọn file (null/undefined) là hợp lệ", () => {
  assert.equal(kiemTraAnh(null), null);
  assert.equal(kiemTraAnh(undefined), null);
});

test("hằng số khớp backend: 5MB và 5 đuôi", () => {
  assert.equal(ANH_TOI_DA_BYTE, 5 * 1024 * 1024);
  assert.deepEqual(DUOI_ANH, ["jpg", "jpeg", "png", "webp", "gif"]);
});

test("đuôi hợp lệ, không phân biệt hoa thường", () => {
  for (const n of ["a.jpg", "a.jpeg", "a.png", "a.webp", "a.gif", "A.JPG", "b.PnG", "c.WebP", "d.GIF"]) assert.equal(kiemTraAnh(f(n)), null, n);
});

test("đuôi không hợp lệ bị từ chối", () => {
  for (const n of ["a.svg", "a.bmp", "a.avif", "a.heic", "a.pdf", "a.exe", "a.txt", "a.jpg.exe", "a.png ", "a.jp", "a.jpgx"]) assert.equal(kiemTraAnh(f(n)), LOI_DUOI, n);
});

test("không có đuôi (kể cả tên rỗng, kết thúc bằng dấu chấm, file ẩn) là lỗi", () => {
  for (const n of ["anh", "", "anh.", ".png", ".jpg", "png"]) assert.equal(kiemTraAnh(f(n)), LOI_DUOI, JSON.stringify(n));
});

test("nhiều dấu chấm: lấy đuôi sau dấu chấm cuối", () => {
  assert.equal(kiemTraAnh(f("vot.yonex.astrox.PNG")), null);
  assert.equal(kiemTraAnh(f("a.png.svg")), LOI_DUOI);
  assert.equal(kiemTraAnh(f("my.photo.final.jpeg")), null);
  assert.equal(kiemTraAnh(f("archive.jpg.zip")), LOI_DUOI);
});

test("dung lượng: 0 byte lỗi rỗng; đúng 5MB hợp lệ; 5MB + 1 lỗi", () => {
  assert.equal(kiemTraAnh(f("a.png", 0)), "File ảnh rỗng.");
  assert.equal(kiemTraAnh(f("a.png", 1)), null);
  assert.equal(kiemTraAnh(f("a.png", ANH_TOI_DA_BYTE)), null);
  assert.equal(kiemTraAnh(f("a.png", ANH_TOI_DA_BYTE + 1)), "Ảnh vượt quá 5MB.");
  assert.equal(kiemTraAnh(f("a.png", 50 * 1024 * 1024)), "Ảnh vượt quá 5MB.");
});

test("type: có mà không bắt đầu image/ thì lỗi định dạng; vắng hoặc rỗng thì bỏ qua", () => {
  assert.equal(kiemTraAnh(f("a.png", 10, "image/png")), null);
  assert.equal(kiemTraAnh(f("a.jpg", 10, "image/jpeg")), null);
  assert.equal(kiemTraAnh(f("a.png", 10, "application/pdf")), LOI_DUOI);
  assert.equal(kiemTraAnh(f("a.png", 10, "text/plain")), LOI_DUOI);
  assert.equal(kiemTraAnh(f("a.png", 10, "")), null, "trình duyệt không nhận ra mime thì để backend quyết");
  assert.equal(kiemTraAnh(f("a.png", 10)), null);
});

test("thứ tự lỗi: đuôi sai báo trước dung lượng; rỗng báo trước quá cỡ không xảy ra cùng lúc", () => {
  assert.equal(kiemTraAnh(f("a.svg", 0)), LOI_DUOI);
  assert.equal(kiemTraAnh(f("a.svg", ANH_TOI_DA_BYTE + 1)), LOI_DUOI);
  assert.equal(kiemTraAnh(f("a.png", 0, "application/pdf")), LOI_DUOI);
});

test("nhận File thật của Node (có name, size, type)", () => {
  assert.equal(kiemTraAnh(new File([new Uint8Array(10)], "x.webp", { type: "image/webp" })), null);
  assert.equal(kiemTraAnh(new File([], "x.webp", { type: "image/webp" })), "File ảnh rỗng.");
  assert.equal(kiemTraAnh(new File([new Uint8Array(10)], "x.txt", { type: "text/plain" })), LOI_DUOI);
});

test("T-404: tên Unicode, khoảng trắng và đuôi hoa thường lẫn lộn", () => {
  for (const name of ["Vợt cầu lông 01.JPEG", "ảnh đẹp.Webp", "  hình ảnh .jPeG", "🏸.PnG"]) assert.equal(kiemTraAnh(f(name, 42, "image/jpeg")), null, name);
});

test("T-406: anhChinhChiTiet — chưa chọn phiên bản thì luôn là ảnh đại diện, kể cả khi biến thể có ảnh riêng", () => {
  assert.equal(anhChinhChiTiet({ anhDaiDien: "uploads/sanpham/moi.jpg", anhBienThe: "uploads/sanpham/cu.jpg", daChonPhienBan: false }), "uploads/sanpham/moi.jpg");
  assert.equal(anhChinhChiTiet({ anhDaiDien: "moi.jpg", anhBienThe: undefined, daChonPhienBan: false }), "moi.jpg");
  assert.equal(anhChinhChiTiet({ anhDaiDien: "moi.jpg", anhBienThe: null, daChonPhienBan: false }), "moi.jpg");
});

test("T-406: anhChinhChiTiet — đã chọn phiên bản có ảnh riêng thì dùng ảnh biến thể", () => {
  assert.equal(anhChinhChiTiet({ anhDaiDien: "dd.jpg", anhBienThe: "uploads/sanpham/bt.jpg", daChonPhienBan: true }), "uploads/sanpham/bt.jpg");
});

test("T-406: anhChinhChiTiet — đã chọn nhưng biến thể không ảnh (rỗng/null/undefined) thì dùng ảnh đại diện", () => {
  for (const bt of ["", null, undefined]) assert.equal(anhChinhChiTiet({ anhDaiDien: "dd.jpg", anhBienThe: bt, daChonPhienBan: true }), "dd.jpg", String(bt));
});

test("T-407: giữ nguyên ảnh biến thể toàn khoảng trắng, URL tuyệt đối hoặc đường dẫn upload", () => {
  for (const anhBienThe of ["   ", "https://example.com/a.jpg", "http://example.com/a.jpg", "uploads/sanpham/a.jpg"]) {
    assert.equal(anhChinhChiTiet({ anhDaiDien: "dd.jpg", anhBienThe, daChonPhienBan: true }), anhBienThe);
    assert.equal(anhChinhChiTiet({ anhDaiDien: "dd.jpg", anhBienThe, daChonPhienBan: false }), "dd.jpg");
  }
});
