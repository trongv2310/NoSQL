export interface GiaoDichDto {
  tid: number;
  items: Map<number, number>;
  utils: Map<number, number>;
  tu: number;
}

export interface KetQuaTopK { utility: number; itemset: number[]; khoa: string }

class Element {
  constructor(readonly tid: number, readonly eu: number, readonly ru: number) {}
}

class IList {
  readonly batches = new Map<string, Element[]>();
  readonly batchSumEU = new Map<string, number>();
  readonly batchSumRU = new Map<string, number>();

  constructor(readonly itemset: number[]) {}

  addBatchData(batchId: string, elements: Element[]) {
    this.batches.set(batchId, elements);
    this.batchSumEU.set(batchId, elements.reduce((sum, e) => sum + e.eu, 0));
    this.batchSumRU.set(batchId, elements.reduce((sum, e) => sum + e.ru, 0));
  }

  getTotalEu() { return [...this.batchSumEU.values()].reduce((sum, value) => sum + value, 0); }
  getTotalRu() { return [...this.batchSumRU.values()].reduce((sum, value) => sum + value, 0); }
}

/** VertTopKDS từ bản C#, với các sửa lỗi cắt nhánh theo T-806. */
export class VertTopKDS {
  private readonly slidingWindow: string[] = [];
  private readonly batchesData = new Map<string, GiaoDichDto[]>();
  private readonly globalTwu = new Map<number, number>();
  private readonly ilists = new Map<number, IList>();
  private prevThreshold = 0;
  private topKBuffer: KetQuaTopK[] = [];
  private readonly itemsetsSet = new Set<string>();

  constructor(private readonly k: number, private readonly winSize: number) {}

  private addToTopK(itemset: number[], utility: number) {
    if (itemset.length < 2) return;
    const sortedItemset = [...itemset].sort((a, b) => a - b);
    const khoa = sortedItemset.join(',');
    if (this.itemsetsSet.has(khoa)) return;
    if (this.topKBuffer.length < this.k) {
      this.topKBuffer.push({ utility, itemset: sortedItemset, khoa });
      this.itemsetsSet.add(khoa);
      this.topKBuffer.sort((a, b) => a.utility - b.utility);
    } else if (utility > this.topKBuffer[0].utility) {
      this.itemsetsSet.delete(this.topKBuffer[0].khoa);
      this.topKBuffer[0] = { utility, itemset: sortedItemset, khoa };
      this.itemsetsSet.add(khoa);
      this.topKBuffer.sort((a, b) => a.utility - b.utility);
    }
  }

  // Khác C#: chỉ nâng ngưỡng khi đã đủ K tập, tránh cắt mất ứng viên khi buffer chưa đầy.
  private getThreshold() { return this.topKBuffer.length >= this.k ? this.topKBuffer[0].utility : 0; }
  private getTwu(item: number) { return this.globalTwu.get(item) ?? 0; }

  private updateWindow(bid: string, batch: GiaoDichDto[]) {
    if (this.slidingWindow.length >= this.winSize) {
      const old = this.slidingWindow.shift()!;
      for (const t of this.batchesData.get(old)!) {
        for (const item of t.items.keys()) {
          if (this.globalTwu.has(item)) this.globalTwu.set(item, this.globalTwu.get(item)! - t.tu);
        }
      }
      this.batchesData.delete(old);
    }
    this.slidingWindow.push(bid);
    this.batchesData.set(bid, batch);
    for (const t of batch) {
      for (const item of t.items.keys()) this.globalTwu.set(item, this.getTwu(item) + t.tu);
    }
  }

