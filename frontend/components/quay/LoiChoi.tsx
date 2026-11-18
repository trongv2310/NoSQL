"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { datHoSo, useHoSo } from "@/components/HoSoChoi";
import { useCatalog } from "@/components/landing/CatalogProvider";
import { fontTieuDe } from "@/components/landing/fonts";
import { DnaVot } from "@/components/product/DnaVot";
import { vnd } from "@/lib/format";
import { PHONG_CACH, phanTramGiam, soVotTheoLoiChoi, votHopLoiChoi, type LoiChoi as KhoaLoiChoi } from "@/lib/landing-data";
import { DuLieuKhu, Khu } from "./KhuChung";
import { lienKetVotTheoHoSo } from "./QuayTuVan";
import s from "./loi-choi.module.css";

/** Điều kiện thông số mà shop dùng để xếp một vợt vào lối chơi (cùng quy tắc với bộ chọn và với bộ lọc `loi_choi` của danh sách). */
const QUY_TAC: Record<KhoaLoiChoi, string> = {
  cong: "Vợt nặng đầu (từ mức \"hơi nặng đầu\" trở lên) và có ghi độ cứng.",
  toc: "Vợt nhẹ đầu và có ghi độ cứng.",
  toan: "Vợt cân bằng hoặc hơi nặng đầu và có ghi độ cứng.",
};

/**
 * Khu "Chọn vợt theo lối chơi": chọn một trong ba lối chơi, xem Racket DNA của một cây vợt thật hợp lối chơi đó (chấm cân bằng, độ cứng thân tính từ chữ
 * ghi trong kho) và danh sách vài cây còn hàng. Số vợt hợp là số đếm thật. Lối chơi ở đây chỉ để xem; nút "Dùng ở Quầy tư vấn" mới ghi vào hồ sơ người chơi.
 */
export function LoiChoi() {
  const kho = useCatalog();
  const hs = useHoSo();
  const [chonLc, setChonLc] = useState<KhoaLoiChoi | null>(null);
  const [chonVot, setChonVot] = useState<string | null>(null);
  const lc = chonLc ?? hs.lc ?? "cong";
  const dem = useMemo(() => soVotTheoLoiChoi(kho.items), [kho.items]);
  const ds = useMemo(() => votHopLoiChoi(kho.items, lc, 4), [kho.items, lc]);
  const pc = PHONG_CACH.find((p) => p.khoa === lc)!;
  const dangXem = ds.find((x) => x.sp.id === chonVot) ?? ds[0] ?? null;

  const dungOQuay = () => {
    datHoSo({ lc });
    document.getElementById("quay-tu-van")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return (
    <Khu id="loi-choi" kicker="Theo lối chơi" tieuDe="Chọn vợt theo lối chơi" moTa="Chọn một lối chơi để xem vợt còn hàng hợp lối đó. Shop xếp vợt vào lối chơi bằng thông số ghi trong kho, không bằng cảm tính.">
      <div className={`${s.tab} sf-reveal`} role="group" aria-label="Lối chơi">
        {PHONG_CACH.map((p) => (
          <button key={p.khoa} type="button" className={s.tabNut} aria-pressed={lc === p.khoa} onClick={() => { setChonLc(p.khoa); setChonVot(null); }}>
            <b className={fontTieuDe.className}>{p.ten}</b>
            <span>{p.mota}</span>
            {kho.trangThai === "ok" && <em>{dem[p.khoa]} vợt còn hàng</em>}
          </button>
        ))}
      </div>

      <DuLieuKhu cho={<div className={s.cho} aria-hidden="true" />}>
        {() => (
          <div className={s.bang} aria-live="polite">
            <div className={`${s.dna} sf-reveal`}>
              <p className={s.dnaDau}>Racket DNA {dangXem && <span>· {dangXem.sp.tenSanPham.replace(/^Vợt Cầu Lông\s+/i, "")}</span>}</p>
              {dangXem ? (
                <DnaVot key={dangXem.sp.id} ts={dangXem.sp.thongSoVot} nhanPhienBan={dangXem.sp.tenSanPham} />
              ) : (
                <p className={s.trong}>Hiện chưa có vợt còn hàng kèm thông số hợp lối chơi này.</p>
              )}
              <p className={s.quyTac}><b>Shop xếp vào lối {pc.ten}:</b> {QUY_TAC[lc]}</p>
            </div>

            <div className={s.ds}>
              <h3 className={s.dsTieuDe}>Vợt còn hàng hợp lối {pc.ten}</h3>
              {ds.length > 0 ? (
                <ol className={s.hang}>
                  {ds.map((x, i) => {
                    const pt = phanTramGiam(x.sp);
                    const dang = dangXem?.sp.id === x.sp.id;
                    return (
                      <li key={x.sp.id} className={`${s.dong} ${dang ? s.dongDang : ""} sf-reveal`}>
                        <span className={`${s.stt} ${fontTieuDe.className}`} aria-hidden="true">{i + 1}</span>
                        <div className={s.dongThan}>
                          <span className={s.dongHang}>{x.sp.hang?.tenHang ?? "Hãng khác"}</span>
                          <Link href={`/Home/ChiTietSanPham/${x.sp.id}`} className={s.dongTen}>{x.sp.tenSanPham}</Link>
                          <span className={s.dongThongSo}>{x.thongSo.join(" · ")}</span>
                        </div>
                        <div className={s.dongGia}>
                          <b className={fontTieuDe.className}>{vnd(x.sp.giaSauKhuyenMai)}</b>
                          {pt > 0 && <span className={s.giam}>-{pt}%</span>}
                        </div>
                        <button type="button" className={s.xemDna} aria-pressed={dang} onClick={() => setChonVot(x.sp.id)}>{dang ? "Đang xem DNA" : "Xem DNA"}<span className="visually-hidden"> của {x.sp.tenSanPham}</span></button>
                      </li>
                    );
                  })}
                </ol>
              ) : <p className={s.trong}>Chưa có vợt còn hàng hợp lối chơi này. Thử lối chơi khác hoặc hỏi người bán.</p>}
              <div className={s.chan}>
                <button type="button" className={s.nutChinh} onClick={dungOQuay}>Dùng lối {pc.ten} ở Quầy tư vấn</button>
                <Link href={lienKetVotTheoHoSo({ lc, ns: null })} className={s.tatCa}>Xem tất cả vợt hợp lối {pc.ten} <span aria-hidden="true">→</span></Link>
              </div>
            </div>
          </div>
        )}
      </DuLieuKhu>
    </Khu>
  );
}
