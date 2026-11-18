import { PipelineStage, Types } from 'mongoose';
import { LOI_CHOI, NOI_DUNG, TRINH_DO } from '../common/ho-so-choi';

/**
 * "Người chơi giống bạn nói gì": gom đánh giá của MỘT sản phẩm theo bản chụp hồ sơ người viết (phanhois.nguoiDanh), bằng MỘT lệnh
 * aggregate có $facet (nhiều nhánh thống kê chạy trên cùng tập đánh giá đã $match, thay vì 4–5 truy vấn riêng).
 *
 * Trung thực với dữ liệu: nhóm "giống bạn" dưới NGUONG_TOI_THIEU đánh giá thì trả `chuaDuDuLieu` kèm số lượng, không đưa ra
 * một điểm trung bình dựa trên một hai người.
 */
export const NGUONG_TOI_THIEU = 3;

export interface NguoiDanh {
  trinhDo?: string;
  noiDung?: string[];
  loiChoi?: string;
  chanThuong?: string[];
}

/** Bản chụp hồ sơ lúc viết. Không đồng ý chia sẻ → không chụp gì; chấn thương cần đồng ý riêng. Hồ sơ trống → undefined. */
export function chupNguoiDanh(
  hoSo: NguoiDanh | null | undefined,
  dongY: { chiaSeHoSo: boolean; chiaSeChanThuong: boolean },
): NguoiDanh | undefined {
  if (!hoSo || !dongY.chiaSeHoSo) return undefined;
  const r: NguoiDanh = {};
  if (hoSo.trinhDo) r.trinhDo = hoSo.trinhDo;
  if (hoSo.noiDung?.length) r.noiDung = [...hoSo.noiDung];
  if (hoSo.loiChoi) r.loiChoi = hoSo.loiChoi;
  if (dongY.chiaSeChanThuong && hoSo.chanThuong?.length) r.chanThuong = [...hoSo.chanThuong];
  return Object.keys(r).length ? r : undefined;
}

export interface NhomNguoiChoi {
  trinhDo: string;
  noiDung: string[];
}

/** Đọc nhóm từ query (`trinhDo`, `noiDung` = "don,doi"). Không có trình độ hợp lệ → null (không có nhánh "giống bạn"). */
export function nhomTuQuery(q: Record<string, unknown>): NhomNguoiChoi | null {
  const trinhDo = String(q.trinhDo ?? '');
  if (!(TRINH_DO as readonly string[]).includes(trinhDo)) return null;
  const noiDung = String(q.noiDung ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x, i, a) => (NOI_DUNG as readonly string[]).includes(x) && a.indexOf(x) === i);
  return { trinhDo, noiDung };
}

/** Cùng trình độ; nếu người xem có khai nội dung đánh thì người viết phải có ít nhất một nội dung chung ($in trên mảng). */
export function dieuKienNhom(n: NhomNguoiChoi): Record<string, unknown> {
  return { 'nguoiDanh.trinhDo': n.trinhDo, ...(n.noiDung.length ? { 'nguoiDanh.noiDung': { $in: n.noiDung } } : {}) };
}

const TONG = { _id: null, tb: { $avg: '$danhGia' }, so: { $sum: 1 } };
const THE_NOI_BAT = (n: number) => [{ $unwind: '$the' }, { $group: { _id: '$the', so: { $sum: 1 } } }, { $sort: { so: -1, _id: 1 } }, { $limit: n }];

