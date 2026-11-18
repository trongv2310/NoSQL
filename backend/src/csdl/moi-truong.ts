import type { mongo } from 'mongoose';

export interface MoiTruongMongo {
  phienBan: string;
  /** Tên replica set (vd. "rs0"), hoặc null khi MongoDB chạy standalone. */
  replicaSet: string | null;
  /** Transaction và change stream chỉ có khi chạy replica set (hoặc sharded cluster). */
  coTransaction: boolean;
}

/** Hỏi MongoDB đang chạy kiểu gì. Chỉ đọc, không đổi gì trên máy chủ. */
export async function docMoiTruong(db: mongo.Db): Promise<MoiTruongMongo> {
  const admin = db.admin();
  const [hello, info] = await Promise.all([admin.command({ hello: 1 }), admin.command({ buildInfo: 1 })]);
  const replicaSet = typeof hello.setName === 'string' ? hello.setName : null;
  const laMongos = hello.msg === 'isdbgrid';
  return { phienBan: String(info.version), replicaSet, coTransaction: replicaSet !== null || laMongos };
}

export const CANH_BAO_STANDALONE =
  'MongoDB đang chạy standalone: chưa dùng được transaction. Các chức năng cần transaction sẽ dùng cách ghi nguyên tử thay thế. ' +
  'Bật replica set rs0 theo backend/db/README.md.';
