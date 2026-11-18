import type { HoSoDoiChieu } from "@/lib/so-sanh";
import type { BienTheV, SanPhamV } from "@/lib/types";
import s from "./so-sanh.module.css";

export interface ChiTietNgan { sanPhamId?: string; sanPham: SanPhamV; bienThes: BienTheV[] }

/** Một cột (một vợt) của trang so sánh, theo trạng thái tải. `i` là vị trí trong URL, quyết định màu/hình nhận biết của vợt. */
export type Cot =
  | { m: { sanPhamId: string; bienTheId: string | null }; i: number; trangThai: "dang" }
  | { m: { sanPhamId: string; bienTheId: string | null }; i: number; trangThai: "loi"; thongBao: string }
  | { m: { sanPhamId: string; bienTheId: string | null }; i: number; trangThai: "bien-the-sai"; ct: ChiTietNgan }
  | { m: { sanPhamId: string; bienTheId: string | null }; i: number; trangThai: "ok"; ct: ChiTietNgan; bien: BienTheV; hs: HoSoDoiChieu };
export type CotOk = Extract<Cot, { trangThai: "ok" }>;

/** Vợt đã vào biểu đồ: `i` = màu/hình, `ten` = tên đầy đủ, `ngan` = tên rút gọn cho nhãn. */
export interface VotBieuDo { i: number; ten: string; ngan: string }

/** Nét vẽ của đa giác theo vợt: liền, đứt, chấm-gạch (để phân biệt không chỉ bằng màu). */
export const NET_VE = ["none", "8 5", "2 4 9 4"] as const;
export const nhanVot = (i: number) => `Vợt ${i + 1}`;

/** Dấu nhận biết: tròn (vợt 1), vuông (vợt 2), thoi (vợt 3), cùng màu của vợt. */
export function DauVot({ i, lon = false }: { i: number; lon?: boolean }) {
  return <span className={`${s.dau} ${s[`h${i % 3}`]} ${s[`v${i % 3}`]} ${lon ? s.dauLon : ""}`} aria-hidden="true" />;
}

/** Mẫu nét trong chú giải radar. */
export function MauNet({ i }: { i: number }) {
  return (
    <svg className={`${s.mauNet} ${s[`v${i % 3}`]}`} viewBox="0 0 34 10" aria-hidden="true" focusable="false">
      <line x1="1" y1="5" x2="33" y2="5" style={{ stroke: "var(--mau)" }} strokeWidth="3" strokeLinecap="round" strokeDasharray={NET_VE[i % 3]} />
    </svg>
  );
}
