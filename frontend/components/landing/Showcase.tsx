"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { vnd } from "@/lib/format";
import {
  KHOANG_GIA, LOAI, conHang, dangGiam, locTab, phanTramGiam, trongKhoang,
  type KhoaLoai, type SanPhamLanding,
} from "@/lib/landing-data";
import { ghiNhoAnhBam } from "@/lib/morph";
import { useCatalog } from "./CatalogProvider";
import { fontTieuDe } from "./fonts";
import { docLuaChon, ghiLuaChon } from "./luu-lua-chon";
import { ProductImage } from "./ProductImage";
import { RvHeading } from "./Words";
import s from "./showcase.module.css";

type Tab = KhoaLoai | "giam";
const SO_O = 8; // số sản phẩm hiển thị ban đầu mỗi tab (đủ hai hàng ở bốn cột)

function The({ sp }: { sp: SanPhamLanding }) {
  const pt = phanTramGiam(sp);
  const het = !conHang(sp);
  const conIt = !het && sp.tongTonKho <= 5;
  return (
    <article className={s.card}>
      <div className={s.media}>
        <ProductImage src={sp.hinhAnhDaiDien} alt="" sizes="(max-width: 767px) 46vw, (max-width: 1199px) 30vw, 22vw" className={s.img} />
        {pt > 0 && <span className={s.badgeSale}>-{pt}%</span>}
        {het && <span className={s.badgeOut}>Hết hàng</span>}
        {conIt && <span className={s.badgeLow}>Còn {sp.tongTonKho}</span>}
      </div>
      <div className={s.body}>
        <span className={s.brand}>{sp.hang?.tenHang ?? "Hãng khác"}</span>
        <Link href={`/Home/ChiTietSanPham/${sp.id}`} className={s.name}
          onClick={(e) => ghiNhoAnhBam(sp.id, e.currentTarget.closest("article")?.querySelector("img") ?? null)}>
          {sp.tenSanPham}
        </Link>
        <span className={s.priceRow}>
          <b className={s.price}>{vnd(sp.giaSauKhuyenMai)}</b>
          {dangGiam(sp) && <s className={s.old}>{vnd(sp.giaGoc)}</s>}
        </span>
        <span className={s.more}>Xem chi tiết <span aria-hidden="true">→</span></span>
      </div>
    </article>
  );
}

