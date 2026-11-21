import { spawnSync } from 'child_process';
import mongoose from 'mongoose';

/** Ưu tiên MongoDB Database Tools. Bản sao Extended JSON lưu cả tùy chọn collection và index trong _meta.json. */
const { EJSON } = mongoose.mongo.BSON;

export const TEN_META = '_meta.json';

export interface MetaCollection {
  ten: string;
  soTaiLieu: number;
  /** options của listCollections: validator, validationLevel, validationAction... */
  tuyChon: Record<string, unknown>;
  index: Record<string, unknown>[];
}
export interface MetaSaoLuu {
  phienBan: 1;
  luc: string;
  csdl: string;
  mongodb: string;
  collections: MetaCollection[];
}

/** Có lệnh `ten` (mongodump/mongorestore) trong PATH không. */
export function coCongCu(ten: string): boolean {
  const r = spawnSync(ten, ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' });
  return r.status === 0;
}

/** Tài liệu → một dòng EJSON canonical (không mất kiểu số: Int32 vẫn là Int32, Double vẫn là Double). */
export const motDong = (d: unknown) => EJSON.stringify(d as never, { relaxed: false });
export const docDong = (s: string) => EJSON.parse(s, { relaxed: false }) as Record<string, unknown>;

/** Index cần tạo lại khi phục hồi: bỏ `_id_` (tự có) và các trường chỉ máy chủ dùng (v, ns). */
export function indexCanTao(ds: Record<string, unknown>[]) {
  return ds
    .filter((i) => i.name !== '_id_')
    .map((i) => {
      const { v, ns, key, ...tuyChon } = i as Record<string, unknown>;
      void v; void ns;
      return { key: key as Record<string, 1 | -1>, ...tuyChon };
    });
}
