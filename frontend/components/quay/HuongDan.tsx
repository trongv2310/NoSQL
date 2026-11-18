import Link from "next/link";
import { fontTieuDe } from "@/components/landing/fonts";
import { ngay } from "@/lib/format";
import { layNoiDungLanding } from "@/lib/server-api";
import { Khu } from "./KhuChung";
import { ThongTinCuaHang } from "./ThongTinCuaHang";
import s from "./huong-dan.module.css";

/**
 * Bài mới nhất của Bảng tin (lấy ở server từ API `/landing`). Chưa có bài nào thì bỏ cả khu (không dựng nội dung giả); LẤY KHÔNG ĐƯỢC (API lỗi/chậm) thì giữ khu
 * và nói thẳng là chưa tải được, kèm liên kết sang Bảng tin (khu này dựng ở server nên cách thử lại là tải lại trang hoặc mở Bảng tin).
 */
export async function BangTinTrangChu() {
  const nd = await layNoiDungLanding();
  if (nd === null) {
    return (
      <Khu id="bang-tin" kicker="Bảng tin" tieuDe="Tin mới từ cửa hàng" lienKet={{ href: "/BangTin", nhan: "Xem Bảng tin" }}>
        <p className={s.tinLoi} role="status">Chưa tải được bài mới của Bảng tin lúc này. Bạn có thể tải lại trang sau ít phút hoặc <Link href="/BangTin">mở trang Bảng tin</Link>.</p>
      </Khu>
    );
  }
  const tin = [...nd.tinMoi].sort((a, b) => +new Date(b.ngayDang) - +new Date(a.ngayDang)).slice(0, 3);
  if (tin.length === 0) return null;
  const [dau, ...con] = tin;
  return (
    <Khu id="bang-tin" kicker="Bảng tin" tieuDe="Tin mới từ cửa hàng" lienKet={{ href: "/BangTin", nhan: "Xem Bảng tin" }}>
      <div className={s.tin}>
        <article className={`${s.tinDau} sf-reveal`}>
          <p className={s.tinNhan}><span>{dau.nhanLoai}</span><time dateTime={dau.ngayDang}>{ngay(dau.ngayDang)}</time></p>
          <h3 className={`${s.tinTieuDe} ${fontTieuDe.className}`}><Link href={`/BangTin/${dau.id}`}>{dau.tieuDe}</Link></h3>
          {dau.tomTat && <p className={s.tinTomTat}>{dau.tomTat}</p>}
          <span className={s.tinDoc} aria-hidden="true">Đọc bài viết →</span>
        </article>
        {con.length > 0 && (
          <div className={s.tinPhu}>
            {con.map((t) => (
              <article key={t.id} className={`${s.tinO} sf-reveal`}>
                <p className={s.tinNhan}><span>{t.nhanLoai}</span><time dateTime={t.ngayDang}>{ngay(t.ngayDang)}</time></p>
                <h3 className={s.tinTieuDePhu}><Link href={`/BangTin/${t.id}`}>{t.tieuDe}</Link></h3>
                {t.tomTat && <p className={s.tinTomTatPhu}>{t.tomTat}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </Khu>
  );
}

/* ── Quy trình mua hàng: bốn bước, nội dung bám đúng cách website đang hoạt động (xem /ChinhSach/huong-dan-mua-hang) ── */

function Icon({ ten }: { ten: "chon" | "gio" | "the" | "don" }) {
  const net = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false" {...net}>
      {ten === "chon" && <><circle cx="17" cy="17" r="8" /><path d="M23 23l9 9" /><path d="M13 17h8M17 13v8" /></>}
      {ten === "gio" && <><path d="M6 8h5l3 17h16l3-12H13" /><circle cx="17" cy="32" r="2" /><circle cx="28" cy="32" r="2" /></>}
      {ten === "the" && <><rect x="5" y="10" width="30" height="20" rx="4" /><path d="M5 17h30M11 25h7" /></>}
      {ten === "don" && <><path d="M12 6h16a2 2 0 012 2v26l-4-3-4 3-4-3-4 3-4-3V8a2 2 0 012-2z" transform="translate(-2 0)" /><path d="M13 14h12M13 20h12M13 26h7" /></>}
    </svg>
  );
}

const BUOC = [
  { icon: "chon", ten: "Chọn sản phẩm", mota: "Xem theo danh mục, hãng hoặc tìm kiếm. Số hàng còn lại của từng phiên bản (màu, size) hiện ngay ở trang sản phẩm.", lk: { href: "/SanPham/Index", nhan: "Xem sản phẩm" } },
  { icon: "gio", ten: "Thêm vào giỏ", mota: "Chưa cần đăng nhập: giỏ lưu trên trình duyệt này. Giá và tồn kho được tính lại mỗi lần bạn xem giỏ.", lk: { href: "/Home/ViewCart", nhan: "Xem giỏ hàng" } },
  { icon: "the", ten: "Thanh toán COD hoặc MoMo", mota: "Chỉ bước này cần tài khoản, và giỏ của bạn được chuyển vào tài khoản. Điền thông tin nhận hàng rồi chọn trả khi nhận hàng (COD) hoặc ví MoMo.", lk: { href: "/ChinhSach/huong-dan-mua-hang", nhan: "Hướng dẫn chi tiết" } },
  { icon: "don", ten: "Theo dõi đơn", mota: "Nhận mã đơn và xem trạng thái ở mục Đơn hàng của tôi. Đơn còn ở Chờ xác nhận, Chờ thanh toán MoMo hoặc Đang xử lý thì bạn tự hủy được.", lk: { href: "/DonHang/Index", nhan: "Đơn hàng của tôi" } },
] as const;

export function QuyTrinh() {
  return (
    <Khu id="quy-trinh" nen="xam" kicker="Mua hàng" tieuDe="Từ chọn vợt đến nhận hàng, bốn bước">
      <ol className={s.buoc}>
        {BUOC.map((b, i) => (
          <li key={b.ten} className={`${s.buocO} sf-reveal`}>
            <span className={s.buocIcon}><Icon ten={b.icon} /><b className={fontTieuDe.className} aria-hidden="true">{i + 1}</b></span>
            <h3 className={`${s.buocTen} ${fontTieuDe.className}`}>{b.ten}</h3>
            <p className={s.buocMoTa}>{b.mota}</p>
            <Link href={b.lk.href} className={s.buocLienKet}>{b.lk.nhan} <span aria-hidden="true">→</span></Link>
          </li>
        ))}
      </ol>
    </Khu>
  );
}

const HOI = [
  { h: "Có cần đăng nhập để thêm vào giỏ không?", d: "Không. Bạn chỉ cần đăng nhập ở bước thanh toán; khi đó giỏ hàng đã chọn được chuyển vào tài khoản." },
  { h: "Có những hình thức thanh toán nào?", d: "Thanh toán khi nhận hàng (COD) và ví MoMo. Bạn chọn ở bước đặt hàng." },
  { h: "Giá và tồn kho có thể thay đổi không?", d: "Có. Giá, khuyến mãi và tồn kho được tính lại mỗi lần bạn xem giỏ và khi đặt hàng; nếu có thay đổi, giỏ hàng sẽ báo cho bạn." },
  { h: "Vợt được gợi ý dựa trên điều gì?", d: "Dựa trên độ cân bằng, độ cứng, trọng lượng ghi trong kho cùng giá và tồn kho. Đây là gợi ý tham khảo, không phải điểm số hay đánh giá chất lượng; vợt thiếu thông số sẽ không được gợi ý theo lối chơi." },
  { h: "Tủ vợt và danh sách so sánh lưu ở đâu?", d: "Tủ vợt lưu trên trình duyệt bạn đang dùng, không đồng bộ sang thiết bị khác. So sánh vợt có liên kết chia sẻ để gửi cho người khác xem cùng danh sách." },
  { h: "Bảo hành, đổi trả và giao hàng thế nào?", d: "Cửa hàng đang cập nhật các chính sách này nên website chưa công bố thời hạn, phí hay điều kiện. Bạn có thể hỏi người bán hoặc xem trang chính sách để biết khi nào có nội dung." },
] as const;

/** Câu hỏi thường gặp (thẻ <details>, chỉ nêu điều kiểm chứng được trên website) cạnh thông tin cửa hàng lấy từ cấu hình hệ thống. */
export function HoiDap() {
  return (
    <Khu id="hoi-dap" kicker="Giải đáp" tieuDe="Câu hỏi thường gặp">
      <div className={s.hoiDap}>
        <div className={s.faq}>
          {HOI.map((q, i) => (
            <details key={q.h} className={`${s.cau} sf-reveal`} name="trang-chu-faq" open={i === 0}>
              <summary>{q.h}</summary>
              <p>{q.d}</p>
              {i === HOI.length - 1 && (
                <p className={s.cauLienKet}>
                  <Link href="/ChinhSach/bao-hanh">Bảo hành</Link> · <Link href="/ChinhSach/doi-tra">Đổi trả</Link> · <Link href="/ChinhSach/giao-hang">Giao hàng</Link> · <Link href="/ChinhSach/cau-hoi-thuong-gap">Mọi câu hỏi thường gặp</Link>
                </p>
              )}
            </details>
          ))}
        </div>
        <ThongTinCuaHang />
      </div>
    </Khu>
  );
}
