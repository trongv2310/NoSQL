"use client";

import { useMemo } from "react";
import anhCangCuoc from "@/assets/trang-chu/cang-cuoc.webp";
import anhChonVot from "@/assets/trang-chu/chon-vot.webp";
import anhHoiNguoiBan from "@/assets/trang-chu/hoi-nguoi-ban.webp";
import anhSoSanh from "@/assets/trang-chu/so-sanh.webp";
import anhTuVot from "@/assets/trang-chu/tu-vot.webp";
import { useCatalog } from "@/components/landing/CatalogProvider";
import { fontTieuDe } from "@/components/landing/fonts";
import { thongKeKho, votCoSucCang } from "@/lib/landing-data";
import { Khu } from "./KhuChung";
import { SoDem } from "./SoDem";
import { TheDieuHuong } from "./TheDieuHuong";
import s from "./cong-cu.module.css";

/** Dải số liệu ngay dưới màn hình đầu: mọi con số đếm từ danh sách sản phẩm đang bán (xem `thongKeKho`), không số nào tự đặt. */
export function DaiSoLieu() {
  const kho = useCatalog();
  const t = useMemo(() => thongKeKho(kho.items), [kho.items]);
  if (kho.trangThai === "error") return null;
  if (kho.trangThai === "loading") return <div className={s.dai} aria-hidden="true"><div className={`container ${s.daiTrong}`} /></div>;
  if (t.soSanPham === 0) return null;
  const muc = [
    { so: t.soSanPham, nhan: "sản phẩm" },
    { so: t.soVot, nhan: "mẫu vợt" },
    { so: t.soHang, nhan: "thương hiệu" },
    { so: t.soDangGiam, nhan: "đang giảm giá" },
  ];
  return (
    <section className={s.dai} aria-label="Số liệu cửa hàng lúc này">
      <div className={`container ${s.daiTrong}`}>
        <dl className={s.daiLuoi}>
          {muc.map((m) => (
            <div key={m.nhan} className={`${s.soLieu} sf-reveal`}>
              <dt className={s.soNhan}>{m.nhan}</dt>
              <dd className={s.soGiaTri}><SoDem den={m.so} className={fontTieuDe.className} /></dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Ảnh minh họa cho từng công cụ. Trạm căng cước lấy liên kết và khoảng căng từ vợt còn hàng. */
export function CongCu() {
  const kho = useCatalog();
  const vot = useMemo(() => votCoSucCang(kho.items), [kho.items]);
  const muc = [
    { href: "#quay-tu-van", tieuDe: "Chọn vợt theo lối chơi", moTa: "3 cây hợp bạn, còn hàng", anh: anhChonVot, sizes: "(max-width: 575px) 32vw, (max-width: 991px) 100vw, 33vw" },
    { href: "/so-sanh", tieuDe: "So sánh vợt", moTa: "Đặt 2–3 cây cạnh nhau", anh: anhSoSanh, sizes: "(max-width: 575px) 32vw, (max-width: 991px) 50vw, 33vw" },
    { href: "/tu-vot", tieuDe: "Tủ vợt của tôi", moTa: "Nhớ ngày căng, nhắc căng lại", anh: anhTuVot, sizes: "(max-width: 575px) 32vw, (max-width: 991px) 50vw, 33vw" },
    {
      href: vot ? `/Home/ChiTietSanPham/${vot.id}` : "/SanPham/Index?loai=Vot",
      tieuDe: "Trạm căng cước", moTa: "Căng đúng mức nhà sản xuất cho phép", anh: anhCangCuoc,
      sizes: "(max-width: 575px) 32vw, 50vw", nhan: vot?.thongSoVot?.sucCang,
    },
    { href: "#hoi-nguoi-ban", tieuDe: "Hỏi người bán", moTa: "Hỏi giá, tồn kho, khuyến mãi", anh: anhHoiNguoiBan, sizes: "(max-width: 575px) 32vw, 50vw" },
  ];

  return (
    <Khu id="cong-cu" nen="xam" kicker="Công cụ của shop" tieuDe="Chọn đúng vợt trước khi mua">
      <ul className={s.luoi} role="list">
        {muc.map(({ moTa, ...the }) => (
          <li key={the.tieuDe} className="sf-reveal">
            <TheDieuHuong {...the} gonTrenDienThoai>{moTa}</TheDieuHuong>
          </li>
        ))}
      </ul>
    </Khu>
  );
}
