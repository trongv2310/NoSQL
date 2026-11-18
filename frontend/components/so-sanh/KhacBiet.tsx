import type { KieuKhacBiet, MucKhacBiet } from "@/lib/so-sanh-bieu-do";
import { DauVot, nhanVot } from "./chung";
import s from "./so-sanh.module.css";

const LOAI: Record<KieuKhacBiet, { chu: string; lop: string }> = {
  "khac": { chu: "Khác nhau", lop: s.kbKhac },
  "giong": { chu: "Giống nhau", lop: s.kbGiong },
  "thieu": { chu: "Thiếu dữ liệu", lop: s.kbThieu },
  "khac-don-vi": { chu: "Khác đơn vị", lop: s.kbThieu },
  "het-hang": { chu: "Hết hàng", lop: s.kbHet },
  "phien-ban": { chu: "Theo phiên bản", lop: s.kbThieu },
};

/**
 * "Điểm khác biệt" dạng thẻ: mỗi thông số một thẻ, mỗi vợt một huy hiệu (màu + hình + chữ). Chỉ nêu chênh lệch của dữ liệu thật,
 * không kết luận cây nào hay hơn và không dự đoán kết quả thi đấu. `viTri[idx]` đổi chỉ số trong danh sách đã chuẩn hóa về vị trí vợt (màu/hình).
 */
export function KhacBiet({ muc, viTri }: { muc: MucKhacBiet[]; viTri: number[] }) {
  return (
    <section className={s.cuonKB} aria-labelledby="doi-chieu">
      <h2 id="doi-chieu" className="h5">Điểm khác biệt từ dữ liệu</h2>
      <p className={s.gioiThieu} style={{ margin: "2px 0 0" }}>Chỉ nêu chênh lệch của dữ liệu trong kho, không kết luận cây nào hay hơn và không dự đoán kết quả thi đấu.</p>
      <ul className={s.luoiKB}>
        {muc.map((m) => {
          const l = LOAI[m.kieu];
          return (
            <li key={m.khoa} className={`${s.kb} ${l.lop}`}>
              <div className={s.kbDau}>
                <h3 className={s.kbTen}>{m.tieuDe}</h3>
                <span className={s.kbLoai}>{l.chu}</span>
              </div>
              {m.kieu === "giong" && m.huyHieu.length > 1 && m.huyHieu.every((h) => h.giaTri === m.huyHieu[0].giaTri) ? (
                <div className={s.hh}>
                  {m.huyHieu.map((h) => <DauVot key={h.idx} i={viTri[h.idx as number] ?? (h.idx as number)} />)}
                  <b>Cả {m.huyHieu.length} vợt</b> <span>giống nhau</span><span className={s.hhGiaTri}>({m.huyHieu[0].giaTri})</span>
                </div>
              ) : m.huyHieu.map((h) => {
                const vi = h.idx === null ? null : viTri[h.idx] ?? h.idx;
                return (
                  <div key={`${h.idx}-${h.nhan}`} className={`${s.hh} ${vi !== null ? s[`v${vi % 3}`] : ""}`}>
                    {vi !== null && <DauVot i={vi} />}
                    <b>{vi !== null ? nhanVot(vi) : ""}</b> <span>{h.nhan}</span>
                    {h.giaTri && <span className={s.hhGiaTri}>({h.giaTri})</span>}
                  </div>
                );
              })}
              {m.ghiChu && <p className={s.kbGhiChu}>{m.ghiChu}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
