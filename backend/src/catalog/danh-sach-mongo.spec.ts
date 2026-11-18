import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import mongoose, { Connection, Types } from 'mongoose';
import { pipelineTinhLaiTongHop } from '../phan-hoi/tong-hop-danh-gia';
import { ALL_MODELS, ChiTietSanPham, Hang, KhuyenMai, LoaiSanPham, NhaCungCap, PhanHoi, SanPham } from '../schemas';
import { CatalogService, KHOANG_GIA } from './catalog.service';

/**
 * So khớp bản danh sách chạy trong MongoDB ($facet + $bucket) với bản lọc trong bộ nhớ cũ trên CÙNG dữ liệu: khuyến mãi còn hạn /
 * hết hạn / chưa tới / có trần giảm / 0%, giá đúng biên khoảng giá, tên có dấu và trùng tên, ngày tạo trùng nhau, hết hàng,
 * sản phẩm đã xoá mềm, thiếu hãng. Hơn hai trăm tổ hợp truy vấn: cùng id, cùng thứ tự, cùng tổng, cùng trang.
 * Riêng từ khoá tìm kiếm cố ý đổi nghĩa (text index, không dấu, chịu lỗi chính tả) nên được kiểm ở tim-kiem-mongo.spec.ts.
 * Các con số đếm của $facet được đối chiếu bằng cách chạy lại bản cũ với lựa chọn tương ứng.
 */
