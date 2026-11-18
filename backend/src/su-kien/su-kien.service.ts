import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, mongo, Types } from 'mongoose';

type Document = mongo.Document;
type ChangeStream = mongo.ChangeStream;
type ChangeStreamDocument<T extends Document> = mongo.ChangeStreamDocument<T>;
import { Observable, ReplaySubject, Subject } from 'rxjs';
import { docMoiTruong } from '../csdl/moi-truong';

/** Tồn kho của một phiên bản xuống tới mức này (sau một lần cập nhật) thì báo admin. */
export const NGUONG_TON_THAP = 3;
const TEN_LUONG = 'admin-thong-bao';

export type SuKienAdmin =
  | { loai: 'don-moi'; luc: string; soDonHang: number; tongTien: number; hoTenNhan: string | null }
  | { loai: 'ton-thap'; luc: string; chiTiet: string; sku: string | null; sanPham: string | null; tenSanPham: string | null; soLuongTon: number };

export interface TrangThaiSuKien {
  hoTro: boolean;
  lyDo: string | null;
  /** Đọc tiếp từ resume token đã lưu (true) hay bắt đầu từ bây giờ (false). */
  docTiep: boolean;
}

/**
 * Pipeline lọc NGAY TRÊN MÁY CHỦ MongoDB: chỉ hai loại sự kiện admin cần đi qua mạng.
 *   - insert vào donhangs  → đơn mới,
 *   - update chitietsanphams có soLuongTon mới ≤ ngưỡng → sắp hết hàng (updateDescription.updatedFields chứa giá trị SAU khi cập nhật).
 * $project bỏ mọi trường không dùng (địa chỉ, số điện thoại... của khách không rời MongoDB).
 */
export function pipelineSuKien(nguong = NGUONG_TON_THAP): Document[] {
  return [
    {
      $match: {
        $or: [
          { operationType: 'insert', 'ns.coll': 'donhangs' },
          { operationType: 'update', 'ns.coll': 'chitietsanphams', 'updateDescription.updatedFields.soLuongTon': { $lte: nguong } },
        ],
      },
    },
    {
      $project: {
        operationType: 1, ns: 1, documentKey: 1, clusterTime: 1,
        'fullDocument.soDonHang': 1, 'fullDocument.tongTienSauGiam': 1, 'fullDocument.hoTenNhan': 1,
        'fullDocument.sku': 1, 'fullDocument.sanPham': 1,
        'updateDescription.updatedFields.soLuongTon': 1,
      },
    },
  ];
}

/**
 * Change stream cho thông báo admin. Chỉ chạy được khi MongoDB là replica set (change stream đọc oplog); standalone thì báo rõ lý do.
 * Mỗi sự kiện xong thì lưu resume token vào `theodoisukiens`; khởi động lại API thì `startAfter` token đó nên không mất sự kiện.
 */
