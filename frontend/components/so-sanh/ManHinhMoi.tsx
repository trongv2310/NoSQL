import Link from "next/link";
import { fontTieuDe } from "@/components/landing/fonts";
import { ProductImage } from "@/components/landing/ProductImage";
import { vnd } from "@/lib/format";
import { duongDanSoSanh, type MucSoSanh } from "@/lib/so-sanh";
import type { CapGoiY, UngVienSoSanh } from "@/lib/so-sanh-bieu-do";
import { tenNganVot } from "@/lib/so-sanh-du-lieu";
import s from "./so-sanh.module.css";

function VotMini({ v, anh }: { v: UngVienSoSanh; anh?: string }) {
  return (
    <div className={s.capVot}>
      <span className={s.capAnh}><ProductImage src={anh} alt="" sizes="140px" hoaNen /></span>
      <span className={s.capTen}>{tenNganVot(v.ten)}</span>
      <b className={`${s.capGia} ${fontTieuDe.className}`}>{vnd(v.gia)}</b>
    </div>
  );
}

/**
 * Gợi ý vài cặp vợt thật còn hàng để so ngay khi chưa đủ 2 vợt. Chỉ chọn cặp mà thông số ghi trong kho có chỗ khác nhau;
 * đây là cách xem khác biệt, không phải khuyến nghị mua. Có 1 vợt đã chọn thì mỗi cặp là vợt đó + một vợt khác.
 */
export function ManHinhMoi({ muc, goiY, dangTai, loi, daChon, anhCua }: {
  muc: MucSoSanh[]; goiY: CapGoiY[]; dangTai: boolean; loi: boolean; daChon: UngVienSoSanh | null; anhCua: Map<string, string | undefined>;
}) {
  const dung = daChon?.id ?? null;
  if (!goiY.length) {
    if (loi || !dangTai) return null;
    return <p className={s.ghiTrong} role="status">Đang tìm vài cặp vợt để gợi ý…</p>;
  }
  return (
    <section className={s.goiY} aria-labelledby="goi-y-tieu-de">
      <h2 id="goi-y-tieu-de" className={s.khoiTen}>{dung ? `So ${tenNganVot(daChon!.ten)} với…` : "Hoặc so ngay một cặp"}</h2>
      <ul className={s.dsCap}>
        {goiY.map((c) => {
          const cap: MucSoSanh[] = dung ? [muc[0], { sanPhamId: c.b.id, bienTheId: null }] : [{ sanPhamId: c.a.id, bienTheId: null }, { sanPhamId: c.b.id, bienTheId: null }];
          return (
            <li key={`${c.a.id}-${c.b.id}`}>
              <Link className={s.cap} href={duongDanSoSanh(cap)} aria-label={`So sánh ${c.a.ten} với ${c.b.ten}`}>
                <span className={s.capHai}>
                  <VotMini v={c.a} anh={anhCua.get(c.a.id)} />
                  <span className={s.capGiua} aria-hidden="true">vs</span>
                  <VotMini v={c.b} anh={anhCua.get(c.b.id)} />
                </span>
                <span className={s.capKhac}>Khác ở {c.khacNhau.join(", ")}</span>
                <span className={s.capNut}>So sánh cặp này<i className="fa-solid fa-arrow-right" aria-hidden="true" /></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
