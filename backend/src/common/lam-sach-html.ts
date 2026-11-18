import sanitizeHtml, { type IOptions } from 'sanitize-html';

/**
 * Làm sạch HTML bản tin theo danh sách cho phép (M5A-02): nhân viên được soạn định dạng cơ bản nhưng không được chạy script nào ở trình duyệt người đọc/admin.
 * Bỏ mọi thẻ/thuộc tính ngoài danh sách (kể cả onerror/onclick, style, iframe, script, form), chỉ nhận liên kết http/https/mailto hoặc đường dẫn nội bộ,
 * liên kết ra ngoài luôn mở tab mới với rel an toàn. Dùng cả khi LƯU và khi TRẢ về (để bài cũ đã lưu chưa sạch cũng được chặn).
 */
const TAG_CHO_PHEP = ['p', 'br', 'hr', 'b', 'strong', 'i', 'em', 'u', 's', 'small', 'sub', 'sup', 'blockquote', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div'];

const TIEN_TO_ID = 'bt-';
/** Tổng độ dài id đầu ra (gồm tiền tố bt- và hậu tố -n khi trùng). */
const DO_DAI_ID_TOI_DA = 60;
/** Phần đầu của id dùng làm khóa đếm hậu tố: ngắn hơn mọi độ dài sau khi chừa chỗ cho hậu tố (-n tối đa 8 ký tự) nên các id dài đụng nhau sau khi cắt dùng chung một bộ đếm. */
const DO_DAI_KHOA_DEM = DO_DAI_ID_TOI_DA - 8;

/**
 * Dạng id chuẩn: chỉ [A-Za-z0-9_-], luôn có tiền tố bt-, tổng độ dài ≤ 60. ĐIỂM CỐ ĐỊNH: chuanHoaId(chuanHoaId(x)) === chuanHoaId(x), nên lọc lại
 * (lưu rồi đọc lại) không đổi gì. Rỗng sau khi lọc → ''.
 */
export function chuanHoaId(raw: string): string {
  let s = raw.replace(/[^A-Za-z0-9_-]/g, '');
  if (s.startsWith(TIEN_TO_ID)) s = s.slice(TIEN_TO_ID.length);
  s = s.slice(0, DO_DAI_ID_TOI_DA - TIEN_TO_ID.length);
  return s ? `${TIEN_TO_ID}${s}` : '';
}

type BienDoiThe = (tagName: string, attribs: Record<string, string>) => { tagName: string; attribs: Record<string, string> };

/** Cấu hình sanitize-html DÙNG CHUNG cho hai lượt (thu thập id rồi ghi kết quả), nên cả hai lượt phân tích HTML y hệt nhau. */
function cauHinh(tieuDe: BienDoiThe, neo: BienDoiThe): IOptions {
  return {
    allowedTags: TAG_CHO_PHEP,
    allowedAttributes: { h2: ['id'], h3: ['id'], h4: ['id'], a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: { h2: tieuDe, h3: tieuDe, h4: tieuDe, a: neo },
  };
}

/**
 * Bộ cấp id cho MỘT bài: id gốc khác nhau mà chuẩn hóa ra cùng một dạng (ví dụ "a b" và "ab") hoặc cùng id gốc ở nhiều tiêu đề đều được đánh số -2, -3...
 * để id trong trang luôn duy nhất; neo trỏ tới tiêu đề đầu tiên mang id gốc đó. Danh sách id gốc lấy từ CHÍNH bộ phân tích của thư viện (lượt thu thập),
 * không dùng regex riêng, nên neo luôn khớp tiêu đề thật kể cả khi thuộc tính có dấu ">" hay entity.
 */
function taoBoCapId(html: string) {
  const dung = new Set<string>();
  const goc = new Map<string, string>(); // id gốc → id cuối cùng của lần xuất hiện đầu tiên
  const daCap = new Set<string>();
  // Hậu tố đã dùng gần nhất theo khóa (phần đầu của dạng chuẩn): tìm tiếp từ đó, không quét lại từ -2, nên số tiêu đề trùng lớn vẫn chạy tuyến tính.
  const hauToCuoi = new Map<string, number>();
  const capMoi = (raw: string): string => {
    const base = chuanHoaId(raw);
    if (!base) return '';
    let cuoi = base;
    if (dung.has(cuoi)) {
      const khoa = base.slice(0, DO_DAI_KHOA_DEM);
      let n = hauToCuoi.get(khoa) ?? 1;
      do {
        n++;
        const hau = `-${n}`;
        cuoi = base.slice(0, DO_DAI_ID_TOI_DA - hau.length) + hau;
      } while (dung.has(cuoi));
      hauToCuoi.set(khoa, n);
    }
    dung.add(cuoi);
    return cuoi;
  };

  // Lượt 1: thu thập id gốc theo thứ tự xuất hiện (kết quả của lượt này bị bỏ).
  const thuThap: BienDoiThe = (tagName, attribs) => {
    const raw = attribs.id;
    if (raw && !goc.has(raw)) goc.set(raw, capMoi(raw));
    return { tagName, attribs };
  };
  sanitizeHtml(html, cauHinh(thuThap, (tagName, attribs) => ({ tagName, attribs })));

  return {
    /** Id cho một tiêu đề đang được ghi ra (lần đầu của id gốc dùng id đã cấp ở lượt 1; lần sau cấp id mới duy nhất). */
    cuaTieuDe(raw: string): string {
      if (!raw) return '';
      if (!daCap.has(raw)) {
        daCap.add(raw);
        return goc.get(raw) ?? capMoi(raw);
      }
      return capMoi(raw);
    },
    /** Đích của neo "#raw". */
    cuaNeo(raw: string): string {
      return goc.get(raw) ?? chuanHoaId(raw);
    },
  };
}

export function lamSachHtmlTin(html: unknown): string {
  if (typeof html !== 'string') return '';
  const idBai = taoBoCapId(html);
  const tieuDe: BienDoiThe = (tagName, attribs) => {
    const { id, ...con } = attribs;
    const moi = id ? idBai.cuaTieuDe(id) : '';
    return { tagName, attribs: moi ? { ...con, id: moi } : con };
  };
  // Chỉ liên kết ra ngoài (http/https) mở tab mới với rel an toàn; neo (#...) và đường dẫn nội bộ giữ hành vi điều hướng bình thường.
  const neo: BienDoiThe = (tagName, attribs) => {
    const { target: _t, rel: _r, ...con } = attribs;
    void _t; void _r;
    const href = attribs.href ?? '';
    if (href.startsWith('#')) {
      const dich = idBai.cuaNeo(href.slice(1));
      return { tagName, attribs: { ...con, href: dich ? `#${dich}` : '#' } };
    }
    return /^https?:\/\//i.test(href) ? { tagName, attribs: { ...con, target: '_blank', rel: 'noopener noreferrer nofollow' } } : { tagName, attribs: con };
  };
  // id chỉ trên tiêu đề, ký tự an toàn, có tiền tố bt- để không đụng id/tên của trang (DOM clobbering); neo "#x" trỏ tới "#bt-x".
  return sanitizeHtml(html, cauHinh(tieuDe, neo));
}
