import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

/** Đăng nhập (M5A-05): chuỗi bcrypt đã lưu KHÔNG được dùng chính nó làm mật khẩu; tài khoản plaintext cũ vẫn đăng nhập được và được băm lại. */
function dungService(tk: { matKhau: string; save: () => Promise<void> } & Record<string, unknown>) {
  const taiKhoan = { findOne: () => Promise.resolve(tk) };
  const khachHang = { findOne: () => ({ lean: () => Promise.resolve(null) }) };
  const gioHang = { aggregate: () => Promise.resolve([]) };
  const jwt = { sign: () => 'token-gia' };
  return new AuthService(taiKhoan as never, khachHang as never, gioHang as never, jwt as never);
}

const tkMau = (matKhau: string) => ({ _id: '64b000000000000000000001', tenDangNhap: 'u', email: 'u@x.vn', maQuyen: 3, matKhau, save: vi.fn(() => Promise.resolve()) });

describe('AuthService.dangNhap – kiểm tra mật khẩu', () => {
  it('mật khẩu đúng với bản ghi đã băm bcrypt: đăng nhập được', async () => {
    const tk = tkMau(await bcrypt.hash('matkhau-that', 10));
    const r = await dungService(tk).dangNhap({ tenDangNhap: 'u', matKhau: 'matkhau-that' }, false);
    expect(r.token).toBe('token-gia');
  });

  it('gửi CHÍNH chuỗi băm làm mật khẩu bị từ chối (hash lộ ra không dùng trực tiếp để đăng nhập được)', async () => {
    const hash = await bcrypt.hash('matkhau-that', 10);
    const tk = tkMau(hash);
    await expect(dungService(tk).dangNhap({ tenDangNhap: 'u', matKhau: hash }, false)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tk.save).not.toHaveBeenCalled();
  });

  it('mật khẩu sai bị từ chối', async () => {
    const tk = tkMau(await bcrypt.hash('matkhau-that', 10));
    await expect(dungService(tk).dangNhap({ tenDangNhap: 'u', matKhau: 'sai' }, false)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('bản ghi plaintext cũ vẫn đăng nhập được và được băm lại ngay', async () => {
    const tk = tkMau('plain123');
    const r = await dungService(tk).dangNhap({ tenDangNhap: 'u', matKhau: 'plain123' }, false);
    expect(r.token).toBe('token-gia');
    expect(tk.save).toHaveBeenCalledTimes(1);
    expect(tk.matKhau).not.toBe('plain123');
    expect(await bcrypt.compare('plain123', tk.matKhau)).toBe(true);
  });
});
