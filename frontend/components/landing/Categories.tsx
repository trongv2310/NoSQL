import Image from "next/image";
import Link from "next/link";
import { khoaLoai, type KhoaLoai } from "@/lib/landing-data";
import { layTrangChuSanPham } from "@/lib/server-api";
import { fontTieuDe } from "./fonts";
import { RvHeading } from "./Words";
import s from "./landing.module.css";

/**
 * Bốn danh mục cố định (tên, ảnh, liên kết không phụ thuộc API). Số sản phẩm là phần phụ,
 * lấy từ API lúc dựng trang: API chậm/lỗi thì ô vẫn đọc và bấm được (chỉ chữ phụ rơi về "Xem tất cả").
 * Ảnh dưới đây là ảnh tạm dựng từ kho ảnh sẵn có, chưa phải bộ ảnh đồng nhất cần chụp (PLAN §8).
 */
const DANH_MUC = [
  { khoa: "vot" as const, slug: "Vot", ten: "Vợt cầu lông", mota: "Khung nhẹ hay đầm tay, chọn theo lối chơi.", anh: "/images/astrox99pro.jpg", sizes: "(max-width: 767px) 100vw, 40vw" },
  { khoa: "giay" as const, slug: "Giay", ten: "Giày cầu lông", mota: "Bám sân, êm chân cho từng pha di chuyển.", anh: "/images/giay_lining.png", sizes: "(max-width: 767px) 100vw, 55vw" },
  { khoa: "aoquan" as const, slug: "AoQuan", ten: "Trang phục", mota: "Thoáng khí, co giãn khi vào trận.", anh: "/images/aoquan.jpeg", sizes: "(max-width: 767px) 50vw, 28vw" },
  { khoa: "phukien" as const, slug: "PhuKien", ten: "Phụ kiện", mota: "Quả cầu, quấn cán và đồ nhỏ cần thiết.", anh: "/images/pk_cau_thi_dau.jpg", sizes: "(max-width: 767px) 50vw, 28vw" },
] as const;

async function SoSanPham({ khoa }: { khoa: KhoaLoai }) {
  const ds = await layTrangChuSanPham();
  const n = ds?.filter((sp) => khoaLoai(sp.loai?.tenLoai) === khoa).length;
  return <span className={s.tileCount}>{n ? `${n} sản phẩm` : "Xem tất cả"}</span>;
}

export function Categories() {
  return (
    <section id="danh-muc" className={s.sheet} aria-labelledby="danh-muc-title">
      <div className="container">
        <RvHeading id="danh-muc-title" className={`${s.sheetTitle} ${fontTieuDe.className}`} text="Bạn cần gì cho trận tới?" />
        <div className={s.tiles}>
          {DANH_MUC.map((d) => (
            <Link key={d.khoa} href={`/SanPham/Index?loai=${d.slug}`} className={`${s.tile} ${s[`tile_${d.khoa}`]}`}>
              <span className={s.tileMedia}>
                <Image src={d.anh} alt="" fill sizes={d.sizes} className={s.tileImg} />
              </span>
              <span className={s.tileBody}>
                <span className={s.tileText}>
                  <span className={`${s.tileName} ${fontTieuDe.className}`}>{d.ten}</span>
                  <span className={s.tileDesc}>{d.mota}</span>
                    <SoSanPham khoa={d.khoa} />
                </span>
                <span className={s.tileArrow} aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
