import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { HTTP_CODE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Types } from 'mongoose';
import { VALIDATORS } from '../csdl/validators';
import { TranDauSchema } from '../schemas/ban-tin.schema';
import { AdminTranDauController, TrangThaiTranDauDto, TranDauDto } from './admin-danh-muc.controller';

const ID = '64b000000000000000000010';
const dto = (extra: Partial<TranDauDto> = {}) => Object.assign(new TranDauDto(), {
  tenGiaiDau: 'Giải A', vong: 'Chung kết', noiDung: 'Đơn nam', doiA: 'A', doiB: 'B', ngayThiDau: '2026-10-01', ...extra,
});
/** Query giả: sort → skip → limit → lean (danh sách phân trang ngay trong MongoDB). */
function truyVan(rows: unknown[], sort = vi.fn()) {
  const q = { boQua: 0, gioiHan: Infinity, sort: sort.mockImplementation(() => q), skip: (n: number) => { q.boQua = n; return q; }, limit: (n: number) => { q.gioiHan = n; return q; }, lean: async () => rows.slice(q.boQua, q.boQua + q.gioiHan) };
  return q;
}
function dungController() {
  const rows = Array.from({ length: 12 }, (_, i) => ({ _id: i === 10 ? ID : String(i), tenGiaiDau: `Giải ${i}`, doiA: 'A', doiB: 'B', doiThang: 'A' }));
  const sort = vi.fn();
  const model = {
    find: vi.fn(() => truyVan(rows, sort)), countDocuments: vi.fn(async () => rows.length),
    findById: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(rows[10]) })), create: vi.fn().mockResolvedValue({}), updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const tin = { aggregate: vi.fn().mockResolvedValue([{ _id: ID, n: 3 }]), countDocuments: vi.fn().mockResolvedValue(3) };
  return { ctrl: new AdminTranDauController(model as never, tin as never), model, tin, sort };
}

