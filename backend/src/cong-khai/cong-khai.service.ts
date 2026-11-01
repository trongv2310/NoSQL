import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CatalogService } from '../catalog/catalog.service';
import { idOf, sanPhamView } from '../common/mappers';
import { dangGiamGia, giaSauKhuyenMai, khuyenMaiConHieuLuc } from '../common/pricing';
import { likeRegex, parseObjectId, phanTrang } from '../common/helpers';
import {
  DonHang, Hang, KhuyenMai, LOAI_TIN, LoaiSanPham, PhanHoi, SanPham, TinTuc, TranDau, TRANG_THAI,
} from '../schemas';
import { TRANG_THAI_LOAI_TRU } from '../don-hang/trang-thai';

/* eslint-disable @typescript-eslint/no-explicit-any */
const NGAN_SACH: [string, string, number, number | null][] = [
  ['0-1000000', 'Dưới 1 triệu', 0, 1000000],
  ['1000000-2000000', '1 – 2 triệu', 1000000, 2000000],
  ['2000000-3000000', '2 – 3 triệu', 2000000, 3000000],
  ['3000000-5000000', '3 – 5 triệu', 3000000, 5000000],
  ['5000000-', 'Trên 5 triệu', 5000000, null],
];

export function tinView(t: any) {
  const [nhan, icon] = LOAI_TIN[t.loaiTin] ?? ['Tin tức', 'fa-newspaper'];
  const sp = t.sanPham && t.sanPham._id ? t.sanPham : null;
  return {
    id: idOf(t),
    tieuDe: t.tieuDe,
    tomTat: t.tomTat ?? null,
    noiDung: t.noiDung,
    loaiTin: t.loaiTin,
    nhanLoai: nhan,
    iconLoai: icon,
    hinhAnh: t.hinhAnh || (sp ? `images/${sp.hinhAnhDaiDien}` : 'images/news/court-journal-thumb.webp'),
    nguonTin: t.nguonTin ?? null,
    lienKetNguon: t.lienKetNguon ?? null,
    noiBat: !!t.noiBat,
    hienThi: t.hienThi !== false,
    thuTu: t.thuTu ?? 1,
    luotXem: t.luotXem ?? 0,
    ngayDang: t.ngayDang,
    sanPham: sp ? sanPhamView(sp) : null,
    tranDau: t.tranDau && t.tranDau._id ? tranDauView(t.tranDau) : null,
    tacGia: t.tacGia?.tenDangNhap ?? null,
  };
}

export function tranDauView(t: any) {
  return {
    id: idOf(t),
    tenGiaiDau: t.tenGiaiDau,
    vong: t.vong,
    noiDung: t.noiDung,
    doiA: t.doiA,
    doiB: t.doiB,
    tiSo: t.tiSo ?? null,
    doiThang: t.doiThang ?? null,
    tenDoiThang: t.doiThang === 'A' ? t.doiA : t.doiThang === 'B' ? t.doiB : null,
    ngayThiDau: t.ngayThiDau,
    diaDiem: t.diaDiem ?? null,
    nguonTin: t.nguonTin ?? null,
    lienKetNguon: t.lienKetNguon ?? null,
    tinTucs: (t.tinTucs ?? []).map((x: any) => ({ id: idOf(x), tieuDe: x.tieuDe })),
  };
}

@Injectable()
export class CongKhaiService {
  constructor(
    @InjectModel(TinTuc.name) private readonly tinModel: Model<TinTuc>,
    @InjectModel(TranDau.name) private readonly tranModel: Model<TranDau>,
    @InjectModel(SanPham.name) private readonly spModel: Model<SanPham>,
    @InjectModel(Hang.name) private readonly hangModel: Model<Hang>,
    @InjectModel(LoaiSanPham.name) private readonly loaiModel: Model<LoaiSanPham>,
    @InjectModel(KhuyenMai.name) private readonly kmModel: Model<KhuyenMai>,
    @InjectModel(PhanHoi.name) private readonly phanHoiModel: Model<PhanHoi>,
    @InjectModel(DonHang.name) private readonly donHangModel: Model<DonHang>,
    private readonly catalog: CatalogService,
  ) {}

  private daDang(extra: Record<string, any> = {}) {
    return {
      deletedAt: null,
      hienThi: { $ne: false },
      ngayDang: { $lte: new Date() },
      ...extra,
    };
  }

  private tinQuery(filter: Record<string, any>) {
    return this.tinModel.find(filter).populate({ path: 'sanPham', populate: 'khuyenMai' }).populate('tranDau');
  }

