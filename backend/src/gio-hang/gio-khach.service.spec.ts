import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import mongoose, { Connection, Model, Types } from 'mongoose';
import { ALL_MODELS, ChiTietSanPham, GioHang, GioHangDongBo, GioHangDongBoDong, KhachHang, KhuyenMai, SanPham } from '../schemas';
import { GioHangService } from './gio-hang.service';
import { xoaDongGio } from './gio-hang-xoa';
import { GioKhachService } from './gio-khach.service';

/**
 * Kiểm thử với MongoDB thật (bản standalone, không transaction) trên một cơ sở dữ liệu TẠM đặt tên ngẫu nhiên và bị xóa khi xong.
 * Không động tới cơ sở dữ liệu của ứng dụng. Đặt TEST_MONGODB_URI (chỉ gồm host, ví dụ mongodb://127.0.0.1:27017) nếu Mongo ở nơi khác.
 * Không kết nối được thì cả nhóm bị bỏ qua và báo rõ là bỏ qua, không tính là đạt.
 */
const BASE = (process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017').replace(/\/+$/, '');

/** Dò kết nối đồng bộ (tiến trình con) để quyết định bỏ qua nhóm test mà không cần await ở cấp module (tsc coi file này là CommonJS). */
function mongoSanSang(): boolean {
  const ma = `require("mongoose").createConnection(${JSON.stringify(`${BASE}/admin`)},{serverSelectionTimeoutMS:1500}).asPromise().then(c=>c.close()).then(()=>process.exit(0),()=>process.exit(1))`;
  return spawnSync(process.execPath, ['-e', ma], { timeout: 10_000 }).status === 0;
}
const coMongo = mongoSanSang();
if (!coMongo) {
  console.warn(`[gio-khach.service.spec] Không kết nối được MongoDB tại ${BASE}: BỎ QUA toàn bộ kiểm thử tích hợp.`);
}

describe.runIf(coMongo)('GioKhachService với MongoDB thật', () => {
  const tenDb = `test_giohang_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  let conn: Connection;
  let gioHangModel: Model<GioHang>;
  let dongBoModel: Model<GioHangDongBo>;
  let soCaiModel: Model<GioHangDongBoDong>;
  let chiTietModel: Model<ChiTietSanPham>;
  let khachModel: Model<KhachHang>;
  let spModel: Model<SanPham>;
  let kmModel: Model<KhuyenMai>;
  let gioHang: GioHangService;
  let gioKhach: GioKhachService;
  let k1: Types.ObjectId;
  let k2: Types.ObjectId;
  let seq = 0;

  beforeAll(async () => {
    expect(tenDb).toMatch(/^test_giohang_[0-9a-f]{12}$/); // chốt chặn: chỉ làm việc trên DB tạm
    conn = await mongoose.createConnection(`${BASE}/${tenDb}`).asPromise();
    for (const m of ALL_MODELS) conn.model(m.name, m.schema);
    await Promise.all(Object.values(conn.models).map((m) => m.init()));
    gioHangModel = conn.model<GioHang>(GioHang.name);
    dongBoModel = conn.model<GioHangDongBo>(GioHangDongBo.name);
    soCaiModel = conn.model<GioHangDongBoDong>(GioHangDongBoDong.name);
    chiTietModel = conn.model<ChiTietSanPham>(ChiTietSanPham.name);
    khachModel = conn.model<KhachHang>(KhachHang.name);
    spModel = conn.model<SanPham>(SanPham.name);
    kmModel = conn.model<KhuyenMai>(KhuyenMai.name);
    gioHang = new GioHangService(gioHangModel, chiTietModel, khachModel);
    gioKhach = new GioKhachService(gioHangModel, dongBoModel, soCaiModel, chiTietModel, gioHang);
    k1 = (await khachModel.create({ hoTen: 'Khách 1', taiKhoan: new Types.ObjectId() }))._id;
    k2 = (await khachModel.create({ hoTen: 'Khách 2', taiKhoan: new Types.ObjectId() }))._id;
  });

  afterAll(async () => {
    if (conn && tenDb.startsWith('test_giohang_')) {
      await conn.dropDatabase();
    }
    await conn?.close();
  });

  /** Tạo mới một biến thể với tồn kho cho trước (mỗi test dùng biến thể riêng nên không ảnh hưởng nhau). */
  async function bienThe(ton: number, opts: { giaBan?: number; giaGoc?: number; xoaMem?: boolean; khuyenMai?: Types.ObjectId } = {}) {
    const sp = await spModel.create({
      tenSanPham: `SP ${++seq}`, giaGoc: opts.giaGoc ?? 1_000_000,
      ...(opts.xoaMem ? { deletedAt: new Date() } : {}), ...(opts.khuyenMai ? { khuyenMai: opts.khuyenMai } : {}),
    });
    return chiTietModel.create({ sanPham: sp._id, sku: `SKU-${tenDb}-${seq}`, soLuongTon: ton, giaBan: opts.giaBan });
  }

  const dong = (ct: { _id: Types.ObjectId }, soLuong: number) => ({ chiTietId: String(ct._id), soLuong });
  const soLuongTrongGio = async (kh: Types.ObjectId, ct: { _id: Types.ObjectId }) =>
    // giỏ HIỂN THỊ: dòng đã bị xóa (daXoa) không tính
    (await gioHangModel.findOne({ khachHang: kh, chiTietSanPham: ct._id, daXoa: { $ne: true } }).lean())?.soLuong ?? null;
  const dongBo = (kh: Types.ObjectId, syncId: string, ...dongs: ReturnType<typeof dong>[]) => gioKhach.dongBoChoKhachHang(kh, syncId, dongs);
  const maSync = () => `sync-${randomUUID()}`;

  describe('báo giá (tinh)', () => {
    it('gộp dòng trùng, tính giá từ DB và kẹp số lượng theo tồn kho', async () => {
      const a = await bienThe(10, { giaBan: 500_000 });
      const b = await bienThe(3);
      const kq = await gioKhach.tinh([dong(a, 2), dong(b, 5), dong(a, 3)]);
      expect(kq.items).toHaveLength(2);
      const da = kq.items.find((i) => i.id === String(a._id))!;
      const db = kq.items.find((i) => i.id === String(b._id))!;
      expect(da).toMatchObject({ trangThai: 'ok', soLuong: 5, donGia: 500_000, thanhTien: 2_500_000 });
      expect(db).toMatchObject({ trangThai: 'giam_so_luong', soLuongYeuCau: 5, soLuong: 3, donGia: 1_000_000, thanhTien: 3_000_000 });
      expect(kq.tongSoLuong).toBe(8);
      expect(kq.tongTien).toBe(5_500_000);
    });

    it('áp khuyến mãi còn hiệu lực, bỏ qua khuyến mãi đã hết hạn', async () => {
      const con = await kmModel.create({ tenChuongTrinh: 'Đang chạy', phanTramGiam: 10, ngayBatDau: new Date(Date.now() - 864e5), ngayKetThuc: new Date(Date.now() + 864e5) });
      const het = await kmModel.create({ tenChuongTrinh: 'Hết hạn', phanTramGiam: 50, ngayBatDau: new Date('2020-01-01'), ngayKetThuc: new Date('2020-02-01') });
      const a = await bienThe(5, { khuyenMai: con._id });
      const b = await bienThe(5, { khuyenMai: het._id });
      const kq = await gioKhach.tinh([dong(a, 1), dong(b, 1)]);
      expect(kq.items.find((i) => i.id === String(a._id))?.donGia).toBe(900_000);
      expect(kq.items.find((i) => i.id === String(b._id))?.donGia).toBe(1_000_000);
    });

    it('báo rõ từng dòng hết hàng, ngừng kinh doanh, không tồn tại và không tính vào tổng', async () => {
      const het = await bienThe(0);
      const ngung = await bienThe(9, { xoaMem: true });
      const ok = await bienThe(9);
      const maLa = new Types.ObjectId();
      const kq = await gioKhach.tinh([dong(het, 2), dong(ngung, 2), { chiTietId: String(maLa), soLuong: 1 }, dong(ok, 1)]);
      const t = (ct: { _id: Types.ObjectId | string }) => kq.items.find((i) => i.id === String(ct._id));
      expect(t(het)).toMatchObject({ trangThai: 'het_hang', soLuong: 0, thanhTien: 0 });
      expect(t(ngung)).toMatchObject({ trangThai: 'ngung_kinh_doanh', soLuong: 0, thanhTien: 0, sanPhamConKinhDoanh: false });
      expect(t(maLa)).toMatchObject({ trangThai: 'khong_ton_tai', soLuong: 0, bienThe: null });
      expect(kq.tongSoLuong).toBe(1);
      expect(kq.tongTien).toBe(1_000_000);
    });

    it('giỏ rỗng trả về tổng bằng 0 và quá 50 sản phẩm khác nhau bị từ chối', async () => {
      expect(await gioKhach.tinh([])).toMatchObject({ items: [], tongTien: 0, tongSoLuong: 0 });
      const nhieu = Array.from({ length: 51 }, () => ({ chiTietId: String(new Types.ObjectId()), soLuong: 1 }));
      await expect(gioKhach.tinh(nhieu)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('đồng bộ (dong-bo)', () => {
    it('cộng dồn vào giỏ đã có và kẹp theo tồn kho', async () => {
      const a = await bienThe(10);
      const b = await bienThe(4);
      await gioHang.them(String((await khachModel.findById(k1))!.taiKhoan), String(a._id), 3);
      const r = await dongBo(k1, maSync(), dong(a, 4), dong(b, 9));
      expect(await soLuongTrongGio(k1, a)).toBe(7);
      expect(await soLuongTrongGio(k1, b)).toBe(4);
      expect(r.ketQua.find((x) => x.chiTietId === String(a._id))).toMatchObject({ trangThai: 'da_gop', daThem: 4 });
      expect(r.ketQua.find((x) => x.chiTietId === String(b._id))).toMatchObject({ trangThai: 'giam_so_luong', yeuCau: 9, daThem: 4 });
    });

    it('gửi lại cùng syncId không cộng thêm lần nào nữa', async () => {
      const a = await bienThe(50);
      const sync = maSync();
      await dongBo(k1, sync, dong(a, 6));
      const lan2 = await dongBo(k1, sync, dong(a, 6));
      const lan3 = await dongBo(k1, sync, dong(a, 6));
      expect(await soLuongTrongGio(k1, a)).toBe(6);
      expect(lan2.daApDungTruoc).toBe(true);
      expect(lan3.ketQua[0].trangThai).toBe('da_ap_dung');
    });

    it('syncId khác nhau là hai lần đồng bộ riêng, mỗi lần được cộng một lần', async () => {
      const a = await bienThe(50);
      await dongBo(k1, maSync(), dong(a, 2));
      await dongBo(k1, maSync(), dong(a, 3));
      expect(await soLuongTrongGio(k1, a)).toBe(5);
    });

    it('gộp dòng trùng trong cùng một lần gửi và chặn ở 100', async () => {
      const a = await bienThe(500);
      await gioHang.them(String((await khachModel.findById(k1))!.taiKhoan), String(a._id), 90);
      const r = await dongBo(k1, maSync(), dong(a, 40), dong(a, 40), dong(a, 40));
      expect(await soLuongTrongGio(k1, a)).toBe(100);
      expect(r.ketQua).toHaveLength(1);
      expect(r.ketQua[0]).toMatchObject({ trangThai: 'giam_so_luong', daThem: 10 });
    });

    it('bỏ qua dòng hết hàng, ngừng kinh doanh, không tồn tại mà vẫn gộp các dòng còn lại', async () => {
      const het = await bienThe(0);
      const ngung = await bienThe(9, { xoaMem: true });
      const ok = await bienThe(9);
      const r = await dongBo(k1, maSync(), dong(het, 1), dong(ngung, 1), { chiTietId: String(new Types.ObjectId()), soLuong: 1 }, dong(ok, 2));
      expect(r.ketQua.map((x) => x.trangThai)).toEqual(['het_hang', 'ngung_kinh_doanh', 'khong_ton_tai', 'da_gop']);
      expect(await soLuongTrongGio(k1, het)).toBeNull();
      expect(await soLuongTrongGio(k1, ngung)).toBeNull();
      expect(await soLuongTrongGio(k1, ok)).toBe(2);
    });

    it('cùng syncId nhưng nội dung khác bị từ chối chứ không âm thầm bỏ qua', async () => {
      const a = await bienThe(20);
      const sync = maSync();
      await dongBo(k1, sync, dong(a, 2));
      await expect(dongBo(k1, sync, dong(a, 3))).rejects.toBeInstanceOf(ConflictException);
      expect(await soLuongTrongGio(k1, a)).toBe(2);
    });

    it('đồng bộ cho khách này không đụng giỏ khách khác, và cùng syncId ở hai tài khoản là hai lần riêng', async () => {
      const a = await bienThe(20);
      const sync = maSync();
      await dongBo(k1, sync, dong(a, 2));
      expect(await soLuongTrongGio(k2, a)).toBeNull();
      await dongBo(k2, sync, dong(a, 2));
      expect(await soLuongTrongGio(k1, a)).toBe(2);
      expect(await soLuongTrongGio(k2, a)).toBe(2);
    });

    it('lần đã hoàn tất mà khách xóa dòng đi thì gửi lại không làm dòng sống lại', async () => {
      const a = await bienThe(20);
      const sync = maSync();
      await dongBo(k1, sync, dong(a, 2));
      await gioHangModel.deleteOne({ khachHang: k1, chiTietSanPham: a._id });
      await dongBo(k1, sync, dong(a, 2));
      expect(await soLuongTrongGio(k1, a)).toBeNull();
    });

    it('ghi dở rồi lỗi: gửi lại cùng syncId hoàn tất phần còn lại và không cộng đôi phần đã ghi', async () => {
      const a = await bienThe(20);
      const b = await bienThe(20);
      const c = await bienThe(20);
      const sync = maSync();
      const that = gioHangModel.findOneAndUpdate.bind(gioHangModel);
      let goi = 0;
      const gia = vi.spyOn(gioHangModel, 'findOneAndUpdate').mockImplementation(((...args: Parameters<typeof that>) => {
        if (++goi === 2) throw new Error('mất kết nối giữa chừng');
        return that(...args);
      }) as typeof that);
      try {
        await expect(dongBo(k1, sync, dong(a, 2), dong(b, 3), dong(c, 4))).rejects.toThrow('mất kết nối');
      } finally {
        gia.mockRestore();
      }
      expect(await soLuongTrongGio(k1, a)).toBe(2); // đã ghi trước khi lỗi
      expect(await soLuongTrongGio(k1, b)).toBeNull();
      expect((await dongBoModel.findOne({ khachHang: k1, syncId: sync }).lean())?.trangThai).toBe('dang_xu_ly');

      const lai = await dongBo(k1, sync, dong(a, 2), dong(b, 3), dong(c, 4));
      expect(lai.ketQua.map((x) => x.trangThai)).toEqual(['da_ap_dung', 'da_gop', 'da_gop']);
      expect([await soLuongTrongGio(k1, a), await soLuongTrongGio(k1, b), await soLuongTrongGio(k1, c)]).toEqual([2, 3, 4]);
      expect((await dongBoModel.findOne({ khachHang: k1, syncId: sync }).lean())?.trangThai).toBe('xong');
    });

    /** Làm yêu cầu đồng bộ lỗi ngay khi tới dòng thứ hai (dòng đầu đã ghi xong), như mất kết nối giữa chừng. */
    async function dongBoRoiLoiODongHai(sync: string, ...dongs: ReturnType<typeof dong>[]) {
      const that = gioHangModel.findOneAndUpdate.bind(gioHangModel);
      let goi = 0;
      const gia = vi.spyOn(gioHangModel, 'findOneAndUpdate').mockImplementation(((...args: Parameters<typeof that>) => {
        if (++goi === 2) throw new Error('mất kết nối giữa chừng');
        return that(...args);
      }) as typeof that);
      try {
        await expect(dongBo(k1, sync, ...dongs)).rejects.toThrow('mất kết nối');
      } finally {
        gia.mockRestore();
      }
    }

    it('M1-R1-02: biên nhận dở dang + 25 lần đồng bộ khác chạm cùng dòng → gửi lại KHÔNG cộng đôi dòng đã ghi (không phụ thuộc số mã giữ lại)', async () => {
      const a = await bienThe(100);
      const b = await bienThe(100);
      const P = maSync();
      await dongBoRoiLoiODongHai(P, dong(a, 1), dong(b, 1));
      expect(await soLuongTrongGio(k1, a)).toBe(1);
      expect((await dongBoModel.findOne({ khachHang: k1, syncId: P }).lean())?.trangThai).toBe('dang_xu_ly');
      for (let i = 0; i < 25; i++) await dongBo(k1, maSync(), dong(a, 1)); // mỗi lần một mã mới, đủ để đẩy mã P ra khỏi mọi bộ đệm đếm theo số lượng
      expect(await soLuongTrongGio(k1, a)).toBe(26);
      const lai = await dongBo(k1, P, dong(a, 1), dong(b, 1));
      expect(await soLuongTrongGio(k1, a)).toBe(26); // trước khi sửa: 27
      expect(await soLuongTrongGio(k1, b)).toBe(1);
      expect(lai.ketQua.map((x) => x.trangThai)).toEqual(['da_ap_dung', 'da_gop']);
    });

    it('M1-R1-02: biên nhận dở dang, khách xóa dòng đã ghi rồi gửi lại → dòng đó không sống lại, dòng còn lại được ghi đúng một lần', async () => {
      const a = await bienThe(100);
      const b = await bienThe(100);
      const P = maSync();
      await dongBoRoiLoiODongHai(P, dong(a, 2), dong(b, 3));
      await gioHangModel.deleteOne({ khachHang: k1, chiTietSanPham: a._id });
      const lai = await dongBo(k1, P, dong(a, 2), dong(b, 3));
      expect(await soLuongTrongGio(k1, a)).toBeNull(); // trước khi sửa: 2
      expect(await soLuongTrongGio(k1, b)).toBe(3);
      expect(lai.ketQua.map((x) => x.trangThai)).toEqual(['da_ap_dung', 'da_gop']);
    });

    it('M1-R1-02: bị ngắt giữa lúc cộng và ghi sổ cái + 60 lần đồng bộ khác → gửi lại vẫn không cộng đôi (mã trên dòng chặn)', async () => {
      const a = await bienThe(500);
      const P = maSync();
      const that = soCaiModel.create.bind(soCaiModel);
      let goi = 0;
      const gia = vi.spyOn(soCaiModel, 'create').mockImplementation(((...args: Parameters<typeof that>) => {
        if (++goi === 1) throw new Error('mất kết nối trước khi ghi sổ cái');
        return that(...args);
      }) as typeof that);
      try {
        await expect(dongBo(k1, P, dong(a, 2))).rejects.toThrow('mất kết nối');
      } finally {
        gia.mockRestore();
      }
      expect(await soLuongTrongGio(k1, a)).toBe(2); // đã cộng, chưa ghi sổ cái
      for (let i = 0; i < 60; i++) await dongBo(k1, maSync(), dong(a, 1));
      expect(await soLuongTrongGio(k1, a)).toBe(62);
      const lai = await dongBo(k1, P, dong(a, 2));
      expect(await soLuongTrongGio(k1, a)).toBe(62);
      expect(lai.ketQua[0].trangThai).toBe('da_ap_dung');
      expect(await soCaiModel.countDocuments({ khachHang: k1, syncId: P })).toBe(1);
    });

    it('M1-R1-02: dòng giỏ đã đầy mã đồng bộ còn hạn → từ chối 503, không âm thầm bỏ mã; mã quá hạn thì được gỡ và cộng bình thường', async () => {
      const day = await bienThe(100);
      const cu = await bienThe(100);
      const gio = (ct: { _id: Types.ObjectId }, ngay: Date) =>
        gioHangModel.collection.insertOne({
          khachHang: k1, chiTietSanPham: ct._id, soLuong: 5, ngayThem: new Date(),
          dongBo: Array.from({ length: 200 }, (_, i) => ({ t: `ma-cu-${i}`.padEnd(16, 'x'), ts: ngay })),
        });
      await gio(day, new Date());
      await gio(cu, new Date(Date.now() - 40 * 864e5));
      await expect(dongBo(k1, maSync(), dong(day, 1))).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(await soLuongTrongGio(k1, day)).toBe(5);
      await dongBo(k1, maSync(), dong(cu, 1));
      expect(await soLuongTrongGio(k1, cu)).toBe(6);
      expect((await gioHangModel.findOne({ khachHang: k1, chiTietSanPham: cu._id }).lean())?.dongBo?.length).toBe(1);
    });

    it('M1-R1-03: bản đồng bộ lập cho tài khoản A mà phiên hiện tại là B → 403, không chạm giỏ B, không tạo biên nhận; đúng tài khoản thì chỉ vào giỏ A', async () => {
      const taiKhoanA = String((await khachModel.findById(k1))!.taiKhoan);
      const taiKhoanB = String((await khachModel.findById(k2))!.taiKhoan);
      const a = await bienThe(50);
      const b = await bienThe(50);
      const sync = maSync();
      await gioHang.them(taiKhoanB, String(b._id), 1); // giỏ có sẵn của B
      const sai = await gioKhach.dongBo(taiKhoanB, taiKhoanA, sync, [dong(a, 3)]).catch((e) => e);
      expect(sai).toBeInstanceOf(ForbiddenException);
      expect(sai.getResponse()).toMatchObject({ maLoi: 'sai_tai_khoan' });
      expect(await soLuongTrongGio(k2, a)).toBeNull(); // giỏ của A KHÔNG bị gộp vào B
      expect(await soLuongTrongGio(k2, b)).toBe(1);
      expect(await soLuongTrongGio(k1, a)).toBeNull();
      expect(await dongBoModel.countDocuments({ syncId: sync })).toBe(0);
      expect(await soCaiModel.countDocuments({ syncId: sync })).toBe(0);
      // Cùng mã gửi đúng tài khoản A: vào giỏ A một lần, B vẫn nguyên; phản hồi nói rõ tài khoản đã áp dụng.
      const dung = await gioKhach.dongBo(taiKhoanA, taiKhoanA, sync, [dong(a, 3)]);
      expect(dung.taiKhoanId).toBe(taiKhoanA);
      expect(await soLuongTrongGio(k1, a)).toBe(3);
      expect(await soLuongTrongGio(k2, a)).toBeNull();
      expect(await soLuongTrongGio(k2, b)).toBe(1);
    });

    // ---- M1-QA2-01: xóa dòng giỏ qua thao tác thường rồi gửi lại biên nhận bị ngắt TRƯỚC khi ghi sổ cái ----
    async function dongBoNgatTruocSoCai(sync: string, ...dongs: ReturnType<typeof dong>[]) {
      const that = soCaiModel.create.bind(soCaiModel);
      let goi = 0;
      const gia = vi.spyOn(soCaiModel, 'create').mockImplementation(((...args: Parameters<typeof that>) => {
        if (++goi === 1) throw new Error('mất kết nối trước khi ghi sổ cái');
        return that(...args);
      }) as typeof that);
      try {
        await expect(dongBo(k1, sync, ...dongs)).rejects.toThrow('mất kết nối');
      } finally {
        gia.mockRestore();
      }
    }
    const taiKhoanCua = async (k: Types.ObjectId) => String((await khachModel.findById(k))!.taiKhoan);
    const dongGioCua = async (k: Types.ObjectId, ct: { _id: Types.ObjectId }) => gioHangModel.findOne({ khachHang: k, chiTietSanPham: ct._id });

    it('M1-QA2-01: P[A2,B3], cộng A xong nhưng ngắt trước sổ cái, khách xóa dòng A bằng API xóa thường, gửi lại P → A KHÔNG sống lại, B đúng 3', async () => {
      const a = await bienThe(100);
      const b = await bienThe(100);
      const P = maSync();
      await dongBoNgatTruocSoCai(P, dong(a, 2), dong(b, 3));
      const rowA = await dongGioCua(k1, a);
      expect(rowA?.soLuong).toBe(2);
      await gioHang.xoa(await taiKhoanCua(k1), String(rowA!._id));
      expect(await soLuongTrongGio(k1, a)).toBeNull();
      const lai = await dongBo(k1, P, dong(a, 2), dong(b, 3));
      expect(await soLuongTrongGio(k1, a)).toBeNull(); // trước khi sửa: 2
      expect(await soLuongTrongGio(k1, b)).toBe(3);
      expect(lai.ketQua.map((x) => x.trangThai)).toEqual(['da_ap_dung', 'da_gop']);
    });

    it('M1-QA2-01: xóa rồi khách thêm lại đúng sản phẩm đó (dòng mới hợp lệ), gửi lại P → số lượng của khách giữ nguyên, không bị cộng thêm', async () => {
      const a = await bienThe(100);
      const P = maSync();
      await dongBoNgatTruocSoCai(P, dong(a, 2));
      const tk = await taiKhoanCua(k1);
      await gioHang.xoa(tk, String((await dongGioCua(k1, a))!._id));
      await gioHang.them(tk, String(a._id), 4);
      const lai = await dongBo(k1, P, dong(a, 2));
      expect(await soLuongTrongGio(k1, a)).toBe(4);
      expect(lai.ketQua[0].trangThai).toBe('da_ap_dung');
    });

    it('M1-QA2-01: dọn giỏ kiểu đặt hàng (xóa cả giỏ) cũng không làm mất dấu: gửi lại P không làm dòng sống lại', async () => {
      const a = await bienThe(100);
      const b = await bienThe(100);
      const P = maSync();
      await dongBoNgatTruocSoCai(P, dong(a, 2), dong(b, 3));
      expect(await xoaDongGio(gioHangModel, { khachHang: k1 })).toBeGreaterThan(0);
      await dongBo(k1, P, dong(a, 2), dong(b, 3));
      expect(await soLuongTrongGio(k1, a)).toBeNull();
      expect(await soLuongTrongGio(k1, b)).toBe(3);
    });

    it('M1-QA2-01: xóa dòng chạy song song với một lần đồng bộ khác trên cùng dòng (15 vòng): không lỗi, kết quả hợp lệ, gửi lại mã đó không cộng lại', async () => {
      const tk = await taiKhoanCua(k1);
      for (let vong = 0; vong < 15; vong++) {
        const a = await bienThe(100);
        await gioHang.them(tk, String(a._id), 1);
        const row = await dongGioCua(k1, a);
        const S = maSync();
        const kq = await Promise.allSettled([gioHang.xoa(tk, String(row!._id)), dongBo(k1, S, dong(a, 1))]);
        expect(kq.every((x) => x.status === 'fulfilled')).toBe(true);
        const sau = await soLuongTrongGio(k1, a);
        expect([null, 1, 2]).toContain(sau); // xóa trước đồng bộ → 1; đồng bộ trước xóa → null; (them có sẵn 1 +1 = 2 nếu xóa chưa chạy xong là không thể vì xóa luôn thành công)
        await dongBo(k1, S, dong(a, 1));
        expect(await soLuongTrongGio(k1, a)).toBe(sau);
      }
    });

    it('tương thích dòng cũ: dòng có mã kiểu chuỗi (bản M1 đầu) vẫn xóa được và vẫn cộng được bằng mã mới', async () => {
      const a = await bienThe(100);
      const tk = await taiKhoanCua(k1);
      await gioHangModel.collection.insertOne({ khachHang: k1, chiTietSanPham: a._id, soLuong: 2, ngayThem: new Date(), dongBo: ['ma-chuoi-cu-aaaaaaaaaaaa'] });
      await dongBo(k1, maSync(), dong(a, 1));
      expect(await soLuongTrongGio(k1, a)).toBe(3);
      await gioHang.xoa(tk, String((await dongGioCua(k1, a))!._id));
      expect(await soLuongTrongGio(k1, a)).toBeNull();
    });

    // ---- M1-QA2-02: thêm hợp lệ bị 400 khi một lần đồng bộ vừa tạo dòng giữa hai lệnh DB của `them` ----
    it('M1-QA2-02: tồn 100, `them` 2 chạy lệnh cộng khi dòng chưa có (matched 0), đồng bộ 3 tạo dòng xen vào → cả hai thành công, giỏ = 5', async () => {
      const a = await bienThe(100);
      const tk = await taiKhoanCua(k1);
      const that = gioHangModel.updateOne.bind(gioHangModel);
      let goi = 0;
      const gia = vi.spyOn(gioHangModel, 'updateOne').mockImplementation(((...args: Parameters<typeof that>) => {
        // Lệnh DB THẬT của `them` chạy trước (dòng chưa có → matched 0); chỉ sau đó mới xếp lịch đồng bộ xen vào giữa hai lệnh.
        const q = that(...args);
        if (++goi === 1) {
          return q.then(async (r: unknown) => {
            await dongBo(k1, maSync(), dong(a, 3));
            return r;
          });
        }
        return q;
      }) as unknown as typeof that);
      try {
        await gioHang.them(tk, String(a._id), 2); // trước khi sửa: BadRequestException "tối đa 100"
      } finally {
        gia.mockRestore();
      }
      expect(await soLuongTrongGio(k1, a)).toBe(5);
    });

    it('M1-QA2-02: vẫn từ chối đúng khi THỰC SỰ không đủ chỗ (tồn 4: đồng bộ 3 xen vào rồi thêm 2 → 400, giỏ giữ 3, không ghi đè)', async () => {
      const a = await bienThe(4);
      const tk = await taiKhoanCua(k1);
      const that = gioHangModel.updateOne.bind(gioHangModel);
      let goi = 0;
      const gia = vi.spyOn(gioHangModel, 'updateOne').mockImplementation(((...args: Parameters<typeof that>) => {
        const q = that(...args);
        if (++goi === 1) {
          return q.then(async (r: unknown) => {
            await dongBo(k1, maSync(), dong(a, 3));
            return r;
          });
        }
        return q;
      }) as unknown as typeof that);
      try {
        await expect(gioHang.them(tk, String(a._id), 2)).rejects.toBeInstanceOf(BadRequestException);
      } finally {
        gia.mockRestore();
      }
      expect(await soLuongTrongGio(k1, a)).toBe(3);
    });

    // ================= M1-QA3-01 (fix3): dòng đã xóa không thể sống lại dù lần gửi lại đã qua MỌI bước kiểm tra =================
    /** Dừng một lệnh DB của dịch vụ NGAY TRƯỚC khi nó chạy (sau khi mọi kiểm tra phía trước đã xong); `tha()` cho chạy tiếp. Chỉ trên instance test. */
    function dungTruocLenh(model: any, ten: string, khop: (args: any[]) => boolean) {
      const that = model[ten].bind(model);
      let tha!: () => void;
      let toi!: () => void;
      const cong = new Promise<void>((r) => { tha = r; });
      const da = new Promise<void>((r) => { toi = r; });
      let dung = false;
      const gia = vi.spyOn(model, ten).mockImplementation(((...args: any[]) => {
        if (dung || !khop(args)) return that(...args);
        dung = true;
        toi();
        const chay = () => cong.then(() => that(...args));
        // findOneAndUpdate(...).lean(): trả về đối tượng có `lean`; các lệnh khác được await trực tiếp.
        return Object.assign(chay(), { lean: () => cong.then(() => that(...args).lean()) });
      }) as any);
      return { da, tha, khoiPhuc: () => gia.mockRestore() };
    }
    const batKy = () => true;
    const hanCho = <T,>(p: Promise<T>, ms = 5000) => Promise.race([p, new Promise<never>((_, j) => setTimeout(() => j(new Error(`quá ${ms}ms`)), ms))]);
    const dongTho = (k: Types.ObjectId, ct: { _id: Types.ObjectId }) => gioHangModel.findOne({ khachHang: k, chiTietSanPham: ct._id }).lean<any>();

    it('M1-QA3-01: lần gửi lại đã qua kiểm tra sổ cái (exists=false) rồi tạm dừng; khách xóa A; tiếp tục → A KHÔNG sống lại, B đúng 3', async () => {
      const a = await bienThe(100);
      const b = await bienThe(100);
      const P = maSync();
      await dongBoNgatTruocSoCai(P, dong(a, 2), dong(b, 3));
      const tk = await taiKhoanCua(k1);
      const rowA = await dongGioCua(k1, a);
      // dừng ngay SAU khi `soCai.exists` của dòng A trả về false (kiểm tra cũ)
      const that = soCaiModel.exists.bind(soCaiModel);
      let toi!: () => void; let tha!: () => void;
      const da = new Promise<void>((r) => { toi = r; }); const cong = new Promise<void>((r) => { tha = r; });
      let dung = false;
      const gia = vi.spyOn(soCaiModel, 'exists').mockImplementation(((...args: Parameters<typeof that>) => {
        const q: any = that(...args);
        if (dung) return q;
        dung = true;
        return q.then(async (r: unknown) => { toi(); await cong; return r; });
      }) as unknown as typeof that);
      let lai: Awaited<ReturnType<typeof dongBo>>;
      try {
        const chay = dongBo(k1, P, dong(a, 2), dong(b, 3));
        await hanCho(da);
        await gioHang.xoa(tk, String(rowA!._id)); // thao tác xóa hợp lệ của khách giữa lúc lần gửi lại đang chờ
        tha();
        lai = await hanCho(chay);
      } finally {
        gia.mockRestore();
      }
      expect(await soLuongTrongGio(k1, a)).toBeNull(); // trước fix3: 2
      expect(await soLuongTrongGio(k1, b)).toBe(3);
      expect(lai.ketQua.map((x) => x.trangThai)).toEqual(['da_ap_dung', 'da_gop']);
    });

    it('M1-QA3-01: dừng SAU kiểm tra cuối cùng, ngay TRƯỚC lệnh ghi dòng giỏ; xóa; tiếp tục → A không sống lại; dòng đã xóa vẫn giữ mã P', async () => {
      const a = await bienThe(100);
      const b = await bienThe(100);
      const P = maSync();
      await dongBoNgatTruocSoCai(P, dong(a, 2), dong(b, 3));
      const tk = await taiKhoanCua(k1);
      const rowA = await dongGioCua(k1, a);
      const chan = dungTruocLenh(gioHangModel, 'findOneAndUpdate', batKy);
      let lai: Awaited<ReturnType<typeof dongBo>>;
      try {
        const chay = dongBo(k1, P, dong(a, 2), dong(b, 3));
        await hanCho(chan.da);
        await gioHang.xoa(tk, String(rowA!._id));
        chan.tha();
        lai = await hanCho(chay);
      } finally {
        chan.khoiPhuc();
      }
      expect(await soLuongTrongGio(k1, a)).toBeNull();
      expect(await soLuongTrongGio(k1, b)).toBe(3);
      expect(lai.ketQua.map((x) => x.trangThai)).toEqual(['da_ap_dung', 'da_gop']);
      const tho = await dongTho(k1, a);
      expect(tho.daXoa).toBe(true);
      expect(tho.dongBo.map((m: { t: string }) => m.t)).toContain(P);
    });

    it('M1-QA3-01: dừng trước lệnh ghi, khách xóa rồi THÊM LẠI A×4, tiếp tục lần gửi lại cũ → vẫn 4 (không cộng thêm)', async () => {
      const a = await bienThe(100);
      const P = maSync();
      await dongBoNgatTruocSoCai(P, dong(a, 2));
      const tk = await taiKhoanCua(k1);
      const rowA = await dongGioCua(k1, a);
      const chan = dungTruocLenh(gioHangModel, 'findOneAndUpdate', batKy);
      try {
        const chay = dongBo(k1, P, dong(a, 2));
        await hanCho(chan.da);
        await gioHang.xoa(tk, String(rowA!._id));
        await gioHang.them(tk, String(a._id), 4);
        chan.tha();
        await hanCho(chay);
      } finally {
        chan.khoiPhuc();
      }
      expect(await soLuongTrongGio(k1, a)).toBe(4);
      const tho = await dongTho(k1, a);
      expect(tho.daXoa).toBe(false);
      expect(tho.ngayXoa).toBeUndefined();
      expect(tho.dongBo.map((m: { t: string }) => m.t)).toContain(P); // dòng kích hoạt lại vẫn giữ mã cũ
    });

    it('M1-QA3-01: 4 lượt gửi lại cùng P chạy song song với thao tác xóa (10 vòng): A không bao giờ sống lại, B đúng 3 một lần', async () => {
      const tk = await taiKhoanCua(k1);
      for (let vong = 0; vong < 10; vong++) {
        const a = await bienThe(100);
        const b = await bienThe(100);
        const P = maSync();
        await dongBoNgatTruocSoCai(P, dong(a, 2), dong(b, 3));
        const rowA = await dongGioCua(k1, a);
        const kq = await hanCho(Promise.allSettled([
          dongBo(k1, P, dong(a, 2), dong(b, 3)), dongBo(k1, P, dong(a, 2), dong(b, 3)),
          gioHang.xoa(tk, String(rowA!._id)),
          dongBo(k1, P, dong(a, 2), dong(b, 3)), dongBo(k1, P, dong(a, 2), dong(b, 3)),
        ]));
        expect(kq.every((x) => x.status === 'fulfilled')).toBe(true);
        expect(await soLuongTrongGio(k1, a)).toBeNull();
        expect(await soLuongTrongGio(k1, b)).toBe(3);
      }
    });

    it('M1-QA3-01: mã MỚI khác trên dòng đã xóa kích hoạt lại từ 0 (không cộng dồn số cũ), tài khoản khác không bị ảnh hưởng, mã cũ vẫn bị chặn', async () => {
      const a = await bienThe(100);
      const tkA = await taiKhoanCua(k1);
      const tkB = await taiKhoanCua(k2);
      const P = maSync();
      await dongBo(k1, P, dong(a, 5));
      await gioHang.them(tkB, String(a._id), 2); // giỏ tài khoản khác
      await gioHang.xoa(tkA, String((await dongGioCua(k1, a))!._id));
      expect(await soLuongTrongGio(k1, a)).toBeNull();
      await dongBo(k1, maSync(), dong(a, 1)); // mã khác: dòng được kích hoạt lại với 1 (không phải 5+1)
      expect(await soLuongTrongGio(k1, a)).toBe(1);
      await dongBo(k1, P, dong(a, 5));
      expect(await soLuongTrongGio(k1, a)).toBe(1); // mã cũ vẫn bị chặn
      expect(await soLuongTrongGio(k2, a)).toBe(2);
    });

    it('M1-QA3-01: dòng đã xóa không xuất hiện trong giỏ/đếm/đơn hàng và không có dòng số lượng 0; sửa số lượng dòng đã xóa → 404; trần 100 giữ khi thêm lại', async () => {
      const a = await bienThe(500);
      const b = await bienThe(500);
      const tk = await taiKhoanCua(k2);
      await gioHang.them(tk, String(a._id), 90);
      await gioHang.them(tk, String(b._id), 3);
      const rowA = await dongGioCua(k2, a);
      await dongBo(k2, maSync(), dong(a, 1)); // để dòng A mang mã đồng bộ → khi xóa sẽ thành tombstone
      const demTruocXoa = await gioHang.dem(tk); // k2 còn dòng của các test trước nên so sánh tương đối
      await gioHang.xoa(tk, String(rowA!._id));
      expect((await dongTho(k2, a)).daXoa).toBe(true);
      const xem = await gioHang.xem(tk);
      expect(xem.items.map((i) => i.bienThe.id)).not.toContain(String(a._id));
      expect(xem.items.every((i) => i.soLuong >= 1)).toBe(true);
      expect((await gioHang.layDong(k2)).map((d: any) => String(d.chiTietSanPham._id))).not.toContain(String(a._id)); // nguồn của đơn hàng/thanh toán
      expect(await gioHang.dem(tk)).toBe(demTruocXoa - 91);
      await expect(gioHang.capNhat(tk, String(rowA!._id), 5)).rejects.toMatchObject({ status: 404 });
      await gioHang.them(tk, String(a._id), 100); // dòng cũ 91 không được cộng dồn: kích hoạt lại từ 0 → 100
      expect(await soLuongTrongGio(k2, a)).toBe(100);
      await expect(gioHang.them(tk, String(a._id), 1)).rejects.toBeInstanceOf(BadRequestException);
      const chiMuc = await gioHangModel.collection.indexes();
      expect(chiMuc.find((i) => i.key?.ngayXoa === 1)?.expireAfterSeconds).toBe(30 * 24 * 3600);
    });

    it('M1-QA3-01: dòng không mang mã thì bị xóa vật lý (không để lại dòng rác); xóa không báo thành công khi dòng hoạt động vẫn còn', async () => {
      const a = await bienThe(100);
      const tk = await taiKhoanCua(k1);
      await gioHang.them(tk, String(a._id), 2); // dòng tạo trực tiếp: chưa có mã nào
      await gioHang.xoa(tk, String((await dongGioCua(k1, a))!._id));
      expect(await dongTho(k1, a)).toBeNull();
      await gioHang.them(tk, String(a._id), 2);
      const that = gioHangModel.updateMany.bind(gioHangModel);
      const deleteGoc = gioHangModel.deleteMany.bind(gioHangModel);
      vi.spyOn(gioHangModel, 'deleteMany').mockImplementation((() => Promise.resolve({ deletedCount: 0 })) as unknown as typeof deleteGoc);
      vi.spyOn(gioHangModel, 'updateMany').mockImplementation((() => Promise.resolve({ modifiedCount: 0 })) as unknown as typeof that);
      try {
        await expect(xoaDongGio(gioHangModel, { khachHang: k1, chiTietSanPham: a._id })).rejects.toBeInstanceOf(ServiceUnavailableException);
      } finally {
        vi.restoreAllMocks();
      }
      expect(await soLuongTrongGio(k1, a)).toBe(2);
    });

    it('nhiều yêu cầu song song cùng syncId vẫn chỉ cộng một lần', async () => {
      for (let vong = 0; vong < 15; vong++) {
        const a = await bienThe(100);
        const b = await bienThe(100);
        const sync = maSync();
        const kq = await Promise.allSettled(Array.from({ length: 6 }, () => dongBo(k1, sync, dong(a, 3), dong(b, 5))));
        expect(kq.every((x) => x.status === 'fulfilled')).toBe(true);
        expect(await soLuongTrongGio(k1, a)).toBe(3);
        expect(await soLuongTrongGio(k1, b)).toBe(5);
      }
    });

    it('hai thiết bị đồng bộ song song với syncId khác nhau không vượt tồn kho và không mất phần nào khi còn chỗ', async () => {
      for (let vong = 0; vong < 10; vong++) {
        const du = await bienThe(100);
        const hep = await bienThe(10);
        await Promise.all([dongBo(k1, maSync(), dong(du, 4), dong(hep, 7)), dongBo(k1, maSync(), dong(du, 5), dong(hep, 7))]);
        expect(await soLuongTrongGio(k1, du)).toBe(9);
        expect(await soLuongTrongGio(k1, hep)).toBe(10);
      }
    });

    it('thêm trực tiếp và đồng bộ chạy song song (cùng tranh tạo dòng mới) không mất số lượng của bên nào', async () => {
      const taiKhoan = String((await khachModel.findById(k1))!.taiKhoan);
      for (let vong = 0; vong < 25; vong++) {
        const a = await bienThe(100);
        await Promise.all([gioHang.them(taiKhoan, String(a._id), 2), dongBo(k1, maSync(), dong(a, 3))]);
        expect(await soLuongTrongGio(k1, a)).toBe(5);
      }
    });
  });

  describe('thêm trực tiếp (them)', () => {
    it('nhiều lần thêm cùng lúc không vượt tồn kho', async () => {
      const taiKhoan = String((await khachModel.findById(k2))!.taiKhoan);
      const a = await bienThe(10);
      const kq = await Promise.allSettled(Array.from({ length: 5 }, () => gioHang.them(taiKhoan, String(a._id), 3)));
      expect(kq.filter((x) => x.status === 'fulfilled')).toHaveLength(3);
      expect(kq.filter((x) => x.status === 'rejected')).toHaveLength(2);
      expect(await soLuongTrongGio(k2, a)).toBe(9);
    });

    it('từ chối khi tổng trong giỏ vượt 100 dù kho còn nhiều', async () => {
      const taiKhoan = String((await khachModel.findById(k2))!.taiKhoan);
      const a = await bienThe(500);
      await gioHang.them(taiKhoan, String(a._id), 70);
      await expect(gioHang.them(taiKhoan, String(a._id), 40)).rejects.toBeInstanceOf(BadRequestException);
      expect(await soLuongTrongGio(k2, a)).toBe(70);
    });
  });
});
