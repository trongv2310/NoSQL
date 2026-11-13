import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { GioHangController, ThemGioHangDto, kiemTraChuGio } from './gio-hang.controller';

/**
 * M3-QA1-02 (H1): món thêm theo ý định của MỘT tài khoản không được ghi vào giỏ của tài khoản khác khi phiên đăng nhập (cookie) đã đổi giữa lúc
 * yêu cầu còn bay. Server so `taiKhoanDuKien` với tài khoản của phiên đăng nhập và từ chối 403 TRƯỚC khi chạm vào giỏ; không bao giờ dùng giá trị
 * client gửi để chọn giỏ.
 */
const A = '64b000000000000000000001';
const B = '64b000000000000000000002';
const BIEN_THE = '6ae71c0ce9fc9d4b5a6a001d';

const user = (id: string) => ({ id, tenDangNhap: 't', maQuyen: 3 }) as never;

describe('POST /gio-hang: đối chiếu tài khoản dự kiến (H1)', () => {
  const taoController = () => {
    const gioHang = { them: vi.fn().mockResolvedValue({ message: 'ok', cartCount: 1 }) };
    const gioKhach = {};
    return { gioHang, ctrl: new GioHangController(gioHang as never, gioKhach as never) };
  };

  it('tài khoản dự kiến KHÁC phiên đăng nhập → 403 sai_tai_khoan và KHÔNG gọi service thêm giỏ (không ghi gì)', () => {
    const { gioHang, ctrl } = taoController();
    let loi: unknown;
    try {
      void ctrl.them(user(B), { chiTietId: BIEN_THE, quantity: 1, taiKhoanDuKien: A });
    } catch (e) {
      loi = e;
    }
    expect(loi).toBeInstanceOf(ForbiddenException);
    expect((loi as ForbiddenException).getStatus()).toBe(403);
    expect((loi as ForbiddenException).getResponse()).toMatchObject({ maLoi: 'sai_tai_khoan' });
    expect(gioHang.them).not.toHaveBeenCalled();
  });

  it('tài khoản dự kiến TRÙNG phiên → thêm vào giỏ của chính phiên đó (user.id), số lượng đúng', async () => {
    const { gioHang, ctrl } = taoController();
    await ctrl.them(user(A), { chiTietId: BIEN_THE, quantity: 2, taiKhoanDuKien: A });
    expect(gioHang.them).toHaveBeenCalledExactlyOnceWith(A, BIEN_THE, 2);
  });

  it('tương thích ngược: client cũ không gửi taiKhoanDuKien vẫn thêm bình thường vào giỏ của phiên', async () => {
    const { gioHang, ctrl } = taoController();
    await ctrl.them(user(B), { chiTietId: BIEN_THE });
    expect(gioHang.them).toHaveBeenCalledExactlyOnceWith(B, BIEN_THE, 1);
  });

  it('kiemTraChuGio không dùng giá trị client để đổi chủ: khác thì ném, trùng/không có thì im lặng', () => {
    expect(() => kiemTraChuGio(A, B)).toThrow(ForbiddenException);
    expect(() => kiemTraChuGio(A, A)).not.toThrow();
    expect(() => kiemTraChuGio(A, undefined)).not.toThrow();
  });
});

describe('validation ThemGioHangDto.taiKhoanDuKien', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true, expectedType: ThemGioHangDto });
  const chay = (body: unknown) => pipe.transform(body, { type: 'body', metatype: ThemGioHangDto });

  it('nhận ObjectId hợp lệ hoặc vắng mặt; từ chối giá trị rác trước khi tới controller', async () => {
    await expect(chay({ chiTietId: BIEN_THE, taiKhoanDuKien: A })).resolves.toMatchObject({ taiKhoanDuKien: A });
    await expect(chay({ chiTietId: BIEN_THE })).resolves.toMatchObject({ chiTietId: BIEN_THE });
    for (const rac of ['abc', 123, {}, true]) {
      await expect(chay({ chiTietId: BIEN_THE, taiKhoanDuKien: rac })).rejects.toMatchObject({ status: 400 });
    }
  });
});
