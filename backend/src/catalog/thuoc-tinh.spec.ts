import { readFileSync } from 'fs';
import { join } from 'path';
import { docChuoi } from '../seed/du-lieu-mongodb';
import { cungThuocTinh, dieuKienThuocTinh, docSucCangLbs, docTrongLuong, thuocTinhTuThongSo, ThuocTinh } from './thuoc-tinh';
import { BoLocThongSo, bienTheKhopBoLoc, LOI_CHOI_KHOA, NHOM_CAN_BANG, NHOM_DO_CUNG, ThongSoVotTho } from './vot-thong-so';

/** Toàn bộ biến thể có thông số trong bộ dữ liệu dùng chung của team. */
const BIEN_THE = docChuoi(readFileSync(join(__dirname, '../../seed-data/mongodb/chitietsanphams.json'), 'utf8'))
  .map((d) => d.thongSo as ThongSoVotTho | undefined)
  .filter((t): t is ThongSoVotTho => !!t);

describe('thuocTinhTuThongSo', () => {
  it('đọc đủ một bộ thông số thật thành số', () => {
    const r = thuocTinhTuThongSo({ doCanBang: 'Nặng đầu', trongLuong: '4U (80-84g)', doCung: 'Cứng', chieuDai: '675mm', sucCang: '20-28 lbs' });
    expect(r).toEqual([
      { k: 'canBangBac', v: 2 },
      { k: 'doCungBac', v: 2 },
      { k: 'trongLuongU', v: 4 },
      { k: 'trongLuongMinG', v: 80 },
      { k: 'trongLuongMaxG', v: 84 },
      { k: 'chieuDaiMm', v: 675 },
      { k: 'sucCangMinLbs', v: 20 },
      { k: 'sucCangMaxLbs', v: 28 },
      { k: 'loiChoi', v: 'cong' },
    ]);
  });

  it(`mọi biến thể trong seed (${BIEN_THE.length} biến thể) đều đọc đủ 8 thuộc tính số, không bỏ sót`, () => {
    expect(BIEN_THE.length).toBeGreaterThan(50);
    const thieu: string[] = [];
    for (const ts of BIEN_THE) {
      const k = new Set(thuocTinhTuThongSo(ts).map((t) => t.k));
      for (const can of ['canBangBac', 'doCungBac', 'trongLuongU', 'trongLuongMinG', 'trongLuongMaxG', 'chieuDaiMm', 'sucCangMinLbs', 'sucCangMaxLbs']) {
        if (!k.has(can as never)) thieu.push(`${JSON.stringify(ts)} thiếu ${can}`);
      }
    }
    expect(thieu).toEqual([]);
  });

  it('không đoán: chuỗi lạ hoặc thiếu đơn vị thì bỏ thuộc tính đó', () => {
    const r = thuocTinhTuThongSo({ doCanBang: 'Khó nói', trongLuong: 'nhẹ', doCung: '', chieuDai: '67,5cm', sucCang: '20-28' });
    expect(r).toEqual([]);
  });

  it('không có thông số → mảng rỗng', () => {
    expect(thuocTinhTuThongSo(null)).toEqual([]);
    expect(thuocTinhTuThongSo(undefined)).toEqual([]);
  });

  it('lối chơi chỉ có khi đủ cả cân bằng lẫn độ cứng (như loiChoiCuaVot)', () => {
    expect(thuocTinhTuThongSo({ doCanBang: 'Cân bằng' }).filter((t) => t.k === 'loiChoi')).toEqual([]);
    expect(thuocTinhTuThongSo({ doCanBang: 'Hơi nặng đầu', doCung: 'Trung bình' }).filter((t) => t.k === 'loiChoi').map((t) => t.v)).toEqual(['cong', 'toan']);
  });
});

