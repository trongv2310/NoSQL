"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useCatalog } from "@/components/landing/CatalogProvider";
import { fontTieuDe } from "@/components/landing/fonts";
import { ProductCard } from "@/components/product/ProductCard";
import { ngay, vnd } from "@/lib/format";
import { LOAI, chonKhuyenMai, chonTheoLoai, conNhieuHang, demTheoLoai, khuyenMaiConHang, laVot, type KhoaLoai } from "@/lib/landing-data";
import { DuLieuKhu, Khu } from "./KhuChung";
import s from "./khuyen-mai.module.css";

/**
 * Khu khuyến mãi: chỉ sản phẩm thật sự đang giảm và còn hàng (giảm nhiều trước), kèm các chương trình đang áp dụng (tên, mức giảm thực tế cao nhất,
 * ngày kết thúc, số sản phẩm) gộp từ chính dữ liệu đó. Hàng thẻ cuộn ngang bằng thanh cuộn, nút mũi tên hoặc bàn phím (vùng cuộn nhận focus).
 */
export function KhuyenMai() {
  const kho = useCatalog();
  const ds = useMemo(() => chonKhuyenMai(kho.items, 8), [kho.items]);
  const { chuongTrinh: ct, giamToiDa } = useMemo(() => khuyenMaiConHang(kho.items), [kho.items]);
  const rail = useRef<HTMLUListElement>(null);
  const cuon = (h: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: h * Math.max(240, el.clientWidth * 0.8), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  if (kho.trangThai === "ok" && ds.length === 0) return null;
  return (
    <Khu id="khuyen-mai" nen="am" kicker="Ưu đãi đang chạy" tieuDe={giamToiDa > 0 && kho.trangThai === "ok" ? `Đang giảm giá, cao nhất ${giamToiDa}%` : "Đang giảm giá"}
      lienKet={{ href: "/KhuyenMai/Index", nhan: "Xem mọi chương trình khuyến mãi" }}>
      <DuLieuKhu cho={<ul className={s.rail} aria-hidden="true">{[0, 1, 2, 3].map((i) => <li key={i} className={`${s.khungCho}`} />)}</ul>}>
        {() => (
          <>
            {ct.length > 0 && (
              <ul className={s.chuongTrinh} aria-label="Chương trình khuyến mãi đang áp dụng">
                {ct.map((c) => (
                  <li key={c.id} className={s.ct}>
                    <b>{c.ten}</b>
                    <span>giảm tới {c.giamToiDa}%{c.ngayKetThuc ? ` · đến ${ngay(c.ngayKetThuc)}` : ""} · {c.soSanPham} sản phẩm còn hàng</span>
                  </li>
                ))}
              </ul>
            )}
            <div className={s.raiBao}>
              <ul ref={rail} className={s.rail} tabIndex={0} aria-label={`${ds.length} sản phẩm đang giảm giá, cuộn ngang để xem thêm`}>
                {ds.map((sp, i) => <li key={sp.id} className={s.raiO}><ProductCard sp={sp} dung={laVot(sp)} uuTien={i < 3} /></li>)}
              </ul>
              <div className={s.mui} aria-hidden="false">
                <button type="button" onClick={() => cuon(-1)} aria-label="Cuộn danh sách sang trái"><span aria-hidden="true">←</span></button>
                <button type="button" onClick={() => cuon(1)} aria-label="Cuộn danh sách sang phải"><span aria-hidden="true">→</span></button>
              </div>
            </div>
          </>
        )}
      </DuLieuKhu>
    </Khu>
  );
}

const TAB: KhoaLoai[] = ["giay", "aoquan", "phukien"];

/** Kệ giày, trang phục, phụ kiện: ba tab, mỗi tab vài sản phẩm còn hàng thật (giảm nhiều trước, tối đa 2 mỗi hãng) bằng thẻ sản phẩm chung. */
export function KeHang() {
  const kho = useCatalog();
  const [tab, setTab] = useState<KhoaLoai>("giay");
  const dem = useMemo(() => demTheoLoai(kho.items), [kho.items]);
  const ds = useMemo(() => chonTheoLoai(kho.items, tab, 4), [kho.items, tab]);
  return (
    <Khu id="ke-hang" kicker="Ngoài vợt" tieuDe="Giày, trang phục và phụ kiện" lienKet={{ href: `/SanPham/Index?loai=${LOAI[tab].slug}`, nhan: `Xem tất cả ${LOAI[tab].tenNgan.toLocaleLowerCase("vi")}` }}>
      <div className={s.tabKe} role="group" aria-label="Nhóm hàng">
        {TAB.map((k) => (
          <button key={k} type="button" className={s.tabNut} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {LOAI[k].tenNgan}{kho.trangThai === "ok" && <small><span className={s.chuPhu}> · </span>{dem[k].soConHang}<span className={s.chuPhu}> còn hàng</span></small>}
          </button>
        ))}
      </div>
      <DuLieuKhu cho={<ul className={s.luoi} aria-hidden="true">{[0, 1, 2, 3].map((i) => <li key={i} className={s.khungCho} />)}</ul>}>
        {() => ds.length === 0
          ? <p className={s.trong}>Hiện chưa có sản phẩm còn hàng trong nhóm này.</p>
          : <ul className={s.luoi} aria-live="polite">{ds.map((sp) => <li key={`${tab}-${sp.id}`}><ProductCard sp={sp} /></li>)}</ul>}
      </DuLieuKhu>
    </Khu>
  );
}

/** Bảng xếp hạng tồn kho: sản phẩm còn nhiều hàng nhất (thanh dài theo số lượng tồn thật). Chỉ nói "còn nhiều", không suy ra lượt bán hay độ ưa chuộng. */
export function ConNhieuHang() {
  const kho = useCatalog();
  const ds = useMemo(() => conNhieuHang(kho.items, 5), [kho.items]);
  const max = Math.max(1, ...ds.map((sp) => sp.tongTonKho));
  if (kho.trangThai === "ok" && ds.length === 0) return null;
  return (
    <Khu id="con-nhieu-hang" nen="xam" kicker="Tồn kho" tieuDe="Còn nhiều hàng trong kho" moTa="Năm sản phẩm có số lượng tồn cao nhất lúc này, cộng dồn mọi phiên bản màu và size.">
      <DuLieuKhu>
        {() => (
          <ol className={s.xepHang}>
            {ds.map((sp, i) => (
              <li key={sp.id} className={`${s.xepDong} sf-reveal`}>
                <span className={`${s.xepSo} ${fontTieuDe.className}`} aria-hidden="true">{i + 1}</span>
                <div className={s.xepThan}>
                  <Link href={`/Home/ChiTietSanPham/${sp.id}`} className={s.xepTen}>{sp.tenSanPham}</Link>
                  <span className={s.xepThanh} aria-hidden="true"><i style={{ width: `${Math.max(6, Math.round((sp.tongTonKho / max) * 100))}%` }} /></span>
                </div>
                <span className={s.xepTon}><b className={fontTieuDe.className}>{sp.tongTonKho}</b> còn lại</span>
                <span className={`${s.xepGia} ${fontTieuDe.className}`}>{vnd(sp.giaSauKhuyenMai)}</span>
              </li>
            ))}
          </ol>
        )}
      </DuLieuKhu>
    </Khu>
  );
}
