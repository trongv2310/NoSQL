"use client";

import Link from "next/link";
import { useState } from "react";
import { fontTieuDe } from "@/components/landing/fonts";
import { ProductImage } from "@/components/landing/ProductImage";
import { useThemBienThe } from "@/components/product/useThemBienThe";
import { vnd } from "@/lib/format";
import { nhanBienThe, tenNganVot } from "@/lib/so-sanh-du-lieu";
import { DauVot, nhanVot, type Cot } from "./chung";
import s from "./so-sanh.module.css";

export interface LuaChonVot { id: string; ten: string }
/** So giá với vợt rẻ nhất trong nhóm: `re` = rẻ nhất, `chenh` = đắt hơn vợt rẻ nhất bao nhiêu. */
export type SoGia = { re: true } | { re: false; chenh: number } | null;

function DoiVot({ i, ds, onDoi }: { i: number; ds: LuaChonVot[]; onDoi: (id: string) => void }) {
  if (!ds.length) return null;
  return (
    <label className={s.doiVot}>
      <i className="fa-solid fa-arrow-right-arrow-left" aria-hidden="true" />
      <span className="visually-hidden">Đổi {nhanVot(i)} bằng vợt khác</span>
      <select value="" onChange={(e) => { if (e.target.value) onDoi(e.target.value); }}>
        <option value="">Đổi vợt khác</option>
        {ds.map((v) => <option key={v.id} value={v.id}>{tenNganVot(v.ten)}</option>)}
      </select>
    </label>
  );
}

function NutBo({ i, ten, onBo }: { i: number; ten?: string; onBo: () => void }) {
  return (
    <button type="button" className={s.nutBo} onClick={onBo} aria-label={`Bỏ ${nhanVot(i)}${ten ? ` (${ten})` : ""} khỏi so sánh`} title="Bỏ khỏi so sánh">
      <i className="fa-solid fa-xmark" aria-hidden="true" />
    </button>
  );
}

/**
 * Thẻ đầu mỗi cột: ảnh thật, tên, phiên bản, giá (kèm chênh so với vợt rẻ nhất), tồn kho, thêm vào giỏ, đổi vợt và bỏ khỏi so sánh.
 * Thêm giỏ dùng đúng hook `useThemBienThe` (cùng luật tồn kho/giỏ như trang chi tiết). Cột lỗi/đang tải/phiên bản sai báo ngay trong thẻ.
 */
