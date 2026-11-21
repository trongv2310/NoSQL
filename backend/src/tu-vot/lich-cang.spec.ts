import { GIO_MO, gioHenVN, khungGioSapToi, laKhungHopLe, ngayLichVN } from './lich-cang.service';

describe('khung giờ căng tại shop (giờ Việt Nam)', () => {
  it('9 khung mỗi ngày, bỏ khung bắt đầu trong vòng 1 giờ tới', () => {
    // 08:30 sáng 18/11 giờ VN = 01:30 UTC → khung 9h (cách 30 phút) bị bỏ, còn 8 khung hôm nay.
    const k = khungGioSapToi(new Date('2026-11-18T01:30:00Z'), 1);
    expect(k).toHaveLength(GIO_MO.length - 1);
    expect(k[0].toISOString()).toBe('2026-11-18T03:00:00.000Z'); // 10:00 VN
    expect(khungGioSapToi(new Date('2026-11-18T01:30:00Z'), 7)).toHaveLength(GIO_MO.length * 7 - 1);
  });

  it('chỉ nhận khung tròn giờ thuộc lịch mở', () => {
    expect(laKhungHopLe(new Date('2026-11-18T03:00:00Z'))).toBe(true); // 10:00 VN
    expect(laKhungHopLe(new Date('2026-11-18T05:00:00Z'))).toBe(false); // 12:00 VN: nghỉ trưa
    expect(laKhungHopLe(new Date('2026-11-18T03:30:00Z'))).toBe(false);
  });

  it('khung 20:00 VN ngày 18 (13:00 UTC) và 9:00 VN ngày 19 (02:00 UTC ngày 19) đều quy đúng về ngày lịch VN', () => {
    expect(ngayLichVN(new Date('2026-11-18T13:00:00Z')).toISOString()).toBe('2026-11-18T00:00:00.000Z');
    expect(ngayLichVN(new Date('2026-11-18T17:30:00Z')).toISOString()).toBe('2026-11-19T00:00:00.000Z'); // 00:30 VN ngày 19
  });

  it('giờ hẹn trong thông báo hiện theo giờ Việt Nam, không theo múi giờ máy chủ', () => {
    expect(gioHenVN(new Date('2026-11-24T02:00:00Z'))).toBe('09:00 24/11/2026');
    expect(gioHenVN(new Date('2026-11-18T13:00:00Z'))).toBe('20:00 18/11/2026');
  });
});