describe('AdminTranDauController', () => {
  it('HIỆN TẠI: danh sách lọc từ khóa đã escape, sắp xếp, phân trang và đếm tin', async () => {
    const { ctrl, model, tin, sort } = dungController();
    const r = await ctrl.danhSach({ keyword: ' A.* ', page: '2' });
    expect(model.find).toHaveBeenCalledWith({ $or: [{ tenGiaiDau: /A\.\*/i }, { noiDung: /A\.\*/i }, { doiA: /A\.\*/i }, { doiB: /A\.\*/i }] });
    expect(sort).toHaveBeenCalledWith({ ngayThiDau: -1, _id: -1 });
    expect(tin.aggregate).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ total: 12, page: 2, perPage: 10, pages: 2 });
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ id: ID, doiA: 'A', doiB: 'B', tenDoiThang: 'A', soTin: 3 });
  });

  it('HIỆN TẠI: danh sách rỗng không có từ khóa dùng filter rỗng', async () => {
    const { ctrl, model } = dungController();
    model.countDocuments.mockResolvedValueOnce(0);
    expect((await ctrl.danhSach({})).items).toEqual([]);
    expect(model.countDocuments).toHaveBeenCalledWith({});
  });

  it('HIỆN TẠI: chi tiết trả hình dạng trận và số bài viết', async () => {
    const { ctrl, tin } = dungController();
    expect(await ctrl.chiTiet(ID)).toMatchObject({ id: ID, doiA: 'A', doiB: 'B', tenDoiThang: 'A', soTin: 3 });
    expect(tin.countDocuments).toHaveBeenCalledWith({ deletedAt: null, tranDau: ID });
  });

  it('HIỆN TẠI: chi tiết không thấy trả 404', async () => {
    const { ctrl, model } = dungController();
    model.findById.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) });
    await expect(ctrl.chiTiet(ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['chiTiet', 'capNhat'] as const)('HIỆN TẠI: %s với id sai trả 400', async (method) => {
    const { ctrl } = dungController();
    await expect(method === 'chiTiet' ? ctrl.chiTiet('sai') : ctrl.capNhat('sai', dto())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('HIỆN TẠI: tạo không có tỉ số đặt đội thắng null', async () => {
    const { ctrl, model } = dungController();
    await expect(ctrl.tao(dto({ doiThang: 'A' }))).resolves.toEqual({ message: 'Thêm kết quả trận đấu thành công!' });
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ doiA: 'A', doiB: 'B', doiThang: null }));
  });

  it('HIỆN TẠI: tạo có tỉ số giữ đội thắng', async () => {
    const { ctrl, model } = dungController();
    await ctrl.tao(dto({ tiSo: '11-21', doiThang: 'B' }));
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ tiSo: '11-21', doiThang: 'B' }));
  });

  it.each([
    ['10-21, 12-21', 'A'],
    ['21-19, 18-21, 21-15', 'B'],
  ])('tỉ số %s mà ghi bên %s thắng → 400, không ghi DB', async (tiSo, doiThang) => {
    const { ctrl, model } = dungController();
    await expect(ctrl.tao(dto({ tiSo, doiThang }))).rejects.toThrow(/không khớp tỉ số/);
    await expect(ctrl.capNhat(ID, dto({ tiSo, doiThang }))).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it.each(['21-21', '21-15, 15-21'])('tỉ số không phân định (%s) → 400', async (tiSo) => {
    const { ctrl, model } = dungController();
    await expect(ctrl.tao(dto({ tiSo, doiThang: 'A' }))).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it.each(['tao', 'capNhat'] as const)('HIỆN TẠI: %s từ chối hai đội trùng sau khi trim', async (method) => {
    const { ctrl, model } = dungController();
    const data = dto({ doiA: ' A ', doiB: 'A' });
    await expect(method === 'tao' ? ctrl.tao(data) : ctrl.capNhat(ID, data)).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it.each(['tao', 'capNhat'] as const)('HIỆN TẠI: %s có tỉ số nhưng thiếu đội thắng bị từ chối', async (method) => {
    const { ctrl } = dungController();
    const data = dto({ tiSo: '21-11' });
    await expect(method === 'tao' ? ctrl.tao(data) : ctrl.capNhat(ID, data)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('HIỆN TẠI: cập nhật thành công và không tìm thấy trả 404', async () => {
    const { ctrl, model } = dungController();
    await expect(ctrl.capNhat(ID, dto())).resolves.toEqual({ message: 'Cập nhật trận đấu thành công!' });
    expect(model.updateOne).toHaveBeenCalledWith({ _id: expect.anything() }, { $set: expect.objectContaining({ doiA: 'A', doiThang: null }) });
    model.updateOne.mockResolvedValueOnce({ matchedCount: 0 });
    await expect(ctrl.capNhat(ID, dto())).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([{ doiA: '' }, { tenGiaiDau: 'x'.repeat(151) }, { tiSo: 'lạ' }, { ngayThiDau: 'không hợp lệ' }])('HIỆN TẠI: DTO sai bị ValidationPipe từ chối %o', async (sai) => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    await expect(pipe.transform(Object.assign({}, dto(), sai), { type: 'body', metatype: TranDauDto })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('C-4: ẩn/hiện trận đấu', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });

  it('schema mặc định hiển thị; validator chỉ kiểm kiểu khi field có mặt', () => {
    expect(TranDauSchema.path('hienThi').instance).toBe('Boolean');
    expect(TranDauSchema.path('hienThi').options.default).toBe(true);
    expect(VALIDATORS.trandaus.validator).toMatchObject({
      $jsonSchema: { required: expect.not.arrayContaining(['hienThi']), properties: { hienThi: { bsonType: 'bool' } } },
    });
  });

  it('route toggle-status trả HTTP 200', () => {
    const handler = Object.getOwnPropertyDescriptor(AdminTranDauController.prototype, 'doiTrangThai')!.value as Function;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(':id/toggle-status');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
  });

  it.each([true, false])('value=%s: cập nhật đúng id/$set và thông báo', async (value) => {
    const { ctrl, model } = dungController();
    const input = await pipe.transform({ value }, { type: 'body', metatype: TrangThaiTranDauDto });
    await expect(ctrl.doiTrangThai(ID, input)).resolves.toEqual({ message: value ? 'Đã hiện trận đấu.' : 'Đã ẩn trận đấu.' });
    expect(model.updateOne).toHaveBeenCalledWith({ _id: new Types.ObjectId(ID) }, { $set: { hienThi: value } });
    expect(model.create).not.toHaveBeenCalled();
    expect(model.findById).not.toHaveBeenCalled();
  });

  it('toggle id sai: 400 trước khi ghi dữ liệu', async () => {
    const { ctrl, model } = dungController();
    await expect(ctrl.doiTrangThai('sai-id', { value: false })).rejects.toMatchObject({ status: 400 });
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('toggle không tìm thấy: 404', async () => {
    const { ctrl, model } = dungController();
    model.updateOne.mockResolvedValueOnce({ matchedCount: 0 });
    await expect(ctrl.doiTrangThai(ID, { value: false })).rejects.toMatchObject({ status: 404, message: 'Không tìm thấy trận đấu.' });
  });

  it.each(['true', 'false', 1, 0, null, undefined, [], {}])('value không phải boolean (%j): 400 qua ValidationPipe, không ghi DB', async (value) => {
    const { ctrl, model } = dungController();
    await expect(pipe.transform({ value }, { type: 'body', metatype: TrangThaiTranDauDto }).then((input) => ctrl.doiTrangThai(ID, input)))
      .rejects.toMatchObject({ status: 400 });
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it.each([undefined, true, false])('GET admin trả hienThi=%s; field thiếu coi là true', async (hienThi) => {
    const { ctrl, model } = dungController();
    const row = { _id: ID, tenGiaiDau: 'Giải A', hienThi };
    model.find.mockReturnValueOnce(truyVan([row]) as never);
    model.countDocuments.mockResolvedValueOnce(1);
    model.findById.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(row) });
    const list = await ctrl.danhSach({});
    expect(list.items[0]).toMatchObject({ id: ID, hienThi: hienThi !== false });
    expect(await ctrl.chiTiet(ID)).toMatchObject({ id: ID, hienThi: hienThi !== false });
    expect(model.find).toHaveBeenCalledWith({});
  });

  it.each(['tao', 'capNhat'] as const)('%s không nhận hienThi qua DTO cũ', async (method) => {
    const { ctrl, model } = dungController();
    const input = await pipe.transform(Object.assign({}, dto(), { hienThi: false }), { type: 'body', metatype: TranDauDto });
    expect(input).not.toHaveProperty('hienThi');
    if (method === 'tao') {
      await ctrl.tao(input);
      expect(model.create.mock.calls[0][0]).not.toHaveProperty('hienThi');
    } else {
      await ctrl.capNhat(ID, input);
      expect(model.updateOne.mock.calls[0][1].$set).not.toHaveProperty('hienThi');
    }
  });
});

describe('T-504: whitelist khi xử lý trận đấu', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });

  it('toggle chỉ nhận value, bỏ hienThi và $set ngoài DTO trước khi cập nhật', async () => {
    const { ctrl, model } = dungController();
    const input = await pipe.transform({ value: true, hienThi: false, $set: { hienThi: false } }, { type: 'body', metatype: TrangThaiTranDauDto });
    expect(input).toEqual(expect.objectContaining({ value: true }));
    expect(input).not.toHaveProperty('hienThi');
    expect(input).not.toHaveProperty('$set');
    await ctrl.doiTrangThai(ID, input);
    expect(model.updateOne).toHaveBeenCalledWith({ _id: new Types.ObjectId(ID) }, { $set: { hienThi: true } });
  });

  it.each(['tao', 'capNhat'] as const)('%s bỏ cả hienThi và $set được gửi lén', async (method) => {
    const { ctrl, model } = dungController();
    const input = await pipe.transform(Object.assign({}, dto(), { hienThi: false, $set: { hienThi: false } }), { type: 'body', metatype: TranDauDto });
    expect(input).not.toHaveProperty('hienThi');
    expect(input).not.toHaveProperty('$set');
    if (method === 'tao') {
      await ctrl.tao(input);
      expect(model.create.mock.calls[0][0]).not.toHaveProperty('hienThi');
      expect(model.create.mock.calls[0][0]).not.toHaveProperty('$set');
    } else {
      await ctrl.capNhat(ID, input);
      expect(model.updateOne.mock.calls[0][1].$set).not.toHaveProperty('hienThi');
      expect(model.updateOne.mock.calls[0][1].$set).not.toHaveProperty('$set');
    }
  });
});
