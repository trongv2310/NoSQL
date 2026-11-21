import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AdminTaiKhoanController, TaiKhoanDto } from './admin-danh-muc.controller';

const ID = '64b000000000000000000010';
const KH = '64b000000000000000000011';
const user = { id: '64b000000000000000000001', tenDangNhap: 'admin', maQuyen: 1 };
const dto = (o: Partial<TaiKhoanDto> = {}): TaiKhoanDto => Object.assign(new TaiKhoanDto(), {
  tenDangNhap: 'nguoidung', matKhau: 'matkhau123', email: 'user@example.com', maQuyen: 3, hoTen: 'Người dùng', ...o,
});

function dungController(maQuyen = 3) {
  const taiKhoan = { _id: ID, email: 'cu@example.com', maQuyen, matKhau: 'cu', save: vi.fn().mockResolvedValue(undefined) };
  const tk = {
    exists: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue(taiKhoan),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    findById: vi.fn().mockResolvedValue(taiKhoan),
  };
  const kh = { create: vi.fn().mockResolvedValue({ _id: KH }), updateOne: vi.fn().mockResolvedValue({}), findOneAndDelete: vi.fn().mockResolvedValue({ _id: KH }) };
  const gio = { deleteMany: vi.fn().mockResolvedValue({}) };
  const don = { updateMany: vi.fn().mockResolvedValue({}) };
  return { ctrl: new AdminTaiKhoanController(tk as never, kh as never, gio as never, don as never), tk, kh, gio, don, taiKhoan };
}

describe('AdminTaiKhoanController.tao', () => {
  it.each([2, 3])('tạo quyền %i: băm mật khẩu và tạo hồ sơ khách', async (maQuyen) => {
    const { ctrl, tk, kh } = dungController();
    const input = dto({ maQuyen });
    await expect(ctrl.tao(input)).resolves.toEqual({ message: 'Tạo tài khoản thành công!' });
    const daTao = tk.create.mock.calls[0][0];
    expect(daTao).toMatchObject({ tenDangNhap: input.tenDangNhap, email: input.email, maQuyen });
    expect(daTao.matKhau).not.toBe(input.matKhau);
    expect(await bcrypt.compare(input.matKhau!, daTao.matKhau)).toBe(true);
    expect(kh.create).toHaveBeenCalledWith({ hoTen: input.hoTen, email: input.email, soDienThoai: '', diaChi: '', taiKhoan: ID });
  });

  it.each([{ tenDangNhap: '' }, { matKhau: '' }])('thiếu tên đăng nhập hoặc mật khẩu: từ chối %o', async (thieu) => {
    const { ctrl, tk } = dungController();
    await expect(ctrl.tao(dto(thieu))).rejects.toBeInstanceOf(BadRequestException);
    expect(tk.create).not.toHaveBeenCalled();
  });

  it.each([['tên đăng nhập', 0], ['email', 1]])('trùng %s: từ chối', async (_ten, lan) => {
    const { ctrl, tk } = dungController();
    if (lan === 1) tk.exists.mockResolvedValueOnce(false);
    tk.exists.mockResolvedValueOnce(true);
    await expect(ctrl.tao(dto())).rejects.toBeInstanceOf(ConflictException);
    expect(tk.create).not.toHaveBeenCalled();
  });

  it('tạo hồ sơ lỗi: xóa bù tài khoản và báo lỗi', async () => {
    const { ctrl, tk, kh } = dungController();
    kh.create.mockRejectedValueOnce(new Error('lỗi hồ sơ'));
    await expect(ctrl.tao(dto())).rejects.toThrow('Lỗi khi tạo tài khoản: lỗi hồ sơ');
    expect(tk.deleteOne).toHaveBeenCalledWith({ _id: ID });
  });

  it('không cho tạo tài khoản admin: 400 đúng thông báo, không ghi dữ liệu', async () => {
    const { ctrl, tk, kh } = dungController();
    await expect(ctrl.tao(dto({ maQuyen: 1 }))).rejects.toMatchObject({ status: 400, message: 'Không được tạo thêm tài khoản quản trị.' });
    expect(tk.create).not.toHaveBeenCalled();
    expect(kh.create).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 0, 4])('tạo với quyền thiếu/không hợp lệ %s: 400, không ghi dữ liệu', async (maQuyen) => {
    const { ctrl, tk, kh } = dungController();
    await expect(ctrl.tao(Object.assign(dto(), { maQuyen }))).rejects.toMatchObject({ status: 400, message: 'Phân quyền không hợp lệ.' });
    expect(tk.create).not.toHaveBeenCalled();
    expect(kh.create).not.toHaveBeenCalled();
  });
});

