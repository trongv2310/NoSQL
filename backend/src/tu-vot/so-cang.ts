import { PipelineStage, Types } from 'mongoose';
import { LBS_MOI_KG, ThuocTinh } from '../catalog/thuoc-tinh';
import { TOI_DA_CHU_KY_NGAY, TOI_DA_LICH_SU_NHUNG } from '../schemas/vot-ca-nhan.schema';

/**
 * Luật thuần của sổ căng cước (không chạm CSDL, test được). Mọi con số do khách nhập hoặc lấy từ thông số nhà sản xuất có trong kho;
 * không ước lượng độ căng còn lại, không khuyên thay cước.
 */

export type DonViCang = 'kg' | 'lbs';
export const TRAN_NHAP: Record<DonViCang, number> = { kg: 40, lbs: 90 }; // cùng trần với frontend/lib/tu-vot.ts

export const doiSangLbs = (giaTri: number, donVi: DonViCang) => Math.round((donVi === 'kg' ? giaTri * LBS_MOI_KG : giaTri) * 100) / 100;

/** "YYYY-MM-DD" (ngày lịch phía người dùng) → Date lúc 00:00 UTC của ngày đó; ngày không có thật → null. */
export function ngayTuChuoi(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
}

export interface NhapLanCang {
  ngay: string;
  giaTri: number;
  donVi: DonViCang;
  tenDay?: string;
  noiCang: 'shop' | 'ngoai';
}

export interface LanCangDaKiem {
  ngay: Date;
  mucCangLbs: number;
  giaTriNhap: number;
  donViNhap: DonViCang;
  tenDay?: string;
  noiCang: 'shop' | 'ngoai';
}

/**
 * Kiểm một lần căng. `homNay` là ngày UTC 00:00 hôm nay; cho phép lệch +1 ngày vì người dùng ở múi giờ sớm hơn máy chủ.
 * Trả lỗi theo trường (tiếng Việt) để hiện cạnh ô nhập.
 */
export function kiemTraLanCang(n: NhapLanCang, homNay: Date): { ok: true; lan: LanCangDaKiem } | { ok: false; loi: Record<string, string> } {
  const loi: Record<string, string> = {};
  const ngay = ngayTuChuoi(String(n.ngay ?? ''));
  if (!ngay) loi.ngay = 'Ngày căng không hợp lệ.';
  else if (ngay.getTime() > homNay.getTime() + 86_400_000) loi.ngay = 'Ngày căng không thể ở tương lai.';
  else if (ngay.getUTCFullYear() < 2000) loi.ngay = 'Ngày căng quá xa.';
  const dv: DonViCang = n.donVi === 'lbs' ? 'lbs' : 'kg';
  if (!(typeof n.giaTri === 'number' && Number.isFinite(n.giaTri) && n.giaTri > 0)) loi.giaTri = 'Số căng phải là số lớn hơn 0.';
  else if (n.giaTri > TRAN_NHAP[dv]) loi.giaTri = `Số căng quá lớn (tối đa ${TRAN_NHAP[dv]} ${dv}).`;
  else if (doiSangLbs(n.giaTri, dv) < 5) loi.giaTri = 'Số căng quá nhỏ (dưới 5 lbs), kiểm tra lại đơn vị.';
  const tenDay = String(n.tenDay ?? '').trim().replace(/\s+/g, ' ');
  if (tenDay.length > 60) loi.tenDay = 'Tên dây tối đa 60 ký tự.';
  if (n.noiCang !== 'shop' && n.noiCang !== 'ngoai') loi.noiCang = 'Nơi căng không hợp lệ.';
  if (Object.keys(loi).length) return { ok: false, loi };
  return {
    ok: true,
    lan: { ngay: ngay!, mucCangLbs: doiSangLbs(n.giaTri, dv), giaTriNhap: Math.round(n.giaTri * 100) / 100, donViNhap: dv, ...(tenDay ? { tenDay } : {}), noiCang: n.noiCang },
  };
}

export const vuotMucNSX = (mucCangLbs: number, toiDaLbs?: number | null) => typeof toiDaLbs === 'number' && mucCangLbs > toiDaLbs;

/** hanNhacLuc = lanCangGanNhat.ngay + chuKyNhacNgay (ngày); thiếu một trong hai thì XOÁ trường ($$REMOVE) để index sparse không chứa nó. */
const TINH_HAN_NHAC = {
  $set: {
    hanNhacLuc: {
      $cond: [
        { $and: [{ $gt: ['$chuKyNhacNgay', 0] }, { $ne: [{ $type: '$lanCangGanNhat.ngay' }, 'missing'] }] },
        { $dateAdd: { startDate: '$lanCangGanNhat.ngay', unit: 'day', amount: '$chuKyNhacNgay' } },
        '$$REMOVE',
      ],
    },
  },
};

/**
 * Ghi một lần căng vào hộ chiếu bằng MỘT lệnh update dạng pipeline (nguyên tử trên một document):
 * nối vào lichSuCang → sắp theo ngày mới nhất → giữ 10 phần tử ($sortArray + $slice), tăng soLanCang, lấy lần mới nhất làm
 * lanCangGanNhat, rồi tính lại hanNhacLuc. Ghi một lần căng CŨ hơn lần gần nhất thì lanCangGanNhat không bị lùi.
 * `$literal` để giá trị người dùng nhập (tên dây bắt đầu bằng "$"...) không bị hiểu thành tên trường.
 */
export function pipelineGhiLanCang(nhung: LanCangDaKiem & { _id: Types.ObjectId; vuotMucNSX: boolean }): PipelineStage[] {
  return [
    {
      $set: {
        lichSuCang: {
          $slice: [
            { $sortArray: { input: { $concatArrays: [{ $ifNull: ['$lichSuCang', []] }, [{ $literal: nhung }]] }, sortBy: { ngay: -1, _id: -1 } } },
            TOI_DA_LICH_SU_NHUNG,
          ],
        },
        soLanCang: { $add: [{ $ifNull: ['$soLanCang', 0] }, 1] },
      },
    },
    { $set: { lanCangGanNhat: { $first: '$lichSuCang' } } },
    TINH_HAN_NHAC,
  ] as PipelineStage[];
}

/** Đổi chu kỳ nhắc (null = tắt nhắc) và tính lại hạn nhắc trong cùng lệnh. */
export function pipelineDoiChuKy(chuKy: number | null): PipelineStage[] {
  if (chuKy !== null && !(Number.isInteger(chuKy) && chuKy >= 1 && chuKy <= TOI_DA_CHU_KY_NGAY)) throw new Error('Chu kỳ nhắc không hợp lệ');
  return [{ $set: { chuKyNhacNgay: chuKy === null ? '$$REMOVE' : { $literal: chuKy } } }, TINH_HAN_NHAC] as PipelineStage[];
}

/** Lấy khoảng căng và trọng lượng U của phiên bản để lưu vào hộ chiếu. */
export function thongSoChupTuThuocTinh(tt?: ThuocTinh[] | null): { sucCangMinLbs?: number; sucCangMaxLbs?: number; trongLuongU?: number } | undefined {
  const lay = (k: string) => (tt ?? []).find((t) => t.k === k && typeof t.v === 'number')?.v as number | undefined;
  const r = { sucCangMinLbs: lay('sucCangMinLbs'), sucCangMaxLbs: lay('sucCangMaxLbs'), trongLuongU: lay('trongLuongU') };
  const gon = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined));
  return Object.keys(gon).length ? gon : undefined;
}
