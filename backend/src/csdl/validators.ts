import { KHOA_THUOC_TINH } from '../catalog/thuoc-tinh';
import { THE_DANH_GIA } from '../common/danh-gia';
import { CHAN_THUONG, LOI_CHOI, NOI_DUNG, TAY_THUAN, TOI_DA_BUOI_MOI_TUAN, TRINH_DO } from '../common/ho-so-choi';
import { TRANG_THAI } from '../schemas/don-hang.schema';
import { Quyen } from '../schemas/tai-khoan.schema';

/**
 * Bộ kiểm tra dữ liệu ($jsonSchema, kèm $expr cho ràng buộc giữa các trường) gắn thẳng vào collection bằng `collMod`.
 *
 * Mongoose đã kiểm dữ liệu ở tầng ứng dụng, nhưng chỉ khi ghi qua model. Validator nằm trong MongoDB nên chặn được mọi đường ghi khác:
 * mongosh, Compass, script nhập liệu, một service quên kiểm. Đây là lớp chặn cuối, không thay cho kiểm tra ở API.
 *
 * Quy ước:
 * - Không đặt `additionalProperties: false`. Schema linh hoạt là điểm mạnh của MongoDB, và các mốc sau sẽ thêm trường mới.
 * - `required` chỉ gồm trường mà mọi đường ghi hiện có đều đặt (Mongoose `required` hoặc có `default`).
 * - Số dùng bsonType "number" (int/long/double/decimal). Trường đếm thêm `multipleOf: 1` để buộc là số nguyên.
 * - Mọi ràng buộc ở đây đã được đối chiếu với dữ liệu seed và một CSDL đang dùng (18/11/2026: 0 tài liệu vi phạm).
 */

const SO_KHONG_AM = { bsonType: 'number', minimum: 0 } as const;
const SO_NGUYEN_KHONG_AM = { bsonType: 'number', minimum: 0, multipleOf: 1 } as const;
const ID = { bsonType: 'objectId' } as const;
const ID_HOAC_NULL = { bsonType: ['objectId', 'null'] } as const;
const NGAY = { bsonType: 'date' } as const;
const NGAY_HOAC_NULL = { bsonType: ['date', 'null'] } as const;
const chuoi = (maxLength?: number, minLength?: number) => ({
  bsonType: 'string',
  ...(minLength !== undefined ? { minLength } : {}),
  ...(maxLength !== undefined ? { maxLength } : {}),
});

/** Chuỗi băm bcrypt (`$2a$`, `$2b$`, `$2y$`…, 60 ký tự). Mật khẩu dạng chữ thường không bao giờ lọt vào CSDL. */
export const MAU_BCRYPT = '^\\$2[abxy]\\$\\d{2}\\$[./A-Za-z0-9]{53}$';

export interface DinhNghiaValidator {
  /** Một câu giải thích ràng buộc, in ra khi chạy `db:setup` và dùng trong báo cáo. */
  moTa: string;
  validator: Record<string, unknown>;
}

