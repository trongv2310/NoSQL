import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LOC_PHAN_HOI_CONG_KHAI, tongKetDanhGia } from '../common/danh-gia';
import { bienTheView, idOf, sanPhamView } from '../common/mappers';
import { dangGiamGia, giaSauKhuyenMai } from '../common/pricing';
import { parseObjectId, phanTrang } from '../common/helpers';
import { locKhuyenMaiDangChay } from './khuyen-mai';
import { ghepTrangChu, gomThongSoTheoSanPham } from './trang-chu';
import { BoLocThongSo, LOI_CHOI_KHOA, NHOM_CAN_BANG, NHOM_DO_CUNG, bienTheKhopBoLoc, coBoLocThongSo, gopThongSoBienThe } from './vot-thong-so';
import {
  ChiTietSanPham, Hang, KhuyenMai, LoaiSanPham, PhanHoi, SanPham,
} from '../schemas';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const KHOANG_GIA: Record<string, [number, number | null]> = {
  '0-1000000': [0, 1000000],
  '1000000-2000000': [1000000, 2000000],
  '2000000-3000000': [2000000, 3000000],
  '3000000-5000000': [3000000, 5000000],
  '5000000-': [5000000, null],
};

const chuThuong = (s: unknown) => String(s ?? '').trim().toLocaleLowerCase('vi');
const chua = (nguon: unknown, tu: string) => chuThuong(nguon).includes(chuThuong(tu));

/** Giá trị hợp lệ của từng nhóm lọc thông số; giá trị lạ bị bỏ (không làm hỏng truy vấn). Nhiều giá trị lặp khóa hoặc cách nhau bằng dấu phẩy. */
export function boLocThongSoTuQuery(q: Record<string, any>): BoLocThongSo {
  const lay = (k: string, hopLe: readonly string[]) =>
    mangTuQuery(q[k]).flatMap((v) => String(v).split(',')).map((v) => v.trim().toLowerCase()).filter((v) => hopLe.includes(v));
  return {
    loiChoi: lay('loi_choi', LOI_CHOI_KHOA),
    canBang: lay('can_bang', NHOM_CAN_BANG),
    trongLuong: lay('trong_luong', ['3u', '4u', '5u', '6u', '2u']),
    doCung: lay('do_cung', NHOM_DO_CUNG),
  };
}

