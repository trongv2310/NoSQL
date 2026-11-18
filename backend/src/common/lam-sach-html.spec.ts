import { chuanHoaId, lamSachHtmlTin } from './lam-sach-html';

describe('lamSachHtmlTin (M5A-02)', () => {
  it('giữ định dạng cơ bản', () => {
    expect(lamSachHtmlTin('<p>Xin <strong>chào</strong></p><ul><li>a</li></ul>')).toBe('<p>Xin <strong>chào</strong></p><ul><li>a</li></ul>');
  });
  it('bỏ script, iframe, style và mọi thuộc tính sự kiện', () => {
    const r = lamSachHtmlTin('<p onclick="x()">a</p><script>alert(1)</script><iframe src="https://e.com"></iframe><img src="https://e.com/a.png" onerror="alert(1)"><style>p{}</style>');
    expect(r).not.toMatch(/script|iframe|onerror|onclick|<style|alert/i);
    expect(r).toContain('<img src="https://e.com/a.png" />');
  });
  it('chặn URL thực thi (javascript:, data:) ở liên kết và ảnh', () => {
    const r = lamSachHtmlTin('<a href="javascript:alert(1)">x</a><a href="JaVaScRiPt:alert(1)">y</a><img src="data:text/html,<script>1</script>"><img src="javascript:1">');
    expect(r).not.toMatch(/javascript:|data:/i);
  });
  it('liên kết hợp lệ luôn mở tab mới với rel an toàn', () => {
    expect(lamSachHtmlTin('<a href="https://shop.vn/x">x</a>')).toBe('<a href="https://shop.vn/x" target="_blank" rel="noopener noreferrer nofollow">x</a>');
  });
  it('neo và liên kết nội bộ không bị ép mở tab mới (M5R1-N02)', () => {
    expect(lamSachHtmlTin('<a href="#thong-so">a</a>')).toBe('<a href="#bt-thong-so">a</a>');
    expect(lamSachHtmlTin('<a href="/SanPham/Index" target="_blank">b</a>')).toBe('<a href="/SanPham/Index">b</a>');
  });
  it('neo trỏ được tới tiêu đề: id có tiền tố bt- và ký tự an toàn; id trên thẻ khác bị bỏ (M5R2-N02)', () => {
    const r = lamSachHtmlTin('<h2 id="thong so!">T</h2><a href="#thong so!">m</a><p id="x">p</p><h3 id="location">L</h3>');
    expect(r).toContain('<h2 id="bt-thongso">T</h2>');
    expect(r).toContain('<a href="#bt-thongso">m</a>');
    expect(r).toContain('<h3 id="bt-location">L</h3>'); // không thể ghi đè window.location
    expect(r).not.toContain('id="x"');
  });
  it('idempotent: lọc nhiều lần cho cùng kết quả, id/neo không bị chồng tiền tố bt-bt- (M5R3-F02)', () => {
    const goc = '<h2 id="muc 1">T</h2><a href="#muc 1">m</a><a href="#">top</a><a href="#!!!">x</a>';
    const mot = lamSachHtmlTin(goc);
    expect(lamSachHtmlTin(mot)).toBe(mot);
    expect(mot).toContain('<h2 id="bt-muc1">T</h2>');
    expect(mot).toContain('<a href="#bt-muc1">m</a>');
    expect(mot).toContain('<a href="#">top</a>'); // fragment rỗng giữ nguyên, không trỏ nhầm tới "#bt-"
    expect(mot).toContain('<a href="#">x</a>'); // fragment chỉ có ký tự bị lọc coi như rỗng
  });
  it('id dài: độ dài tổng (gồm bt-) ≤ 60 và là điểm cố định của phép lọc (M5R4-F02)', () => {
    const dai = 'a'.repeat(200);
    const r1 = chuanHoaId(dai);
    expect(r1.length).toBeLessThanOrEqual(60);
    expect(chuanHoaId(r1)).toBe(r1);
    expect(chuanHoaId('bt-bt-x')).toBe('bt-bt-x');
    expect(chuanHoaId(chuanHoaId('bt-bt-x'))).toBe('bt-bt-x');
    const html = '<h2 id="' + dai + '">T</h2><a href="#' + dai + '">m</a>';
    const mot = lamSachHtmlTin(html);
    expect(lamSachHtmlTin(mot)).toBe(mot);
  });
  it('id gốc khác nhau nhưng chuẩn hóa trùng nhau vẫn ra id duy nhất; neo trỏ đúng tiêu đề của nó, kể cả khi mục lục đứng trước (M5R4-F02)', () => {
    const goc = '<a href="#a b">1</a><a href="#ab">2</a><h2 id="a b">A</h2><h2 id="ab">B</h2>';
    const mot = lamSachHtmlTin(goc);
    expect(mot).toContain('<h2 id="bt-ab">A</h2>');
    expect(mot).toContain('<h2 id="bt-ab-2">B</h2>');
    expect(mot).toContain('<a href="#bt-ab">1</a>');
    expect(mot).toContain('<a href="#bt-ab-2">2</a>');
    expect(lamSachHtmlTin(mot)).toBe(mot);
  });
  it('cùng id gốc ở nhiều tiêu đề: id trong trang vẫn duy nhất, neo trỏ tiêu đề đầu', () => {
    const mot = lamSachHtmlTin('<h2 id="x">1</h2><h3 id="x">2</h3><a href="#x">t</a>');
    expect(mot).toContain('<h2 id="bt-x">1</h2>');
    expect(mot).toContain('<h3 id="bt-x-2">2</h3>');
    expect(mot).toContain('<a href="#bt-x">t</a>');
    expect(lamSachHtmlTin(mot)).toBe(mot);
  });
  it('hàng chục nghìn tiêu đề trùng id: chạy tuyến tính, id vẫn duy nhất (M5R5-P2-01)', () => {
    const html = '<h2 id="broken"'.repeat(35000) + '>' + '<h2 id="broken">'.repeat(35000);
    const t0 = Date.now();
    const r = lamSachHtmlTin(html);
    expect(Date.now() - t0).toBeLessThan(5000); // trước khi sửa: hơn 2 phút (vòng lặp tìm hậu tố O(n²))
    const ids = [...r.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(30000);
  });
  it('neo trỏ đúng tiêu đề khi thuộc tính đứng trước id có dấu > hoặc entity (id lấy từ chính bộ phân tích, không regex riêng) (M5R6-F02)', () => {
    const goc = `<a href="#x">t</a><h2 title="a>b" id="x">1</h2><h2 title="&gt;" id="x">2</h2><h3 title='q"r>s' id="y">3</h3><a href="#y">u</a>`;
    const mot = lamSachHtmlTin(goc);
    expect(mot).toContain('id="bt-x"');
    expect(mot).toContain('id="bt-x-2"');
    expect(mot).toContain('id="bt-y"');
    expect(mot).toContain('<a href="#bt-x">t</a>'); // neo tới tiêu đề ĐẦU của id x
    expect(mot).toContain('<a href="#bt-y">u</a>');
    const ids = [...mot.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(lamSachHtmlTin(mot)).toBe(mot);
  });
  it('nhiều id dài khác nhau đụng nhau sau khi cắt hậu tố: vẫn duy nhất và tuyến tính (M5R6-NV-PERF-01)', () => {
    const tien = 'a'.repeat(55);
    const html = Array.from({ length: 20000 }, (_, i) => '<h2 id="' + tien + i + '">t</h2>').join('');
    const t0 = Date.now();
    const r = lamSachHtmlTin(html);
    expect(Date.now() - t0).toBeLessThan(5000);
    const ids = [...r.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(20000);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((x) => x.length <= 60)).toBe(true);
  });
  it('giá trị không phải chuỗi trả chuỗi rỗng', () => {
    expect(lamSachHtmlTin(undefined)).toBe('');
    expect(lamSachHtmlTin(null)).toBe('');
  });
});
