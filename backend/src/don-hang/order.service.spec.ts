import { OrderService } from './order.service';

/** Giỏ giả ghi lại các lệnh để kiểm tra MoMo thành công chỉ tiêu thụ ĐÚNG phần thuộc đơn (M5A-09, Q2-R09). */
function dungService(donDaThanhToan: unknown) {
  const lenh: { loai: string; loc: any; cap?: any; tuyChon?: any }[] = [];
  const gio = {
    updateOne: vi.fn((loc: any, cap: any, tuyChon?: any) => {
      lenh.push({ loai: 'giam', loc, cap, tuyChon });
      return Promise.resolve({ modifiedCount: 1 });
    }),
    deleteMany: vi.fn((loc: any) => {
      lenh.push({ loai: 'xoa', loc });
      return Promise.resolve({ deletedCount: 1 });
    }),
    updateMany: vi.fn(() => Promise.resolve({ modifiedCount: 0 })),
    exists: vi.fn(() => Promise.resolve(null)),
  };
  const service = new OrderService({} as never, {} as never, gio as never, {} as never);
  (vi.spyOn(service as any, 'doiTrangThai') as any).mockResolvedValue(donDaThanhToan);
  return { service, lenh, gio };
}

describe('OrderService.danhDauDaThanhToanMomo – dọn giỏ', () => {
  const don = {
    khachHang: 'kh1',
    chiTiet: [
      { chiTietSanPham: 'A', soLuong: 1 },
      { chiTietSanPham: 'B', soLuong: 2 },
    ],
  };

  it('trừ giỏ bằng MỘT lệnh nguyên tử cho mỗi dòng của đơn (pipeline $max(0, soLuong - n)), đúng khách và đúng biến thể', async () => {
    const { service, lenh } = dungService(don);
    await service.danhDauDaThanhToanMomo(7);
    const giam = lenh.filter((l) => l.loai === 'giam');
    expect(giam.map((g) => g.loc.chiTietSanPham)).toEqual(['A', 'B']);
    expect(giam.every((g) => g.loc.khachHang === 'kh1')).toBe(true);
    expect(giam[1].cap).toEqual([{ $set: { soLuong: { $max: [0, { $subtract: ['$soLuong', 2] }] } } }]);
    // Mongoose 9 từ chối update dạng mảng nếu không bật rõ updatePipeline (mặc định false): thiếu cờ này thì việc dọn giỏ báo lỗi
    expect(giam.every((g) => g.tuyChon?.updatePipeline === true)).toBe(true);
  });

  it('chỉ dọn dòng đã hết (soLuong <= 0) của đúng biến thể trong đơn; dòng biến thể khác không bị đụng', async () => {
    const { service, lenh } = dungService(don);
    await service.danhDauDaThanhToanMomo(7);
    const xoa = lenh.filter((l) => l.loai === 'xoa');
    expect(xoa.map((x) => x.loc.chiTietSanPham).sort()).toEqual(['A', 'B']);
    expect(xoa.every((x) => JSON.stringify(x.loc.soLuong) === JSON.stringify({ $lte: 0 }))).toBe(true);
    expect(xoa.every((x) => x.loc.khachHang === 'kh1')).toBe(true);
  });

  it('lỗi khi dọn giỏ không làm hỏng xác nhận thanh toán (vẫn trả đơn)', async () => {
    const { service, gio } = dungService(don);
    gio.updateOne.mockRejectedValueOnce(new Error('db'));
    await expect(service.danhDauDaThanhToanMomo(7)).resolves.toBe(don);
  });
});
