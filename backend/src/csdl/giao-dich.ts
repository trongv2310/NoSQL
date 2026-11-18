import { ClientSession, Connection } from 'mongoose';
import { docMoiTruong } from './moi-truong';

/**
 * Chạy một nhóm thao tác trong transaction NẾU MongoDB hỗ trợ (replica set / mongos), không thì chạy thẳng (session = undefined) để
 * người gọi tự dùng phương án thay thế (cập nhật nguyên tử có điều kiện + bù trừ). Hỏi máy chủ một lần rồi nhớ.
 * `withTransaction` tự thử lại khi gặp lỗi tạm thời (TransientTransactionError) và tự huỷ (abort) khi hàm ném lỗi.
 */
export class GiaoDich {
  private coTransaction: Promise<boolean> | null = null;

  constructor(private readonly conn: Connection) {}

  hoTro(): Promise<boolean> {
    this.coTransaction ??= (this.conn?.db ? docMoiTruong(this.conn.db).then((m) => m.coTransaction) : Promise.resolve(false)).catch(() => false);
    return this.coTransaction;
  }

  async chay<T>(viec: (s?: ClientSession) => Promise<T>): Promise<{ kq: T; coTransaction: boolean }> {
    if (!(await this.hoTro())) return { kq: await viec(undefined), coTransaction: false };
    const s = await this.conn.startSession();
    try {
      let kq!: T;
      await s.withTransaction(async () => {
        kq = await viec(s);
      });
      return { kq, coTransaction: true };
    } finally {
      await s.endSession();
    }
  }
}