@Injectable()
export class SuKienService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SuKienService.name);
  private luong: ChangeStream | null = null;
  private dangDung = false;
  private readonly kenh = new Subject<SuKienAdmin>();
  /** 20 sự kiện gần nhất cho người vừa mở trang admin. */
  private readonly ganDay = new ReplaySubject<SuKienAdmin>(20);
  private trangThai: TrangThaiSuKien = { hoTro: false, lyDo: 'Chưa khởi động.', docTiep: false };

  constructor(@InjectConnection() private readonly conn: Connection) {}

  async onApplicationBootstrap() {
    if (process.env.TAT_CHANGE_STREAM === 'true') {
      this.trangThai = { hoTro: false, lyDo: 'Đã tắt bằng TAT_CHANGE_STREAM=true.', docTiep: false };
      return;
    }
    await this.batDau().catch((e) => this.logger.error(`Không mở được change stream: ${(e as Error).message}`));
  }

  async onModuleDestroy() {
    await this.dung();
  }

  layTrangThai(): TrangThaiSuKien {
    return this.trangThai;
  }

  /** Luồng cho SSE: các sự kiện gần đây rồi sự kiện mới. */
  theoDoi(): Observable<SuKienAdmin> {
    return new Observable<SuKienAdmin>((sub) => {
      const a = this.ganDay.subscribe(sub);
      return () => a.unsubscribe();
    });
  }

  /** Dùng trong test: sự kiện mới (không kèm sự kiện cũ). */
  suKienMoi(): Observable<SuKienAdmin> {
    return this.kenh.asObservable();
  }

  async batDau(): Promise<TrangThaiSuKien> {
    const db = this.conn.db;
    if (!db) throw new Error('Chưa kết nối MongoDB.');
    const mt = await docMoiTruong(db);
    if (!mt.coTransaction) {
      this.trangThai = { hoTro: false, lyDo: 'MongoDB đang chạy standalone: change stream cần replica set (xem backend/db/README.md).', docTiep: false };
      this.logger.warn(`Thông báo trực tiếp cho admin TẮT: ${this.trangThai.lyDo}`);
      return this.trangThai;
    }
    const daLuu = await db.collection<{ _id: string; token: Document }>('theodoisukiens').findOne({ _id: TEN_LUONG });
    this.dangDung = false;
    await this.moLuong(daLuu?.token ?? null);
    this.trangThai = { hoTro: true, lyDo: null, docTiep: !!daLuu };
    this.logger.log(`Thông báo trực tiếp cho admin BẬT (change stream${daLuu ? ', đọc tiếp từ resume token đã lưu' : ''}).`);
    return this.trangThai;
  }

  async dung() {
    this.dangDung = true;
    const l = this.luong;
    this.luong = null;
    await l?.close().catch(() => undefined);
  }

  /**
   * Mở luồng. Có token: đọc tiếp ngay sau sự kiện đã xử lý (startAfter). Chưa có: bắt đầu từ thời điểm hiện tại của cluster
   * (startAtOperationTime lấy từ operationTime của một lệnh ping) — driver mở cursor bất đồng bộ, mốc này bảo đảm sự kiện xảy ra
   * ngay sau khi gọi hàm vẫn được nhận.
   */
  private async moLuong(token: Document | null): Promise<void> {
    const db = this.conn.db!;
    const moc = token ? null : ((await db.command({ ping: 1 })) as { operationTime?: mongo.Timestamp }).operationTime;
    const luong = db.watch(pipelineSuKien(), {
      fullDocument: 'updateLookup', // update chỉ có phần thay đổi: lấy thêm sku, sanPham của tài liệu hiện tại
      ...(token ? { startAfter: token } : moc ? { startAtOperationTime: moc } : {}),
    });
    this.luong = luong;
    luong.on('change', (ev) => void this.xuLy(ev));
    luong.on('error', (e: Error & { code?: number }) => {
      if (this.dangDung) return;
      // 286 ChangeStreamHistoryLost: token đã trôi khỏi oplog → bắt đầu lại từ bây giờ (mất các sự kiện quá cũ, không treo luồng).
      const matLichSu = e.code === 286 || /ChangeStreamHistoryLost|resume point may no longer be in the oplog/i.test(e.message);
      this.logger.error(`Change stream lỗi: ${e.message}${matLichSu ? ' → bỏ token cũ, mở lại từ bây giờ' : ' → mở lại sau 2 giây'}`);
      void luong.close().catch(() => undefined);
      setTimeout(() => {
        if (!this.dangDung) void this.moLuong(matLichSu ? null : token).catch((x) => this.logger.error(`Mở lại change stream lỗi: ${(x as Error).message}`));
      }, matLichSu ? 0 : 2000);
    });
  }

  private async xuLy(ev: ChangeStreamDocument<Document>) {
    const sk = await this.chuyenDoi(ev).catch(() => null);
    if (sk) {
      this.kenh.next(sk);
      this.ganDay.next(sk);
    }
    await this.conn.db!
      .collection<{ _id: string }>('theodoisukiens')
      .updateOne({ _id: TEN_LUONG }, { $set: { token: ev._id as Document, luc: new Date() } }, { upsert: true })
      .catch((e) => this.logger.warn(`Không lưu được resume token: ${(e as Error).message}`));
  }

  private async chuyenDoi(ev: ChangeStreamDocument<Document>): Promise<SuKienAdmin | null> {
    const luc = (ev as { clusterTime?: { getHighBits(): number } }).clusterTime
      ? new Date((ev as { clusterTime: { getHighBits(): number } }).clusterTime.getHighBits() * 1000).toISOString()
      : new Date().toISOString();
    if (ev.operationType === 'insert' && ev.ns.coll === 'donhangs') {
      const d = ev.fullDocument;
      return { loai: 'don-moi', luc, soDonHang: Number(d.soDonHang), tongTien: Number(d.tongTienSauGiam ?? 0), hoTenNhan: d.hoTenNhan ?? null };
    }
    if (ev.operationType === 'update' && ev.ns.coll === 'chitietsanphams') {
      const ton = Number(ev.updateDescription?.updatedFields?.soLuongTon);
      const d = ev.fullDocument;
      const sp = d?.sanPham ? await this.conn.db!.collection('sanphams').findOne({ _id: new Types.ObjectId(String(d.sanPham)) }, { projection: { tenSanPham: 1 } }) : null;
      return {
        loai: 'ton-thap', luc, chiTiet: String(ev.documentKey._id), sku: d?.sku ?? null,
        sanPham: d?.sanPham ? String(d.sanPham) : null, tenSanPham: sp?.tenSanPham ?? null, soLuongTon: ton,
      };
    }
    return null;
  }
}