describe('AdminTaiKhoanController.capNhat', () => {
  it('không cho đổi tên đăng nhập', async () => {
    const { ctrl, tk } = dungController();
    await expect(ctrl.capNhat(user, ID, dto())).rejects.toBeInstanceOf(BadRequestException);
    expect(tk.findById).not.toHaveBeenCalled();
  });

  it('admin không được tự hạ quyền', async () => {
    const { ctrl, taiKhoan } = dungController(1);
    await expect(ctrl.capNhat({ ...user, id: ID }, ID, dto({ tenDangNhap: undefined, maQuyen: 2 }))).rejects.toBeInstanceOf(BadRequestException);
    expect(taiKhoan.save).not.toHaveBeenCalled();
  });

  it.each([2, 3])('sửa thông tin thường của quyền %i, không đổi mật khẩu', async (maQuyen) => {
    const { ctrl, taiKhoan, kh } = dungController(maQuyen);
    const input = dto({ tenDangNhap: undefined, matKhau: undefined, maQuyen, soDienThoai: '0123456789', diaChi: 'Hà Nội' });
    await expect(ctrl.capNhat(user, ID, input)).resolves.toEqual({ message: 'Cập nhật tài khoản thành công!' });
    expect(taiKhoan).toMatchObject({ email: input.email, maQuyen, matKhau: 'cu' });
    expect(taiKhoan.save).toHaveBeenCalledOnce();
    expect(kh.updateOne).toHaveBeenCalledWith({ taiKhoan: ID }, { $set: { hoTen: input.hoTen, email: input.email, soDienThoai: input.soDienThoai, diaChi: input.diaChi } }, { upsert: true });
  });

  it.each([[3, 2], [2, 3], [2, 1], [3, 1], [1, 2], [1, 3]])('không cho đổi quyền %i sang %i: 400 đúng thông báo, không ghi dữ liệu', async (cu, moi) => {
    const { ctrl, taiKhoan, kh } = dungController(cu);
    await expect(ctrl.capNhat(user, ID, dto({ tenDangNhap: undefined, maQuyen: moi }))).rejects.toMatchObject({ status: 400, message: 'Không được đổi vai trò của tài khoản.' });
    expect(taiKhoan.maQuyen).toBe(cu);
    expect(taiKhoan.save).not.toHaveBeenCalled();
    expect(kh.updateOne).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3])('PUT cùng quyền %i: sửa thông tin, giữ nguyên vai trò', async (maQuyen) => {
    const { ctrl, taiKhoan, kh } = dungController(maQuyen);
    const input = dto({ tenDangNhap: undefined, matKhau: undefined, maQuyen });
    await expect(ctrl.capNhat(user, ID, input)).resolves.toEqual({ message: 'Cập nhật tài khoản thành công!' });
    expect(taiKhoan).toMatchObject({ email: input.email, maQuyen });
    expect(kh.updateOne).toHaveBeenCalledOnce();
  });

  it.each([1, 2, 3])('PUT không gửi quyền: sửa thông tin và mật khẩu, giữ quyền %i', async (maQuyen) => {
    const { ctrl, taiKhoan, kh } = dungController(maQuyen);
    const input = dto({ tenDangNhap: undefined });
    delete input.maQuyen;
    await expect(ctrl.capNhat(maQuyen === 1 ? { ...user, id: ID } : user, ID, input)).resolves.toEqual({ message: 'Cập nhật tài khoản thành công!' });
    expect(taiKhoan).toMatchObject({ email: input.email, maQuyen });
    expect(await bcrypt.compare(input.matKhau!, taiKhoan.matKhau)).toBe(true);
    expect(taiKhoan.save).toHaveBeenCalledOnce();
    expect(kh.updateOne).toHaveBeenCalledOnce();
  });
});

