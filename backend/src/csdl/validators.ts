import { KHOA_THUOC_TINH } from '../catalog/thuoc-tinh';
import { THE_DANH_GIA } from '../common/danh-gia';
import { CHAN_THUONG, LOI_CHOI, NOI_DUNG, TAY_THUAN, TOI_DA_BUOI_MOI_TUAN, TRINH_DO } from '../common/ho-so-choi';
import { TRANG_THAI } from '../schemas/don-hang.schema';
import { LOAI_TIN } from '../schemas/ban-tin.schema';
import { Quyen } from '../schemas/tai-khoan.schema';
import { TRANG_THAI_DAT_CHO } from '../schemas/lich-cang.schema';
import { DON_VI_CANG, LOAI_SU_KIEN, NGUON_VOT, NOI_CANG, TOI_DA_CHU_KY_NGAY, TOI_DA_LICH_SU_NHUNG } from '../schemas/vot-ca-nhan.schema';

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

/** Mức căng lưu theo lbs. 5–100 lbs là khoảng chặn lỗi nhập (gõ thừa số 0...), không phải khuyến nghị. */
const MUC_CANG_LBS = { bsonType: 'number', minimum: 5, maximum: 100 } as const;
const LAN_CANG_NHUNG = {
  bsonType: 'object',
  required: ['_id', 'ngay', 'mucCangLbs', 'giaTriNhap', 'donViNhap', 'noiCang'],
  additionalProperties: false,
  properties: {
    _id: ID,
    ngay: NGAY,
    mucCangLbs: MUC_CANG_LBS,
    giaTriNhap: { bsonType: 'number', minimum: 0, exclusiveMinimum: true },
    donViNhap: { enum: [...DON_VI_CANG] },
    tenDay: chuoi(60),
    noiCang: { enum: [...NOI_CANG] },
    vuotMucNSX: { bsonType: 'bool' },
  },
};

export interface DinhNghiaValidator {
  /** Một câu giải thích ràng buộc, in ra khi chạy `db:setup` và dùng trong báo cáo. */
  moTa: string;
  validator: Record<string, unknown>;
}

