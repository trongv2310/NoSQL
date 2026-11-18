import { bacCanBang } from "@/lib/landing-data";
import type { ThongSoVotV } from "@/lib/types";
import { fontTieuDe } from "@/components/landing/fonts";
import s from "./the-san-pham.module.css";

const NHAN_TRUONG: Record<string, string> = { doCanBang: "điểm cân bằng", trongLuong: "trọng lượng", doCung: "độ cứng", chieuDai: "chiều dài", sucCang: "sức căng" };

/** Mã trọng lượng ngắn: "3U (85-89g)" → "3U". */
export const maU = (ts?: ThongSoVotV | null) => /^\s*(\d\s*U)/i.exec(ts?.trongLuong ?? "")?.[1].replace(/\s/g, "").toUpperCase() ?? null;

/** Vợt dựng đứng tối giản (đầu ở trên, cán ở dưới) dùng làm nền cho vạch điểm cân bằng và làm hình giữ chỗ khi chưa có ảnh chuẩn. */
export function HinhVot({ className, diem }: { className?: string; diem?: number | null }) {
  return (
    <svg className={className} viewBox="0 0 60 150" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="30" cy="40" rx="22" ry="32" stroke="currentColor" strokeWidth="3" />
      <path d="M12 28h36M10 40h40M12 52h36M22 10v60M30 8v64M38 10v60" stroke="currentColor" strokeWidth=".8" opacity=".35" />
      <path d="M30 72v22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="26" y="94" width="8" height="44" rx="3" fill="currentColor" opacity=".85" />
      {diem != null && <circle className={s.diemCanBang} cx="30" cy={diem} r="5" />}
    </svg>
  );
}

/** y của chấm cân bằng trên HinhVot: 18 (đầu vợt) … 118 (cán). Mức định tính từ chữ ghi trong kho, không phải số đo; không có thì null. */
export function diemCanBangY(ts?: ThongSoVotV | null): number | null {
  const b = bacCanBang(ts ?? null);
  return b === null ? null : Math.round(80 - (Math.max(-2, Math.min(3, b)) + 2) * 12);
}

/**
 * Dải thông số gọn của một cây vợt, chỉ từ giá trị thật trong kho: vị trí chấm trên thân vợt là mức định tính của "điểm cân bằng"
 * (nặng đầu → gần đầu, nhẹ đầu → gần cán), KHÔNG phải số mm. Trường mà các phiên bản khác nhau được ghi "tùy phiên bản".
 */
export function DaiThongSo({ ts, khacNhau, lon = false, anHinh = false }: { ts?: ThongSoVotV | null; khacNhau?: Record<string, string[]>; lon?: boolean; anHinh?: boolean }) {
  const u = maU(ts);
  const tuyBien = Object.keys(khacNhau ?? {});
  if (!ts && !tuyBien.length) return null;
  // y của chấm: 18 (đầu vợt) … 118 (cán); mức định tính, không phải số đo.
  const y = diemCanBangY(ts);
  const mo = [
    ts?.trongLuong && `Trọng lượng ${ts.trongLuong}`, ts?.doCanBang && `cân bằng ${ts.doCanBang}`, ts?.doCung && `độ cứng ${ts.doCung}`,
    tuyBien.length ? `${tuyBien.map((k) => NHAN_TRUONG[k] ?? k).join(", ")} tùy phiên bản` : "",
  ].filter(Boolean).join(", ");
  return (
    <div className={`${s.dai} ${lon ? s.daiLon : ""}`} role="group" aria-label={`Thông số: ${mo}`}>
      {!anHinh && <HinhVot className={s.daiHinh} diem={y} />}
      <dl className={s.daiBang}>
        {u && <div className={s.daiU}><dt>Trọng lượng</dt><dd className={`${s.so} ${fontTieuDe.className}`}>{u}</dd></div>}
        {ts?.doCanBang && <div><dt>Cân bằng</dt><dd>{ts.doCanBang}</dd></div>}
        {ts?.doCung && <div><dt>Độ cứng</dt><dd>{ts.doCung}</dd></div>}
        {tuyBien.length > 0 && <div className={s.daiTuyBien}><dt>Tùy phiên bản</dt><dd>{tuyBien.map((k) => NHAN_TRUONG[k] ?? k).join(", ")}</dd></div>}
      </dl>
    </div>
  );
}
