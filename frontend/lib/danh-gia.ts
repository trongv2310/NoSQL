/**
 * Nhãn cho đánh giá có ngữ cảnh người chơi (khớp khoá với backend: common/danh-gia.ts, common/ho-so-choi.ts).
 * Luật thuần, không phụ thuộc React để kiểm thử được bằng `node --test`.
 */
import type { LoiChoiKhoa, TrinhDoKhoa } from "./ho-so-choi";

// Chép lại nhãn (cùng nội dung với lib/ho-so-choi.ts) vì `node --test` chạy file .ts trực tiếp, chỉ import kiểu được giữa các file lib.
const NHAN_TRINH_DO: Record<TrinhDoKhoa, string> = { moi: "Mới chơi", deu: "Chơi đều", thi: "Thi đấu" };
const NHAN_LOI_CHOI: Record<LoiChoiKhoa, string> = { cong: "Uy lực", toc: "Tốc độ", toan: "Kiểm soát" };

export const NHAN_THE: Record<string, string> = {
  "dap-uy-luc": "Đập uy lực",
  "phan-tat-nhanh": "Phản tạt nhanh",
  "de-dieu-khien": "Dễ điều khiển",
  "nang-tay": "Nặng tay",
  "rung-tay": "Rung tay",
  "em-tay": "Êm tay",
  ben: "Bền",
  "dung-size": "Đúng size",
};
export const CAC_THE = Object.keys(NHAN_THE);
export const NHAN_NOI_DUNG: Record<string, string> = { don: "đánh đơn", doi: "đánh đôi" };

export interface NguoiDanhCongKhai { trinhDo?: TrinhDoKhoa; noiDung?: string[]; loiChoi?: LoiChoiKhoa }

/** "Chơi đều · đánh đôi · Tốc độ" — chỉ ghép những gì người viết đã chia sẻ. */
export function nhanNguoiDanh(n?: NguoiDanhCongKhai | null): string | null {
  if (!n) return null;
  const phan = [
    n.trinhDo && NHAN_TRINH_DO[n.trinhDo],
    n.noiDung?.length ? n.noiDung.map((x) => NHAN_NOI_DUNG[x] ?? x).join(", ") : null,
    n.loiChoi && NHAN_LOI_CHOI[n.loiChoi],
  ].filter((x): x is string => !!x);
  return phan.length ? phan.join(" · ") : null;
}

/** Tham số truy vấn nhóm "giống bạn" từ hồ sơ (ưu tiên hồ sơ tài khoản, không có thì trình độ ở Quầy tư vấn). */
export function thamSoNhom(taiKhoan: { trinhDo?: string; noiDung?: string[] } | null, quayKn: string | null): string {
  const trinhDo = taiKhoan?.trinhDo ?? quayKn;
  if (!trinhDo) return "";
  const q = new URLSearchParams({ trinhDo });
  const noiDung = taiKhoan?.trinhDo ? taiKhoan.noiDung ?? [] : [];
  if (noiDung.length) q.set("noiDung", noiDung.join(","));
  return `?${q.toString()}`;
}
