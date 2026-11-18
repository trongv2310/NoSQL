import { Controller, Get, MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, Observable } from 'rxjs';
import { Roles } from '../auth/auth.guards';
import { Quyen } from '../schemas';
import { SuKienService } from './su-kien.service';

/** Thông báo trực tiếp cho trang quản trị: Server-Sent Events, nguồn là change stream của MongoDB (xem su-kien.service.ts). */
@Roles(Quyen.Admin, Quyen.NhanVien)
@Controller('admin/su-kien')
export class SuKienController {
  constructor(private readonly suKien: SuKienService) {}

  /** Có bật được không (standalone thì không) và vì sao. */
  @Get('trang-thai')
  trangThai() {
    return this.suKien.layTrangThai();
  }

  /** text/event-stream: mỗi sự kiện một message (type = loai); 25 giây gửi "ping" để proxy không cắt kết nối im lặng. */
  @Sse()
  luong(): Observable<MessageEvent> {
    return merge(
      this.suKien.theoDoi().pipe(map((d) => ({ type: d.loai, data: d }) as MessageEvent)),
      interval(25_000).pipe(map(() => ({ type: 'ping', data: '' }) as MessageEvent)),
    );
  }
}
