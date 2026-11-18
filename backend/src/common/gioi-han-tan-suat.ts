import { HttpException, HttpStatus } from '@nestjs/common';
import { Model } from 'mongoose';
import { GioiHanTanSuat } from '../schemas/gioi-han.schema';

/**
 * Giới hạn tần suất theo cửa sổ cố định, lưu trong collection `gioihantansuats` (TTL tự dọn).
 * - `daVuot`: chỉ ĐỌC, chặn trước khi làm việc tốn kém (kiểm mật khẩu bcrypt).
 * - `ghiNhan`: upsert + $inc trong MỘT lệnh, trả số lần mới (đúng kể cả khi nhiều yêu cầu đến cùng lúc).
 * - `xoa`: xoá bộ đếm của khoá (vd. đăng nhập đúng thì xoá số lần sai của tài khoản đó).
 */
export interface QuyTac {
  khoa: string;
  toiDa: number;
  cuaSoMs: number;
}

export const batDauCuaSo = (now: number, cuaSoMs: number) => new Date(Math.floor(now / cuaSoMs) * cuaSoMs);

export class GioiHanMongo {
  constructor(private readonly model: Model<GioiHanTanSuat>) {}

  /** Khoá nào đã chạm trần trong cửa sổ hiện tại → số giây phải chờ; chưa chạm thì null. */
  async daVuot(quyTac: QuyTac[], now = Date.now()): Promise<number | null> {
    const ds = await this.model
      .find({ $or: quyTac.map((q) => ({ khoa: q.khoa, cuaSo: batDauCuaSo(now, q.cuaSoMs) })) }, { khoa: 1, so: 1, hetHan: 1 })
      .lean();
    let cho: number | null = null;
    for (const q of quyTac) {
      const d = ds.find((x) => x.khoa === q.khoa);
      if (d && d.so >= q.toiDa) cho = Math.max(cho ?? 0, Math.ceil((d.hetHan.getTime() - now) / 1000));
    }
    return cho === null ? null : Math.max(1, cho);
  }

  async ghiNhan(quyTac: QuyTac[], now = Date.now()): Promise<void> {
    await Promise.all(
      quyTac.map((q) => {
        const cuaSo = batDauCuaSo(now, q.cuaSoMs);
        return this.model.updateOne(
          { khoa: q.khoa, cuaSo },
          { $inc: { so: 1 }, $setOnInsert: { hetHan: new Date(cuaSo.getTime() + q.cuaSoMs) } },
          { upsert: true },
        ).catch((e: any) => {
          // Hai yêu cầu cùng tạo tài liệu cho một cửa sổ: một bên thắng, bên kia gặp 11000 → cộng lại vào tài liệu vừa có.
          if (e?.code === 11000) return this.model.updateOne({ khoa: q.khoa, cuaSo }, { $inc: { so: 1 } });
          throw e;
        });
      }),
    );
  }

  async xoa(khoa: string): Promise<void> {
    await this.model.deleteMany({ khoa });
  }
}

export function loiQuaNhieuLan(choGiay: number, thongDiep: string): HttpException {
  const loi = new HttpException({ statusCode: 429, message: thongDiep, thuLaiSau: choGiay }, HttpStatus.TOO_MANY_REQUESTS);
  return loi;
}
