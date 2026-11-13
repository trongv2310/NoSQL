import Link from "next/link";
import { HinhVot } from "@/components/product/DaiThongSo";
import { vnd } from "@/lib/format";
import { duongDanSoSanh, TOI_DA_SO_SANH, TOI_THIEU_SO_SANH, type MucSoSanh } from "@/lib/so-sanh";
import type { CapGoiY, UngVienSoSanh } from "@/lib/so-sanh-bieu-do";
import { tenNganVot } from "@/lib/so-sanh-du-lieu";
import { BieuDoNhen } from "./BieuDoNhen";
import { tinhTruc } from "@/lib/so-sanh-bieu-do";
import s from "./so-sanh.module.css";

const TRUC_TRONG = tinhTruc([]);
// y của chấm cân bằng trên HinhVot (18 = đầu vợt … 118 = cán), cùng cách tính với `diemCanBangY` nhưng từ bậc đã có.
const yCham = (bac: number | undefined) => (bac === undefined ? null : Math.round(80 - (Math.max(-2, Math.min(3, bac)) + 2) * 12));

function VotMini({ v, daChon }: { v: UngVienSoSanh; daChon?: boolean }) {
  return (
    <div className={`${s.capVot} ${daChon ? s.capDaChon : ""}`}>
      <HinhVot className={s.hinhVot} diem={yCham(v.canBang?.bac)} />
      <span className={s.capTen}>{tenNganVot(v.ten)}</span>
      <span className={s.capChu}>{[v.canBang?.chu, v.doCung?.chu && `thân ${v.doCung.chu.toLowerCase()}`].filter(Boolean).join(" · ") || "Chưa có thông số"}</span>
      <span className={s.capChu}><b>{vnd(v.gia)}</b></span>
      {daChon && <span className={s.capChu}>Đã chọn</span>}
    </div>
  );
}

/**
 * Màn hình mời chọn vợt khi có ít hơn 2 vợt: khung biểu đồ trống làm hình minh họa (không có số liệu), và vài cặp vợt thật còn hàng để so ngay.
 * Gợi ý chỉ chọn cặp mà thông số ghi trong kho có chỗ khác nhau; đây là cách xem khác biệt, không phải khuyến nghị mua.
 */
export function ManHinhMoi({ muc, goiY, dangTai, loi, daChon }: { muc: MucSoSanh[]; goiY: CapGoiY[]; dangTai: boolean; loi: boolean; daChon: UngVienSoSanh | null }) {
  const dung = daChon?.id ?? null;
  return (
    <section className={s.moi} aria-labelledby="moi-tieu-de">
      <div className={s.moiTren}>
        <div className={s.moiChu}>
          <h2 id="moi-tieu-de">Đặt hai đến ba cây vợt cạnh nhau</h2>
          <p role="status">{muc.length === 0 ? "Chưa có vợt nào để so sánh." : "Mới có 1 vợt."} Hãy chọn từ {TOI_THIEU_SO_SANH} đến {TOI_DA_SO_SANH} vợt. Bạn cũng có thể bấm nút so sánh trên thẻ vợt ở trang <Link href="/SanPham/Index?loai=Vot">danh sách</Link>.</p>
          <p>Khi đủ vợt, trang sẽ vẽ biểu đồ nhện, thước đo ngang cho điểm cân bằng, độ cứng, trọng lượng, chiều dài, sức căng, cùng thanh giá và tồn kho. Số liệu lấy từ thông số ghi trong kho.</p>
        </div>
        <div className={s.moiHinh}><BieuDoNhen vot={[]} truc={TRUC_TRONG} moTa="" minhHoa /></div>
      </div>
      {goiY.length > 0 ? (
        <div>
          <h2 className="h5" style={{ margin: "0 0 2px" }}>{dung ? "Thêm một vợt để so với vợt bạn đã chọn" : "Vài cặp vợt còn hàng để so ngay"}</h2>
          <p className={s.ghiTrong} style={{ marginBottom: 12 }}>Các cặp dưới đây ghi thông số khác nhau, nên xem trên biểu đồ sẽ thấy rõ khác biệt. Đây chỉ là gợi ý để so sánh, không phải khuyến nghị mua.</p>
          <div className={s.gocGoiY}>
            {goiY.map((c) => {
              const ds: MucSoSanh[] = [{ sanPhamId: c.a.id, bienTheId: null }, { sanPhamId: c.b.id, bienTheId: null }];
              const cap = dung ? [muc[0], { sanPhamId: c.b.id, bienTheId: null }] : ds;
              return (
                <div key={`${c.a.id}-${c.b.id}`} className={s.cap}>
                  <div className={s.capHai}>
                    <VotMini v={c.a} daChon={dung === c.a.id} />
                    <span className={s.capGiua} aria-hidden="true"><i className="fa-solid fa-code-compare" /></span>
                    <VotMini v={c.b} />
                  </div>
                  <p className={s.capKhac}>Khác nhau ở: {c.khacNhau.join(", ")}.</p>
                  <Link className={s.nutLien} href={duongDanSoSanh(cap)} aria-label={`So sánh ${c.a.ten} với ${c.b.ten}`}>So sánh cặp này</Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className={s.ghiTrong} role="status">{loi ? "Chưa tải được danh sách vợt để gợi ý. Bạn vẫn có thể chọn vợt ở ô bên dưới." : dangTai ? "Đang tìm cặp vợt còn hàng để gợi ý…" : "Chưa có cặp vợt còn hàng nào ghi thông số khác nhau để gợi ý. Hãy chọn vợt ở ô bên dưới."}</p>
      )}
    </section>
  );
}