describe('AdminTaiKhoanController.xoa', () => {
  it('không cho tự xóa', async () => {
    const { ctrl, tk } = dungController(1);
    await expect(ctrl.xoa({ ...user, id: ID }, ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tk.deleteOne).not.toHaveBeenCalled();
  });

  it.each([2, 3])('xóa quyền %i: xóa tài khoản, hồ sơ và giỏ, giữ đơn', async (maQuyen) => {
    const { ctrl, tk, kh, gio, don } = dungController(maQuyen);
    await expect(ctrl.xoa(user, ID)).resolves.toEqual({ message: 'Xóa tài khoản thành công!' });
    expect(String(tk.deleteOne.mock.calls[0][0]._id)).toBe(ID);
    expect(String(kh.findOneAndDelete.mock.calls[0][0].taiKhoan)).toBe(ID);
    expect(gio.deleteMany).toHaveBeenCalledWith({ khachHang: KH });
    expect(don.updateMany).toHaveBeenCalledWith({ khachHang: KH }, { $set: { khachHang: null } });
  });

  it('tài khoản không tồn tại: báo lỗi, không dọn hồ sơ', async () => {
    const { ctrl, tk, kh } = dungController();
    tk.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    await expect(ctrl.xoa(user, ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(kh.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('không cho xóa admin khác: 400 đúng thông báo, không xóa tài khoản hay dữ liệu liên quan', async () => {
    const { ctrl, tk, kh, gio, don } = dungController(1);
    await expect(ctrl.xoa(user, ID)).rejects.toMatchObject({ status: 400, message: 'Không được xóa tài khoản quản trị.' });
    expect(tk.deleteOne).not.toHaveBeenCalled();
    expect(kh.findOneAndDelete).not.toHaveBeenCalled();
    expect(gio.deleteMany).not.toHaveBeenCalled();
    expect(don.updateMany).not.toHaveBeenCalled();
  });
});

describe('AdminTaiKhoanController đọc tài khoản', () => {
  it('GET danh sách và chi tiết vẫn trả đủ ba quyền', async () => {
    const { ctrl, tk, kh, taiKhoan } = dungController();
    const q = { sort: () => q, skip: () => q, limit: () => q, lean: async () => [taiKhoan] };
    Object.assign(tk, { find: () => q, countDocuments: async () => 1 });
    Object.assign(kh, { find: () => ({ lean: async () => [] }), findOne: () => ({ lean: async () => null }) });
    tk.findById.mockReturnValueOnce(Object.assign(Promise.resolve(taiKhoan), { lean: async () => taiKhoan }));
    const phanQuyens = [
      { maQuyen: 1, tenQuyen: 'Quản trị' },
      { maQuyen: 2, tenQuyen: 'Nhân viên' },
      { maQuyen: 3, tenQuyen: 'Khách hàng' },
    ];
    expect((await ctrl.danhSach({})).phanQuyens).toEqual(phanQuyens);
    expect((await ctrl.chiTiet(ID)).phanQuyens).toEqual(phanQuyens);
  });
});

describe('TaiKhoanDto qua ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const body = { type: 'body' as const, metatype: TaiKhoanDto };

  it('PUT không gửi maQuyen vẫn qua validation và cập nhật được', async () => {
    const input = { email: 'moi@example.com', hoTen: 'Người dùng' };
    const daKiemTra = await pipe.transform(input, body);
    const { ctrl, taiKhoan } = dungController(2);
    await expect(ctrl.capNhat(user, ID, daKiemTra)).resolves.toEqual({ message: 'Cập nhật tài khoản thành công!' });
    expect(taiKhoan.maQuyen).toBe(2);
  });

  it('maQuyen dạng chuỗi được chuyển thành số, tạo admin vẫn bị 400 đúng thông báo', async () => {
    const daKiemTra = await pipe.transform(Object.assign({}, dto(), { maQuyen: '1' }), body);
    const { ctrl, tk } = dungController();
    await expect(ctrl.tao(daKiemTra)).rejects.toMatchObject({ status: 400, message: 'Không được tạo thêm tài khoản quản trị.' });
    expect(tk.create).not.toHaveBeenCalled();
  });

  it.each([0, 4, 'khong-hop-le'])('quyền ngoài danh sách %s bị validation từ chối', async (maQuyen) => {
    await expect(pipe.transform(Object.assign({}, dto(), { maQuyen }), body)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('T-104: xác nhận hợp đồng và đầu vào', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const body = { type: 'body' as const, metatype: TaiKhoanDto };

  it('tạo quyền dạng chuỗi 2 qua ValidationPipe thành công', async () => {
    const input = await pipe.transform(Object.assign({}, dto(), { maQuyen: '2' }), body);
    const { ctrl, tk } = dungController();
    expect(input.maQuyen).toBe(2);
    await expect(ctrl.tao(input)).resolves.toEqual({ message: 'Tạo tài khoản thành công!' });
    expect(tk.create).toHaveBeenCalledWith(expect.objectContaining({ maQuyen: 2 }));
  });

  it('PUT quyền chuỗi trùng quyền hiện tại qua ValidationPipe thành công', async () => {
    const input = await pipe.transform({ email: 'moi@example.com', hoTen: 'Người dùng', maQuyen: '2' }, body);
    const { ctrl, taiKhoan } = dungController(2);
    expect(input.maQuyen).toBe(2);
    await expect(ctrl.capNhat(user, ID, input)).resolves.toEqual({ message: 'Cập nhật tài khoản thành công!' });
    expect(taiKhoan.maQuyen).toBe(2);
  });

  it.each([
    ['email sai', { email: 'khong-la-email' }],
    ['số điện thoại sai', { soDienThoai: '123' }],
    ['mật khẩu dưới 6 ký tự', { matKhau: '12345' }],
    ['tên đăng nhập có ký tự đặc biệt', { tenDangNhap: 'nguoi@dung' }],
    ['tên đăng nhập quá dài', { tenDangNhap: 'a'.repeat(51) }],
    ['mật khẩu quá dài', { matKhau: 'a'.repeat(101) }],
    ['họ tên quá dài', { hoTen: 'a'.repeat(101) }],
    ['email quá dài', { email: `${'a'.repeat(95)}@x.com` }],
    ['địa chỉ quá dài', { diaChi: 'a'.repeat(256) }],
  ])('%s bị ValidationPipe từ chối', async (_ten, sai) => {
    await expect(pipe.transform(Object.assign({}, dto(), sai), body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('xóa tài khoản không tồn tại sau khi tìm không thấy trả 404', async () => {
    const { ctrl, tk, kh } = dungController();
    tk.findById.mockResolvedValueOnce(null);
    tk.deleteOne.mockResolvedValueOnce({ deletedCount: 0 });
    await expect(ctrl.xoa(user, ID)).rejects.toMatchObject({ status: 404 });
    expect(kh.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('admin tự xóa nhận 403 với thông báo tự xóa, không ghi dữ liệu', async () => {
    const { ctrl, tk } = dungController(1);
    await expect(ctrl.xoa({ ...user, id: ID }, ID)).rejects.toMatchObject({ status: 403, message: 'Bạn không thể xóa tài khoản đang đăng nhập.' });
    expect(tk.findById).not.toHaveBeenCalled();
    expect(tk.deleteOne).not.toHaveBeenCalled();
  });
});