export const VALIDATORS: Record<string, DinhNghiaValidator> = {
  sanphams: {
    moTa: 'Tên 1–100 ký tự, giá gốc không âm, các khoá ngoại là ObjectId, xoá mềm là ngày hoặc null.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenSanPham', 'giaGoc'],
        properties: {
          tenSanPham: chuoi(100, 1),
          moTa: chuoi(5000),
          giaGoc: SO_KHONG_AM,
          hinhAnhDaiDien: chuoi(),
          loai: ID_HOAC_NULL,
          nhaCungCap: ID_HOAC_NULL,
          hang: ID_HOAC_NULL,
          khuyenMai: ID_HOAC_NULL,
          coSize: { bsonType: 'bool' },
          coMau: { bsonType: 'bool' },
          ngayTao: NGAY,
          deletedAt: NGAY_HOAC_NULL,
        },
      },
    },
  },

  chitietsanphams: {
    moTa:
      'Biến thể phải thuộc một sản phẩm, SKU 1–50 ký tự, tồn kho là số nguyên không âm, giá bán không âm, thông số vợt là chuỗi, ' +
      'thuocTinh chỉ gồm khoá đã định nghĩa.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['sanPham', 'sku', 'soLuongTon'],
        properties: {
          sanPham: ID,
          mau: ID_HOAC_NULL,
          size: ID_HOAC_NULL,
          giaBan: { bsonType: ['number', 'null'], minimum: 0 },
          // Lớp chặn thứ hai sau `$inc` có điều kiện ở OrderService: dù code nào trừ quá tay thì tồn kho cũng không thể âm.
          soLuongTon: SO_NGUYEN_KHONG_AM,
          sku: chuoi(50, 1),
          hinhAnh: chuoi(),
          thongSo: {
            bsonType: 'object',
            properties: {
              doCanBang: chuoi(),
              trongLuong: chuoi(),
              doCung: chuoi(),
              chieuDai: chuoi(),
              sucCang: chuoi(),
            },
          },
          // Attribute pattern: chỉ nhận khoá đã định nghĩa, giá trị là số (riêng loiChoi là chuỗi).
          thuocTinh: {
            bsonType: 'array',
            maxItems: 20,
            items: {
              bsonType: 'object',
              required: ['k', 'v'],
              additionalProperties: false,
              properties: {
                k: { enum: [...KHOA_THUOC_TINH] },
                v: { bsonType: ['number', 'string'] },
              },
            },
          },
        },
      },
    },
  },

  donhangs: {
    moTa:
      'Trạng thái thuộc danh sách cố định, mỗi dòng hàng có số lượng ≥ 1, và tiền khớp nhau: thành tiền = số lượng × đơn giá, ' +
      'tổng tiền = tổng các thành tiền, tổng sau giảm = tổng tiền − tiền giảm.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['soDonHang', 'ngayDat', 'trangThai', 'tongTien', 'tongTienSauGiam', 'tienGiam', 'chiTiet'],
        properties: {
          soDonHang: { bsonType: 'number', minimum: 1, multipleOf: 1 },
          ngayDat: NGAY,
          trangThai: { enum: Object.values(TRANG_THAI) },
          tongTien: SO_KHONG_AM,
          tongTienSauGiam: SO_KHONG_AM,
          tienGiam: SO_KHONG_AM,
          khachHang: ID_HOAC_NULL,
          hoTenNhan: chuoi(100),
          diaChiGiaoHang: chuoi(255),
          soDienThoaiNhanHang: chuoi(15),
          ghiChu: chuoi(500),
          chiTiet: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['soLuong', 'donGia', 'thanhTien'],
              properties: {
                chiTietSanPham: ID_HOAC_NULL,
                sanPham: ID_HOAC_NULL,
                tenSanPham: chuoi(),
                hinhAnh: chuoi(),
                sku: chuoi(),
                tenMau: chuoi(),
                tenSize: chuoi(),
                soLuong: { bsonType: 'number', minimum: 1, multipleOf: 1 },
                donGia: SO_KHONG_AM,
                thanhTien: SO_KHONG_AM,
              },
            },
          },
        },
      },
      // $jsonSchema chỉ kiểm từng trường riêng lẻ; ràng buộc giữa các trường phải viết bằng $expr.
      $expr: {
        $and: [
          { $eq: ['$tongTienSauGiam', { $subtract: ['$tongTien', '$tienGiam'] }] },
          { $eq: ['$tongTien', { $sum: '$chiTiet.thanhTien' }] },
          {
            $allElementsTrue: [
              {
                $map: {
                  input: '$chiTiet',
                  as: 'd',
                  in: { $eq: ['$$d.thanhTien', { $multiply: ['$$d.soLuong', '$$d.donGia'] }] },
                },
              },
            ],
          },
        ],
      },
    },
  },

  khachhangs: {
    moTa: 'Họ tên 1–100 ký tự; liên kết tài khoản (nếu có) là ObjectId; hồ sơ người chơi chỉ nhận giá trị trong danh sách, mảng không trùng phần tử.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['hoTen'],
        properties: {
          hoTen: chuoi(100, 1),
          email: chuoi(100),
          soDienThoai: chuoi(15),
          diaChi: chuoi(255),
          taiKhoan: ID_HOAC_NULL,
          ngayTao: NGAY,
          hoSoChoi: {
            bsonType: 'object',
            additionalProperties: false,
            properties: {
              trinhDo: { enum: [...TRINH_DO] },
              noiDung: { bsonType: 'array', uniqueItems: true, minItems: 1, items: { enum: [...NOI_DUNG] } },
              loiChoi: { enum: [...LOI_CHOI] },
              tayThuan: { enum: [...TAY_THUAN] },
              chanThuong: { bsonType: 'array', uniqueItems: true, minItems: 1, items: { enum: [...CHAN_THUONG] } },
              soBuoiMoiTuan: { bsonType: 'number', minimum: 0, maximum: TOI_DA_BUOI_MOI_TUAN, multipleOf: 1 },
              capNhatLuc: NGAY,
            },
          },
        },
      },
    },
  },

  phanhois: {
    moTa:
      'Đánh giá phải gắn với một sản phẩm, số sao là số nguyên 1–5, nội dung tối đa 255 ký tự; bản chụp người viết và thẻ chỉ nhận giá trị trong danh sách; ' +
      'số lượt hữu ích luôn bằng số người đã bấm.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['sanPham', 'danhGia'],
        properties: {
          noiDung: chuoi(255),
          ngayPhanHoi: NGAY,
          danhGia: { bsonType: 'number', minimum: 1, maximum: 5, multipleOf: 1 },
          daXacMinh: { bsonType: 'bool' },
          khachHang: ID_HOAC_NULL,
          sanPham: ID,
          bienThe: ID_HOAC_NULL,
          nguoiDanh: {
            bsonType: 'object',
            additionalProperties: false,
            properties: {
              trinhDo: { enum: [...TRINH_DO] },
              noiDung: { bsonType: 'array', uniqueItems: true, items: { enum: [...NOI_DUNG] } },
              loiChoi: { enum: [...LOI_CHOI] },
              chanThuong: { bsonType: 'array', uniqueItems: true, items: { enum: [...CHAN_THUONG] } },
            },
          },
          the: { bsonType: 'array', uniqueItems: true, maxItems: THE_DANH_GIA.length, items: { enum: [...THE_DANH_GIA] } },
          huuIch: { bsonType: 'array', uniqueItems: true, items: ID },
          soHuuIch: SO_NGUYEN_KHONG_AM,
          daMuaHang: { bsonType: 'bool' },
          laDuLieuMau: { bsonType: 'bool' },
        },
      },
      // Bộ đếm phải khớp danh sách người bấm (cả hai được đổi trong cùng một lệnh, xem PhanHoiController.huuIch).
      $expr: { $eq: [{ $ifNull: ['$soHuuIch', 0] }, { $size: { $ifNull: ['$huuIch', []] } }] },
    },
  },

  taikhoans: {
    moTa: 'Tên đăng nhập 1–50 ký tự, mật khẩu bắt buộc là chuỗi băm bcrypt, quyền thuộc {1 admin, 2 nhân viên, 3 khách hàng}.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenDangNhap', 'matKhau', 'maQuyen'],
        properties: {
          tenDangNhap: chuoi(50, 1),
          matKhau: { bsonType: 'string', pattern: MAU_BCRYPT },
          email: chuoi(100),
          maQuyen: { enum: [Quyen.Admin, Quyen.NhanVien, Quyen.KhachHang] },
          ngayTao: NGAY,
        },
      },
    },
  },
};
