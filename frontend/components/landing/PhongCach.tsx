"use client";

import Link from "next/link";
import { useMemo, useRef, type CSSProperties } from "react";
import {
  NGAN_SACH_VOT, PHONG_CACH, chonNoiBat, lienKetVotTheoGia, votTheoPhongCach,
  type LoiChoi, type SanPhamLanding,
} from "@/lib/landing-data";
import { useCatalog } from "./CatalogProvider";
import { fontTieuDe } from "./fonts";
import { datLoiChoi, datNganSach, usePhongCach } from "./phong-cach-store";
import { ProductCard } from "./ProductCard";
import { SecHead } from "./SecHead";
import s from "./phongcach.module.css";
import c from "./showcase.module.css";

const SO_O = 4;

/** Quỹ đạo minh họa khi chưa có cảnh 3D (không WebGL / thiết bị yếu): ba đường bay trên mặt sân nhìn chéo, đường đã chọn sáng lên. */
const QUY_DAO: Record<LoiChoi, string> = {
  cong: "M150 60 C 250 80 330 190 420 350",
  toc: "M110 270 C 230 235 360 195 500 150",
  toan: "M190 300 C 230 90 330 80 380 245",
};

function SanMinhHoa({ lc }: { lc: LoiChoi | null }) {
  return (
    <svg className={s.court} viewBox="0 0 600 420" aria-hidden="true" focusable="false">
      <g className={s.courtLines}>
        <path d="M150 390 H450 L540 130 H60 Z" />
        <path d="M105 260 H495" />
        <path d="M300 130 V390" />
        <path d="M128 195 H472" />
      </g>
      {PHONG_CACH.map((p) => (
        <path key={`${p.khoa}-${lc === p.khoa ? "on" : "off"}`} d={QUY_DAO[p.khoa]} className={s.shot} data-on={lc === p.khoa ? "1" : lc ? "0" : undefined}
          style={{ "--c": p.mau } as CSSProperties} pathLength={1} />
      ))}
    </svg>
  );
}

/**
 * Khu "chọn lối chơi" ngay sau hero: ba lựa chọn lớn (Uy lực / Tốc độ / Kiểm soát). Chọn xong, lối chơi được ghi lên trang (`data-pc`):
 * cảnh 3D phía sau đổi quỹ đạo cầu và màu nhấn, CSS đổi màu nhấn của các khối, hàng sản phẩm bên dưới đổi thành vợt hợp lối chơi
 * (có lý do ngắn, lọc thêm theo tầm giá). Chưa chọn thì hàng đó là hàng nổi bật (vợt đứng đầu), nên khách vẫn thấy hàng thật và mua được ngay.
 * Bộ chọn vợt bên dưới nhận lối chơi này làm câu trả lời có sẵn.
 */
