import { ServiceUnavailableException } from '@nestjs/common';
import { Model } from 'mongoose';
import { GioHang } from '../schemas';

/** Điều kiện chọn dòng giỏ ĐANG HOẠT ĐỘNG (chưa bị khách xóa). Mọi truy vấn hiển thị/đếm/đặt hàng phải dùng điều kiện này. */
export const DONG_GIO_HOAT_DONG = { daXoa: { $ne: true } } as const;

const SO_LAN_TOI_DA = 6;
const SO_MA_RONG = { $expr: { $eq: [{ $size: { $ifNull: ['$dongBo', []] } }, 0] } };

/**
 * Xóa dòng giỏ theo nghĩa nghiệp vụ mà KHÔNG làm mất dấu "mã đồng bộ này đã cộng dòng này".
 * Mã chống cộng đôi nằm TRÊN CHÍNH dòng giỏ (`dongBo`), và việc cộng của một lần đồng bộ cũ là thao tác có điều kiện `dongBo.t != syncId`
 * trên đúng tài liệu đó. Vì vậy xóa dòng có mã chỉ được "đánh dấu đã xóa" (`daXoa`, kèm `ngayXoa`) chứ không xóa vật lý: mã vẫn ở lại,
 * lần đồng bộ cũ (kể cả đã qua mọi bước kiểm tra và đang chờ ngay trước lệnh ghi) không khớp điều kiện nên không thể tạo lại hay cộng
 * lại dòng, KHÔNG phụ thuộc thứ tự giữa hai thao tác và không cần nhiều tài liệu/transaction.
 *  - dòng chưa có mã nào: xóa vật lý bằng lệnh có điều kiện (nếu vừa có mã chen vào thì không khớp và sẽ rơi xuống nhánh đánh dấu);
 *  - dòng còn lại: đánh dấu đã xóa; khách thêm lại hoặc một mã đồng bộ MỚI sẽ kích hoạt lại dòng (số lượng tính từ 0, mã cũ giữ nguyên).
 * Dòng đã đánh dấu tự bị xóa vật lý bởi chỉ mục TTL sau 30 ngày kể từ `ngayXoa` (dài hơn mọi lần gửi lại được hỗ trợ: trình duyệt 14 ngày).
 * Dùng cho MỌI đường xóa giỏ của khách (xóa dòng, dọn giỏ khi đặt hàng/MoMo thành công). Chỉ trả về khi không còn dòng hoạt động nào khớp
 * `loc`, nếu không thì ném 503 thay vì báo thành công. `loc` phải gồm `khachHang`. Trả về số dòng đã xóa/đánh dấu.
 */
export async function xoaDongGio(gioHangModel: Model<GioHang>, loc: Record<string, unknown>): Promise<number> {
  const hoatDong = { ...loc, ...DONG_GIO_HOAT_DONG };
  let daXoa = 0;
  for (let lan = 0; lan < SO_LAN_TOI_DA; lan++) {
    daXoa += (await gioHangModel.deleteMany({ ...hoatDong, ...SO_MA_RONG })).deletedCount ?? 0;
    daXoa += (await gioHangModel.updateMany(hoatDong, { $set: { daXoa: true, ngayXoa: new Date() } })).modifiedCount ?? 0;
    if (!(await gioHangModel.exists(hoatDong))) {
      return daXoa;
    }
  }
  throw new ServiceUnavailableException('Chưa xóa được sản phẩm khỏi giỏ hàng lúc này, vui lòng thử lại.');
}
