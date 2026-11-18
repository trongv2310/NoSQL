import { Types } from 'mongoose';
import { TOI_DA_LICH_SU_NHUNG } from '../schemas/vot-ca-nhan.schema';

/**
 * Sinh DỮ LIỆU MẪU để minh hoạ các truy vấn thống kê (M6). Mọi tài liệu đều gắn `laDuLieuMau: true`; số liệu công khai của cửa hàng
 * KHÔNG tính chúng (common/danh-gia.ts). Đây là dữ liệu GIẢ LẬP theo vài quy tắc đơn giản ghi ngay dưới đây, không phải khảo sát người
 * chơi thật, nên mọi kết luận rút ra từ nó chỉ để minh hoạ cách truy vấn:
 * - mức căng trung bình theo trình độ: mới chơi ~22 lbs, chơi đều ~24,5 lbs, thi đấu ~27 lbs (dao động ±1,5), kẹp trong khoảng nhà
 *   sản xuất của cây vợt; ~4% lần căng "ở ngoài" vượt mức tối đa;
 * - khoảng cách giữa hai lần căng ~ 90 / số buổi chơi mỗi tuần ngày (±30%);
 * - số sao: gốc 4; người mới chấm vợt nặng đầu + cứng thấp hơn 1; lối "tốc độ" thích vợt nhẹ đầu, lối "uy lực" thích vợt nặng đầu (+0,6);
 *   cộng nhiễu rồi làm tròn trong 1..5.
 * Sinh bằng bộ số giả ngẫu nhiên có hạt cố định: chạy lại ra đúng cùng dữ liệu.
 */

export interface PhienBanVot {
  bienThe: Types.ObjectId;
  sanPham: Types.ObjectId;
  ten: string;
  canBangBac?: number;
  doCungBac?: number;
  trongLuongU?: number;
  sucCangMinLbs?: number;
  sucCangMaxLbs?: number;
}

/** Bộ số giả ngẫu nhiên mulberry32: đủ đều cho dữ liệu minh hoạ, cùng hạt → cùng dãy. */
export function taoNgauNhien(hat: number) {
  let a = hat >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const chon = <T,>(ds: readonly T[]): T => ds[Math.floor(r() * ds.length)];
  const chuan = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); // phân phối chuẩn N(0,1)
  return { r, chon, chuan, nguyen: (a1: number, b1: number) => a1 + Math.floor(r() * (b1 - a1 + 1)) };
}

const TEN_DAY = ['BG65', 'BG66 Ultimax', 'BG80', 'Exbolt 63', 'Aerobite', 'No.1', 'VBS-66N'];
const MUC_THEO_TRINH_DO: Record<string, number> = { moi: 22, deu: 24.5, thi: 27 };
const NOI_DUNG_DANH_GIA: Record<string, string> = {
  'dap-uy-luc': 'đập cầu có lực',
  'phan-tat-nhanh': 'phản tạt nhanh',
  'de-dieu-khien': 'dễ điều khiển',
  'nang-tay': 'hơi nặng tay',
  'rung-tay': 'rung tay khi mishit',
  'em-tay': 'cảm giác êm',
  ben: 'khung chắc',
};

