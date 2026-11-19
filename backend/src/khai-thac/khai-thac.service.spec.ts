import { Types } from 'mongoose';
import { Logger } from '@nestjs/common';
import { TRANG_THAI } from '../schemas';
import { KhaiThacService, KetQuaKhaiThac, TOI_DA_DON_KHAI_THAC } from './khai-thac.service';
import { VertTopKDS } from './vert-topk-ds';

const A = new Types.ObjectId('64b000000000000000000001');
const B = new Types.ObjectId('64b000000000000000000002');
const C = new Types.ObjectId('64b000000000000000000003');
const BT = new Types.ObjectId('64b000000000000000000010');
const AB = [A, B].map((id) => id.toHexString()).join(',');
const AC = [A, C].map((id) => id.toHexString()).join(',');
const now = new Date(2026, 10, 19, 12);
const dong = (sanPham: Types.ObjectId, soLuong = 1, donGia = 10, thanhTien?: number) => ({ sanPham, soLuong, donGia, thanhTien });
const don = (thang: number, chiTiet = [dong(A), dong(B)], trangThai: string = TRANG_THAI.HoanThanh) => ({ ngayDat: new Date(2026, thang - 1, 5), trangThai, chiTiet });
const query = (rows: unknown[]) => {
  const chain = { sort: vi.fn(), limit: vi.fn(), lean: vi.fn().mockResolvedValue(rows) };
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
};

