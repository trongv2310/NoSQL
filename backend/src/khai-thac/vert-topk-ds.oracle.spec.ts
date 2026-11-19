import { VertTopKDS, type GiaoDichDto } from './vert-topk-ds';

type Mon = [number, number];
const gd = (tid: number, mon: Mon[]): GiaoDichDto => ({
  tid,
  items: new Map(mon.map(([id]) => [id, 1])),
  utils: new Map(mon),
  tu: mon.reduce((s, [, utility]) => s + utility, 0),
});

/** Vét cạn độc lập: chỉ cộng utility của các món trong tập khi đơn chứa đủ tập. */
function vetCan(batches: GiaoDichDto[][], winSize: number, _k: number) {
  if (batches.length < winSize) return [];
  const don = batches.slice(-winSize).flat().filter((d) => d.items.size >= 2);
  const ids = [...new Set(don.flatMap((d) => [...d.items.keys()]))].sort((a, b) => a - b);
  const ketQua: { khoa: string; utility: number }[] = [];
  for (let mask = 1; mask < 2 ** ids.length; mask++) {
    const tap = ids.filter((_, i) => (mask & (1 << i)) !== 0);
    if (tap.length < 2) continue;
    let utility = 0;
    let coDon = false;
    for (const d of don) {
      if (tap.every((id) => d.items.has(id))) {
        coDon = true;
        utility += tap.reduce((s, id) => s + (d.utils.get(id) ?? 0), 0);
      }
    }
    if (coDon) ketQua.push({ khoa: tap.join(','), utility });
  }
  return ketQua.sort((a, b) => b.utility - a.utility);
}

function kiemTra(batches: GiaoDichDto[][], winSize: number, k: number) {
  const miner = new VertTopKDS(k, winSize);
  for (let i = 0; i < batches.length; i++) miner.xuLyBatch(`batch-${i}`, batches[i]);
  const oracle = vetCan(batches, winSize, k);
  const thucTe = miner.layKetQua();
  const mongDoi = oracle.slice(0, k);
  expect(thucTe.map((x) => x.utility)).toEqual(mongDoi.map((x) => x.utility));
  for (const x of thucTe) {
    expect(x.itemset.length).toBeGreaterThanOrEqual(2);
    expect(x.itemset).toEqual([...x.itemset].sort((a, b) => a - b));
    expect(x.khoa).toBe(x.itemset.join(','));
  }
  expect(new Set(thucTe.map((x) => x.khoa)).size).toBe(thucTe.length);
  if (oracle.length <= k || oracle[k - 1].utility > oracle[k].utility) {
    expect(thucTe.map((x) => x.khoa).sort()).toEqual(mongDoi.map((x) => x.khoa).sort());
  }
}

describe('VertTopKDS so với oracle vét cạn', () => {
  it('một đơn hai món và K lớn hơn số tập', () => {
    const batches = [[gd(1, [[1, 3], [2, 7]])]];
    expect(vetCan(batches, 1, 10)).toEqual([{ khoa: '1,2', utility: 10 }]);
    kiemTra(batches, 1, 10);
  });

  it('nhiều tập chung đơn, K=1 và hòa utility', () => {
    const batches = [[gd(1, [[1, 1], [2, 1], [3, 1]]), gd(2, [[1, 1], [2, 1]])]];
    expect(vetCan(batches, 1, 10).map((x) => x.utility)).toEqual([4, 3, 2, 2]);
    kiemTra(batches, 1, 1);
    kiemTra(batches, 1, 3);
  });

  it.each([1, 2, 3])('cửa sổ %i, batch rỗng, đơn một món và trượt', (winSize) => {
    const batches = [[gd(1, [[1, 3], [2, 7]])], [], [gd(2, [[3, 99]]), gd(3, [[2, 4], [3, 6]])], [gd(4, [[4, 5], [5, 9]])]];
    for (let n = 0; n <= batches.length; n++) kiemTra(batches.slice(0, n), winSize, 8);
  });

  it('250 bộ dữ liệu nhỏ sinh từ seed cố định, so utility và khóa khi biên không hòa', () => {
    let seed = 0x31415926;
    const rand = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 65536) % n; };
    let tid = 1;
    for (let c = 0; c < 250; c++) {
      const winSize = 1 + rand(3);
      const k = 1 + rand(12);
      const nBatches = rand(6);
      const batches: GiaoDichDto[][] = [];
      for (let b = 0; b < nBatches; b++) {
        const batch: GiaoDichDto[] = [];
        for (let t = 0, n = rand(6); t < n; t++) {
          const mon: Mon[] = [];
          for (let id = 1; id <= 6; id++) if (rand(3) !== 0) mon.push([id, 1 + rand(50)]);
          batch.push(gd(tid++, mon));
        }
        batches.push(batch);
      }
      try { kiemTra(batches, winSize, k); } catch (error) {
        throw new Error(`Bộ ${c}, winSize=${winSize}, k=${k}, batches=${JSON.stringify(batches.map((b) => b.map((d) => [...d.utils])))}: ${String(error)}`);
      }
    }
  });
});
