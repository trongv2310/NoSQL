import { Schema } from 'mongoose';
import { ALL_MODELS, TRANG_THAI } from '../schemas';
import { soSanhIndex } from './so-sanh-index';
import { MAU_BCRYPT, VALIDATORS } from './validators';

/** collection → schema Mongoose tương ứng. */
const schemaCua = (ten: string): Schema => {
  const def = ALL_MODELS.find((m) => (m.schema.get('collection') as string) === ten);
  if (!def) throw new Error(`Không có model cho collection ${ten}`);
  return def.schema as Schema;
};

/** Trường đó có luôn được ghi không: Mongoose bắt buộc hoặc có giá trị mặc định. */
const luonCo = (s: Schema, p: string) => {
  const kieu: any = s.path(p);
  return !!kieu && (kieu.isRequired || kieu.defaultValue !== undefined);
};

describe('validator $jsonSchema khớp với schema Mongoose', () => {
  for (const [ten, def] of Object.entries(VALIDATORS)) {
    const js = (def.validator as any).$jsonSchema;
    const s = schemaCua(ten);

    it(`${ten}: mọi trường trong validator đều có trong schema (bắt lỗi gõ sai tên)`, () => {
      for (const p of Object.keys(js.properties)) expect(s.path(p), `${ten}.${p}`).toBeTruthy();
    });

    it(`${ten}: trường bắt buộc trong validator luôn được ứng dụng ghi`, () => {
      for (const p of js.required) expect(luonCo(s, p), `${ten}.${p}`).toBe(true);
    });
  }

  it('donhangs.chiTiet: trường dòng hàng có trong schema con', () => {
    const con = (schemaCua('donhangs').path('chiTiet') as any).schema as Schema;
    const items = (VALIDATORS.donhangs.validator as any).$jsonSchema.properties.chiTiet.items;
    for (const p of Object.keys(items.properties)) expect(con.path(p), `chiTiet.${p}`).toBeTruthy();
  });

  it('donhangs: chấp nhận đủ mọi trạng thái mà code dùng', () => {
    const e = (VALIDATORS.donhangs.validator as any).$jsonSchema.properties.trangThai.enum;
    expect([...e].sort()).toEqual(Object.values(TRANG_THAI).sort());
  });

  it('donhangs: có ràng buộc tiền giữa các trường ($expr)', () => {
    const s = JSON.stringify((VALIDATORS.donhangs.validator as any).$expr);
    expect(s).toContain('$tongTienSauGiam');
    expect(s).toContain('$chiTiet.thanhTien');
    expect(s).toContain('$$d.donGia');
  });

  it('mẫu bcrypt nhận chuỗi băm thật, từ chối mật khẩu chữ thường', () => {
    const re = new RegExp(MAU_BCRYPT);
    expect(re.test('$2y$10$fJflhWzIK6ynLHuWeKzA9em0ICV8WhsJ6PRjdpkxJA3m1G7kK55Bm')).toBe(true);
    expect(re.test('$2b$12$' + 'a'.repeat(53))).toBe(true);
    expect(re.test('admin@123')).toBe(false);
    expect(re.test('$2b$12$ngan')).toBe(false);
  });
});

describe('so sánh index khai báo với CSDL', () => {
  const id = { name: '_id_', key: { _id: 1 } };

  it('tìm index thiếu và thừa, bỏ qua _id_', () => {
    const kq = soSanhIndex(
      [[{ khachHang: 1, ngayDat: -1, soDonHang: -1 }, { name: 'don_cua_khach' }], [{ soDonHang: 1 }, { unique: true }]],
      [id, { name: 'soDonHang_1', key: { soDonHang: 1 }, unique: true }, { name: 'khachHang_1', key: { khachHang: 1 } }],
    );
    expect(kq.thieu.map((x) => x[0])).toEqual([{ khachHang: 1, ngayDat: -1, soDonHang: -1 }]);
    expect(kq.thua.map((x) => x.name)).toEqual(['khachHang_1']);
    expect(kq.lech).toEqual([]);
  });

  it('thứ tự trường và chiều sắp là một phần của khoá', () => {
    const kq = soSanhIndex([[{ a: 1, b: -1 }]], [id, { name: 'b_-1_a_1', key: { b: -1, a: 1 } }]);
    expect(kq.thieu).toHaveLength(1);
    expect(kq.thua).toHaveLength(1);
  });

  it('cùng khoá khác tuỳ chọn thì báo lệch, không coi là thiếu', () => {
    const kq = soSanhIndex(
      [[{ ngayXoa: 1 }, { expireAfterSeconds: 2592000 }], [{ sku: 1 }, { unique: true }]],
      [id, { name: 'ngayXoa_1', key: { ngayXoa: 1 }, expireAfterSeconds: 60 }, { name: 'sku_1', key: { sku: 1 } }],
    );
    expect(kq.thieu).toEqual([]);
    expect(kq.lech.map((l) => [l.thucTe.name, l.khac])).toEqual([
      ['ngayXoa_1', ['expireAfterSeconds']],
      ['sku_1', ['unique']],
    ]);
  });

  it('unique: false trong code và không có cờ trong CSDL là như nhau', () => {
    const kq = soSanhIndex([[{ a: 1 }, { unique: false, background: true }]], [id, { name: 'a_1', key: { a: 1 } }]);
    expect(kq).toEqual({ thieu: [], thua: [], lech: [] });
  });
});
