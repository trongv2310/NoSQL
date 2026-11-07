import mongoose from 'mongoose';
import { anMatKhau, chuoiHoaCollection, docChuoi, laMayLocal } from './du-lieu-mongodb';

describe('file dữ liệu MongoDB dùng chung', () => {
  const a = new mongoose.Types.ObjectId('6ae71c0ce9fc9d4b5a69ffa7');
  const b = new mongoose.Types.ObjectId('6ae71c0ce9fc9d4b5a69ffa8');

  it('ghi rồi đọc lại giữ nguyên ObjectId và Date', () => {
    const ngay = new Date('2026-05-08T04:31:00.000Z');
    const kq = docChuoi(chuoiHoaCollection([{ _id: a, ten: 'Vợt', ngay, gia: 4500000 }]));
    expect(kq).toHaveLength(1);
    expect(String(kq[0]._id)).toBe(String(a));
    expect(kq[0]._id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(kq[0].ngay).toBeInstanceOf(Date);
    expect((kq[0].ngay as Date).toISOString()).toBe(ngay.toISOString());
    expect(kq[0].gia).toBe(4500000);
  });

  it('sắp theo _id, mỗi tài liệu một dòng và bỏ __v', () => {
    const noiDung = chuoiHoaCollection([{ _id: b, x: 2, __v: 0 }, { _id: a, x: 1, __v: 0 }]);
    const dong = noiDung.trim().split('\n');
    expect(dong).toHaveLength(4); // [, hai tài liệu, ]
    expect(dong[1]).toContain(String(a));
    expect(dong[2]).toContain(String(b));
    expect(noiDung).not.toContain('__v');
  });

  it('từ chối file không phải mảng', () => {
    expect(() => docChuoi('{"_id": 1}')).toThrow(/mảng/);
  });

  it('chỉ coi localhost là máy này', () => {
    expect(laMayLocal('mongodb://127.0.0.1:27017/shop')).toBe(true);
    expect(laMayLocal('mongodb://localhost/shop')).toBe(true);
    expect(laMayLocal('mongodb://user:pw@db.example.com:27017/shop')).toBe(false);
    expect(laMayLocal('mongodb+srv://u:p@cluster0.abc.mongodb.net/shop')).toBe(false);
  });

  it('che mật khẩu khi in chuỗi kết nối', () => {
    expect(anMatKhau('mongodb://user:bimat@db.example.com/shop')).toBe('mongodb://user:***@db.example.com/shop');
    expect(anMatKhau('mongodb://127.0.0.1:27017/shop')).toBe('mongodb://127.0.0.1:27017/shop');
  });
});
