import { ConfigService } from '@nestjs/config';
import { MomoService } from './momo.service';

describe('MomoService', () => {
  const momo = new MomoService(new ConfigService({ MOMO_MOCK: 'true' }));

  it('kết quả mock có chữ ký hợp lệ', () => {
    const d = momo.taoKetQuaMock(12, 1_500_000, true);
    expect(d.resultCode).toBe('0');
    expect(momo.chuKyHopLe(d)).toBe(true);
  });

  it('sửa dữ liệu thì chữ ký không còn hợp lệ', () => {
    const d = momo.taoKetQuaMock(12, 1_500_000, true);
    expect(momo.chuKyHopLe({ ...d, amount: '1' })).toBe(false);
    expect(momo.chuKyHopLe({ ...d, resultCode: '0', orderId: '13' })).toBe(false);
  });

  it('thiếu trường bắt buộc hoặc thiếu chữ ký thì bị từ chối', () => {
    const d = momo.taoKetQuaMock(12, 1000, false);
    const { signature: _s, ...khongChuKy } = d;
    expect(momo.chuKyHopLe(khongChuKy)).toBe(false);
    expect(momo.chuKyHopLe({ ...d, transId: undefined })).toBe(false);
  });

  it('giao dịch bị hủy mang resultCode khác 0', () => {
    expect(momo.taoKetQuaMock(1, 1000, false).resultCode).not.toBe('0');
  });
});
