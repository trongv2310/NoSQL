/**
 * So sánh index khai báo trong Mongoose với index đang có trong MongoDB. Hàm thuần để test được không cần CSDL.
 * Hai index được coi là "cùng một cái" khi có cùng khoá (cùng trường, cùng chiều, cùng thứ tự).
 * Text index được MongoDB lưu với khoá `{ _fts: 'text', _ftsx: 1 }`, còn tên trường nằm ở `weights`: khoá khai báo được đổi về
 * dạng đó trước khi so, và trọng số / ngôn ngữ mặc định được so như tuỳ chọn.
 */

export interface IndexThucTe {
  name: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
  weights?: Record<string, number>;
  default_language?: string;
}

/** Một phần tử của `schema.indexes()` trong Mongoose: [khoá, tuỳ chọn]. */
export type IndexKhaiBao = [Record<string, unknown>, Record<string, unknown>?];

export interface KetQuaSoSanh {
  /** Khai báo trong code nhưng chưa có trong CSDL: `db:setup` sẽ tạo. */
  thieu: IndexKhaiBao[];
  /** Có trong CSDL nhưng code không khai báo (trừ `_id_`): chỉ xoá khi có `--xoa-index-thua`. */
  thua: IndexThucTe[];
  /** Cùng khoá nhưng khác tuỳ chọn (unique/sparse/TTL/partial): phải xử lý tay, tạo lại sẽ lỗi IndexOptionsConflict. */
  lech: { khaiBao: IndexKhaiBao; thucTe: IndexThucTe; khac: string[] }[];
}

const truongText = (key: Record<string, unknown>) => Object.keys(key).filter((k) => key[k] === 'text');

export function khoaIndex(key: Record<string, unknown>): string {
  const ds: [string, unknown][] = [];
  let daCoText = false;
  for (const [k, v] of Object.entries(key)) {
    if (k === '_ftsx') continue; // khoá text index đã lưu trong CSDL: _fts đã đại diện
    if (v === 'text') {
      if (!daCoText) ds.push(['_fts', 'text'], ['_ftsx', 1]);
      daCoText = true;
    } else ds.push([k, Number(v) || v]);
  }
  return JSON.stringify(ds);
}

const TUY_CHON = ['unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression', 'weights', 'default_language'] as const;

/**
 * Mongoose bỏ trống thì MongoDB coi là false/không có: chuẩn hoá về cùng một dạng trước khi so.
 * `key` chỉ truyền cho index KHAI BÁO (để biết trường text nào, trọng số mặc định 1, ngôn ngữ mặc định "english").
 */
const chuanHoaTuyChon = (o: Record<string, unknown> | undefined, ten: (typeof TUY_CHON)[number], key?: Record<string, unknown>) => {
  const v = o?.[ten];
  if (ten === 'unique' || ten === 'sparse') return Boolean(v);
  if (ten === 'weights') {
    const w = key ? Object.fromEntries(truongText(key).map((f) => [f, Number((v as Record<string, number>)?.[f] ?? 1)])) : (v as Record<string, number>);
    return w && Object.keys(w).length ? JSON.stringify(Object.entries(w).sort(([a], [b]) => a.localeCompare(b))) : null;
  }
  if (ten === 'default_language') return key ? (truongText(key).length ? String(v ?? 'english') : null) : v ? String(v) : null;
  return v === undefined || v === null ? null : JSON.stringify(v);
};

export function soSanhIndex(khaiBao: IndexKhaiBao[], thucTe: IndexThucTe[]): KetQuaSoSanh {
  const conLai = thucTe.filter((i) => i.name !== '_id_');
  const theoKhoa = new Map(conLai.map((i) => [khoaIndex(i.key), i]));
  const kq: KetQuaSoSanh = { thieu: [], thua: [], lech: [] };
  const daGap = new Set<string>();
  for (const kb of khaiBao) {
    const k = khoaIndex(kb[0]);
    daGap.add(k);
    const tt = theoKhoa.get(k);
    if (!tt) {
      kq.thieu.push(kb);
      continue;
    }
    const khac = TUY_CHON.filter((t) => chuanHoaTuyChon(kb[1], t, kb[0]) !== chuanHoaTuyChon(tt as unknown as Record<string, unknown>, t));
    if (khac.length) kq.lech.push({ khaiBao: kb, thucTe: tt, khac });
  }
  kq.thua = conLai.filter((i) => !daGap.has(khoaIndex(i.key)));
  return kq;
}
