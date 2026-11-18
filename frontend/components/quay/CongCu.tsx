"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCatalog } from "@/components/landing/CatalogProvider";
import { fontTieuDe } from "@/components/landing/fonts";
import { demTheoHang, thongKeKho, votCoSucCang, type SanPhamLanding } from "@/lib/landing-data";
import { Khu } from "./KhuChung";
import { SoDem } from "./SoDem";
import s from "./cong-cu.module.css";

/** Dải số liệu ngay dưới màn hình đầu: mọi con số đếm từ danh sách sản phẩm đang bán (xem `thongKeKho`), không số nào tự đặt. */
export function DaiSoLieu() {
  const kho = useCatalog();
  const t = useMemo(() => thongKeKho(kho.items), [kho.items]);
  const tenHang = useMemo(() => demTheoHang(kho.items).map((h) => h.ten).join(", "), [kho.items]);
  if (kho.trangThai === "error") return null;
  if (kho.trangThai === "loading") return <div className={s.dai} aria-hidden="true"><div className={`container ${s.daiTrong}`} /></div>;
  if (t.soSanPham === 0) return null;
  const muc = [
    { so: t.soSanPham, nhan: "sản phẩm trong kho", phu: `${t.soConHang} còn hàng` },
    { so: t.soVot, nhan: "mẫu vợt", phu: "đang bán trên website" },
    { so: t.soHang, nhan: "thương hiệu", phu: tenHang },
    { so: t.soDangGiam, nhan: "đang giảm giá", phu: t.giamToiDa > 0 ? `mức giảm cao nhất ${t.giamToiDa}%` : "" },
  ];
  return (
    <section className={s.dai} aria-label="Số liệu cửa hàng lúc này">
      <div className={`container ${s.daiTrong}`}>
        <dl className={s.daiLuoi}>
          {muc.map((m) => (
            <div key={m.nhan} className={`${s.soLieu} sf-reveal`}>
              <dt className={s.soNhan}>{m.nhan}</dt>
              <dd className={s.soGiaTri}><SoDem den={m.so} className={fontTieuDe.className} /><small>{m.phu}</small></dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ───────────── Minh họa nhỏ cho từng công cụ: hình vẽ thuần, không phải dữ liệu (aria-hidden) ───────────── */

function VotNho({ x, y, dot }: { x: number; y: number; dot?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx="13" ry="18" className={s.nenVot} />
      <path d="M-9 -7h18M-11 0h22M-9 7h18M-4 -16v32M4 -16v32" className={s.daySvg} />
      <path d="M0 18v14" className={s.thanSvg} />
      <rect x="-3" y="32" width="6" height="22" rx="2.5" className={s.canSvg} />
      {dot !== undefined && <circle cx="0" cy={dot} r="4" className={s.chamSvg} />}
    </g>
  );
}

function HinhChonVot() {
  return (
    <svg viewBox="0 0 220 124" className={s.hinh} aria-hidden="true" focusable="false">
      {["Uy lực", "Tốc độ", "Kiểm soát"].map((t, i) => (
        <g key={t}>
          <rect x={6 + i * 72} y="6" width="64" height="24" rx="12" className={i === 1 ? s.thuocBat : s.thuoc} />
          <text x={38 + i * 72} y="22" textAnchor="middle" className={i === 1 ? s.chuBat : s.chuThuoc}>{t}</text>
        </g>
      ))}
      <path d="M110 34v12" className={s.mui} /><path d="M105 42l5 6 5-6" className={s.mui} />
      <VotNho x={42} y={72} dot={4} /><VotNho x={110} y={72} dot={14} /><VotNho x={178} y={72} dot={-6} />
    </svg>
  );
}

function HinhSoSanh() {
  const hang = [["Cân bằng", 62, 94], ["Độ cứng", 88, 58], ["Trọng lượng", 46, 72]] as const;
  return (
    <svg viewBox="0 0 220 124" className={s.hinh} aria-hidden="true" focusable="false">
      {hang.map(([t, a, b], i) => (
        <g key={t} transform={`translate(0 ${i * 38})`}>
          <text x="2" y="16" className={s.chuThuoc}>{t}</text>
          <rect x="74" y="4" width="140" height="9" rx="4.5" className={s.vach} /><rect x="74" y="4" width={a * 1.4} height="9" rx="4.5" className={s.vachXanh} />
          <rect x="74" y="17" width="140" height="9" rx="4.5" className={s.vach} /><rect x="74" y="17" width={b * 1.4} height="9" rx="4.5" className={s.vachCam} />
        </g>
      ))}
    </svg>
  );
}

function HinhTuVot() {
  return (
    <svg viewBox="0 0 220 124" className={s.hinh} aria-hidden="true" focusable="false">
      <rect x="10" y="4" width="200" height="116" rx="12" className={s.tu} />
      <path d="M110 4v116" className={s.vachTu} />
      <VotNho x={44} y={42} dot={2} /><VotNho x={110} y={42} dot={10} /><VotNho x={176} y={42} dot={-4} />
      <g transform="translate(150 16)"><circle cx="0" cy="0" r="10" className={s.chuong} /><path d="M-4 3h8M-3 3v-4a3 3 0 016 0v4M-1.5 5.5h3" className={s.chuongNet} /></g>
    </svg>
  );
}

function HinhCangCuoc({ sucCang }: { sucCang?: string }) {
  const tick = Array.from({ length: 19 }, (_, i) => 12 + i * 18);
  return (
    <svg viewBox="0 0 360 96" className={`${s.hinh} ${s.hinhRong}`} aria-hidden="true" focusable="false">
      <rect x="92" y="40" width="170" height="22" rx="6" className={s.dai2} />
      <path d="M12 51h336" className={s.thuoc2} />
      {tick.map((x, i) => <path key={x} d={`M${x} ${i % 3 === 0 ? 42 : 46}v${i % 3 === 0 ? 18 : 10}`} className={s.thuoc2} />)}
      <circle cx="176" cy="51" r="9" className={s.chamSvg} />
      {sucCang && <text x="177" y="26" textAnchor="middle" className={s.chuCang}>{sucCang}</text>}
      <text x="12" y="86" className={s.chuThuoc}>nhẹ tay</text><text x="348" y="86" textAnchor="end" className={s.chuThuoc}>căng mạnh</text>
    </svg>
  );
}

function HinhHoiDap() {
  return (
    <svg viewBox="0 0 220 124" className={s.hinh} aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="140" height="42" rx="14" className={s.boiTrai} />
      <rect x="20" y="18" width="104" height="6" rx="3" className={s.dongXam} /><rect x="20" y="30" width="70" height="6" rx="3" className={s.dongXam} />
      <rect x="64" y="58" width="150" height="48" rx="14" className={s.boiPhai} />
      <rect x="80" y="70" width="112" height="6" rx="3" className={s.dongTrang} /><rect x="80" y="82" width="80" height="6" rx="3" className={s.dongTrang} />
      <circle cx="176" cy="94" r="2.6" className={s.dongTrang} /><circle cx="186" cy="94" r="2.6" className={s.dongTrang} /><circle cx="196" cy="94" r="2.6" className={s.dongTrang} />
    </svg>
  );
}

function O({ cls, href, tieuDe, children, hinh, hanhDong }: { cls: string; href: string; tieuDe: string; children: React.ReactNode; hinh: React.ReactNode; hanhDong: string }) {
  const trong = href.startsWith("#");
  return (
    <li className={`${s.o} ${cls} sf-reveal`}>
      <div className={s.hinhKhung}>{hinh}</div>
      <h3 className={`${s.oTen} ${fontTieuDe.className}`}>
        {trong ? <a href={href} className={s.oLienKet}>{tieuDe}</a> : <Link href={href} className={s.oLienKet}>{tieuDe}</Link>}
      </h3>
      <p className={s.oMoTa}>{children}</p>
      <span className={s.oHanhDong} aria-hidden="true">{hanhDong} <i>→</i></span>
    </li>
  );
}

const ruotLienKetVot = (sp: SanPhamLanding | null) => (sp ? `/Home/ChiTietSanPham/${sp.id}` : "/SanPham/Index?loai=Vot");

/** Năm công cụ của shop, mỗi ô dẫn tới tính năng đã có (đều là liên kết thật). Ô "trạm căng cước" dẫn tới một cây vợt thật có ghi sức căng trong kho. */
export function CongCu() {
  const kho = useCatalog();
  const vot = useMemo(() => votCoSucCang(kho.items), [kho.items]);
  return (
    <Khu id="cong-cu" nen="xam" kicker="Công cụ của shop" tieuDe="Chọn đúng vợt trước khi mua" moTa="Năm công cụ có sẵn trên website: từ chọn theo lối chơi, đặt vợt cạnh nhau, nhớ lịch căng cước đến hỏi người bán.">
      <ul className={s.luoi}>
        <O cls={s.o1} href="#quay-tu-van" tieuDe="Chọn vợt theo lối chơi" hinh={<HinhChonVot />} hanhDong="Về Quầy tư vấn">
          Chọn lối chơi, trình độ, ngân sách: shop đưa ra 3 cây còn hàng kèm lý do tính từ thông số ghi trong kho.
        </O>
        <O cls={s.o2} href="/so-sanh" tieuDe="So sánh vợt" hinh={<HinhSoSanh />} hanhDong="Mở trang so sánh">
          Đặt 2–3 vợt cạnh nhau theo giá, tồn kho và thông số; liên kết so sánh chia sẻ được cho bạn bè.
        </O>
        <O cls={s.o3} href="/tu-vot" tieuDe="Tủ vợt của tôi" hinh={<HinhTuVot />} hanhDong="Mở tủ vợt">
          Ghi vợt đang dùng, ngày căng và chu kỳ nhắc do bạn đặt. Dữ liệu lưu trên trình duyệt này.
        </O>
        <O cls={s.o4} href={ruotLienKetVot(vot)} tieuDe="Trạm căng cước" hinh={<HinhCangCuoc sucCang={vot?.thongSoVot?.sucCang} />} hanhDong={vot ? `Thử với ${vot.tenSanPham.replace(/^Vợt Cầu Lông\s+/i, "")}` : "Xem các vợt"}>
          Chọn mức căng trong khoảng nhà sản xuất ghi cho đúng phiên bản vợt, có đổi kg và lbs. Trạm nằm ở trang chi tiết của từng cây vợt; vợt chưa có số liệu sức căng thì trạm nói rõ là chưa có.
        </O>
        <O cls={s.o5} href="#hoi-nguoi-ban" tieuDe="Hỏi người bán" hinh={<HinhHoiDap />} hanhDong="Mở khung hỏi đáp">
          Hỏi bằng lời của bạn: shop tra giá, tồn kho, khuyến mãi và gợi ý theo dữ liệu đang có. Chưa có thông tin thì nói là chưa có.
        </O>
      </ul>
    </Khu>
  );
}