const BASE = (process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017').replace(/\/+$/, '');
function mongoSanSang(): boolean {
  const ma = `require("mongoose").createConnection(${JSON.stringify(`${BASE}/admin`)},{serverSelectionTimeoutMS:1500}).asPromise().then(c=>c.close()).then(()=>process.exit(0),()=>process.exit(1))`;
  return spawnSync(process.execPath, ['-e', ma], { timeout: 10_000 }).status === 0;
}
const coMongo = mongoSanSang();

/** Bộ sinh số giả ngẫu nhiên cố định hạt giống (mulberry32): lần chạy nào cũng cùng dữ liệu, lỗi tái hiện được. */
function rng(hat: number) {
  return () => {
    hat |= 0; hat = (hat + 0x6d2b79f5) | 0;
    let t = Math.imul(hat ^ (hat >>> 15), 1 | hat);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe.runIf(coMongo)('danh sách sản phẩm: $facet trong MongoDB khớp bản lọc trong bộ nhớ', () => {
  const tenDb = `test_danh_sach_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  let conn: Connection;
  let catalog: CatalogService;
  const r = rng(20261118);
  const chon = <T>(ds: readonly T[]) => ds[Math.floor(r() * ds.length)];
  const loaiIds: Record<string, Types.ObjectId> = {};
  const hangIds: Types.ObjectId[] = [];

  beforeAll(async () => {
    expect(tenDb).toMatch(/^test_danh_sach_[0-9a-f]{12}$/);
    conn = await mongoose.createConnection(`${BASE}/${tenDb}`).asPromise();
    for (const m of ALL_MODELS) conn.model(m.name, m.schema);
    await Promise.all(Object.values(conn.models).map((m) => m.init()));
    const M = (c: { name: string }) => conn.model(c.name) as any;
    catalog = new CatalogService(M(SanPham), M(ChiTietSanPham), M(PhanHoi), M(Hang), M(LoaiSanPham), M(KhuyenMai));

    for (const ten of ['Vợt cầu lông', 'Giày cầu lông', 'Áo thi đấu', 'Phụ kiện']) loaiIds[ten] = (await M(LoaiSanPham).create({ tenLoai: ten }))._id;
    for (const ten of ['Yonex', 'Lining', 'Victor', 'Kumpoo']) hangIds.push((await M(Hang).create({ tenHang: ten }))._id);
    const ncc = (await M(NhaCungCap).create({ tenNhaCungCap: 'NCC' }))._id;
    const ngay = (n: number, gio = 12) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(gio, 30, 0, 0); return d; };
    const km = await M(KhuyenMai).create([
      { tenChuongTrinh: 'Đang chạy 10%', phanTramGiam: 10, ngayBatDau: ngay(-5), ngayKetThuc: ngay(5) },
      { tenChuongTrinh: 'Đang chạy 20% trần 150k', phanTramGiam: 20, giamToiDa: 150_000, ngayBatDau: ngay(-1, 23), ngayKetThuc: ngay(0, 0) },
      { tenChuongTrinh: 'Hết hạn hôm qua', phanTramGiam: 30, ngayBatDau: ngay(-10), ngayKetThuc: ngay(-1, 23) },
      { tenChuongTrinh: 'Bắt đầu ngày mai', phanTramGiam: 25, ngayBatDau: ngay(1, 0) },
      { tenChuongTrinh: 'Bắt đầu hôm nay, 50%', phanTramGiam: 50, ngayBatDau: ngay(0, 23) },
      { tenChuongTrinh: '0%', phanTramGiam: 0 },
    ]);
    const tenGoc = ['Vợt Yonex Astrox', 'vợt yonex nanoflare', 'Áo thi đấu Victor', 'Giày Lining Ranger', 'Đai quấn cán', 'Ống cầu lông', 'Balo cầu lông', 'Vợt Kumpoo', 'Ao tap', 'Giay chay'];
    const gia = [0, 500_000, 1_000_000, 1_187_500, 1_250_000, 2_000_000, 2_150_000, 2_500_000, 3_000_000, 4_990_000, 5_000_000, 8_000_000];
    const moc = Date.now() - 50 * 864e5;
    const docs = Array.from({ length: 90 }, (_, i) => ({
      tenSanPham: r() < 0.15 ? 'Trùng tên' : `${chon(tenGoc)} ${chon(['', 'Pro', 'đặc biệt', 'II'])}`.trim(),
      giaGoc: chon(gia),
      loai: r() < 0.9 ? loaiIds[chon(Object.keys(loaiIds))] : undefined,
      hang: r() < 0.85 ? chon(hangIds) : undefined,
      khuyenMai: r() < 0.6 ? (chon(km) as any)._id : r() < 0.1 ? new Types.ObjectId() /* khuyến mãi đã bị xoá */ : undefined,
      nhaCungCap: ncc,
      ngayTao: new Date(moc + Math.floor(r() * 12) * 864e5), // nhiều sản phẩm trùng ngày tạo → phải phân định bằng _id
      ...(r() < 0.08 ? { deletedAt: new Date() } : {}),
    }));
    const sps: any[] = await M(SanPham).insertMany(docs);
    const ct: any[] = [];
    const thongSo = [
      { doCanBang: 'Nặng đầu', doCung: 'Cứng', trongLuong: '3U (85-89g)' },
      { doCanBang: 'Nhẹ đầu', doCung: 'Mềm', trongLuong: '4U (80-84g)' },
      { doCanBang: 'Cân bằng', doCung: 'Trung bình', trongLuong: '4U (80-84g)' },
    ];
    sps.forEach((sp, i) => {
      const so = Math.floor(r() * 3); // 0 = không có phiên bản (tồn kho 0)
      for (let k = 0; k < so; k++) {
        ct.push({ sanPham: sp._id, sku: `SKU-${tenDb}-${i}-${k}`, soLuongTon: r() < 0.3 ? 0 : Math.floor(r() * 9), ...(r() < 0.5 ? { thongSo: chon(thongSo) } : {}) });
      }
    });
    for (const c of ct) await M(ChiTietSanPham).create(c); // create() để hook dựng thuocTinh (lọc lối chơi)
    await M(PhanHoi).insertMany(sps.slice(0, 30).map((sp, i) => ({ sanPham: sp._id, danhGia: (i % 5) + 1, noiDung: 'Đánh giá thử nghiệm', daXacMinh: true })));
    await M(SanPham).aggregate(pipelineTinhLaiTongHop());
  }, 60_000);

  afterAll(async () => {
    if (conn && tenDb.startsWith('test_danh_sach_')) await conn.dropDatabase();
    await conn?.close();
  });

  const toHop = (): Record<string, any>[] => {
    const tay: Record<string, any>[] = [
      {},
      { page: '2' }, { page: '99' }, { page: '0' }, { page: 'abc' },
      { sap_xep: 'ten' }, { sap_xep: 'gia_tang' }, { sap_xep: 'gia_giam' }, { sap_xep: 'la' },
      { keyword: '  ' }, // từ khoá rỗng = không tìm
      { loai: 'vot' }, { loai: 'giày' }, { loai: 'quan' }, { loai: 'phu' }, { loai: 'xyz' }, { loai: String(loaiIds['Áo thi đấu']) },
      { maLoai: String(loaiIds['Phụ kiện']) }, { hang: 'yon' }, { ten: 'pro' },
      { khoang: '1000000-2000000' }, { khoang: '5000000-' }, { khoang: 'sai' },
      { gia_tu: '3000000', gia_den: '1000000' }, { gia_tu: '2000000' }, { gia_den: '2000000' }, { gia_tu: '-5' }, { gia_den: '0' },
      { giam_gia: '1' }, { con_hang: 'on' }, { giam_gia: 'true', con_hang: '1', sap_xep: 'gia_tang' },
      { hangs: [String(hangIds[0]), String(hangIds[2])] }, { 'hangs[]': String(hangIds[1]) }, { hangs: 'khong-phai-id' },
      { loi_choi: 'cong' }, { loi_choi: 'toc', loai: 'vot' }, { can_bang: 'nang', trong_luong: '4u' }, { loi_choi: 'la' },
    ];
    const ngauNhien = Array.from({ length: 180 }, () => {
      const q: Record<string, any> = {};
      if (r() < 0.4) q.loai = chon(['vot', 'giay', 'ao', 'phu', String(loaiIds['Vợt cầu lông'])]);
      if (r() < 0.3) q.hangs = hangIds.filter(() => r() < 0.4).map(String);
      if (r() < 0.2) q.hang = chon(['yonex', 'Li', 'VICTOR']);
      if (r() < 0.3) q.khoang = chon(Object.keys(KHOANG_GIA));
      else if (r() < 0.3) { q.gia_tu = String(chon([0, 1_000_000, 1_187_500, 2_000_000])); q.gia_den = String(chon([2_000_000, 2_150_000, 5_000_000])); }
      if (r() < 0.25) q.giam_gia = '1';
      if (r() < 0.25) q.con_hang = '1';
      if (r() < 0.2) q.loi_choi = chon(['cong', 'toc', 'toan']);
      if (r() < 0.7) q.sap_xep = chon(['ten', 'gia_tang', 'gia_giam', 'moi']);
      if (r() < 0.4) q.page = String(chon([1, 2, 3, 8]));
      return q;
    });
    return [...tay, ...ngauNhien];
  };

  it('cùng id, thứ tự, tổng, trang và cùng nội dung từng sản phẩm trên hơn 200 tổ hợp truy vấn', async () => {
    const ds = toHop();
    expect(ds.length).toBeGreaterThan(200);
    let coKetQua = 0;
    for (const q of ds) {
      const [moi, cu] = await Promise.all([catalog.danhSach(q), catalog.danhSachTrongBoNho(q)]);
      const tom = (x: any) => ({ total: x.total, page: x.page, pages: x.pages, perPage: x.perPage, tieuDe: x.tieuDe, items: x.items });
      try {
        expect(tom(moi)).toEqual(tom(cu));
        const { demTheoHang, demTheoKhoang, phanBoGia, ...boLoc } = moi.boLoc as any;
        expect(boLoc).toEqual(cu.boLoc);
      } catch (e) {
        throw new Error(`Lệch ở truy vấn ${JSON.stringify(q)}:\n${(e as Error).message}`);
      }
      if (moi.items.length) coKetQua++;
    }
    expect(coKetQua).toBeGreaterThan(ds.length / 2); // bộ dữ liệu không quá thưa: đa số tổ hợp có kết quả
  }, 120_000);

  it('số đếm theo hãng và theo khoảng giá = tổng mà bản cũ trả khi chọn đúng lựa chọn đó (các bộ lọc khác giữ nguyên)', async () => {
    for (const q of [{}, { loai: 'vot' }, { con_hang: '1', khoang: '1000000-2000000' }, { hangs: [String(hangIds[0])], giam_gia: '1' }, { hang: 'yon', gia_tu: '1000000' }]) {
      const moi = (await catalog.danhSach(q)).boLoc as any;
      const { hangs: _h, 'hangs[]': _h2, ...khongHang } = q as Record<string, any>;
      for (const h of hangIds) {
        const ky = (await catalog.danhSachTrongBoNho({ ...khongHang, hangs: [String(h)] })).total;
        expect([q, String(h), moi.demTheoHang[String(h)] ?? 0]).toEqual([q, String(h), ky]);
      }
      const { gia_tu: _a, gia_den: _b, khoang: _c, ...khongGia } = q as Record<string, any>;
      for (const k of Object.keys(KHOANG_GIA)) {
        const ky = (await catalog.danhSachTrongBoNho({ ...khongGia, khoang: k })).total;
        expect([q, k, moi.demTheoKhoang[k]]).toEqual([q, k, ky]);
      }
      // $bucket: các khoảng [a, b) không chồng nhau nên cộng lại đúng bằng số sản phẩm khi bỏ bộ lọc giá.
      const tong = (await catalog.danhSachTrongBoNho(khongGia)).total;
      expect(moi.phanBoGia.reduce((s: number, b: any) => s + b.so, 0)).toBe(tong);
    }
  }, 60_000);
});
