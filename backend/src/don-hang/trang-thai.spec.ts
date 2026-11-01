import { adminCoTheHuy, coTheChuyen, khachCoTheHuy } from './trang-thai';

describe('trạng thái đơn hàng', () => {
  it('cho phép luồng xử lý -> giao -> hoàn thành', () => {
    expect(coTheChuyen('Đang xử lý', 'Đang giao hàng')).toBe(true);
    expect(coTheChuyen('Đang giao hàng', 'Đã hoàn thành')).toBe(true);
  });

  it('không cho nhảy cóc hoặc quay lại', () => {
    expect(coTheChuyen('Đang xử lý', 'Đã hoàn thành')).toBe(false);
    expect(coTheChuyen('Đã hoàn thành', 'Đang xử lý')).toBe(false);
    expect(coTheChuyen('Đã hủy', 'Đang xử lý')).toBe(false);
  });

  it('đơn đã thanh toán MoMo không quay về đang xử lý', () => {
    expect(coTheChuyen('Đã thanh toán bằng MoMo', 'Đang xử lý')).toBe(false);
    expect(coTheChuyen('Đã thanh toán bằng MoMo', 'Đang giao hàng')).toBe(true);
  });

  it('khách chỉ hủy được đơn chưa giao', () => {
    expect(khachCoTheHuy('Đang xử lý')).toBe(true);
    expect(khachCoTheHuy('Đang giao hàng')).toBe(false);
    expect(khachCoTheHuy('Đã thanh toán bằng MoMo')).toBe(false);
  });

  it('admin hủy được cả đơn đang giao nhưng không hủy đơn đã kết thúc', () => {
    expect(adminCoTheHuy('Đang giao hàng')).toBe(true);
    expect(adminCoTheHuy('Đã hoàn thành')).toBe(false);
    expect(adminCoTheHuy('Đã hủy')).toBe(false);
  });
});