export function mangTuQuery(v: unknown): string[] {
  if (v === undefined || v === null || v === '') {
    return [];
  }
  return (Array.isArray(v) ? v : [v]).map(String).filter(Boolean);
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(SanPham.name) private readonly sanPhamModel: Model<SanPham>,
    @InjectModel(ChiTietSanPham.name) private readonly chiTietModel: Model<ChiTietSanPham>,
    @InjectModel(PhanHoi.name) private readonly phanHoiModel: Model<PhanHoi>,
    @InjectModel(Hang.name) private readonly hangModel: Model<Hang>,
    @InjectModel(LoaiSanPham.name) private readonly loaiModel: Model<LoaiSanPham>,
    @InjectModel(KhuyenMai.name) private readonly khuyenMaiModel: Model<KhuyenMai>,
  ) {}

  /** Toàn bộ sản phẩm đang kinh doanh (chưa xóa mềm), đã populate quan hệ. Danh mục nhỏ nên lọc trong bộ nhớ. */
  async tatCaSanPham(): Promise<any[]> {
    const [ds, diem] = await Promise.all([
      this.sanPhamModel
        .find({ deletedAt: null })
        .populate('loai hang khuyenMai nhaCungCap')
        .sort({ ngayTao: -1, _id: -1 })
        .lean() as Promise<any[]>,
      // Chỉ tính đánh giá đã xác minh; sản phẩm chưa có thì điểm là null (không mặc định 5 sao).
      this.phanHoiModel.aggregate<{ _id: any; tb: number; so: number }>([
        { $match: LOC_PHAN_HOI_CONG_KHAI },
        { $group: { _id: '$sanPham', tb: { $avg: '$danhGia' }, so: { $sum: 1 } } },
      ]),
    ]);
    const diemMap = new Map(diem.map((d) => [String(d._id), { tb: Math.round(d.tb * 10) / 10, so: d.so }]));
    return ds.map((sp) => {
      const d = diemMap.get(String(sp._id));
      return { ...sp, trungBinhDanhGia: d?.tb ?? null, soDanhGia: d?.so ?? 0 };
    });
  }

  async tonKhoTheoSanPham(): Promise<Map<string, number>> {
    const r = await this.chiTietModel.aggregate<{ _id: any; t: number }>([
      { $group: { _id: '$sanPham', t: { $sum: '$soLuongTon' } } },
    ]);
    return new Map(r.map((x) => [String(x._id), x.t]));
  }

  private loc(ds: any[], q: Record<string, any>, tonKho: Map<string, number>, thongSoTheoSp: Map<string, any[]> = new Map()): any[] {
    let r = ds;
    const loai = q.loai || q.maLoai;
    if (loai) {
      const key = chuThuong(loai);
      if (/^[0-9a-f]{24}$/i.test(String(loai))) {
        r = r.filter((sp) => idOf(sp.loai) === String(loai));
      } else {
        const khop = (sp: any, ...mau: string[]) => mau.some((m) => chua(sp.loai?.tenLoai, m));
        if (key.includes('vot')) {
          r = r.filter((sp) => khop(sp, 'vợt', 'vot'));
        } else if (key.includes('giay') || key.includes('giày')) {
          r = r.filter((sp) => khop(sp, 'giày', 'giay'));
        } else if (['ao', 'áo', 'quan', 'quần'].some((k) => key.includes(k))) {
          r = r.filter((sp) => khop(sp, 'áo', 'ao'));
        } else if (key.includes('phu') || key.includes('phụ')) {
          r = r.filter((sp) => khop(sp, 'phụ kiện', 'phu'));
        } else {
          r = r.filter((sp) => chua(sp.loai?.tenLoai, key));
        }
      }
    }
    if (q.hang) {
      r = r.filter((sp) => chua(sp.hang?.tenHang, q.hang));
    }
    if (q.ten) {
      r = r.filter((sp) => chua(sp.tenSanPham, q.ten));
    }
    if (q.keyword) {
      r = r.filter(
        (sp) => chua(sp.tenSanPham, q.keyword) || chua(sp.hang?.tenHang, q.keyword) || chua(sp.loai?.tenLoai, q.keyword),
      );
    }
    const [tu, den] = this.khoangGia(q);
    if (tu !== null && tu > 0) {
      r = r.filter((sp) => giaSauKhuyenMai(sp.giaGoc, sp.khuyenMai) >= tu);
    }
    if (den !== null && den > 0) {
      r = r.filter((sp) => giaSauKhuyenMai(sp.giaGoc, sp.khuyenMai) <= den);
    }
    // Lọc theo thông số vợt: một sản phẩm khớp khi CÓ MỘT phiên bản thỏa mọi nhóm đã chọn (không lấy phiên bản đầu đại diện cho cả sản phẩm).
    const boLocThongSo = boLocThongSoTuQuery(q);
    if (coBoLocThongSo(boLocThongSo)) {
      r = r.filter((sp) => (thongSoTheoSp.get(String(sp._id)) ?? []).some((ts) => bienTheKhopBoLoc(ts, boLocThongSo)));
    }
    const hangIds = mangTuQuery(q.hangs ?? q['hangs[]']);
    if (hangIds.length) {
      r = r.filter((sp) => hangIds.includes(idOf(sp.hang) ?? ''));
    }
    if (q.giam_gia === '1' || q.giam_gia === 'true' || q.giam_gia === 'on') {
      r = r.filter((sp) => dangGiamGia(sp.khuyenMai));
    }
    if (q.con_hang === '1' || q.con_hang === 'true' || q.con_hang === 'on') {
      r = r.filter((sp) => (tonKho.get(String(sp._id)) ?? 0) > 0);
    }
    return this.sapXep(r, q.sap_xep);
  }

  private sapXep(ds: any[], kieu?: string): any[] {
    const gia = (sp: any) => giaSauKhuyenMai(sp.giaGoc, sp.khuyenMai);
    const moiNhat = (a: any, b: any) =>
      +new Date(b.ngayTao) - +new Date(a.ngayTao) || String(b._id).localeCompare(String(a._id));
    const r = [...ds];
    switch (kieu) {
      case 'gia_tang':
        return r.sort((a, b) => gia(a) - gia(b) || moiNhat(a, b));
      case 'gia_giam':
        return r.sort((a, b) => gia(b) - gia(a) || moiNhat(a, b));
      case 'ten':
        return r.sort((a, b) => String(a.tenSanPham).localeCompare(String(b.tenSanPham), 'vi'));
      default:
        return r.sort(moiNhat);
    }
  }

  khoangGia(q: Record<string, any>): [number | null, number | null] {
    let tu = q.gia_tu !== undefined && q.gia_tu !== '' && !isNaN(Number(q.gia_tu)) && Number(q.gia_tu) >= 0 ? Number(q.gia_tu) : null;
    let den = q.gia_den !== undefined && q.gia_den !== '' && !isNaN(Number(q.gia_den)) && Number(q.gia_den) > 0 ? Number(q.gia_den) : null;
    if (tu === null && den === null) {
      const preset = Object.hasOwn(KHOANG_GIA, String(q.khoang)) ? KHOANG_GIA[String(q.khoang)] : undefined;
      if (preset) {
        [tu, den] = preset;
      }
    }
    if (tu !== null && den !== null && tu > den) {
      [tu, den] = [den, tu];
    }
    return [tu, den];
  }

  async danhSach(q: Record<string, any>) {
    const [all, tonKho, dsHang, dsLoai, bienThes] = await Promise.all([
      this.tatCaSanPham(),
      this.tonKhoTheoSanPham(),
      this.hangModel.find().sort({ tenHang: 1 }).lean(),
      this.loaiModel.find().sort({ _id: 1 }).lean(),
      this.chiTietModel.find({ thongSo: { $ne: null } }, { sanPham: 1, thongSo: 1 }).sort({ _id: 1 }).lean(),
    ]);
    const thongSoTheoSp = gomThongSoTheoSanPham(bienThes);
    const khop = this.loc(all, q, tonKho, thongSoTheoSp);
    const trang = phanTrang(khop, Number(q.page) || 1, 12);
    const [tu, den] = this.khoangGia(q);
    let hangDangChon = mangTuQuery(q.hangs ?? q['hangs[]']);
    const hangTheoTen = String(q.hang ?? '').trim();
    if (!hangDangChon.length && hangTheoTen) {
      hangDangChon = dsHang.filter((h) => chua(h.tenHang, hangTheoTen)).map((h) => String(h._id));
    }
    const bool = (v: any) => ['1', 'true', 'on'].includes(String(v));
    return {
      ...trang,
      items: trang.items.map((sp: any) => {
        const g = gopThongSoBienThe(thongSoTheoSp.get(String(sp._id)) ?? []);
        return { ...sanPhamView(sp), tongTonKho: tonKho.get(String(sp._id)) ?? 0, thongSoVot: g.thongSoVot, thongSoKhacNhau: g.khacNhau };
      }),
      tieuDe: q.keyword ? `Kết quả tìm kiếm cho '${String(q.keyword).trim()}'` : 'Danh sách sản phẩm',
      boLoc: {
        dsHang: dsHang.map((h) => ({ id: idOf(h), tenHang: h.tenHang })),
        dsLoai: dsLoai.map((l) => ({ id: idOf(l), tenLoai: l.tenLoai })),
        khoangGiaGoiY: Object.keys(KHOANG_GIA),
        locGiaTu: tu,
        locGiaDen: den,
        locHang: hangDangChon,
        locKhoang: q.khoang ?? null,
        locThongSo: boLocThongSoTuQuery(q),
        sapXep: q.sap_xep ?? 'moi',
        dangLoc: tu !== null || den !== null || hangDangChon.length > 0 || bool(q.giam_gia) || bool(q.con_hang),
      },
    };
  }

  /** Một lần gọi cho landing: mọi sản phẩm + tồn kho + thông số vợt (xem trang-chu.ts). */
  async trangChu() {
    const [sps, tonKho, bienThes] = await Promise.all([
      this.tatCaSanPham(),
      this.tonKhoTheoSanPham(),
      this.chiTietModel.find({ thongSo: { $ne: null } }, { sanPham: 1, thongSo: 1 }).sort({ _id: 1 }).lean(),
    ]);
    return { sanPhams: ghepTrangChu(sps, tonKho, bienThes) };
  }

  async cuaHang() {
    return (await this.tatCaSanPham()).map(sanPhamView);
  }

  async chiTiet(id: string) {
    const oid = parseObjectId(id, 'Mã sản phẩm');
    const sp: any = await this.sanPhamModel
      .findOne({ _id: oid, deletedAt: null })
      .populate('loai hang khuyenMai nhaCungCap')
      .lean();
    if (!sp) {
      throw new NotFoundException('Không tìm thấy sản phẩm.');
    }
    const [bienThes, danhGias]: [any[], any[]] = await Promise.all([
      this.chiTietModel.find({ sanPham: oid }).populate('mau size').sort({ _id: 1 }).lean(),
      this.phanHoiModel.find({ sanPham: oid, ...LOC_PHAN_HOI_CONG_KHAI }).populate('khachHang').sort({ ngayPhanHoi: -1 }).lean(),
    ]);
    const duyNhat = <T extends { id: string | null }>(ds: (T | null)[]): T[] => {
      const seen = new Set<string>();
      return ds.filter((x): x is T => !!x && !seen.has(x.id ?? '') && !!seen.add(x.id ?? ''));
    };
    const views = bienThes.map((b) => bienTheView(b, sp));
    const tongKet = tongKetDanhGia(danhGias);
    return {
      sanPham: sanPhamView({ ...sp, trungBinhDanhGia: tongKet.trungBinh, soDanhGia: tongKet.so }),
      bienThes: views,
      mauSacs: duyNhat(views.map((v) => v.mau)),
      sizes: duyNhat(views.map((v) => v.size)),
      ...(({ thongSoVot, khacNhau }) => ({ thongSoVot, thongSoKhacNhau: khacNhau }))(gopThongSoBienThe(views.map((v) => v.thongSo))),
      danhGias: danhGias.map((r) => ({
        id: idOf(r),
        noiDung: r.noiDung,
        danhGia: r.danhGia,
        ngayPhanHoi: r.ngayPhanHoi,
        tenKhachHang: r.khachHang?.hoTen ?? 'Khách hàng',
      })),
      trungBinhDanhGia: tongKet.trungBinh,
      soDanhGia: tongKet.so,
      giaBanThucTe: giaSauKhuyenMai(sp.giaGoc, sp.khuyenMai),
    };
  }

  async khuyenMaiDangChay() {
    const [kms, sps] = await Promise.all([
      this.khuyenMaiModel.find().lean(),
      this.tatCaSanPham(),
    ]);
    return locKhuyenMaiDangChay(kms, sps);
  }
}
