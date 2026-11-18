import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
import { DongBoGioDto, TinhGioDto } from './gio-hang.controller';
import { TOI_DA_SO_LUONG, dauNoiDung, gopDong } from './gio-khach';

const A = 'a'.repeat(24);
const B = 'b'.repeat(24);
const C = '0123456789abcdef01234567';

describe('gopDong', () => {
  it('cộng số lượng các dòng trùng biến thể và giữ thứ tự xuất hiện đầu tiên', () => {
    const kq = gopDong([
      { chiTietId: A, soLuong: 2 },
      { chiTietId: B, soLuong: 1 },
      { chiTietId: A, soLuong: 3 },
    ]);
    expect(kq).toEqual([
      { chiTietId: A, soLuong: 5 },
      { chiTietId: B, soLuong: 1 },
    ]);
  });

  it('coi id viết hoa và viết thường là cùng một biến thể', () => {
    expect(gopDong([{ chiTietId: C.toUpperCase(), soLuong: 1 }, { chiTietId: C, soLuong: 1 }])).toEqual([{ chiTietId: C, soLuong: 2 }]);
  });

  it(`không để một dòng vượt ${TOI_DA_SO_LUONG} sau khi gộp`, () => {
    const kq = gopDong([{ chiTietId: A, soLuong: 80 }, { chiTietId: A, soLuong: 80 }]);
    expect(kq).toEqual([{ chiTietId: A, soLuong: TOI_DA_SO_LUONG }]);
  });
});

describe('dauNoiDung', () => {
  it('không phụ thuộc thứ tự dòng hay việc dòng bị tách ra', () => {
    const x = dauNoiDung([{ chiTietId: A, soLuong: 2 }, { chiTietId: B, soLuong: 1 }]);
    expect(dauNoiDung([{ chiTietId: B, soLuong: 1 }, { chiTietId: A, soLuong: 1 }, { chiTietId: A, soLuong: 1 }])).toBe(x);
  });

  it('khác nhau khi số lượng hoặc biến thể khác', () => {
    const x = dauNoiDung([{ chiTietId: A, soLuong: 2 }]);
    expect(dauNoiDung([{ chiTietId: A, soLuong: 3 }])).not.toBe(x);
    expect(dauNoiDung([{ chiTietId: B, soLuong: 2 }])).not.toBe(x);
  });
});

/** Chạy đúng ValidationPipe như app thật (`cauHinhApp`) để xem body xấu bị chặn và trường lạ bị bỏ. */
async function kiemTra<T>(metatype: new () => T, body: unknown): Promise<T> {
  return new ValidationPipe({ whitelist: true, transform: true }).transform(body, { type: 'body', metatype }) as Promise<T>;
}

describe('validation body giỏ khách', () => {
  const hopLe = { dong: [{ chiTietId: A, soLuong: 2 }] };
  const SYNC = 'sync-aaaaaaaaaaaaaaaa';
  const TK = '64b000000000000000000001';

  it('nhận body hợp lệ và BỎ các trường giá/tên/tổng tiền do client tự gửi', async () => {
    const r = await kiemTra(TinhGioDto, {
      dong: [{ chiTietId: A, soLuong: 2, donGia: 1, gia: 1, tenSanPham: 'x', thanhTien: 2 }],
      tongTien: 1,
    });
    expect(r.dong).toHaveLength(1);
    expect(Object.keys(r.dong[0]).sort()).toEqual(['chiTietId', 'soLuong']);
    expect(Object.keys(r)).toEqual(['dong']);
  });

  it.each([
    ['id không phải ObjectId', { dong: [{ chiTietId: 'abc', soLuong: 1 }] }],
    ['số lượng 0', { dong: [{ chiTietId: A, soLuong: 0 }] }],
    ['số lượng âm', { dong: [{ chiTietId: A, soLuong: -1 }] }],
    ['số lượng vượt 100', { dong: [{ chiTietId: A, soLuong: 101 }] }],
    ['số lượng thập phân', { dong: [{ chiTietId: A, soLuong: 1.5 }] }],
    ['số lượng là chuỗi', { dong: [{ chiTietId: A, soLuong: '3' }] }],
    ['số lượng là boolean', { dong: [{ chiTietId: A, soLuong: true }] }],
    ['thiếu số lượng', { dong: [{ chiTietId: A }] }],
    ['dong không phải mảng', { dong: { chiTietId: A, soLuong: 1 } }],
    ['thiếu dong', {}],
    ['quá nhiều dòng thô', { dong: Array.from({ length: 101 }, () => ({ chiTietId: A, soLuong: 1 })) }],
  ])('báo lỗi 400 khi %s', async (_ten, body) => {
    await expect(kiemTra(TinhGioDto, body)).rejects.toMatchObject({ status: 400 });
  });

  it('đồng bộ yêu cầu syncId đúng định dạng', async () => {
    await expect(kiemTra(DongBoGioDto, { ...hopLe, syncId: SYNC, taiKhoanId: TK })).resolves.toMatchObject({ syncId: SYNC, taiKhoanId: TK });
    for (const syncId of [undefined, '', 'ngan', 'co dau cach khong hop le!', 'x'.repeat(65), 123]) {
      await expect(kiemTra(DongBoGioDto, { ...hopLe, syncId, taiKhoanId: TK })).rejects.toMatchObject({ status: 400 });
    }
  });

  it('đồng bộ bắt buộc có taiKhoanId hợp lệ (tài khoản mà bản đồng bộ được lập cho)', async () => {
    for (const taiKhoanId of [undefined, '', 'abc', 123, null]) {
      await expect(kiemTra(DongBoGioDto, { ...hopLe, syncId: SYNC, taiKhoanId })).rejects.toMatchObject({ status: 400 });
    }
  });

  it('class-validator cũng từ chối id xấu ở dòng thứ hai (không chỉ dòng đầu)', async () => {
    const dto = plainToInstance(TinhGioDto, { dong: [{ chiTietId: A, soLuong: 1 }, { chiTietId: 'xấu', soLuong: 1 }] });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
