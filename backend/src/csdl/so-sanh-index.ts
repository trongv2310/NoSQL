/**
 * So sánh index khai báo trong Mongoose với index đang có trong MongoDB. Hàm thuần để test được không cần CSDL.
 * Hai index được coi là "cùng một cái" khi có cùng khoá (cùng trường, cùng chiều, cùng thứ tự).
 */

export interface IndexThucTe {
  name: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
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

export const khoaIndex = (key: Record<string, unknown>) => JSON.stringify(Object.entries(key).map(([k, v]) => [k, Number(v) || v]));

const TUY_CHON = ['unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression'] as const;

/** Mongoose bỏ trống thì MongoDB coi là false/không có: chuẩn hoá về cùng một dạng trước khi so. */
const chuanHoaTuyChon = (o: Record<string, unknown> | undefined, ten: (typeof TUY_CHON)[number]) => {
  const v = o?.[ten];
  if (ten === 'unique' || ten === 'sparse') return Boolean(v);
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
    const khac = TUY_CHON.filter((t) => chuanHoaTuyChon(kb[1], t) !== chuanHoaTuyChon(tt as unknown as Record<string, unknown>, t));
    if (khac.length) kq.lech.push({ khaiBao: kb, thucTe: tt, khac });
  }
  kq.thua = conLai.filter((i) => !daGap.has(khoaIndex(i.key)));
  return kq;
}