function dungService(rows = [don(11)]) {
  const donQuery = query(rows.filter((d) => d.trangThai === TRANG_THAI.HoanThanh && d.ngayDat >= new Date(2026, 8, 1) && d.ngayDat <= now)
    .sort((a, b) => b.ngayDat.getTime() - a.ngayDat.getTime()));
  const donModel = { find: vi.fn((_filter: { trangThai: string; ngayDat: { $gte: Date; $lte: Date } }) => donQuery) };
  const ctModel = { find: vi.fn(() => query([{ _id: BT, sanPham: B }])) };
  const spModel = { find: vi.fn(() => query([{ _id: B, tenSanPham: 'B' }, { _id: A, tenSanPham: 'A' }, { _id: C, tenSanPham: 'C' }])) };
  const goiYModel = { bulkWrite: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({}), find: vi.fn(() => query([])) };
  const service = new KhaiThacService(donModel as never, ctModel as never, spModel as never, goiYModel as never);
  return { service, donModel, donQuery, ctModel, spModel, goiYModel };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('KhaiThacService: dựng giao dịch và batch tháng lịch', () => {
  it('gộp theo sản phẩm, fallback biến thể, utility ưu tiên thanhTien; bỏ đơn sai trạng thái/ít món', async () => {
    const row = don(10, [dong(A, 2, 100, 30), dong(A, 1, 100, 5), dong(B, 1, 4)]);
    row.chiTiet[2] = { chiTietSanPham: BT, soLuong: 1, donGia: 4 } as never;
    const { service, donModel, ctModel, goiYModel } = dungService([row, don(9, [dong(A)]), don(11, [dong(A), dong(B)], TRANG_THAI.DaHuy), don(11, [dong(A)], TRANG_THAI.DangXuLy)]);
    const xuLy = vi.spyOn(VertTopKDS.prototype, 'xuLyBatch');
    const result = await service.chay(5, 3, now);
    expect(donModel.find).toHaveBeenCalledWith({ trangThai: TRANG_THAI.HoanThanh, ngayDat: { $gte: new Date(2026, 8, 1), $lte: now } }, { ngayDat: 1, chiTiet: 1 });
    expect(ctModel.find).toHaveBeenCalledWith({ _id: { $in: [BT] } }, { sanPham: 1 });
    expect(xuLy.mock.calls.map(([id]) => id)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(xuLy.mock.calls[0][1]).toEqual([]);
    expect(xuLy.mock.calls[1][1][0]).toEqual({ tid: 2, items: new Map([[1, 3], [2, 1]]), utils: new Map([[1, 35], [2, 4]]), tu: 39 });
    expect(xuLy.mock.calls[2][1]).toEqual([]);
    expect(result).toMatchObject({ k: 5, soThang: 3, soDonXet: 2, soBatch: 3, biCat: false, chayLuc: now.toISOString(), ketQua: [
      { hang: 1, khoa: AB, tenTap: 'A + B', loiNhuan: 39, sanPhams: [{ id: A.toHexString(), tenSanPham: 'A' }, { id: B.toHexString(), tenSanPham: 'B' }] },
    ] });
    expect(goiYModel.bulkWrite).not.toHaveBeenCalled();
    expect(goiYModel.deleteMany).not.toHaveBeenCalled();
  });

  it('tháng hiện tại tính đến now, qua năm mới vẫn đủ batch cũ nhất trước', async () => {
    const { service, donModel } = dungService([]);
    const xuLy = vi.spyOn(VertTopKDS.prototype, 'xuLyBatch');
    await service.chay(1, 3, new Date(2027, 0, 2));
    expect(donModel.find.mock.calls[0][0].ngayDat.$gte).toEqual(new Date(2026, 10, 1));
    expect(xuLy.mock.calls.map(([id]) => id)).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('giới hạn 20.000 đơn mới nhất và có cờ biCat, TID tăng trong batch cho phép join', async () => {
    const { service, donQuery } = dungService([]);
    donQuery.lean.mockResolvedValue(Array.from({ length: TOI_DA_DON_KHAI_THAC + 1 }, () => don(11, [dong(A)])));
    const result = await service.chay(5, 3, now);
    expect(donQuery.sort).toHaveBeenCalledWith({ ngayDat: -1, _id: -1 });
    expect(donQuery.limit).toHaveBeenCalledWith(20_001);
    expect(result).toMatchObject({ soDonXet: 20_000, biCat: true, ketQua: [] });
  });

  it('bỏ sản phẩm đã mất, bỏ tập dưới hai sản phẩm và đánh lại hạng', async () => {
    vi.spyOn(VertTopKDS.prototype, 'layKetQua').mockReturnValue([
      { itemset: [1, 2], utility: 60, khoa: '1,2' }, { itemset: [1, 2, 3], utility: 50, khoa: '1,2,3' },
    ]);
    // Cần C xuất hiện trong dữ liệu đầu vào để bảng ánh xạ có đủ ba ID.
    const state = dungService([don(11, [dong(C), dong(B), dong(A)])]);
    state.spModel.find.mockReturnValue(query([{ _id: A, tenSanPham: 'A' }, { _id: C, tenSanPham: 'C' }]));
    const result = await state.service.chay(5, 3, now);
    expect(result.ketQua).toEqual([{ hang: 1, khoa: AC, tenTap: 'A + C', loiNhuan: 50, sanPhams: [
      { id: A.toHexString(), tenSanPham: 'A', hinhAnhDaiDien: undefined }, { id: C.toHexString(), tenSanPham: 'C', hinhAnhDaiDien: undefined },
    ] }]);
  });

  it.each([[0, 3], [51, 3], [1.5, 3], [5, 0], [5, 13]])('tham số ngoài biên %s/%s bị chặn trước khi đọc DB', async (k, soThang) => {
    const { service, donModel } = dungService();
    await expect(service.chay(k, soThang, now)).rejects.toMatchObject({ status: 400 });
    expect(donModel.find).not.toHaveBeenCalled();
  });
});

describe('lưu và đọc gợi ý', () => {
  it('upsert mới trước khi xóa cũ; khóa trùng được cập nhật, không insert trùng unique khoa', async () => {
    const { service, goiYModel } = dungService();
    const kq = await service.chay(5, 3, now);
    await service.luuGoiY(kq);
    expect(goiYModel.bulkWrite).toHaveBeenCalledWith([{ updateOne: { filter: { khoa: AB }, upsert: true,
      update: { $set: { khoa: AB, sanPham: [A, B], loiNhuan: 20, hang: 1, k: 5, soThang: 3, taoLuc: now } },
    } }], { ordered: true });
    expect(goiYModel.deleteMany).toHaveBeenCalledWith({ khoa: { $nin: [AB] } });
    expect(goiYModel.bulkWrite.mock.invocationCallOrder[0]).toBeLessThan(goiYModel.deleteMany.mock.invocationCallOrder[0]);
  });

  it('ghi mới lỗi: không xóa cũ; lần lưu sau vẫn chạy được', async () => {
    const { service, goiYModel } = dungService();
    const kq = await service.chay(5, 3, now);
    goiYModel.bulkWrite.mockRejectedValueOnce(new Error('ghi lỗi'));
    await expect(service.luuGoiY(kq)).rejects.toThrow('ghi lỗi');
    expect(goiYModel.deleteMany).not.toHaveBeenCalled();
    await expect(service.luuGoiY(kq)).resolves.toBeUndefined();
  });

  it('hai yêu cầu lưu cùng process được tuần tự hóa, không xóa lẫn kết quả mới', async () => {
    const { service, goiYModel } = dungService();
    const kq = await service.chay(5, 3, now);
    let hoanTat!: () => void;
    goiYModel.bulkWrite.mockImplementationOnce(() => new Promise<void>((resolve) => { hoanTat = resolve; }));
    const lan1 = service.luuGoiY(kq);
    const lan2 = service.luuGoiY(kq);
    await vi.waitFor(() => expect(goiYModel.bulkWrite).toHaveBeenCalledOnce());
    expect(goiYModel.deleteMany).not.toHaveBeenCalled();
    hoanTat();
    await Promise.all([lan1, lan2]);
    expect(goiYModel.bulkWrite).toHaveBeenCalledTimes(2);
    expect(goiYModel.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(goiYModel.bulkWrite.mock.invocationCallOrder[1]);
    expect(goiYModel.bulkWrite.mock.invocationCallOrder[1]).toBeLessThan(goiYModel.deleteMany.mock.invocationCallOrder[1]);
  });

  it('xóa cũ lỗi sau ghi: không rollback/xóa kết quả mới', async () => {
    const { service, goiYModel } = dungService();
    const kq = await service.chay(5, 3, now);
    goiYModel.deleteMany.mockRejectedValueOnce(new Error('xóa lỗi'));
    await expect(service.luuGoiY(kq)).rejects.toThrow('xóa lỗi');
    expect(goiYModel.bulkWrite).toHaveBeenCalledOnce();
    expect(goiYModel.deleteMany).toHaveBeenCalledOnce();
  });

  it('kết quả rỗng được áp dụng có chủ ý; đọc khi chưa có dữ liệu trả null', async () => {
    const { service, goiYModel } = dungService([]);
    const kq = await service.chay(5, 3, now);
    await service.luuGoiY(kq);
    expect(goiYModel.bulkWrite).not.toHaveBeenCalled();
    expect(goiYModel.deleteMany).toHaveBeenCalledWith({ khoa: { $nin: [] } });
    expect(await service.docGoiYDaLuu()).toBeNull();
  });

  it('đọc gợi ý đã lưu dịch sản phẩm và giữ tham số/thời điểm', async () => {
    const { service, goiYModel } = dungService();
    goiYModel.find.mockReturnValue(query([{ sanPham: [A, B], k: 10, soThang: 2, taoLuc: now, loiNhuan: 100, hang: 1 }]));
    expect(await service.docGoiYDaLuu()).toMatchObject({ k: 10, soThang: 2, capNhatLuc: now.toISOString(), ketQua: [{ tenTap: 'A + B', loiNhuan: 100, hang: 1 }] });
  });
});

describe('tự động khai thác tùy chọn', () => {
  it.each(['', '0', '4', 'abc', 'Infinity', '100000000'])('tắt/không hợp lệ %s không tạo timer', (value) => {
    vi.stubEnv('KHAI_THAC_TU_DONG_PHUT', value);
    const interval = vi.spyOn(globalThis, 'setInterval');
    const { service } = dungService();
    service.onModuleInit();
    expect(interval).not.toHaveBeenCalled();
    service.onModuleDestroy();
  });

  it('bật mỗi 5 phút: chạy 10/3, lưu; lỗi chỉ log; destroy dọn timer', async () => {
    vi.useFakeTimers();
    vi.stubEnv('KHAI_THAC_TU_DONG_PHUT', '5');
    const { service } = dungService();
    const kq: KetQuaKhaiThac = { k: 10, soThang: 3, soDonXet: 0, soBatch: 3, biCat: false, thoiGianMs: 0, chayLuc: now.toISOString(), ketQua: [] };
    const chay = vi.spyOn(service, 'chay').mockResolvedValueOnce(kq).mockRejectedValueOnce(new Error('DB lỗi'));
    const luu = vi.spyOn(service, 'luuGoiY').mockResolvedValue(undefined);
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service.onModuleInit();
    expect(chay).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(chay).toHaveBeenCalledWith(10, 3);
    expect(luu).toHaveBeenCalledWith(kq);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(log).toHaveBeenCalledWith('Không thể cập nhật gợi ý Top-K tự động.');
    service.onModuleDestroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