export const VALIDATORS: Record<string, DinhNghiaValidator> = {
  goiysanphams: {
    moTa: 'Tập gợi ý có ít nhất hai sản phẩm, hạng và tham số khai thác nguyên trong giới hạn.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['khoa', 'sanPham', 'loiNhuan', 'hang', 'k', 'soThang', 'taoLuc'],
        properties: {
          khoa: chuoi(undefined, 1),
          sanPham: { bsonType: 'array', minItems: 2, uniqueItems: true, items: ID },
          loiNhuan: SO_KHONG_AM,
          hang: { bsonType: 'number', minimum: 1, multipleOf: 1 },
          k: { bsonType: 'number', minimum: 1, maximum: 50, multipleOf: 1 },
          soThang: { bsonType: 'number', minimum: 1, maximum: 12, multipleOf: 1 },
          taoLuc: NGAY,
        },
      },
    },
  },
  sanphams: {
    moTa: 'Tên 1–100 ký tự, giá gốc không âm, các khoá ngoại là ObjectId, xoá mềm là ngày hoặc null, trường tìm kiếm chỉ chữ không dấu.',
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
          danhGiaTongHop: {
            bsonType: 'object',
            required: ['so', 'tong'],
            properties: {
              so: SO_NGUYEN_KHONG_AM,
              tong: SO_NGUYEN_KHONG_AM,
              trungBinh: { bsonType: ['number', 'null'], minimum: 1, maximum: 5 },
            },
          },
          // Trường tìm kiếm đã chuẩn hoá: chỉ chữ thường không dấu và số (đúng như khongDau() sinh ra).
          timKiem: {
            bsonType: 'object',
            required: ['chuoi'],
            properties: {
              chuoi: { bsonType: 'string', pattern: '^[a-z0-9 ]*$' },
              tu: { bsonType: 'array', items: { bsonType: 'string', pattern: '^[a-z0-9]+$' } },
              baKyTu: { bsonType: 'array', items: { bsonType: 'string', maxLength: 3 } },
            },
          },
        },
      },
      // Computed pattern: tổng điểm nằm giữa 1×số đánh giá và 5×số đánh giá (chưa có tổng hợp thì bỏ qua).
      $expr: {
        $or: [
          { $eq: [{ $type: '$danhGiaTongHop' }, 'missing'] },
          {
            $and: [
              { $gte: ['$danhGiaTongHop.tong', '$danhGiaTongHop.so'] },
              { $lte: ['$danhGiaTongHop.tong', { $multiply: ['$danhGiaTongHop.so', 5] }] },
            ],
          },
        ],
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
          laDuLieuMau: { bsonType: 'bool' },
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

  votcanhans: {
    moTa:
      'Hộ chiếu vợt thuộc một khách hàng; nhúng tối đa 10 lần căng gần nhất; mức căng 5–100 lbs; chu kỳ nhắc 1–365 ngày; ' +
      'soLanCang không nhỏ hơn số lần nhúng và khoảng căng nhà sản xuất hợp lệ (min ≤ max).',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['khachHang', 'nguon', 'ten', 'soLanCang', 'lichSuCang'],
        properties: {
          khachHang: ID,
          nguon: { enum: [...NGUON_VOT] },
          sanPham: ID_HOAC_NULL,
          bienThe: ID_HOAC_NULL,
          donHang: ID_HOAC_NULL,
          ten: chuoi(80, 1),
          soSerial: chuoi(40, 1),
          maNguon: chuoi(120, 1),
          thongSoChup: {
            bsonType: 'object',
            additionalProperties: false,
            properties: { sucCangMinLbs: SO_KHONG_AM, sucCangMaxLbs: SO_KHONG_AM, trongLuongU: SO_NGUYEN_KHONG_AM },
          },
          ngayMua: NGAY,
          chuKyNhacNgay: { bsonType: 'number', minimum: 1, maximum: TOI_DA_CHU_KY_NGAY, multipleOf: 1 },
          lanCangGanNhat: LAN_CANG_NHUNG,
          hanNhacLuc: NGAY,
          soLanCang: SO_NGUYEN_KHONG_AM,
          lichSuCang: { bsonType: 'array', maxItems: TOI_DA_LICH_SU_NHUNG, items: LAN_CANG_NHUNG },
          suKien: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['loai', 'ngay'],
              properties: { loai: { enum: [...LOAI_SU_KIEN] }, ngay: NGAY, ghiChu: chuoi(200) },
            },
          },
          ghiChu: chuoi(200),
          taoLuc: NGAY,
          deletedAt: NGAY_HOAC_NULL,
          laDuLieuMau: { bsonType: 'bool' },
        },
      },
      $expr: {
        $and: [
          { $gte: ['$soLanCang', { $size: { $ifNull: ['$lichSuCang', []] } }] },
          {
            $or: [
              { $eq: [{ $type: '$thongSoChup.sucCangMinLbs' }, 'missing'] },
              { $eq: [{ $type: '$thongSoChup.sucCangMaxLbs' }, 'missing'] },
              { $lte: ['$thongSoChup.sucCangMinLbs', '$thongSoChup.sucCangMaxLbs'] },
            ],
          },
        ],
      },
    },
  },

  lancangs: {
    moTa: 'Mỗi lần căng thuộc một hộ chiếu và một khách hàng; mức căng 5–100 lbs; đơn vị nhập kg|lbs; nơi căng shop|ngoài.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['votCaNhan', 'khachHang', 'ngay', 'mucCangLbs', 'giaTriNhap', 'donViNhap', 'noiCang'],
        properties: {
          votCaNhan: ID,
          khachHang: ID,
          ngay: NGAY,
          mucCangLbs: MUC_CANG_LBS,
          giaTriNhap: { bsonType: 'number', minimum: 0, exclusiveMinimum: true },
          donViNhap: { enum: [...DON_VI_CANG] },
          tenDay: chuoi(60),
          noiCang: { enum: [...NOI_CANG] },
          nguoiDanhChup: {
            bsonType: 'object',
            additionalProperties: false,
            properties: { trinhDo: { enum: [...TRINH_DO] }, loiChoi: { enum: [...LOI_CHOI] } },
          },
          vuotMucNSX: { bsonType: 'bool' },
          laDuLieuMau: { bsonType: 'bool' },
          taoLuc: NGAY,
        },
      },
    },
  },

  lichcangs: {
    moTa:
      'Mỗi khung giờ một document; số chỗ đang giữ không vượt sức chứa và luôn bằng số chỗ đặt chưa huỷ; mỗi chỗ đặt có mức căng 5–100 lbs.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['ngay', 'sucChua', 'soDaDat', 'datCho'],
        properties: {
          ngay: NGAY,
          sucChua: { bsonType: 'number', minimum: 1, maximum: 10, multipleOf: 1 },
          soDaDat: SO_NGUYEN_KHONG_AM,
          datCho: {
            bsonType: 'array',
            maxItems: 50,
            items: {
              bsonType: 'object',
              required: ['_id', 'khachHang', 'votCaNhan', 'mucCangLbs', 'giaTriNhap', 'donViNhap', 'trangThai'],
              properties: {
                _id: ID,
                khachHang: ID,
                votCaNhan: ID,
                tenVot: chuoi(80),
                tenKhach: chuoi(100),
                mucCangLbs: MUC_CANG_LBS,
                giaTriNhap: { bsonType: 'number', minimum: 0, exclusiveMinimum: true },
                donViNhap: { enum: [...DON_VI_CANG] },
                tenDay: chuoi(60),
                trangThai: { enum: [...TRANG_THAI_DAT_CHO] },
                lanCang: ID_HOAC_NULL,
                taoLuc: NGAY,
              },
            },
          },
        },
      },
      $expr: {
        $and: [
          { $lte: ['$soDaDat', '$sucChua'] },
          { $eq: ['$soDaDat', { $size: { $filter: { input: '$datCho', cond: { $ne: ['$$this.trangThai', 'huy'] } } } }] },
        ],
      },
    },
  },

  // ---- Bổ sung: phủ nốt các collection còn lại (danh mục, khuyến mãi, bản tin, giỏ hàng, nhật ký giá) ----
  khuyenmais: {
    moTa: 'Phần trăm giảm 0–100, giảm tối đa ≥ 0; $expr: ngày kết thúc không trước ngày bắt đầu.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenChuongTrinh', 'phanTramGiam'],
        properties: {
          tenChuongTrinh: chuoi(100, 1),
          moTa: chuoi(255),
          ngayBatDau: NGAY_HOAC_NULL,
          ngayKetThuc: NGAY_HOAC_NULL,
          phanTramGiam: { bsonType: 'number', minimum: 0, maximum: 100 },
          giamToiDa: { bsonType: ['number', 'null'], minimum: 0 },
          soLuongSuDung: { bsonType: ['number', 'null'], minimum: 0 },
        },
      },
      $expr: {
        $or: [
          { $eq: [{ $type: '$ngayBatDau' }, 'missing'] },
          { $eq: [{ $type: '$ngayKetThuc' }, 'missing'] },
          { $eq: ['$ngayBatDau', null] },
          { $eq: ['$ngayKetThuc', null] },
          { $lte: ['$ngayBatDau', '$ngayKetThuc'] },
        ],
      },
    },
  },

  tintucs: {
    moTa: 'Tiêu đề 1–200 ký tự, nội dung bắt buộc, loại tin thuộc danh sách, lượt xem là số nguyên không âm.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tieuDe', 'noiDung', 'loaiTin'],
        properties: {
          tieuDe: chuoi(200, 1),
          tomTat: chuoi(500),
          noiDung: chuoi(undefined, 1),
          loaiTin: { enum: Object.keys(LOAI_TIN) },
          sanPham: ID_HOAC_NULL,
          tranDau: ID_HOAC_NULL,
          tacGia: ID_HOAC_NULL,
          noiBat: { bsonType: 'bool' },
          hienThi: { bsonType: 'bool' },
          thuTu: { bsonType: 'number' },
          luotXem: SO_NGUYEN_KHONG_AM,
          ngayDang: NGAY,
          deletedAt: NGAY_HOAC_NULL,
        },
      },
    },
  },

  trandaus: {
    moTa: 'Đội thắng là A, B hoặc chưa có; $expr: hai đội phải khác nhau.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['tenGiaiDau', 'vong', 'noiDung', 'doiA', 'doiB', 'ngayThiDau'],
        properties: {
          tenGiaiDau: chuoi(150, 1),
          vong: chuoi(60, 1),
          noiDung: chuoi(60, 1),
          doiA: chuoi(150, 1),
          doiB: chuoi(150, 1),
          tiSo: chuoi(60),
          doiThang: { enum: ['A', 'B', null] },
          ngayThiDau: NGAY,
          hienThi: { bsonType: 'bool' },
        },
      },
      $expr: { $ne: [{ $toLower: { $trim: { input: '$doiA' } } }, { $toLower: { $trim: { input: '$doiB' } } }] },
    },
  },

  giohangs: {
    moTa: 'Mỗi dòng giỏ thuộc một khách và một biến thể; số lượng là số nguyên không âm.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['khachHang', 'chiTietSanPham', 'soLuong'],
        properties: {
          khachHang: ID,
          chiTietSanPham: ID,
          soLuong: SO_NGUYEN_KHONG_AM,
          ngayThem: NGAY,
          daXoa: { bsonType: 'bool' },
          ngayXoa: NGAY,
        },
      },
    },
  },

  lichsuthaydoigias: {
    moTa: 'Nhật ký đổi giá của một biến thể; giá cũ/mới không âm.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['chiTiet'],
        properties: { chiTiet: ID, giaCu: { bsonType: ['number', 'null'], minimum: 0 }, giaMoi: { bsonType: ['number', 'null'], minimum: 0 }, ngayThayDoi: NGAY, nguoiThayDoi: chuoi(50) },
      },
    },
  },

  hangs: { moTa: 'Tên hãng 1–100 ký tự.', validator: { $jsonSchema: { bsonType: 'object', required: ['tenHang'], properties: { tenHang: chuoi(100, 1) } } } },
  loaisanphams: { moTa: 'Tên loại 1–100 ký tự.', validator: { $jsonSchema: { bsonType: 'object', required: ['tenLoai'], properties: { tenLoai: chuoi(100, 1) } } } },
  mausacs: { moTa: 'Tên màu 1–50 ký tự.', validator: { $jsonSchema: { bsonType: 'object', required: ['tenMau'], properties: { tenMau: chuoi(50, 1) } } } },
  sizes: { moTa: 'Tên size 1–20 ký tự, loại size bắt buộc.', validator: { $jsonSchema: { bsonType: 'object', required: ['tenSize', 'loaiSize'], properties: { tenSize: chuoi(20, 1), loaiSize: chuoi(30, 1) } } } },

  gioihantansuats: {
    moTa: 'Bộ đếm giới hạn tần suất: khoá + mốc cửa sổ + số lần ≥ 0 + thời điểm hết hạn (TTL tự xoá).',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['khoa', 'cuaSo', 'so', 'hetHan'],
        properties: { khoa: chuoi(200, 1), cuaSo: NGAY, so: SO_NGUYEN_KHONG_AM, hetHan: NGAY },
      },
      $expr: { $gt: ['$hetHan', '$cuaSo'] },
    },
  },
  theodoisukiens: {
    moTa: 'Resume token của change stream: tên luồng (_id) + token (object có _data) + thời điểm lưu.',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'token', 'luc'],
        properties: { _id: chuoi(100, 1), token: { bsonType: 'object', required: ['_data'] }, luc: NGAY },
      },
    },
  },
};