/** Khu sản phẩm gom thành một chỗ: tab theo danh mục (hoặc ưu đãi thật) + lọc ngân sách. Chiều cao giữ ổn định khi đổi tab. */
export function Showcase() {
  const kho = useCatalog();
  const [tab, setTab] = useState<Tab>("giam");
  const [khoang, setKhoang] = useState<string | null>(null);
  const dsTab = useRef<(HTMLButtonElement | null)[]>([]);
  const thanhTab = useRef<HTMLDivElement>(null);
  const vach = useRef<HTMLSpanElement>(null);

  const tabs = useMemo(() => {
    const t: { khoa: Tab; nhan: string; n: number }[] = [
      { khoa: "giam", nhan: "Đang giảm giá", n: kho.items.filter(dangGiam).length },
      ...(Object.keys(LOAI) as KhoaLoai[]).map((k) => ({ khoa: k as Tab, nhan: LOAI[k].tenNgan, n: locTab(kho.items, k, null).length })),
    ];
    return t.filter((x) => x.n > 0 || kho.trangThai !== "ok");
  }, [kho.items, kho.trangThai]);
  const [daKhoiPhuc, setDaKhoiPhuc] = useState(false);
  // Khôi phục tab/ngân sách đã chọn khi quay lại từ trang chi tiết (đọc sau hydrate để không lệch HTML của server).
  useEffect(() => {
    const r = docLuaChon<{ tab: Tab; khoang: string | null }>("landing:showcase");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (r) { setTab(r.tab); setKhoang(r.khoang); }
    setDaKhoiPhuc(true);
  }, []);
  useEffect(() => { if (daKhoiPhuc) ghiLuaChon("landing:showcase", { tab, khoang }); }, [daKhoiPhuc, tab, khoang]);
  const tabHienTai = tabs.some((t) => t.khoa === tab) ? tab : (tabs[0]?.khoa ?? "vot");

  // Chỉ hiện các mức giá có sản phẩm (chuỗi mức giá không đổi khi đổi tab; mức không có hàng ở tab hiện tại bị làm mờ).
  const mucGia = useMemo(() => KHOANG_GIA.filter((k) => kho.items.some((sp) => trongKhoang(sp.giaSauKhuyenMai, k))), [kho.items]);
  const k = KHOANG_GIA.find((x) => x.khoa === khoang) ?? null;
  const tatCa = useMemo(() => locTab(kho.items, tabHienTai, k), [kho.items, tabHienTai, k]);
  const hienThi = tatCa.slice(0, SO_O);

  // Vạch tab trượt tới tab đang chọn (đo bằng JS, chỉ ghi biến CSS/transform; chưa đo được thì tab tự có gạch chân).
  useEffect(() => {
    const dat = () => {
      const i = tabs.findIndex((t) => t.khoa === tabHienTai);
      const nut = dsTab.current[i];
      const v = vach.current;
      if (!nut || !v) return;
      v.style.width = `${nut.offsetWidth}px`;
      v.style.transform = `translateX(${nut.offsetLeft}px)`;
      v.dataset.ready = "1";
    };
    dat();
    const ro = new ResizeObserver(dat);
    if (thanhTab.current) ro.observe(thanhTab.current);
    return () => ro.disconnect();
  }, [tabs, tabHienTai]);

  const phimTab = (e: React.KeyboardEvent, i: number) => {
    const sang = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (sang === null) return;
    e.preventDefault();
    const j = (sang + tabs.length) % tabs.length;
    setTab(tabs[j].khoa);
    dsTab.current[j]?.focus();
  };

  const lienKetTatCa = tabHienTai === "giam" ? "/KhuyenMai/Index" : `/SanPham/Index?loai=${LOAI[tabHienTai].slug}${k ? `&khoang=${k.khoa}` : ""}`;
  const nhanTab = tabs.find((t) => t.khoa === tabHienTai)?.nhan ?? "";

  return (
    <section id="san-pham" className={s.showcase} aria-labelledby="san-pham-title">
      <div className="container">
        <div className={s.head}>
          <RvHeading id="san-pham-title" className={`${s.title} ${fontTieuDe.className}`} text="Sản phẩm đáng xem" />
          <div className={s.budget} role="group" aria-label="Lọc theo ngân sách" data-rv="up">
            <button type="button" className={s.chip} aria-pressed={khoang === null} onClick={() => setKhoang(null)}>Mọi mức giá</button>
            {mucGia.map((m) => {
              const n = locTab(kho.items, tabHienTai, m).length;
              return (
                <button key={m.khoa} type="button" className={s.chip} aria-pressed={khoang === m.khoa} disabled={n === 0 && khoang !== m.khoa}
                  onClick={() => setKhoang(khoang === m.khoa ? null : m.khoa)}>{m.nhan}</button>
              );
            })}
          </div>
        </div>

        <div className={s.tabsWrap} data-rv="up">
          <div className={s.tabs} role="tablist" aria-label="Nhóm sản phẩm" ref={thanhTab}>
            {tabs.map((t, i) => (
              <button key={t.khoa} ref={(el) => { dsTab.current[i] = el; }} type="button" role="tab" id={`tab-${t.khoa}`} aria-selected={tabHienTai === t.khoa}
                aria-controls="panel-san-pham" tabIndex={tabHienTai === t.khoa ? 0 : -1} className={s.tab} onClick={() => setTab(t.khoa)} onKeyDown={(e) => phimTab(e, i)}>
                {t.nhan}{kho.trangThai === "ok" && <span className={s.tabCount}>{t.n}</span>}
              </button>
            ))}
            <span ref={vach} className={s.indicator} aria-hidden="true" />
          </div>
        </div>

        <div id="panel-san-pham" role="tabpanel" aria-labelledby={`tab-${tabHienTai}`} className={s.panel} aria-busy={kho.trangThai === "loading"} data-rv="up">
          {kho.trangThai === "error" ? (
            <div className={s.state} role="alert">
              <p>Chưa tải được danh sách sản phẩm.</p>
              <div className={s.stateActions}>
                <button type="button" className={s.btn} onClick={kho.thuLai}>Thử lại</button>
                <Link href="/SanPham/Index" className={s.btnGhost}>Xem toàn bộ sản phẩm</Link>
              </div>
            </div>
          ) : (
            <>
              <div key={`${tabHienTai}|${khoang}`} className={s.grid}>
                {kho.trangThai === "loading"
                  ? Array.from({ length: SO_O }, (_, i) => (
                      <div key={i} className={`${s.card} ${s.skeleton}`} aria-hidden="true"><div className={s.media} /><div className={s.body} /></div>
                    ))
                  : hienThi.map((sp, i) => <div key={sp.id} className={s.cell} style={{ "--i": i } as React.CSSProperties}><The sp={sp} /></div>)}
                {/* Ô giữ chỗ để lưới luôn đủ hai hàng, tab ít hàng không làm trang co lại. */}
                {kho.trangThai === "ok" && Array.from({ length: Math.max(0, SO_O - hienThi.length) }, (_, i) => (
                  <div key={`g${i}`} className={`${s.card} ${s.ghost}`} aria-hidden="true"><div className={s.media} /><div className={s.body} /></div>
                ))}
                {kho.trangThai === "ok" && hienThi.length === 0 && (
                  <div className={s.empty}>
                    <p>Chưa có sản phẩm {nhanTab.toLocaleLowerCase("vi")} trong mức giá này.</p>
                    <button type="button" className={s.btnGhost} onClick={() => setKhoang(null)}>Xem mọi mức giá</button>
                  </div>
                )}
              </div>
              {kho.trangThai === "ok" && (
                <div className={s.foot}>
                  <span className={s.count} role="status">Hiển thị {hienThi.length} / {tatCa.length} sản phẩm</span>
                  <Link href={lienKetTatCa} className={s.all}>Xem tất cả {nhanTab.toLocaleLowerCase("vi")} <span aria-hidden="true">→</span></Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
