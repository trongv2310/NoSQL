import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { Page } from "@/components/Ui";

/**
 * Trang hỗ trợ khách. Quy ước trung thực:
 *  - "Hướng dẫn mua hàng" và "Câu hỏi thường gặp" chỉ mô tả cách website đang hoạt động (có thể kiểm chứng trên giao diện).
 *  - Bảo hành, đổi trả, giao hàng là chính sách của cửa hàng nên CHƯA có nội dung cho tới khi chủ cửa hàng cung cấp và duyệt:
 *    trang chỉ nói rõ là đang cập nhật, không nêu thời hạn, phí hay điều kiện nào.
 */
interface Muc { tieuDe: string; noiDung: React.ReactNode }
interface Trang { ten: string; mota: string; daDuyet: boolean; muc: Muc[] }

const DANG_CAP_NHAT = "Cửa hàng đang cập nhật nội dung này. Nội dung chỉ được đăng sau khi chủ cửa hàng cung cấp và duyệt, nên hiện chưa có thông tin về thời hạn, phí hay điều kiện áp dụng.";

const TRANG: Record<string, Trang> = {
  "huong-dan-mua-hang": {
    ten: "Hướng dẫn mua hàng",
    mota: "Các bước đặt hàng trên website, theo đúng cách website đang hoạt động.",
    daDuyet: true,
    muc: [
      { tieuDe: "1. Chọn sản phẩm", noiDung: "Xem sản phẩm theo danh mục, hãng hoặc tìm kiếm. Ở trang sản phẩm, chọn màu, size (nếu có) và số lượng. Số hàng còn lại của từng phiên bản được hiển thị ngay tại đó." },
      { tieuDe: "2. Thêm vào giỏ", noiDung: "Bấm “Thêm vào giỏ” hoặc “Mua ngay”. Bạn chưa cần đăng nhập: giỏ hàng được lưu trên trình duyệt này. Giá và tồn kho luôn được hệ thống tính lại mỗi lần bạn xem giỏ." },
      { tieuDe: "3. Đăng nhập khi thanh toán", noiDung: "Chỉ bước thanh toán cần tài khoản. Khi đăng nhập hoặc đăng ký, giỏ hàng bạn đã chọn được chuyển vào tài khoản." },
      { tieuDe: "4. Điền thông tin nhận hàng", noiDung: "Nhập họ tên, số điện thoại và địa chỉ nhận hàng, sau đó chọn thanh toán khi nhận hàng (COD) hoặc ví MoMo rồi bấm “Đặt hàng”." },
      { tieuDe: "5. Theo dõi và hủy đơn", noiDung: "Sau khi đặt, bạn nhận mã đơn hàng và theo dõi trạng thái trong mục “Đơn hàng của tôi”. Bạn có thể tự hủy đơn khi đơn còn ở trạng thái Chờ xác nhận, Chờ thanh toán MoMo hoặc Đang xử lý." },
    ],
  },
  "bao-hanh": {
    ten: "Chính sách bảo hành",
    mota: "Thông tin bảo hành sản phẩm.",
    daDuyet: false,
    muc: [{ tieuDe: "Đang cập nhật", noiDung: DANG_CAP_NHAT }],
  },
  "doi-tra": {
    ten: "Chính sách đổi trả",
    mota: "Thông tin đổi trả sản phẩm.",
    daDuyet: false,
    muc: [{ tieuDe: "Đang cập nhật", noiDung: DANG_CAP_NHAT }],
  },
  "giao-hang": {
    ten: "Chính sách giao hàng",
    mota: "Phí và thời gian giao hàng.",
    daDuyet: false,
    muc: [
      { tieuDe: "Đang cập nhật", noiDung: DANG_CAP_NHAT },
      { tieuDe: "Về phí vận chuyển trên website", noiDung: "Hệ thống hiện không cộng phí vận chuyển vào đơn hàng: tổng tiền ở bước thanh toán chỉ là tiền hàng. Điều này không có nghĩa là mọi đơn đều miễn phí giao hàng." },
    ],
  },
  "cau-hoi-thuong-gap": {
    ten: "Câu hỏi thường gặp",
    mota: "Những điều bạn có thể kiểm chứng ngay trên website.",
    daDuyet: true,
    muc: [
      { tieuDe: "Có cần đăng nhập để thêm vào giỏ không?", noiDung: "Không. Bạn chỉ cần đăng nhập ở bước thanh toán." },
      { tieuDe: "Có những hình thức thanh toán nào?", noiDung: "Thanh toán khi nhận hàng (COD) và ví MoMo." },
      { tieuDe: "Làm sao biết sản phẩm còn hàng?", noiDung: "Trang sản phẩm hiển thị số hàng còn lại của từng màu, size. Giỏ hàng cũng báo rõ dòng nào hết hàng hoặc không còn kinh doanh." },
      { tieuDe: "Giá trong giỏ có thể thay đổi không?", noiDung: "Có. Giá và khuyến mãi được tính lại mỗi lần bạn xem giỏ và khi đặt hàng; nếu giá đổi, giỏ hàng sẽ báo cho bạn." },
      { tieuDe: "Bảo hành, đổi trả và giao hàng thế nào?", noiDung: <>Các chính sách này đang được cập nhật, xem <Link href="/ChinhSach/bao-hanh">bảo hành</Link>, <Link href="/ChinhSach/doi-tra">đổi trả</Link>, <Link href="/ChinhSach/giao-hang">giao hàng</Link>.</> },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(TRANG).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = Object.hasOwn(TRANG, slug) ? TRANG[slug] : undefined; // không nhận khóa kế thừa như "constructor"/"__proto__"
  return t ? { title: `${t.ten} - Cửa Hàng Cầu Lông`, description: t.mota } : {};
}

export default async function ChinhSachPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = Object.hasOwn(TRANG, slug) ? TRANG[slug] : undefined;
  if (!t) notFound();
  return (
    <>
      <PageHero compact tone="green" kicker="Hỗ trợ khách hàng" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: t.ten }]} title={t.ten} sub={t.mota} />
      <Page className="cs-wrap">
        {!t.daDuyet && (
          <p className="cs-status" role="status"><i className="fa-solid fa-hourglass-half" aria-hidden="true" /> Đang cập nhật, chờ chủ cửa hàng duyệt nội dung.</p>
        )}
        <div className="cs-body">
          {t.muc.map((m) => (
            <section key={m.tieuDe} className="cs-card">
              <h2>{m.tieuDe}</h2>
              <p>{m.noiDung}</p>
            </section>
          ))}
        </div>
        <p className="cs-foot">
          Cần hỏi thêm? Xem <Link href="/Home/Contact">trang liên hệ</Link> hoặc hỏi trợ lý tư vấn ở góc phải màn hình. Các trang khác:{" "}
          {Object.entries(TRANG).filter(([k]) => k !== slug).map(([k, v], i) => <span key={k}>{i > 0 && " · "}<Link href={`/ChinhSach/${k}`}>{v.ten}</Link></span>)}
        </p>
      </Page>
    </>
  );
}
