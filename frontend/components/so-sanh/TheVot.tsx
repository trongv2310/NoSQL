"use client";

import Link from "next/link";
import { useState } from "react";
import { fontTieuDe } from "@/components/landing/fonts";
import { HinhVot, diemCanBangY } from "@/components/product/DaiThongSo";
import b from "@/components/product/bento.module.css";
import { useThemBienThe } from "@/components/product/useThemBienThe";
import { anhDaKiemDuyet } from "@/lib/landing-data";
import { imgUrl, vnd } from "@/lib/format";
import { nhanBienThe } from "@/lib/so-sanh-du-lieu";
import { DauVot, nhanVot, type Cot } from "./chung";
import s from "./so-sanh.module.css";

/**
 * Thẻ tóm tắt đầu mỗi cột: ảnh (hoặc hình minh họa có chấm cân bằng), tên, phiên bản, giá, tồn kho, thêm vào giỏ và bỏ khỏi so sánh.
 * Thêm giỏ dùng đúng hook `useThemBienThe` (cùng luật tồn kho/giỏ khách/tài khoản như trang chi tiết). Cột lỗi/đang tải/phiên bản sai báo ngay trong thẻ.
 */
export function TheVot({ c, onBo, onDoiBien }: { c: Cot; onBo: () => void; onDoiBien: (bienId: string | null) => void }) {
  const them = useThemBienThe();
  const [dangThem, setDangThem] = useState(false);
  const mau = `${s.the} ${s[`v${c.i % 3}`]}`;
  const nhan = <span className={s.theNhan}><DauVot i={c.i} />{nhanVot(c.i)}</span>;

  if (c.trangThai === "dang") {
    return (
      <article className={mau} aria-label={`${nhanVot(c.i)}: đang tải`} aria-busy="true">
        {nhan}
        <div className={s.theAnh} />
        <div className={s.theCho}><span className={s.xuong} style={{ width: "80%" }} /><span className={s.xuong} style={{ width: "50%" }} /><span className="visually-hidden">Đang tải…</span></div>
      </article>
    );
  }
  if (c.trangThai === "loi") {
    return (
      <article className={mau} aria-label={`${nhanVot(c.i)}: không tải được`}>
        {nhan}
        <div className={s.theLoi} style={{ paddingTop: 44 }}>
          <p className={b.loi} role="alert" style={{ margin: 0 }}>{c.thongBao}</p>
          <div><button type="button" className={s.nutChu} onClick={onBo}>Bỏ khỏi so sánh</button></div>
        </div>
      </article>
    );
  }
  const sp = c.ct.sanPham;
  const bienChon = c.trangThai === "ok" ? c.bien : null;
  const ten = (
    <>
      {sp.hang && <span className={s.theHang}>{sp.hang.tenHang}</span>}
      <h2 className={s.theTen}><Link href={`/Home/ChiTietSanPham/${sp.id}`}>{sp.tenSanPham}</Link></h2>
    </>
  );
  if (c.trangThai === "bien-the-sai") {
    return (
      <article className={mau} aria-label={`${nhanVot(c.i)}: ${sp.tenSanPham}`}>
        {nhan}
        <div className={s.theLoi} style={{ paddingTop: 44 }}>
          {ten}
          <p className={b.loi} role="alert" style={{ margin: 0 }}>Phiên bản trong liên kết không thuộc vợt này nên chưa so sánh để tránh so nhầm cấu hình. <button type="button" className={s.nutChu} onClick={() => onDoiBien(null)}>Dùng phiên bản mặc định</button></p>
          <select className={b.nhap} aria-label={`Phiên bản của vợt ${c.i + 1}`} value="" onChange={(e) => onDoiBien(e.target.value || null)}>
            <option value="">Chọn phiên bản</option>
            {c.ct.bienThes.map((x) => <option key={x.id} value={x.id}>{nhanBienThe(x)}{x.soLuongTon <= 0 ? " (hết hàng)" : ""}</option>)}
          </select>
          <div><button type="button" className={s.nutChu} onClick={onBo}>Bỏ khỏi so sánh</button></div>
        </div>
      </article>
    );
  }
  const bien = bienChon!;
  const het = bien.soLuongTon <= 0;
  const themGio = async () => {
    if (dangThem || het) return;
    setDangThem(true);
    try { await them({ id: bien.id, soLuongTon: bien.soLuongTon }, 1, sp.tenSanPham); } finally { setDangThem(false); }
  };
  return (
    <article className={mau} aria-label={`${nhanVot(c.i)}: ${sp.tenSanPham}`}>
      {nhan}
      <div className={s.theAnh}>
        {anhDaKiemDuyet(sp) ? (
          <img src={imgUrl(sp.hinhAnhDaiDien)} alt="" />
        ) : (
          <>
            <HinhVot className={s.hinhVot} diem={diemCanBangY(bien.thongSo)} />
            <span className={s.theAnhNhan}><span className={s.nhanDai}>Hình minh họa (chưa có ảnh chuẩn); chấm = điểm cân bằng theo thông số.</span><span className={s.nhanNgan}>Hình minh họa</span></span>
          </>
        )}
      </div>
      <div className={s.theThan}>
        <div>{ten}</div>
        <label className={s.chonBien}>Phiên bản
          <select className={b.nhap} aria-label={`Phiên bản của vợt ${c.i + 1}`} value={bien.id} onChange={(e) => onDoiBien(e.target.value || null)}>
            {c.ct.bienThes.map((x) => <option key={x.id} value={x.id}>{nhanBienThe(x)}{x.soLuongTon <= 0 ? " (hết hàng)" : ""}</option>)}
          </select>
        </label>
        <div className={s.theGia}>
          <b className={`${s.giaLon} ${fontTieuDe.className}`}>{vnd(bien.giaThucTe)}</b>
          <span className={`${s.ton} ${het ? s.tonHet : ""}`}><i className={`fa-solid ${het ? "fa-circle-xmark" : "fa-circle-check"}`} aria-hidden="true" />{het ? "Hết hàng" : `Còn ${bien.soLuongTon}`}</span>
        </div>
        <div className={s.hanhTheo}>
          <button type="button" className={s.nutGio} disabled={het || dangThem} aria-label={het ? `${sp.tenSanPham}: phiên bản này đã hết hàng` : `Thêm ${sp.tenSanPham} (${nhanBienThe(bien)}) vào giỏ hàng`} onClick={themGio}>
            <i className="fa-solid fa-cart-plus" aria-hidden="true" />{het ? "Hết hàng" : dangThem ? "Đang thêm…" : "Thêm vào giỏ"}
          </button>
          <button type="button" className={s.nutChu} onClick={onBo}>Bỏ khỏi so sánh</button>
        </div>
      </div>
    </article>
  );
}