export function PhongCach() {
  const kho = useCatalog();
  const { lc, ns: nsKhoa } = usePhongCach();
  const ketQua = useRef<HTMLDivElement>(null);
  const pc = PHONG_CACH.find((p) => p.khoa === lc) ?? null;
  const ns = NGAN_SACH_VOT.find((n) => n.khoa === nsKhoa) ?? null;

  const noiBat = useMemo(() => chonNoiBat(kho.items), [kho.items]);
  const goiY = useMemo(() => (lc ? votTheoPhongCach(kho.items, lc, ns, SO_O) : []), [kho.items, lc, ns]);
  const dem = useMemo(
    () => (lc ? [null, ...NGAN_SACH_VOT].map((n) => votTheoPhongCach(kho.items, lc, n, 99).length) : []),
    [kho.items, lc],
  );
  const ds: { sp: SanPhamLanding; lyDo?: string }[] = lc ? goiY.map((g) => ({ sp: g.sp, lyDo: g.lyDo[0] })) : noiBat.map((sp) => ({ sp }));
  const dang = kho.trangThai === "loading";
  const loi = kho.trangThai === "error" || (kho.trangThai === "ok" && ds.length === 0 && !lc);

  /** Chọn một lối chơi (bấm lại để bỏ). Hàng sản phẩm còn nằm ngoài màn hình thì cuộn nhẹ tới để khách thấy ngay phần thưởng. */
  const chon = (k: LoiChoi) => {
    const bo = lc === k;
    datLoiChoi(bo ? null : k);
    if (bo) return;
    window.setTimeout(() => {
      const el = ketQua.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top < window.innerHeight * 0.62) return;
      const header = document.querySelector<HTMLElement>(".main-header");
      const chiemCho = Math.min(header ? header.getBoundingClientRect().height : 96, 110);
      window.scrollTo({ top: Math.max(0, top + window.scrollY - chiemCho - 16), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 520);
  };

  const lienKetTatCa = ns ? lienKetVotTheoGia(ns) : lc ? "/SanPham/Index?loai=Vot" : "/SanPham/Index";

  return (
    <section id="phong-cach" className={s.pc} aria-labelledby="pc-title" data-chon={lc ?? undefined}>
      <div id="pc-chon" className={s.top}>
        <div className={`container ${s.topGrid}`}>
          <div className={s.left}>
            <SecHead label="Lối chơi" tag="Chọn một" />
            <h2 id="pc-title" className={`${s.title} ${fontTieuDe.className}`}>Bạn muốn thắng bằng cách nào?</h2>
            <p className={s.lede} data-rv="up">
              Chọn một lối chơi. Quỹ đạo cầu, màu sắc và nhóm vợt bên dưới đổi theo.
            </p>
            <div className={s.options} role="group" aria-label="Lối chơi" data-rv="up">
              {PHONG_CACH.map((p, i) => (
                <button key={p.khoa} type="button" className={s.option} aria-pressed={lc === p.khoa}
                  style={{ "--c": p.mau } as CSSProperties} onClick={() => chon(p.khoa)}>
                  <span className={`${s.no} ${fontTieuDe.className}`} aria-hidden="true">0{i + 1}</span>
                  <span className={s.optText}>
                    <b className={fontTieuDe.className}>{p.ten}</b>
                    <span>{p.mota}</span>
                    <em>{p.dacTrung}</em>
                  </span>
                  <span className={s.tick} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          <div className={s.window} aria-hidden="true">
            <SanMinhHoa lc={lc} />
          </div>
        </div>
      </div>

      <div ref={ketQua} className={s.reward} aria-busy={dang}>
        <div className="container">
          <div className={s.head}>
            <div>
              <h3 className={`${s.rewardTitle} ${fontTieuDe.className}`}>{pc ? `Vợt hợp lối chơi ${pc.ten}` : "Hàng nổi bật"}</h3>
              <p className={s.sub}>
                {pc
                  ? `${pc.dacTrung}. Gợi ý tham khảo theo thông số ghi trong kho.`
                  : "Chưa biết chọn gì? Chọn một lối chơi ở trên, chúng tôi lọc ra vợt hợp với bạn."}
              </p>
            </div>
            {pc ? (
              <div className={s.budget} role="group" aria-label="Tầm giá">
                {[null, ...NGAN_SACH_VOT].map((n, i) => (
                  <button key={n?.khoa ?? "all"} type="button" className={s.chip} aria-pressed={(n?.khoa ?? null) === (ns?.khoa ?? null)}
                    disabled={dem[i] === 0 && (n?.khoa ?? null) !== (ns?.khoa ?? null)} onClick={() => datNganSach(n?.khoa ?? null)}>
                    {n ? n.nhan : "Mọi tầm giá"}
                  </button>
                ))}
              </div>
            ) : (
              <a href="#tim-vot" className={s.link}>Muốn gợi ý kỹ hơn? <b>Tìm vợt phù hợp <span aria-hidden="true">→</span></b></a>
            )}
          </div>
          <p className={s.vh} role="status" aria-live="polite">
            {pc && kho.trangThai === "ok" ? `Đã chọn lối chơi ${pc.ten}. ${goiY.length} vợt gợi ý.` : ""}
          </p>

          {loi ? (
            <div className={s.state} role="alert">
              <p>Chưa tải được dữ liệu sản phẩm.</p>
              <div className={s.stateActions}>
                <button type="button" className={s.btn} onClick={kho.thuLai}>Thử lại</button>
                <Link href="/SanPham/Index" className={s.btnGhost}>Xem toàn bộ sản phẩm</Link>
              </div>
            </div>
          ) : (
            <div key={`${lc ?? "nb"}-${ns?.khoa ?? "all"}`} className={s.grid} data-k={lc ?? "none"}>
              {dang
                ? Array.from({ length: SO_O }, (_, i) => (
                    <div key={i} className={`${c.card} ${c.skeleton}`} aria-hidden="true"><div className={c.media} /><div className={c.body} /></div>
                  ))
                : ds.length === 0
                  ? (
                    <div className={s.state}>
                      <p>Chưa có vợt hợp lối chơi này trong tầm giá đã chọn.</p>
                      <div className={s.stateActions}><button type="button" className={s.btn} onClick={() => datNganSach(null)}>Xem mọi tầm giá</button></div>
                    </div>
                  )
                  : ds.map((d, i) => (
                    <div key={d.sp.id} className={`${c.cell} ${s.cell}`} style={{ "--i": i } as CSSProperties}>
                      <ProductCard sp={d.sp} lyDo={d.lyDo} />
                    </div>
                  ))}
            </div>
          )}

          <div className={s.foot}>
            <Link href={lienKetTatCa} className={s.all}>
              {lc ? "Xem tất cả vợt" : "Xem tất cả sản phẩm"}{ns ? ` ${ns.nhan.toLocaleLowerCase("vi")}` : ""} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