  private rebuildILists() {
    // Khác C#: dựng lại mọi batch theo cùng thứ tự TWU hiện tại để RU luôn là cận trên hợp lệ.
    this.ilists.clear();
    // Khác C#: TWU bằng 0 vẫn hợp lệ khi cần thêm tập utility 0 để đủ K.
    const items = [...this.globalTwu.keys()].filter((item) => this.getTwu(item) >= 0)
      .sort((a, b) => this.getTwu(a) - this.getTwu(b) || a - b);
    const order = new Map(items.map((item, index) => [item, index]));
    for (const [bid, batch] of this.batchesData) {
      const temp = new Map<number, Element[]>();
      for (const t of batch) {
        const its = [...t.items.keys()].filter((item) => order.has(item)).sort((a, b) => order.get(a)! - order.get(b)!);
        let ru = 0;
        for (let index = its.length - 1; index >= 0; index--) {
          const item = its[index];
          const eu = t.utils.get(item) ?? 0;
          if (!temp.has(item)) temp.set(item, []);
          temp.get(item)!.push(new Element(t.tid, eu, ru));
          ru += eu;
        }
      }
      for (const [item, elements] of temp) {
        if (!this.ilists.has(item)) this.ilists.set(item, new IList([item]));
        this.ilists.get(item)!.addBatchData(bid, elements);
      }
    }
  }

  private construct(prefix: IList, yIlist: IList, currentTh: number): IList | null {
    const result = new IList([...prefix.itemset, yIlist.itemset[0]]);
    const commonBatches = [...prefix.batches.keys()].filter((bid) => yIlist.batches.has(bid));
    for (const bid of commonBatches) {
      const ex = prefix.batches.get(bid)!;
      const ey = yIlist.batches.get(bid)!;
      const elements: Element[] = [];
      let i = 0;
      let j = 0;
      while (i < ex.length && j < ey.length) {
        if (ex[i].tid === ey[j].tid) {
          elements.push(new Element(ex[i].tid, ex[i].eu + ey[j].eu, ey[j].ru));
          i++;
          j++;
        } else if (ex[i].tid < ey[j].tid) i++;
        else j++;
      }
      if (elements.length) result.addBatchData(bid, elements);
    }
    if (!result.batches.size || result.getTotalEu() + result.getTotalRu() < currentTh) return null;
    return result;
  }

  private vertMiner(current: IList, startIdx: number, oneItemILists: IList[], currentTh: number) {
    const eu = current.getTotalEu();
    if (eu >= currentTh) this.addToTopK(current.itemset, eu);
    if (eu + current.getTotalRu() < currentTh) return;
    for (let j = startIdx; j < oneItemILists.length; j++) {
      const ixy = this.construct(current, oneItemILists[j], currentTh);
      if (ixy) this.vertMiner(ixy, j + 1, oneItemILists, this.getThreshold());
    }
  }

  xuLyBatch(batchId: string, giaoDich: GiaoDichDto[]): void {
    this.updateWindow(batchId, giaoDich);
    if (this.slidingWindow.length !== this.winSize) return;
    this.rebuildILists();
    let oneItemILists = [...this.globalTwu.keys()].filter((item) => this.getTwu(item) >= this.prevThreshold)
      .sort((a, b) => this.getTwu(a) - this.getTwu(b) || a - b)
      .filter((item) => this.ilists.has(item)).map((item) => this.ilists.get(item)!);
    this.topKBuffer = [];
    this.itemsetsSet.clear();
    for (const ilist of oneItemILists) this.addToTopK(ilist.itemset, ilist.getTotalEu());
    const currentTh = this.getThreshold();
    oneItemILists = oneItemILists.filter((ilist) => this.getTwu(ilist.itemset[0]) >= currentTh);
    for (let i = 0; i < oneItemILists.length; i++) this.vertMiner(oneItemILists[i], i + 1, oneItemILists, currentTh);
    const commonBatches = this.slidingWindow.slice(1);
    // Khác C#: ngưỡng dùng cho cửa sổ sau cũng phải chờ đủ K tập làm cận dưới.
    if (commonBatches.length && this.topKBuffer.length >= this.k) {
      this.prevThreshold = Math.min(...this.topKBuffer.map((result) => {
        let utilCommon = 0;
        for (const bid of commonBatches) {
          for (const t of this.batchesData.get(bid)!) {
            if (result.itemset.every((item) => t.items.has(item))) {
              utilCommon += result.itemset.reduce((sum, item) => sum + (t.utils.get(item) ?? 0), 0);
            }
          }
        }
        return utilCommon;
      }));
    } else this.prevThreshold = 0;
  }

  layKetQua(): KetQuaTopK[] { return [...this.topKBuffer].sort((a, b) => b.utility - a.utility); }
}