  private async tranMoi(soLuong: number) {
    const trans = await this.tranModel.find().sort({ ngayThiDau: -1, _id: -1 }).limit(soLuong).lean();
    const tins = await this.tinModel
      .find(this.daDang({ tranDau: { $in: trans.map((t) => t._id) } }), { tieuDe: 1, tranDau: 1 })
      .sort({ ngayDang: -1 })
      .lean();
    return trans.map((t) =>
      tranDauView({ ...t, tinTucs: tins.filter((x) => String(x.tranDau) === String(t._id)) }),
    );
  }

  async landing() {
    const all = await this.catalog.tatCaSanPham();
    const [tongHang, kms, loais, soLoai, danhGia, noiBat] = await Promise.all([
      this.hangModel.countDocuments(),
      this.kmModel.find().lean(),
      this.loaiModel.find().sort({ _id: 1 }).lean(),
      this.spModel.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { deletedAt: null } },
        { $group: { _id: '$loai', n: { $sum: 1 } } },
      ]),
      this.phanHoiModel
        .find({ danhGia: { $gte: 4 }, noiDung: { $nin: [null, ''] } })
        .populate('khachHang sanPham')
        .sort({ ngayPhanHoi: -1 })
        .limit(3)
        .lean() as Promise<any[]>,
      this.tinQuery(this.daDang({ noiBat: true })).sort({ thuTu: 1, ngayDang: -1, _id: -1 }).lean() as Promise<any[]>,
    ]);
    const gia = (sp: any) => giaSauKhuyenMai(sp.giaGoc, sp.khuyenMai);
    const tiLeGiam = (sp: any) => (sp.giaGoc > 0 ? 1 - gia(sp) / sp.giaGoc : 0);

    let uuDai = all.filter((sp) => dangGiamGia(sp.khuyenMai)).sort((a, b) => tiLeGiam(b) - tiLeGiam(a)).slice(0, 8);
    if (uuDai.length < 4) {
      const co = new Set(uuDai.map((s) => String(s._id)));
      uuDai = uuDai.concat(all.filter((s) => !co.has(String(s._id))).slice(0, 8 - uuDai.length));
    }
    const loaiDaLay = new Set<string>();
    let heroSp = uuDai.filter((sp) => {
      const k = idOf(sp.loai) ?? '';
      if (loaiDaLay.has(k)) {
        return false;
      }
      loaiDaLay.add(k);
      return true;
    }).slice(0, 3);
    if (heroSp.length < 3) {
      const co = new Set(heroSp.map((s) => String(s._id)));
      heroSp = heroSp.concat(uuDai.filter((s) => !co.has(String(s._id)))).slice(0, 3);
    }
    const idNoiBat = noiBat.map((t) => t._id);
    const tinMoi = (await this.tinQuery(this.daDang(idNoiBat.length ? { _id: { $nin: idNoiBat } } : {}))
      .sort({ ngayDang: -1, _id: -1 })
      .limit(3)
      .lean()) as any[];
    const demLoai = new Map(soLoai.map((x) => [String(x._id), x.n]));

    return {
      thongKe: {
        sanPham: all.length,
        hang: tongHang,
        uuDai: kms.filter((k) => khuyenMaiConHieuLuc(k)).length,
      },
      nganSach: NGAN_SACH.map(([khoa, nhan, tu, den]) => ({
        khoa,
        nhan,
        soLuong: all.filter((sp) => gia(sp) >= tu && (den === null || gia(sp) <= den)).length,
      })),
      danhMuc: loais.map((l) => ({ id: idOf(l), tenLoai: l.tenLoai, moTa: l.moTa ?? null, soSanPham: demLoai.get(String(l._id)) ?? 0 })),
      uuDai: uuDai.map(sanPhamView),
      heroSp: heroSp.map(sanPhamView),
      giamToiDa: uuDai.length ? Math.max(...uuDai.map((sp) => Math.round(tiLeGiam(sp) * 100))) : 0,
      danhGia: danhGia.map((r) => ({
        id: idOf(r),
        noiDung: r.noiDung,
        danhGia: r.danhGia,
        tenKhachHang: r.khachHang?.hoTen ?? 'Khách hàng',
        tenSanPham: r.sanPham?.tenSanPham ?? null,
      })),
      dsNoiBat: noiBat.map(tinView),
      tinMoi: tinMoi.map(tinView),
      tranMoi: await this.tranMoi(4),
    };
  }

  private async sanPhamHot(soLuong: number): Promise<any[]> {
    const top = await this.donHangModel.aggregate<{ _id: Types.ObjectId; t: number }>([
      { $match: { trangThai: { $nin: TRANG_THAI_LOAI_TRU } } },
      { $unwind: '$chiTiet' },
      { $group: { _id: '$chiTiet.sanPham', t: { $sum: '$chiTiet.soLuong' } } },
      { $sort: { t: -1 } },
      { $limit: soLuong },
    ]);
    const all = await this.catalog.tatCaSanPham();
    const byId = new Map(all.map((s) => [String(s._id), s]));
    let hot = top.map((x) => byId.get(String(x._id))).filter(Boolean) as any[];
    if (hot.length < soLuong) {
      const co = new Set(hot.map((s) => String(s._id)));
      hot = hot.concat(all.filter((s) => dangGiamGia(s.khuyenMai) && !co.has(String(s._id))).slice(0, soLuong - hot.length));
    }
    return hot;
  }

  private async cotPhu() {
    const all = await this.catalog.tatCaSanPham();
    return {
      tranDauMoi: await this.tranMoi(5),
      spHot: (await this.sanPhamHot(4)).map(sanPhamView),
      spMoi: all.slice(0, 4).map(sanPhamView),
    };
  }

  async bangTin(q: Record<string, any>) {
    const loai = q.loai && LOAI_TIN[String(q.loai)] ? String(q.loai) : null;
    const keyword = String(q.keyword ?? '').trim();
    const page = Number(q.page) || 1;
    const filter: Record<string, any> = this.daDang();
    if (loai) {
      filter.loaiTin = loai;
    }
    if (keyword) {
      const re = likeRegex(keyword);
      filter.$or = [{ tieuDe: re }, { tomTat: re }, { noiDung: re }];
    }
    let dsNoiBat: any[] = [];
    if (!loai && !keyword && page === 1) {
      dsNoiBat = (await this.tinQuery(this.daDang({ noiBat: true })).sort({ thuTu: 1, ngayDang: -1, _id: -1 }).lean()) as any[];
      if (dsNoiBat.length) {
        filter._id = { $nin: dsNoiBat.map((t) => t._id) };
      }
    }
    const [danhSach, demLoai, luotXem, soTran]: [any[], any[], any[], number] = await Promise.all([
      this.tinQuery(filter).sort({ ngayDang: -1, _id: -1 }).lean() as Promise<any[]>,
      this.tinModel.aggregate([{ $match: this.daDang() }, { $group: { _id: '$loaiTin', so: { $sum: 1 } } }]),
      this.tinModel.aggregate([{ $match: this.daDang() }, { $group: { _id: null, t: { $sum: '$luotXem' } } }]),
      this.tranModel.countDocuments(),
    ]);
    const trang = phanTrang(danhSach, page, 8);
    const dem: Record<string, number> = Object.fromEntries(demLoai.map((x) => [x._id, x.so]));
    return {
      ...trang,
      items: trang.items.map(tinView),
      dsNoiBat: dsNoiBat.map(tinView),
      noiBat: dsNoiBat[0] ? tinView(dsNoiBat[0]) : null,
      loai,
      keyword,
      demLoai: dem,
      tong: {
        tin: Object.values(dem).reduce((a, b) => a + b, 0),
        tran: soTran,
        luotXem: luotXem[0]?.t ?? 0,
      },
      tickerTran: await this.tranMoi(8),
      ...(await this.cotPhu()),
    };
  }

  async chiTietTin(id: string, daXem: boolean) {
    const oid = parseObjectId(id, 'Mã tin');
    const tin: any = await this.tinQuery({ ...this.daDang(), _id: oid })
      .populate('tacGia', 'tenDangNhap')
      .lean();
    if (!tin) {
      throw new NotFoundException('Không tìm thấy bài viết.');
    }
    if (!daXem) {
      await this.tinModel.updateOne({ _id: oid }, { $inc: { luotXem: 1 } });
      tin.luotXem = (tin.luotXem ?? 0) + 1;
    }
    const lienQuan = (await this.tinQuery(this.daDang({ loaiTin: tin.loaiTin, _id: { $ne: oid } }))
      .sort({ ngayDang: -1 })
      .limit(3)
      .lean()) as any[];
    return { tin: tinView(tin), lienQuan: lienQuan.map(tinView), ...(await this.cotPhu()) };
  }
}
