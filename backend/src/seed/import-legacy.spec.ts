import { parseNgay } from './import-legacy';

describe('parseNgay', () => {
  it('ngày thuần được hiểu là 00:00 giờ Việt Nam', () => {
    expect(parseNgay('2026-08-23')?.toISOString()).toBe('2026-08-22T17:00:00.000Z');
  });

  it('chuỗi ngày giờ của MySQL được hiểu theo giờ Việt Nam', () => {
    expect(parseNgay('2026-11-01 08:20:33')?.toISOString()).toBe('2026-11-01T01:20:33.000Z');
  });

  it('giá trị rỗng hoặc sai trả về undefined', () => {
    expect(parseNgay(null)).toBeUndefined();
    expect(parseNgay('không phải ngày')).toBeUndefined();
  });
});
