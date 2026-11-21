"use client";

import Link from "next/link";
import { useCatalog } from "@/components/landing/CatalogProvider";
import k from "./khu.module.css";

type Nen = "trang" | "xam" | "am" | "toi";
const LOP_NEN: Record<Nen, string> = { trang: "", xam: k.xam, am: k.am, toi: k.toi };

export function Khu({ id, nen = "trang", kicker, tieuDe, moTa, lienKet, children, className = "" }: {
  id: string; nen?: Nen; kicker?: string; tieuDe: string; moTa?: string; lienKet?: { href: string; nhan: string }; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`${k.khu} ${LOP_NEN[nen]} ${className}`} aria-labelledby={`${id}-tieu-de`}>
      <div className="container">
        <div className={`${k.khuDau} sf-reveal`}>
          <div className={k.khuDauTrai}>
            {kicker && <p className={k.kicker}>{kicker}</p>}
            <h2 id={`${id}-tieu-de`} className={k.khuTieuDe}>{tieuDe}</h2>
            {moTa && <p className={k.khuMoTa}>{moTa}</p>}
          </div>
          {lienKet && <Link href={lienKet.href} className={k.khuLienKet}>{lienKet.nhan} <span aria-hidden="true">→</span></Link>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function DuLieuKhu({ cho, children }: { cho?: React.ReactNode; children: () => React.ReactNode }) {
  const kho = useCatalog();
  if (kho.trangThai === "loading") return <>{cho ?? <div className={k.khoiCho} aria-hidden="true" />}</>;
  if (kho.trangThai === "error") {
    return <p className={k.trangThaiKhu} role="status">Chưa tải được dữ liệu sản phẩm. <button type="button" className={k.lienKetNut} onClick={kho.thuLai}>Thử lại</button> hoặc <Link href="/SanPham/Index">xem trang sản phẩm</Link>.</p>;
  }
  return <>{children()}</>;
}
