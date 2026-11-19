import { GiaoDichDto, VertTopKDS } from './vert-topk-ds';

const don = (tid: number, rows: [number, number][]): GiaoDichDto => ({ tid, items: new Map(rows.map(([id]) => [id, 1])), utils: new Map(rows), tu: rows.reduce((sum, [, u]) => sum + u, 0) });

describe('VertTopKDS: các ca tính tay', () => {
  it('ba batch: AB=50, AC=10, BC=10, không có tập đơn hoặc tập trùng', () => {
    const miner = new VertTopKDS(3, 3);
    miner.xuLyBatch('1', [don(1, [[1, 10], [2, 20]])]);
    miner.xuLyBatch('2', [don(2, [[1, 5], [2, 15]])]);
    expect(miner.layKetQua()).toEqual([]);
    miner.xuLyBatch('3', [don(3, [[1, 7], [3, 3]]), don(4, [[2, 4], [3, 6]])]);
    expect(miner.layKetQua()).toEqual([
      { utility: 50, itemset: [1, 2], khoa: '1,2' },
      { utility: 10, itemset: [1, 3], khoa: '1,3' },
      { utility: 10, itemset: [2, 3], khoa: '2,3' },
    ]);
  });

  it('K lớn hơn số tập: giữ các cặp và bộ ba tính tay', () => {
    const miner = new VertTopKDS(10, 1);
    miner.xuLyBatch('1', [don(1, [[3, 1], [1, 1], [2, 1]])]);
    expect(miner.layKetQua()).toEqual([
      { utility: 3, itemset: [1, 2, 3], khoa: '1,2,3' },
      { utility: 2, itemset: [1, 2], khoa: '1,2' },
      { utility: 2, itemset: [1, 3], khoa: '1,3' },
      { utility: 2, itemset: [2, 3], khoa: '2,3' },
    ]);
  });

  it('đơn một món, batch rỗng, cửa sổ chưa đầy đều chưa có tập hợp lệ', () => {
    const miner = new VertTopKDS(5, 3);
    miner.xuLyBatch('1', [don(1, [[1, 100]])]);
    miner.xuLyBatch('2', []);
    expect(miner.layKetQua()).toEqual([]);
    miner.xuLyBatch('3', [don(2, [[2, 200]])]);
    expect(miner.layKetQua()).toEqual([]);
  });

  it('trượt cửa sổ bỏ utility batch cũ và không giữ kết quả đã hết hạn', () => {
    const miner = new VertTopKDS(2, 2);
    miner.xuLyBatch('1', [don(1, [[1, 10], [2, 20]])]);
    miner.xuLyBatch('2', [don(2, [[1, 1], [2, 2]])]);
    expect(miner.layKetQua()[0].utility).toBe(33);
    miner.xuLyBatch('3', []);
    expect(miner.layKetQua()).toEqual([{ utility: 3, itemset: [1, 2], khoa: '1,2' }]);
    miner.xuLyBatch('4', []);
    expect(miner.layKetQua()).toEqual([]);
  });

  it('hòa utility không thay thế phần tử đã có khi K đầy', () => {
    const miner = new VertTopKDS(1, 1);
    miner.xuLyBatch('1', [don(1, [[1, 5], [2, 5]]), don(2, [[3, 5], [4, 5]])]);
    expect(miner.layKetQua()).toEqual([{ utility: 10, itemset: [1, 2], khoa: '1,2' }]);
  });

  it('sửa lỗi ngưỡng C#: K chưa đầy phải giữ cả tập utility 27', () => {
    const miner = new VertTopKDS(8, 1);
    miner.xuLyBatch('1', [don(1, [[2, 7], [3, 23], [4, 20]])]);
    // Ca lỗi gốc: C# chỉ trả 50/43/30 vì nâng ngưỡng trước khi đủ K.
    expect(miner.layKetQua().map((r) => r.utility)).toEqual([50, 43, 30, 27]);
  });

  it('TWU đổi thứ tự giữa hai batch: RU cũ không được cắt mất bộ ba utility 111', () => {
    const miner = new VertTopKDS(1, 2);
    miner.xuLyBatch('1', [don(1, [[1, 100], [2, 10], [3, 1]]), don(2, [[3, 1], [4, 20]])]);
    // TWU đổi từ 4,1,2,3 sang 3,4,2,1; RU cũ của món 2 chỉ có utility món 3.
    miner.xuLyBatch('2', [don(3, [[1, 1000]]), don(4, [[2, 500]]), don(5, [[4, 300]])]);
    expect(miner.layKetQua()).toEqual([{ utility: 111, itemset: [1, 2, 3], khoa: '1,2,3' }]);
  });

  it('cửa sổ trước chưa đủ K: không mang ngưỡng dương sang cửa sổ kế tiếp', () => {
    const miner = new VertTopKDS(8, 2);
    miner.xuLyBatch('1', []);
    miner.xuLyBatch('2', [don(1, [[1, 50], [2, 50]])]);
    expect(miner.layKetQua().map((r) => r.utility)).toEqual([100]);
    miner.xuLyBatch('3', [don(2, [[3, 5], [4, 5]])]);
    expect(miner.layKetQua()).toEqual([
      { utility: 100, itemset: [1, 2], khoa: '1,2' },
      { utility: 10, itemset: [3, 4], khoa: '3,4' },
    ]);
  });

  it('utility bằng 0 vẫn là ứng viên hợp lệ khi chưa đủ K', () => {
    const miner = new VertTopKDS(5, 1);
    miner.xuLyBatch('1', [don(1, [[1, 0], [2, 0]])]);
    expect(miner.layKetQua()).toEqual([{ utility: 0, itemset: [1, 2], khoa: '1,2' }]);
  });
});
