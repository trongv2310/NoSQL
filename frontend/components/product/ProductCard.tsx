"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { api, loiTuApi } from "@/lib/api";
import { vnd } from "@/lib/format";
import { anhDaKiemDuyet, dangGiam, phanTramGiam } from "@/lib/landing-data";
import { ghiNhoAnhBam } from "@/lib/morph";
import type { BienTheV, SanPhamV } from "@/lib/types";
import { fontTieuDe } from "@/components/landing/fonts";
import { ProductImage } from "@/components/landing/ProductImage";
import { useApp } from "@/components/AppProviders";
import { NutSoSanh } from "@/components/so-sanh/NutSoSanh";
import { DaiThongSo, HinhVot, diemCanBangY } from "./DaiThongSo";
import { useThemBienThe } from "./useThemBienThe";
import s from "./the-san-pham.module.css";

/** Nhãn một phiên bản: màu · size (hoặc "Tiêu chuẩn" nếu sản phẩm không có màu/size). */
const nhanBienThe = (b: BienTheV) => [b.mau?.tenMau, b.size?.tenSize].filter(Boolean).join(" · ") || "Tiêu chuẩn";

/**
 * Thêm nhanh theo ĐÚNG phiên bản: danh sách thẻ không mang theo các phiên bản nên khi bấm mới tải chi tiết sản phẩm.
 * Chỉ một phiên bản còn hàng thì thêm luôn (và nói rõ phiên bản nào); nhiều phiên bản thì hiện bảng chọn nhỏ, không bao giờ chọn bừa một phiên bản.
 */
function ThemNhanh({ sp }: { sp: SanPhamV }) {
  const { flash } = useApp();
  const them = useThemBienThe();
  const [buoc, setBuoc] = useState<"rong" | "dang" | "chon">("rong");
  const [ds, setDs] = useState<BienTheV[]>([]);
  const het = sp.tongTonKho === 0;

  const bam = async () => {
    if (buoc === "chon") { setBuoc("rong"); return; }
    setBuoc("dang");
    try {
      const r = await api<{ bienThes: BienTheV[] }>(`/san-pham/${sp.id}`);
      const con = r.bienThes.filter((b) => b.soLuongTon > 0);
      if (!con.length) { flash("danger", "Sản phẩm này đã hết hàng."); setBuoc("rong"); return; }
      if (con.length === 1) {
        await them(con[0], 1, `${sp.tenSanPham} (${nhanBienThe(con[0])})`);
        setBuoc("rong");
        return;
      }
      setDs(con);
      setBuoc("chon");
    } catch (e) {
      flash("danger", loiTuApi(e));
      setBuoc("rong");
    }
  };

  const chon = async (b: BienTheV) => {
    const ok = await them(b, 1, `${sp.tenSanPham} (${nhanBienThe(b)})`);
    if (ok) setBuoc("rong");
  };

  return (
    <div className={s.hanh}>
      {buoc === "chon" && (
        <div className={s.chonPb} role="group" aria-label={`Chọn phiên bản của ${sp.tenSanPham}`}>
          <p>Chọn phiên bản để thêm vào giỏ</p>
          {ds.map((b) => (
            <button key={b.id} type="button" className={s.pbNut} onClick={() => void chon(b)}>
              <span>{nhanBienThe(b)} <small>(còn {b.soLuongTon})</small></span><b className={fontTieuDe.className}>{vnd(b.giaThucTe)}</b>
            </button>
          ))}
        </div>
      )}
      <button type="button" className={s.nutThem} disabled={het || buoc === "dang"} aria-busy={buoc === "dang"} aria-expanded={buoc === "chon"} onClick={() => void bam()}>
        {het ? "Tạm hết hàng" : buoc === "dang" ? "Đang tải phiên bản…" : buoc === "chon" ? "Đóng bảng chọn" : "Thêm vào giỏ"}
      </button>
    </div>
  );
}

/**
 * Thẻ sản phẩm DUY NHẤT của storefront (trang chủ, danh sách, khuyến mãi, sản phẩm liên quan). Giá, tồn kho, ảnh, trạng thái là dữ liệu thật;
 * dải thông số chỉ hiện với vợt có thông số; `lyDo` chỉ truyền vào khi được tính từ thông số thật. `dung`: khung ảnh dựng đứng cho vợt;
 * khi chưa có ảnh đã duyệt là sạch thì hiện hình giữ chỗ ghi rõ, ảnh gốc vẫn xem được ở trang chi tiết.
 */
export function ProductCard({ sp, lyDo, nhan, dung = false, uuTien = false, themNhanh = true }: {
  sp: SanPhamV; lyDo?: string; nhan?: string; dung?: boolean; uuTien?: boolean; themNhanh?: boolean;
}) {
  const pt = phanTramGiam(sp);
  const het = sp.tongTonKho === 0;
  const conIt = sp.tongTonKho !== undefined && sp.tongTonKho > 0 && sp.tongTonKho <= 5;
  const laVot = !!sp.thongSoVot || Object.keys(sp.thongSoKhacNhau ?? {}).length > 0;
  const duongDan = `/Home/ChiTietSanPham/${sp.id}`;
  const khungRef = useRef<HTMLSpanElement>(null);
  const giuCho = dung && laVot && !anhDaKiemDuyet(sp);

  return (
    <article className={`${s.the} ${dung ? s.dung : ""} sf-reveal`} data-sp={sp.id}>
      <span className={s.khung} ref={khungRef}>
        {giuCho ? (
          <span className={s.giuCho}><HinhVot className={s.giuChoHinh} diem={diemCanBangY(sp.thongSoVot)} /><span className={s.giuChoNhan}>Chưa có ảnh chuẩn</span></span>
        ) : (
          <ProductImage src={sp.hinhAnhDaiDien} alt="" sizes="(max-width: 767px) 60vw, (max-width: 1199px) 30vw, 22vw" className={s.anh} />
        )}
        {laVot && <NutSoSanh sanPhamId={sp.id} ten={sp.tenSanPham} />}
        {pt > 0 && <span className={`${s.huy} ${s.giam}`}>-{pt}%</span>}
        {het ? <span className={`${s.huy} ${s.het}`}>Hết hàng</span> : conIt ? <span className={`${s.huy} ${s.it}`}>Còn {sp.tongTonKho}</span> : null}
        {nhan && <span className={`${s.huy} ${s.nhanGan}`}>{nhan}</span>}
      </span>
      <div className={s.than}>
        <span className={s.hang}>{sp.hang?.tenHang ?? "Hãng khác"}</span>
        <Link href={duongDan} className={s.ten} title={sp.tenSanPham} prefetch={uuTien ? undefined : false}
          onClick={() => ghiNhoAnhBam(sp.id, khungRef.current?.querySelector("img") ?? null)}>
          {sp.tenSanPham}
        </Link>
        <div className={s.hangGia}>
          <b className={`${s.gia} ${fontTieuDe.className}`}>{vnd(sp.giaSauKhuyenMai)}</b>
          {dangGiam(sp) && <s className={s.giaCu}>{vnd(sp.giaGoc)}</s>}
        </div>
        {dangGiam(sp) && <span className={s.tietKiem}>Tiết kiệm {vnd(sp.giaGoc - sp.giaSauKhuyenMai)}</span>}
        {laVot && <DaiThongSo ts={sp.thongSoVot} khacNhau={sp.thongSoKhacNhau} anHinh={giuCho} />}
        {lyDo && <p className={s.lyDo}>{lyDo}</p>}
      </div>
      {themNhanh && <ThemNhanh sp={sp} />}
    </article>
  );
}
