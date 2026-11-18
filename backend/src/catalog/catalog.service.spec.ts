import { pipelineTinhLaiTongHop } from '../phan-hoi/tong-hop-danh-gia';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import mongoose, { Connection, Model, Types } from 'mongoose';
import { CongKhaiService } from '../cong-khai/cong-khai.service';
import {
  ALL_MODELS, ChiTietSanPham, DonHang, Hang, KhachHang, KhuyenMai, LoaiSanPham, PhanHoi, SanPham, TinTuc, TranDau,
} from '../schemas';
import { CatalogService } from './catalog.service';

/**
 * Kiểm thử với MongoDB thật trên cơ sở dữ liệu TẠM (tự tạo, tự xóa; không đụng DB ứng dụng): đánh giá chưa xác minh không được
 * hiển thị hay tính điểm, sản phẩm chưa có đánh giá không còn 5 sao mặc định, khuyến mãi hết hạn/không có sản phẩm bị ẩn.
 * Không kết nối được MongoDB thì nhóm này bị bỏ qua và báo rõ.
 */
const BASE = (process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017').replace(/\/+$/, '');

/** Dò kết nối đồng bộ (tiến trình con) để quyết định bỏ qua nhóm test mà không cần await ở cấp module (tsc coi file này là CommonJS). */
function mongoSanSang(): boolean {
  const ma = `require("mongoose").createConnection(${JSON.stringify(`${BASE}/admin`)},{serverSelectionTimeoutMS:1500}).asPromise().then(c=>c.close()).then(()=>process.exit(0),()=>process.exit(1))`;
  return spawnSync(process.execPath, ['-e', ma], { timeout: 10_000 }).status === 0;
}
const coMongo = mongoSanSang();
if (!coMongo) {
  console.warn(`[catalog.service.spec] Không kết nối được MongoDB tại ${BASE}: BỎ QUA kiểm thử tích hợp.`);
}

describe.runIf(coMongo)('đánh giá và khuyến mãi công khai (MongoDB thật)', () => {
  const tenDb = `test_catalog_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  let conn: Connection;
  let spModel: Model<SanPham>;
  let ctModel: Model<ChiTietSanPham>;
  let phModel: Model<PhanHoi>;
  let kmModel: Model<KhuyenMai>;
  let khModel: Model<KhachHang>;
  let catalog: CatalogService;
  let congKhai: CongKhaiService;
  let khach: Types.ObjectId;
  const ngay = (n: number) => new Date(Date.now() + n * 864e5);
  let seq = 0;

  beforeAll(async () => {
    expect(tenDb).toMatch(/^test_catalog_[0-9a-f]{12}$/);
    conn = await mongoose.createConnection(`${BASE}/${tenDb}`).asPromise();
    for (const m of ALL_MODELS) conn.model(m.name, m.schema);
    await Promise.all(Object.values(conn.models).map((m) => m.init()));
    const m = <T>(c: { name: string }) => conn.model<T>(c.name);
    spModel = m<SanPham>(SanPham);
    ctModel = m<ChiTietSanPham>(ChiTietSanPham);
    phModel = m<PhanHoi>(PhanHoi);
    kmModel = m<KhuyenMai>(KhuyenMai);
    khModel = m<KhachHang>(KhachHang);
    catalog = new CatalogService(spModel, ctModel, phModel, m<Hang>(Hang), m<LoaiSanPham>(LoaiSanPham), kmModel);
    congKhai = new CongKhaiService(
      m<TinTuc>(TinTuc), m<TranDau>(TranDau), spModel, m<Hang>(Hang), m<LoaiSanPham>(LoaiSanPham), kmModel, phModel, m<DonHang>(DonHang), catalog,
    );
    khach = (await khModel.create({ hoTen: 'Nguyễn Văn A' }))._id;
  });

  afterAll(async () => {
    if (conn && tenDb.startsWith('test_catalog_')) {
      await conn.dropDatabase();
    }
    await conn?.close();
  });

  const sanPham = async (extra: Record<string, unknown> = {}) => {
    const sp = await spModel.create({ tenSanPham: `SP ${++seq}`, giaGoc: 1_000_000, ...extra });
    await ctModel.create({ sanPham: sp._id, sku: `SKU-${tenDb}-${seq}`, soLuongTon: 5 });
    return sp;
  };
  const danhGia = (sp: { _id: Types.ObjectId }, sao: number, daXacMinh?: boolean) =>
    phModel.create({ sanPham: sp._id, khachHang: khach, danhGia: sao, noiDung: `Đánh giá ${sao} sao rất chi tiết`, ...(daXacMinh === undefined ? {} : { daXacMinh }) });
  const trongDanhSach = async (sp: { _id: Types.ObjectId }) => (await catalog.tatCaSanPham()).find((x) => String(x._id) === String(sp._id));

  it('sản phẩm chưa có đánh giá nào có điểm null chứ không phải 5 sao', async () => {
    const sp = await sanPham();
    expect(await trongDanhSach(sp)).toMatchObject({ trungBinhDanhGia: null, soDanhGia: 0 });
    const ct = await catalog.chiTiet(String(sp._id));
    expect(ct).toMatchObject({ trungBinhDanhGia: null, soDanhGia: 0, danhGias: [] });
    expect(ct.sanPham).toMatchObject({ trungBinhDanhGia: null, soDanhGia: 0 });
  });

  it('đánh giá mẫu/import (không có cờ xác minh) không hiện và không tính điểm, nhưng vẫn nằm trong DB', async () => {
    const sp = await sanPham();
    await danhGia(sp, 5); // mặc định chưa xác minh
    await danhGia(sp, 5, false);
    expect(await phModel.countDocuments({ sanPham: sp._id })).toBe(2);
    expect(await trongDanhSach(sp)).toMatchObject({ trungBinhDanhGia: null, soDanhGia: 0 });
    expect((await catalog.chiTiet(String(sp._id))).danhGias).toEqual([]);
  });

  it('chỉ đánh giá đã xác minh được tính điểm và hiển thị', async () => {
    const sp = await sanPham();
    await danhGia(sp, 5, false);
    await danhGia(sp, 5, true);
    await danhGia(sp, 2, true);
    // Đánh giá được ghi thẳng vào collection (không qua API) nên tổng hợp lưu sẵn chưa có: chạy bước đối soát $merge như sau khi nhập dữ liệu.
    await spModel.aggregate(pipelineTinhLaiTongHop());
    expect(await trongDanhSach(sp)).toMatchObject({ trungBinhDanhGia: 3.5, soDanhGia: 2 });
    const ct = await catalog.chiTiet(String(sp._id));
    expect(ct).toMatchObject({ trungBinhDanhGia: 3.5, soDanhGia: 2 });
    expect(ct.danhGias).toHaveLength(2);
  });

  it('trang chủ chỉ lấy lời đánh giá đã xác minh', async () => {
    const sp = await sanPham();
    const chuaXacMinh = await danhGia(sp, 5, false);
    const macDinh = await danhGia(sp, 5);
    const that = await danhGia(sp, 5, true);
    const ids = (await congKhai.landing()).danhGia.map((r) => r.id);
    expect(ids).toContain(String(that._id));
    expect(ids).not.toContain(String(chuaXacMinh._id));
    expect(ids).not.toContain(String(macDinh._id));
  });

  describe("danh sách có thông số vợt và bộ lọc facet", () => {
    const loaiVot = async () => (await conn.model<LoaiSanPham>(LoaiSanPham.name).create({ tenLoai: "Vợt cầu lông" }))._id;
    const votTheoBienThe = async (ten: string, loai: Types.ObjectId, thongSos: Record<string, string>[], ton = 3) => {
      const sp = await spModel.create({ tenSanPham: ten, giaGoc: 2_000_000, loai });
      for (const t of thongSos) await ctModel.create({ sanPham: sp._id, sku: `SKU-${tenDb}-${++seq}`, soLuongTon: ton, thongSo: t });
      return sp;
    };
    const ts = (doCanBang: string, doCung: string, trongLuong: string) => ({ doCanBang, doCung, trongLuong, chieuDai: "675mm", sucCang: "21-29 lbs" });
    const ten = (r: { items: { tenSanPham: string }[] }) => r.items.map((i) => i.tenSanPham).sort();

    it("trả thongSoVot/tongTonKho; trường các phiên bản khác nhau nằm ở thongSoKhacNhau chứ không lấy phiên bản đầu; lọc facet khớp khi CÓ MỘT phiên bản thỏa", async () => {
      const loai = await loaiVot();
      await votTheoBienThe("F-NangCung", loai, [ts("Nặng đầu", "Cứng", "3U (85-89g)")]);
      await votTheoBienThe("F-NheMem", loai, [ts("Nhẹ đầu", "Mềm", "4U (80-84g)")]);
      await votTheoBienThe("F-HaiBan", loai, [ts("Nặng đầu", "Cứng", "3U (85-89g)"), ts("Nhẹ đầu", "Cứng", "4U (80-84g)")]);
      await sanPham(); // sản phẩm không phải vợt, không có thông số
      const tat = await catalog.danhSach({ loai: String(loai) });
      const hai = tat.items.find((i: any) => i.tenSanPham === "F-HaiBan") as any;
      expect(hai.tongTonKho).toBe(3 * 2);
      expect(hai.thongSoVot).toEqual({ doCung: "Cứng", chieuDai: "675mm", sucCang: "21-29 lbs" });
      expect(hai.thongSoKhacNhau).toEqual({ doCanBang: ["Nặng đầu", "Nhẹ đầu"], trongLuong: ["3U (85-89g)", "4U (80-84g)"] });
      expect(ten(await catalog.danhSach({ loai: String(loai), loi_choi: "cong" }))).toEqual(["F-HaiBan", "F-NangCung"]);
      expect(ten(await catalog.danhSach({ loai: String(loai), loi_choi: "toc" }))).toEqual(["F-HaiBan", "F-NheMem"]);
      expect(ten(await catalog.danhSach({ loai: String(loai), can_bang: "nang", do_cung: "cung", trong_luong: "3u" }))).toEqual(["F-HaiBan", "F-NangCung"]);
      // hai nhóm phải được thỏa Ở CÙNG MỘT phiên bản: nặng đầu + 4U không có phiên bản nào thỏa cả hai
      expect(ten(await catalog.danhSach({ loai: String(loai), can_bang: "nang", trong_luong: "4u" }))).toEqual([]);
      expect(ten(await catalog.danhSach({ loai: String(loai), can_bang: ["nang", "nhe"] }))).toEqual(["F-HaiBan", "F-NangCung", "F-NheMem"]);
    });

    it("giá trị facet lạ bị bỏ (không làm hỏng truy vấn); lọc facet giữ nguyên các bộ lọc cũ (giá, sắp xếp) và phân trang", async () => {
      const loai = await loaiVot();
      for (let i = 0; i < 14; i++) await votTheoBienThe(`G-${String(i).padStart(2, "0")}`, loai, [ts("Cân bằng", "Trung bình", "3U (85-89g)")]);
      const r = await catalog.danhSach({ loai: String(loai), loi_choi: "khong-co", can_bang: "xyz", sap_xep: "ten", page: "2" });
      expect(r.total).toBe(14);
      expect(r.page).toBe(2);
      expect(r.items).toHaveLength(2);
      const toan = await catalog.danhSach({ loai: String(loai), loi_choi: "toan", gia_tu: "1000000", gia_den: "3000000", sap_xep: "ten" });
      expect(toan.total).toBe(14);
      expect((toan.boLoc as any).locThongSo.loiChoi).toEqual(["toan"]);
      expect((await catalog.danhSach({ loai: String(loai), loi_choi: "toan", gia_tu: "2500000" })).total).toBe(0);
    });

    it("trang chủ dùng cùng cách gộp: không lấy thông số phiên bản đầu cho cả sản phẩm", async () => {
      const loai = await loaiVot();
      const sp = await votTheoBienThe("T-HaiBan", loai, [ts("Nặng đầu", "Cứng", "3U (85-89g)"), ts("Cân bằng", "Cứng", "3U (85-89g)")]);
      const tc = (await catalog.trangChu()).sanPhams.find((x: any) => x.id === String(sp._id)) as any;
      expect(tc.thongSoVot.doCanBang).toBeUndefined();
      expect(tc.thongSoKhacNhau.doCanBang).toEqual(["Nặng đầu", "Cân bằng"]);
    });
  });

  it('khuyến mãi: chỉ hiện chương trình còn hạn, có mức giảm và có sản phẩm còn kinh doanh', async () => {
    const dangChay = await kmModel.create({ tenChuongTrinh: 'Đang chạy', phanTramGiam: 10, ngayBatDau: ngay(-2), ngayKetThuc: ngay(3) });
    const hetHan = await kmModel.create({ tenChuongTrinh: 'Đại lễ 30/4 - 1/5', phanTramGiam: 20, ngayBatDau: new Date('2026-04-25'), ngayKetThuc: new Date('2026-05-02') });
    const khongSp = await kmModel.create({ tenChuongTrinh: 'Chưa có sản phẩm', phanTramGiam: 15, ngayBatDau: ngay(-2), ngayKetThuc: ngay(3) });
    const chiXoaMem = await kmModel.create({ tenChuongTrinh: 'Chỉ có sản phẩm đã xóa', phanTramGiam: 15, ngayBatDau: ngay(-2), ngayKetThuc: ngay(3) });
    const spChay = await sanPham({ khuyenMai: dangChay._id });
    await sanPham({ khuyenMai: hetHan._id });
    await sanPham({ khuyenMai: chiXoaMem._id, deletedAt: new Date() });

    const kq = await catalog.khuyenMaiDangChay();
    expect(kq.khuyenMais.map((k) => k?.tenChuongTrinh)).toEqual(['Đang chạy']);
    expect(kq.sanPhams.map((s) => s.id)).toEqual([String(spChay._id)]);
    expect(kq.khuyenMais.map((k) => k?.id)).not.toContain(String(khongSp._id));
  });
});