const ngayUtc = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const themNgay = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export function sinhDuLieuMau(phienBan: PhienBanVot[], opts: { hat?: number; soNguoi?: number; homNay?: Date } = {}) {
  if (!phienBan.length) throw new Error('Cần ít nhất một phiên bản vợt có thông số.');
  const g = taoNgauNhien(opts.hat ?? 20261118);
  const homNay = ngayUtc(opts.homNay ?? new Date());
  const batDau = themNgay(homNay, -365);
  const khachhangs: any[] = [];
  const votcanhans: any[] = [];
  const lancangs: any[] = [];
  const phanhois: any[] = [];

  for (let i = 1; i <= (opts.soNguoi ?? 40); i++) {
    const x = g.r();
    const trinhDo = x < 0.3 ? 'moi' : x < 0.75 ? 'deu' : 'thi';
    const noiDung = g.r() < 0.25 ? ['don'] : g.r() < 0.5 ? ['don', 'doi'] : ['doi'];
    const loiChoi = g.chon(['cong', 'toc', 'toan'] as const);
    const soBuoi = trinhDo === 'thi' ? g.nguyen(3, 6) : trinhDo === 'deu' ? g.nguyen(2, 4) : g.nguyen(1, 2);
    const kh = {
      _id: new Types.ObjectId(), hoTen: `Người chơi mẫu ${String(i).padStart(2, '0')}`, email: `nguoi-choi-mau-${i}@vidu.test`,
      soDienThoai: '', diaChi: '', ngayTao: batDau, laDuLieuMau: true,
      hoSoChoi: {
        trinhDo, noiDung, loiChoi, tayThuan: g.r() < 0.9 ? 'phai' : 'trai', soBuoiMoiTuan: soBuoi,
        ...(g.r() < 0.15 ? { chanThuong: ['co-tay'] } : {}), capNhatLuc: batDau,
      },
    };
    khachhangs.push(kh);

    // 1–3 cây vợt, mỗi cây một sổ căng trong 12 tháng qua.
    const soVot = g.nguyen(1, 3);
    for (let v = 0; v < soVot; v++) {
      const pb = g.chon(phienBan);
      const chuKy = g.chon([30, 45, 60]);
      const ds: any[] = [];
      let ngay = themNgay(batDau, g.nguyen(0, 60));
      while (ngay <= homNay) {
        const ngoai = g.r() < 0.4;
        let muc = MUC_THEO_TRINH_DO[trinhDo] + g.chuan() * 1.5;
        if (pb.sucCangMinLbs !== undefined) muc = Math.max(muc, pb.sucCangMinLbs);
        if (pb.sucCangMaxLbs !== undefined) muc = Math.min(muc, pb.sucCangMaxLbs);
        if (ngoai && pb.sucCangMaxLbs !== undefined && g.r() < 0.1) muc = pb.sucCangMaxLbs + g.nguyen(1, 2); // ~4% vượt mức NSX
        muc = Math.round(muc * 2) / 2;
        const theoKg = g.r() < 0.5;
        ds.push({
          _id: new Types.ObjectId(), ngay, mucCangLbs: muc,
          giaTriNhap: theoKg ? Math.round((muc / 2.20462262) * 10) / 10 : muc, donViNhap: theoKg ? 'kg' : 'lbs',
          tenDay: g.chon(TEN_DAY), noiCang: ngoai ? 'ngoai' : 'shop',
          vuotMucNSX: pb.sucCangMaxLbs !== undefined && muc > pb.sucCangMaxLbs,
        });
        ngay = themNgay(ngay, Math.max(7, Math.round((90 / soBuoi) * (0.7 + g.r() * 0.6))));
      }
      const votId = new Types.ObjectId();
      for (const l of ds) lancangs.push({ ...l, votCaNhan: votId, khachHang: kh._id, nguoiDanhChup: { trinhDo, loiChoi }, laDuLieuMau: true, taoLuc: l.ngay });
      const nhung = [...ds].sort((a, b) => b.ngay - a.ngay).slice(0, TOI_DA_LICH_SU_NHUNG);
      const ganNhat = nhung[0];
      votcanhans.push({
        _id: votId, khachHang: kh._id, nguon: 'tu-nhap', sanPham: pb.sanPham, bienThe: pb.bienThe, ten: pb.ten,
        thongSoChup: Object.fromEntries(Object.entries({ sucCangMinLbs: pb.sucCangMinLbs, sucCangMaxLbs: pb.sucCangMaxLbs, trongLuongU: pb.trongLuongU }).filter(([, x]) => x !== undefined)),
        chuKyNhacNgay: chuKy, soLanCang: ds.length, lichSuCang: nhung,
        ...(ganNhat ? { lanCangGanNhat: ganNhat, hanNhacLuc: themNgay(ganNhat.ngay, chuKy) } : {}),
        ghiChu: '', taoLuc: batDau, deletedAt: null, laDuLieuMau: true,
      });
    }

    // 3–6 đánh giá cho các sản phẩm vợt khác nhau.
    const daChon = new Set<string>();
    for (let k = g.nguyen(3, 6); k > 0; k--) {
      const pb = g.chon(phienBan);
      if (daChon.has(String(pb.sanPham))) continue;
      daChon.add(String(pb.sanPham));
      const cb = pb.canBangBac ?? 0;
      const dc = pb.doCungBac ?? 1;
      let diem = 4 + g.chuan() * 0.7;
      if (trinhDo === 'moi' && cb >= 2 && dc >= 2) diem -= 1;
      if (loiChoi === 'toc' && cb < 0) diem += 0.6;
      if (loiChoi === 'cong' && cb >= 1) diem += 0.6;
      if (loiChoi === 'toc' && cb >= 2) diem -= 0.5;
      const danhGia = Math.min(5, Math.max(1, Math.round(diem)));
      const the = [
        cb >= 2 && dc >= 2 ? 'dap-uy-luc' : null, cb < 0 ? 'phan-tat-nhanh' : null, cb === 0 ? 'de-dieu-khien' : null,
        cb >= 2 && trinhDo === 'moi' ? 'nang-tay' : null, dc >= 3 && g.r() < 0.5 ? 'rung-tay' : null, dc <= 1 && g.r() < 0.5 ? 'em-tay' : null,
        g.r() < 0.2 ? 'ben' : null,
      ].filter((t): t is string => !!t);
      phanhois.push({
        _id: new Types.ObjectId(), sanPham: pb.sanPham, bienThe: pb.bienThe, khachHang: kh._id, danhGia,
        noiDung: `[Mẫu] ${the.length ? the.map((t) => NOI_DUNG_DANH_GIA[t] ?? t).join(', ') : 'dùng ổn'}.`.slice(0, 255),
        ngayPhanHoi: themNgay(batDau, g.nguyen(30, 360)), daXacMinh: true, daMuaHang: g.r() < 0.5,
        nguoiDanh: { trinhDo, noiDung, loiChoi }, ...(the.length ? { the } : {}), soHuuIch: 0, laDuLieuMau: true,
      });
    }
  }
  return { khachhangs, votcanhans, lancangs, phanhois };
}
