import { vnd } from "@/lib/format";
import { tinhThanhGia, tinhThanhTon, type KetQuaTruc } from "@/lib/so-sanh-bieu-do";
import { DauVot, nhanVot, type VotBieuDo } from "./chung";
import s from "./so-sanh.module.css";

/**
 * Thước đo ngang cho từng thông số: các vợt nằm trên CÙNG một thang, mỗi vợt một làn riêng (màu + hình) nên vợt bằng nhau vẫn thấy cả hai.
 * Dải mờ nối vợt thấp nhất tới cao nhất cho thấy khoảng cách. Chữ "cao nhất/thấp nhất" chỉ nói giá trị của thông số đó lớn hơn/nhỏ hơn.
 */
export function ThuocDo({ truc, vot }: { truc: KetQuaTruc[]; vot: VotBieuDo[] }) {
  return (
    <div>
      {truc.map((t) => {
        const co = t.diem.filter((d) => d.vitri !== null);
        const a = co.length ? Math.min(...co.map((d) => d.vitri as number)) : 0;
        const b = co.length ? Math.max(...co.map((d) => d.vitri as number)) : 0;
        const trangThai = t.trangThai === "giong" ? "Giống nhau" : t.trangThai === "khac" ? "Khác nhau" : t.trangThai === "khac-don-vi" ? "Khác đơn vị" : t.trong ? "Chưa có thông tin" : "Chưa đủ để so";
        return (
          <section key={t.khoa} className={s.thuoc} aria-label={`${t.ten}: ${trangThai}`}>
            <div className={s.thuocDau}>
              <h3 className={s.thuocTen}>{t.ten}</h3>
              <span className={s.huong}>{t.dauThap} → {t.dauCao}{t.donViMoc ? ` (${t.donViMoc})` : ""}</span>
              <span className={`${s.nhanTT} ${t.trangThai === "khac" ? s.nhanKhac : ""}`}>{trangThai}</span>
            </div>
            <div className={s.thuocThan}>
              <div className={s.duong}>
                <div className={s.luoiDoc} aria-hidden="true">{t.moc.map((m) => <i key={m.chu} style={{ ["--x" as string]: m.vitri }} />)}</div>
                {co.length >= 2 && t.trangThai !== "giong" && <span className={s.khoang} style={{ ["--a" as string]: a, ["--b" as string]: b }} aria-hidden="true" />}
                {t.diem.map((d, k) => {
                  const v = vot[k];
                  if (!v) return null;
                  const noi = t.idxCao.includes(d.idx) || t.idxThap.includes(d.idx);
                  return (
                    <div className={`${s.lan} ${s[`v${v.i % 3}`]}`} key={v.i}>
                      {d.vitri === null ? (
                        <span className={s.chuThieu}>{d.chu ? `${d.chu} (khác đơn vị)` : "Chưa có thông tin"}</span>
                      ) : (
                        <>
                          <span className={`${s.cham} ${s[`h${v.i % 3}`]} ${noi ? s.chamNoi : ""}`} style={{ ["--x" as string]: d.vitri }} aria-hidden="true" />
                          <span className={`${s.chuCham} ${d.vitri > 0.55 ? s.chuTrai : ""}`} style={{ ["--x" as string]: d.vitri }}>{d.chu}{d.ngoaiThang ? " ›" : ""}</span>
                        </>
                      )}
                    </div>
                  );
                })}
                <div className={s.moc} aria-hidden="true">
                  {t.moc.map((m, k) => <span key={m.chu} className={k === 0 ? s.dauTien : k === t.moc.length - 1 ? s.cuoi : ""} style={{ ["--x" as string]: m.vitri }}>{m.chu}</span>)}
                </div>
              </div>
              <div aria-hidden="false">
                {t.diem.map((d, k) => {
                  const v = vot[k];
                  if (!v) return null;
                  const nhan = t.idxCao.includes(d.idx) ? `${t.dauCao} nhất` : t.idxThap.includes(d.idx) ? `${t.dauThap} nhất` : "";
                  return <div className={s.nhanLan} key={v.i}>{nhan ? <b>{nhan}</b> : <span className="visually-hidden">{nhanVot(v.i)}</span>}</div>;
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Thanh giá (bắt đầu từ 0, đánh dấu rẻ nhất/đắt nhất) và thanh tồn kho. */
export function ThanhGiaTon({ hs, vot, loai }: { hs: Parameters<typeof tinhThanhGia>[0]; vot: VotBieuDo[]; loai: "gia" | "ton" }) {
  if (loai === "gia") {
    const g = tinhThanhGia(hs);
    return (
      <>
        <ul className={s.thanhDS}>
          {g.thanh.map((b) => {
            const v = vot[b.idx];
            if (!v) return null;
            return (
              <li key={v.i} className={`${s.hangThanh} ${s[`v${v.i % 3}`]}`}>
                <span className={s.hangTen}><DauVot i={v.i} />{nhanVot(v.i)}</span>
                <span className={s.nenThanh} aria-hidden="true"><span className={s.thanh} style={{ ["--ti" as string]: b.ti }} /></span>
                <span className={s.chuThanh}>
                  <span>{vnd(b.giaTri)}</span>
                  {b.reNhat && <span className={`${s.nhanTT} ${s.nhanRe}`}>Rẻ nhất</span>}
                  {b.datNhat && <span className={`${s.nhanTT} ${s.nhanDat}`}>Đắt nhất</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p className={s.ghiThanh}>{g.giongNhau ? "Các vợt có giá bằng nhau." : "Thanh bắt đầu từ 0 đ nên độ dài là tỉ lệ thật giữa các giá."}</p>
      </>
    );
  }
  const t = tinhThanhTon(hs);
  return (
    <>
      <ul className={s.thanhDS}>
        {t.thanh.map((b) => {
          const v = vot[b.idx];
          if (!v) return null;
          return (
            <li key={v.i} className={`${s.hangThanh} ${s[`v${v.i % 3}`]}`}>
              <span className={s.hangTen}><DauVot i={v.i} />{nhanVot(v.i)}</span>
              <span className={s.nenThanh} aria-hidden="true"><span className={`${s.thanh} ${b.het ? s.thanhRong : ""}`} style={{ ["--ti" as string]: b.het ? 1 : b.ti }} /></span>
              <span className={s.chuThanh}>
                <span>{b.het ? "Hết hàng" : `Còn ${b.giaTri}`}</span>
                {b.nhieuNhat && <span className={`${s.nhanTT} ${s.nhanRe}`}>Còn nhiều nhất</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={s.ghiThanh}>Tồn kho của phiên bản đang chọn; thanh so với vợt còn nhiều nhất trong nhóm.</p>
    </>
  );
}
