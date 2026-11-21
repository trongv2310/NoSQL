import type { KetQuaTruc } from "@/lib/so-sanh-bieu-do";
import { DauVot, type Cot } from "./chung";
import s from "./so-sanh.module.css";

const TRANG_THAI: Record<KetQuaTruc["trangThai"], string> = { khac: "Khác nhau", giong: "Giống nhau", "chua-du": "Chưa đủ để so", "khac-don-vi": "Khác đơn vị" };
/** "tối đa 30 lbs" → "30 lbs": tên hàng đã nói là sức căng tối đa. */
const gon = (chu: string) => chu.replace(/^tối đa\s+/i, "");

/**
 * Năm thông số xếp thẳng cột với thẻ vợt phía trên: mỗi ô có dấu nhận biết vợt, giá trị ghi trong kho, nhãn "… nhất" khi khác nhau
 * và một thước nhỏ (cùng thang cho cả hàng) để mắt so vị trí. `chiKhac` ẩn các hàng mọi vợt giống nhau.
 * Phần này chỉ để nhìn; bản chữ đầy đủ cho trình đọc màn hình là bảng ẩn `BangSoSanh`.
 */
export function DongThongSo({ truc, cot, viTri, chiKhac }: { truc: KetQuaTruc[]; cot: Cot[]; viTri: Map<number, number>; chiKhac: boolean }) {
  const hien = chiKhac ? truc.filter((t) => t.trangThai !== "giong") : truc;
  const an = truc.filter((t) => !hien.includes(t));
  return (
    <div className={s.dsDong} aria-hidden="true">
      {hien.map((t) => (
        <div key={t.khoa} className={`${s.dong} ${t.trangThai === "giong" ? s.dongGiong : ""}`}>
          <div className={s.dongDau}>
            <h3 className={s.dongTen}>{t.ten}</h3>
            <span className={s.dongHuong}>{t.dauThap}<i className="fa-solid fa-arrow-right-long" />{t.dauCao}</span>
            <span className={`${s.chip} ${t.trangThai === "khac" ? s.chipCam : t.trangThai === "giong" ? s.chipXanh : ""}`}>{TRANG_THAI[t.trangThai]}</span>
          </div>
          <div className={s.dongO}>
            {cot.map((c) => {
              const k = viTri.get(c.i);
              const d = k === undefined ? undefined : t.diem[k];
              if (!d) return <div key={c.m.sanPhamId} className={s.o}><span className={s.oThieu}>—</span></div>;
              const nhat = t.idxCao.includes(d.idx) ? `${t.dauCao} nhất` : t.idxThap.includes(d.idx) ? `${t.dauThap} nhất` : null;
              return (
                <div key={c.m.sanPhamId} className={`${s.o} ${s[`v${c.i % 3}`]}`}>
                  <div className={s.oChu}>
                    <span className={s.oGiaTri}>
                      <DauVot i={c.i} />
                      {d.chu ? <b>{gon(d.chu)}</b> : <span className={s.oThieu}>Chưa có thông tin</span>}
                    </span>
                    {nhat && <span className={s.oNhat}>{nhat}</span>}
                  </div>
                  {d.vitri !== null && (
                    <span className={s.ray}><span className={`${s.rayDiem} ${s[`h${c.i % 3}`]}`} style={{ ["--x" as string]: d.vitri }} /></span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {an.length > 0 && <p className={s.dongAn}>Đang ẩn {an.length} thông số giống nhau: {an.map((t) => t.ten.toLowerCase()).join(", ")}.</p>}
    </div>
  );
}