describe('đọc từng trường', () => {
  it('trọng lượng', () => {
    expect(docTrongLuong('3U (85-89g)')).toEqual({ u: 3, minG: 85, maxG: 89 });
    expect(docTrongLuong('5U')).toEqual({ u: 5 });
    expect(docTrongLuong('85-89g')).toEqual({ minG: 85, maxG: 89 });
    expect(docTrongLuong('3U (89-85g)')).toEqual({ u: 3 });
  });

  it('sức căng: lbs, kg đổi sang lbs, chỉ có mức tối đa, thiếu đơn vị', () => {
    expect(docSucCangLbs('20-28 lbs')).toEqual({ minLbs: 20, maxLbs: 28 });
    expect(docSucCangLbs('9 – 13 kg')).toEqual({ minLbs: 19.84, maxLbs: 28.66 });
    expect(docSucCangLbs('tối đa 30 lbs')).toEqual({ minLbs: null, maxLbs: 30 });
    expect(docSucCangLbs('28lbs')).toEqual({ minLbs: null, maxLbs: 28 });
    expect(docSucCangLbs('20-28')).toBeNull();
    expect(docSucCangLbs('30-20 lbs')).toBeNull();
    expect(docSucCangLbs('')).toBeNull();
  });

  it('chỉ ghi sucCangMinLbs khi nguồn có cận dưới', () => {
    const k = thuocTinhTuThongSo({ sucCang: 'tối đa 30 lbs' }).map((t) => t.k);
    expect(k).toEqual(['sucCangMaxLbs']);
  });
});

describe('cungThuocTinh', () => {
  it('không phụ thuộc thứ tự, phân biệt kiểu số/chuỗi', () => {
    const a: ThuocTinh[] = [{ k: 'trongLuongU', v: 4 }, { k: 'loiChoi', v: 'cong' }];
    expect(cungThuocTinh(a, [...a].reverse())).toBe(true);
    expect(cungThuocTinh(a, [{ k: 'trongLuongU', v: '4' }, { k: 'loiChoi', v: 'cong' }])).toBe(false);
    expect(cungThuocTinh(undefined, [])).toBe(true);
  });
});

/**
 * Bộ chấm điều kiện MongoDB rút gọn (đủ các toán tử mà dieuKienThuocTinh sinh ra) để so với bộ lọc cũ mà không cần CSDL.
 * Bài so trên MongoDB thật nằm ở bo-loc-mongo.spec.ts (chạy khi có MONGO_TEST_URI).
 */
function khop(doc: { thuocTinh: ThuocTinh[] }, q: any): boolean {
  if (q.$and) return q.$and.every((x: any) => khop(doc, x));
  if (q.$or) return q.$or.some((x: any) => khop(doc, x));
  if (q.$expr === false) return false;
  const em = q.thuocTinh.$elemMatch;
  const gt = (v: any, dk: any) =>
    dk !== null && typeof dk === 'object'
      ? Object.entries(dk).every(([op, x]: [string, any]) =>
          op === '$gt' ? v > x : op === '$lt' ? v < x : op === '$gte' ? v >= x : op === '$in' ? x.includes(v) : false,
        )
      : v === dk;
  return doc.thuocTinh.some((t) => t.k === em.k && gt(t.v, em.v));
}

/** Mọi tập con của một danh sách. */
const tapCon = <T,>(ds: readonly T[]): T[][] => ds.reduce<T[][]>((acc, x) => [...acc, ...acc.map((a) => [...a, x])], [[]]);

describe('dieuKienThuocTinh cho kết quả y hệt bienTheKhopBoLoc', () => {
  it('không chọn gì → không lọc', () => {
    expect(dieuKienThuocTinh({ loiChoi: [], canBang: [], trongLuong: [], doCung: [] })).toBeNull();
  });

  it('mọi tổ hợp bộ lọc × mọi biến thể trong seed', () => {
    const docs = BIEN_THE.map((ts) => ({ ts, thuocTinh: thuocTinhTuThongSo(ts) }));
    let soLanSo = 0;
    const lech: string[] = [];
    for (const canBang of tapCon(NHOM_CAN_BANG))
      for (const doCung of tapCon(NHOM_DO_CUNG))
        for (const trongLuong of tapCon(['3u', '4u', '5u']))
          for (const loiChoi of tapCon(LOI_CHOI_KHOA)) {
            const b: BoLocThongSo = { canBang, doCung, trongLuong, loiChoi };
            const q = dieuKienThuocTinh(b);
            for (const d of docs) {
              soLanSo++;
              const cu = bienTheKhopBoLoc(d.ts, b);
              const moi = q === null ? true : khop(d, q);
              // bienTheKhopBoLoc với bộ lọc rỗng trả true cho mọi biến thể có thông số: cùng nghĩa với "không lọc".
              if (cu !== moi) lech.push(`${JSON.stringify(b)} ${JSON.stringify(d.ts)}: cũ ${cu}, mới ${moi}`);
            }
          }
    expect(soLanSo).toBe(8 * 8 * 8 * 8 * BIEN_THE.length);
    expect(lech.slice(0, 5)).toEqual([]);
  });
});