export function pipelineDanhGia(sanPham: Types.ObjectId, nhom: NhomNguoiChoi | null, locCongKhai: Record<string, unknown>): PipelineStage[] {
  const facet: Record<string, unknown[]> = {
    tatCa: [{ $group: TONG }],
    phanBoSao: [{ $group: { _id: '$danhGia', so: { $sum: 1 } } }],
    theNoiBat: THE_NOI_BAT(5),
    // Điểm theo từng trình độ người viết (chỉ đánh giá có chia sẻ hồ sơ).
    theoTrinhDo: [{ $match: { 'nguoiDanh.trinhDo': { $exists: true } } }, { $group: { _id: '$nguoiDanh.trinhDo', tb: { $avg: '$danhGia' }, so: { $sum: 1 } } }],
    daMuaHang: [{ $match: { daMuaHang: true } }, { $count: 'so' }],
    duLieuMau: [{ $match: { laDuLieuMau: true } }, { $count: 'so' }],
  };
  if (nhom) {
    facet.giongBan = [{ $match: dieuKienNhom(nhom) }, { $group: TONG }];
    facet.theGiongBan = [{ $match: dieuKienNhom(nhom) }, ...THE_NOI_BAT(3)];
  }
  return [{ $match: { sanPham, ...locCongKhai } }, { $facet: facet }] as PipelineStage[];
}

const lamTron = (x: number) => Math.round(x * 10) / 10;

export interface KetQuaDanhGiaNhom {
  tatCa: { trungBinh: number | null; so: number };
  phanBoSao: Record<1 | 2 | 3 | 4 | 5, number>;
  theNoiBat: { the: string; so: number }[];
  theoTrinhDo: { trinhDo: string; trungBinh: number; so: number }[];
  soDaMuaHang: number;
  giongBan: null | { nhom: NhomNguoiChoi; chuaDuDuLieu: true; so: number; canToiThieu: number } | { nhom: NhomNguoiChoi; chuaDuDuLieu: false; trungBinh: number; so: number; theNoiBat: { the: string; so: number }[] };
  coDuLieuMau: boolean;
}

/** Kết quả $facet (mỗi nhánh là một mảng) → dạng gọn cho giao diện; áp ngưỡng tối thiểu cho nhóm "giống bạn". */
export function ketQuaDanhGia(f: Record<string, any[]>, nhom: NhomNguoiChoi | null): KetQuaDanhGiaNhom {
  const tong = f.tatCa?.[0];
  const phanBoSao = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as KetQuaDanhGiaNhom['phanBoSao'];
  for (const x of f.phanBoSao ?? []) if (x._id >= 1 && x._id <= 5) phanBoSao[x._id as 1] = x.so;
  const the = (ds: any[] = []) => ds.map((x) => ({ the: String(x._id), so: x.so }));
  let giongBan: KetQuaDanhGiaNhom['giongBan'] = null;
  if (nhom) {
    const g = f.giongBan?.[0];
    const so = g?.so ?? 0;
    giongBan = so < NGUONG_TOI_THIEU
      ? { nhom, chuaDuDuLieu: true, so, canToiThieu: NGUONG_TOI_THIEU }
      : { nhom, chuaDuDuLieu: false, trungBinh: lamTron(g.tb), so, theNoiBat: the(f.theGiongBan) };
  }
  return {
    tatCa: { trungBinh: tong ? lamTron(tong.tb) : null, so: tong?.so ?? 0 },
    phanBoSao,
    theNoiBat: the(f.theNoiBat),
    theoTrinhDo: (f.theoTrinhDo ?? [])
      .map((x) => ({ trinhDo: String(x._id), trungBinh: lamTron(x.tb), so: x.so }))
      .sort((a, b) => TRINH_DO.indexOf(a.trinhDo as never) - TRINH_DO.indexOf(b.trinhDo as never)),
    soDaMuaHang: f.daMuaHang?.[0]?.so ?? 0,
    giongBan,
    coDuLieuMau: (f.duLieuMau?.[0]?.so ?? 0) > 0,
  };
}

/** Phần bản chụp được phép trả ở API công khai: KHÔNG có chanThuong. */
export function nguoiDanhCongKhai(n?: NguoiDanh | null): Omit<NguoiDanh, 'chanThuong'> | null {
  if (!n) return null;
  const r: Omit<NguoiDanh, 'chanThuong'> = {};
  if (n.trinhDo) r.trinhDo = n.trinhDo;
  if (n.noiDung?.length) r.noiDung = n.noiDung;
  if (n.loiChoi && (LOI_CHOI as readonly string[]).includes(n.loiChoi)) r.loiChoi = n.loiChoi;
  return Object.keys(r).length ? r : null;
}

