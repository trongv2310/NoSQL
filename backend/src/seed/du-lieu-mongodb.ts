import mongoose from 'mongoose';
import { join } from 'path';

/**
 * Định dạng file dữ liệu MongoDB dùng chung cho team (seed-data/mongodb/):
 * mỗi collection là một file `<tên-collection>.json` chứa MẢNG tài liệu ở dạng Extended JSON
 * ({"$oid": ...}, {"$date": ...}), mỗi tài liệu một dòng, sắp theo _id để khi xuất lại, git diff chỉ thấy phần thật sự đổi.
 * Cùng định dạng này dùng được với `mongoimport --jsonArray` nên không bắt buộc phải chạy script của dự án.
 */

const { EJSON } = mongoose.mongo.BSON;

export const TEN_MANIFEST = 'manifest.json';
export const thuMucMacDinh = () => join(process.cwd(), 'seed-data', 'mongodb');

/** Dữ liệu phát sinh trong lúc dùng (giỏ hàng, nhật ký lỗi, lịch sử đổi giá) – không đưa vào bộ dữ liệu dùng chung. */
export const BO_QUA_KHI_XUAT = ['giohangs', 'logloigiaotacs', 'lichsuthaydoigias'];

export interface Manifest {
  taoLuc: string;
  ghiChu: string;
  collections: Record<string, number>;
}

type Doc = Record<string, unknown>;

/** Tài liệu → một dòng Extended JSON; bỏ __v của Mongoose vì nó không phải dữ liệu nghiệp vụ. */
const motDong = (d: Doc) => {
  const { __v, ...con } = d;
  void __v;
  return EJSON.stringify(con, { relaxed: true });
};

/** Mảng tài liệu → nội dung file (sắp theo _id, mỗi tài liệu một dòng). */
export function chuoiHoaCollection(docs: Doc[]): string {
  const sapXep = [...docs].sort((a, b) => String(a._id).localeCompare(String(b._id)));
  return `[\n${sapXep.map((d) => `  ${motDong(d)}`).join(',\n')}\n]\n`;
}

/** Nội dung file → mảng tài liệu với đúng kiểu ObjectId / Date. */
export function docChuoi(noiDung: string): Doc[] {
  const v = EJSON.parse(noiDung, { relaxed: true }) as unknown;
  if (!Array.isArray(v)) {
    throw new Error('File dữ liệu phải là một mảng tài liệu JSON.');
  }
  return v as Doc[];
}

/** Chỉ cho phép thao tác phá dữ liệu (--reset) trên MongoDB chạy trên máy này, trừ khi có --force. */
export function laMayLocal(uri: string): boolean {
  try {
    const host = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'http://')).hostname;
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  } catch {
    return false;
  }
}

/** Che mật khẩu trong chuỗi kết nối khi in ra màn hình. */
export const anMatKhau = (uri: string) => uri.replace(/\/\/([^:/@]+):[^@]*@/, '//$1:***@');
