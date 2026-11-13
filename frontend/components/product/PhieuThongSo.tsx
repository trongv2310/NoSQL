"use client";

import { useHoSo } from "@/components/HoSoChoi";
import { loiChoiCuaThongSo } from "@/lib/landing-data";
import { NHAN_LOI_CHOI } from "@/lib/ho-so-choi";
import type { ThongSoVotV } from "@/lib/types";
import { fontTieuDe } from "@/components/landing/fonts";
import { DnaVot } from "./DnaVot";
import { maU } from "./DaiThongSo";
import s from "./bento.module.css";

type Khoa = "doCanBang" | "trongLuong" | "doCung" | "chieuDai" | "sucCang";

/** Giải thích bằng lời thường cho từng trường. Chỉ nói thuật ngữ nghĩa là gì, không hứa hiệu năng hay độ an toàn của cây vợt cụ thể. */
const TRUONG: { khoa: Khoa; ten: string; giaiThich: string }[] = [
  { khoa: "doCanBang", ten: "Điểm cân bằng", giaiThich: "Cho biết trọng tâm cây vợt nằm gần đầu hay gần cán. Nặng đầu thường dồn lực vào cú đập nhưng cầm nặng tay hơn; nhẹ đầu linh hoạt hơn khi đổi hướng." },
  { khoa: "trongLuong", ten: "Trọng lượng", giaiThich: "Ký hiệu U càng nhỏ thì vợt càng nặng (3U nặng hơn 4U, 4U nặng hơn 5U). Khoảng gram ghi theo từng hãng." },
  { khoa: "doCung", ten: "Độ cứng thân", giaiThich: "Mức thân vợt uốn khi vung. Thân cứng cần lực cổ tay tốt hơn; thân mềm dễ dùng hơn cho người mới." },
  { khoa: "chieuDai", ten: "Chiều dài", giaiThich: "Tổng chiều dài cây vợt theo nhà sản xuất." },
  { khoa: "sucCang", ten: "Sức căng", giaiThich: "Mức căng dây tối đa nhà sản xuất cho phép với khung vợt này, không phải mức căng đã được căng sẵn." },
];

/**
 * Phiếu thông số Bento của MỘT phiên bản: Racket DNA + 5 trường thật, mỗi ô có giải thích bằng lời thường. Đổi phiên bản ở trang chi tiết thì phiếu
 * (và DNA) đổi theo. Trường thiếu hoặc khác nhau giữa các phiên bản được nói rõ; không có số đo suy đoán, radar hay điểm phần trăm.
 */
export function PhieuThongSo({ ts, nhanPhienBan, khacNhau }: { ts: ThongSoVotV | null | undefined; nhanPhienBan: string; khacNhau?: Record<string, string[]> }) {
  const hs = useHoSo();
  const hop = loiChoiCuaThongSo(ts ?? null);
  let fit: { noiDung: string; khong: boolean } | null = null;
  if (hs.lc) {
    if (!hop.length) fit = { noiDung: `Phiên bản này chưa đủ thông số để xét lối chơi ${NHAN_LOI_CHOI[hs.lc]} của bạn.`, khong: true };
    else if (hop.includes(hs.lc)) fit = { noiDung: `Theo thông số ghi trong kho, phiên bản này hợp lối chơi ${NHAN_LOI_CHOI[hs.lc]} của bạn.`, khong: false };
    else fit = { noiDung: `Theo thông số ghi trong kho, phiên bản này nghiêng về ${hop.map((k) => NHAN_LOI_CHOI[k]).join(" / ")} hơn là ${NHAN_LOI_CHOI[hs.lc]}.`, khong: true };
  }
  const u = maU(ts);
  return (
    <div className={s.bento} role="group" aria-label={`Phiếu thông số ${nhanPhienBan}`}>
      {fit && <p className={`${s.fit} ${fit.khong ? s.fitKhong : ""}`}>{fit.noiDung}</p>}
      <dl className={s.luoi}>
        <div className={`${s.o} ${s.dnaO}`}>
          <dt>Racket DNA</dt>
          <dd><DnaVot ts={ts} nhanPhienBan={nhanPhienBan} /></dd>
        </div>
        {TRUONG.map((t) => {
          const v = ts?.[t.khoa];
          const tuy = khacNhau?.[t.khoa];
          const rong = t.khoa === "sucCang" || t.khoa === "doCanBang" || t.khoa === "chieuDai";
          return (
            <div className={`${s.o} ${v ? "" : s.thieu} ${rong ? s.rong2 : ""}`} key={t.khoa}>
              <dt>{t.ten}</dt>
              {v ? (
                <>
                  <dd className={t.khoa === "trongLuong" && u ? `${s.so} ${fontTieuDe.className}` : undefined}>{t.khoa === "trongLuong" && u ? u : v}</dd>
                  {t.khoa === "trongLuong" && u && <p>{v}</p>}
                  <p>{t.giaiThich}</p>
                </>
              ) : (
                <dd>Chưa có thông tin cho phiên bản này.</dd>
              )}
              {tuy && <span className={s.tuy}>Khác nhau giữa các phiên bản; đang hiện theo phiên bản đã chọn.</span>}
              {t.khoa === "sucCang" && v && <a href="#tram-cang" className={s.lienKet}>Mở trạm căng cước ↓</a>}
            </div>
          );
        })}
      </dl>
      <p className={s.ghiChu}>Thông số theo dữ liệu cửa hàng ghi cho từng phiên bản; cảm giác khi chơi còn tùy người cầm vợt và dây căng. Hình DNA chỉ minh họa mức độ.</p>
    </div>
  );
}