export function TheVot({ c, soGia, dsDoi, onBo, onDoiBien, onDoiVot }: {
  c: Cot; soGia: SoGia; dsDoi: LuaChonVot[]; onBo: () => void; onDoiBien: (bienId: string | null) => void; onDoiVot: (id: string) => void;
}) {
  const them = useThemBienThe();
  const [dangThem, setDangThem] = useState(false);
  const nhan = <span className={s.theNhan}><DauVot i={c.i} />{nhanVot(c.i)}</span>;

  if (c.trangThai === "dang") {
    return (
      <article className={s.the} aria-label={`${nhanVot(c.i)}: đang tải`} aria-busy="true">
        <div className={s.theAnh}>{nhan}</div>
        <div className={s.theThan}><span className={s.xuong} style={{ width: "80%" }} /><span className={s.xuong} style={{ width: "50%" }} /><span className="visually-hidden">Đang tải…</span></div>
      </article>
    );
  }
  if (c.trangThai === "loi") {
    return (
      <article className={s.the} aria-label={`${nhanVot(c.i)}: không tải được`}>
        <div className={`${s.theAnh} ${s.theAnhLoi}`}>{nhan}<NutBo i={c.i} onBo={onBo} /><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /></div>
        <div className={s.theThan}>
          <p className={s.theLoi} role="alert">{c.thongBao}</p>
          <DoiVot i={c.i} ds={dsDoi} onDoi={onDoiVot} />
        </div>
      </article>
    );
  }
  const sp = c.ct.sanPham;
  const anh = (
    <div className={s.theAnh}>
      <ProductImage src={sp.hinhAnhDaiDien} alt="" sizes="(max-width: 639px) 33vw, 300px" hoaNen />
      {nhan}
      <NutBo i={c.i} ten={sp.tenSanPham} onBo={onBo} />
    </div>
  );
  const ten = (
    <div className={s.theDau}>
      {sp.hang && <span className={s.theHang}>{sp.hang.tenHang}</span>}
      <h2 className={s.theTen}><Link href={`/Home/ChiTietSanPham/${sp.id}`} title={sp.tenSanPham}>{tenNganVot(sp.tenSanPham)}</Link></h2>
    </div>
  );
  const chonBien = (value: string, rong: boolean) => (
    <label className={s.chonBien}>
      <span className="visually-hidden">Phiên bản của {nhanVot(c.i)}</span>
      <select value={value} onChange={(e) => onDoiBien(e.target.value || null)}>
        {rong && <option value="">Chọn phiên bản</option>}
        {c.ct.bienThes.map((x) => <option key={x.id} value={x.id}>{nhanBienThe(x)}{x.soLuongTon <= 0 ? " (hết hàng)" : ""}</option>)}
      </select>
    </label>
  );

  if (c.trangThai === "bien-the-sai") {
    return (
      <article className={s.the} aria-label={`${nhanVot(c.i)}: ${sp.tenSanPham}`}>
        {anh}
        <div className={s.theThan}>
          {ten}
          <p className={s.theLoi} role="alert">Phiên bản trong liên kết không thuộc vợt này. Hãy chọn lại để tránh so nhầm.</p>
          {chonBien("", true)}
        </div>
      </article>
    );
  }
  const bien = c.bien;
  const het = bien.soLuongTon <= 0;
  const themGio = async () => {
    if (dangThem || het) return;
    setDangThem(true);
    try { await them({ id: bien.id, soLuongTon: bien.soLuongTon }, 1, sp.tenSanPham); } finally { setDangThem(false); }
  };
  return (
    <article className={s.the} aria-label={`${nhanVot(c.i)}: ${sp.tenSanPham}`}>
      {anh}
      <div className={s.theThan}>
        {ten}
        {c.ct.bienThes.length > 1 ? chonBien(bien.id, false) : <span className={s.bienMot}>{nhanBienThe(bien)}</span>}
        <div className={s.theGia}>
          <b className={`${s.giaLon} ${fontTieuDe.className}`}>{vnd(bien.giaThucTe)}</b>
          {soGia && (soGia.re ? <span className={`${s.chip} ${s.chipXanh}`}>Rẻ nhất</span> : <span className={s.chenh}>+{vnd(soGia.chenh)}</span>)}
        </div>
        <span className={`${s.ton} ${het ? s.tonHet : ""}`}><i className={`fa-solid ${het ? "fa-circle-xmark" : "fa-circle-check"}`} aria-hidden="true" />{het ? "Hết hàng" : `Còn ${bien.soLuongTon}`}</span>
        <button type="button" className={s.nutGio} disabled={het || dangThem} aria-label={het ? `${sp.tenSanPham}: phiên bản này đã hết hàng` : `Thêm ${sp.tenSanPham} (${nhanBienThe(bien)}) vào giỏ hàng`} onClick={themGio}>
          <i className="fa-solid fa-cart-plus" aria-hidden="true" /><span>{het ? "Hết hàng" : dangThem ? "Đang thêm…" : "Thêm vào giỏ"}</span>
        </button>
        <DoiVot i={c.i} ds={dsDoi} onDoi={onDoiVot} />
      </div>
    </article>
  );
}

/** Ô trống trong hàng thẻ: chọn thêm một vợt ngay tại chỗ. */
export function OChon({ ds, dangTai, loi, thuLai, onChon, ngang = false }: {
  ds: LuaChonVot[]; dangTai: boolean; loi: boolean; thuLai: () => void; onChon: (id: string) => void; ngang?: boolean;
}) {
  return (
    <div className={`${s.oChon} ${ngang ? s.oChonNgang : ""}`}>
      <span className={s.oChonDau} aria-hidden="true"><i className="fa-solid fa-plus" /></span>
      <label className={s.oChonChu}>
        <b>Thêm vợt để so</b>
        <select value="" disabled={dangTai || loi} onChange={(e) => { if (e.target.value) onChon(e.target.value); }}>
          <option value="">{loi ? "Không tải được danh sách" : dangTai ? "Đang tải danh sách…" : "Chọn một vợt"}</option>
          {ds.map((v) => <option key={v.id} value={v.id}>{tenNganVot(v.ten)}</option>)}
        </select>
      </label>
      {loi && <button type="button" className={s.nutChu} onClick={thuLai}>Thử tải lại</button>}
    </div>
  );
}
