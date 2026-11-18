import Link from "next/link";
import { vnd } from "@/lib/format";
import { nhanBienThe } from "@/lib/so-sanh-du-lieu";
import { DauVot, nhanVot, type Cot } from "./chung";
import s from "./so-sanh.module.css";

const CHUA = "Chưa có thông tin";

/**
 * Bảng đầy đủ (bản dự phòng truy cập của biểu đồ): mọi thông số ghi trong kho dạng chữ. `hienThi = false` thì bảng vẫn nằm trong trang nhưng ẩn về mặt
 * thị giác (dành cho trình đọc màn hình khi đang xem dạng biểu đồ), và không có liên kết/nút nào để bàn phím không rơi vào chỗ vô hình.
 */
export function BangSoSanh({ cot, hienThi }: { cot: Cot[]; hienThi: boolean }) {
  const hang = (ten: string, lay: (c: Extract<Cot, { trangThai: "ok" }>) => React.ReactNode) => (
    <tr key={ten}>
      <th scope="row">{ten}</th>
      {cot.map((c) => <td key={c.m.sanPhamId}>{c.trangThai === "ok" ? lay(c) : "—"}</td>)}
    </tr>
  );
  const bang = (
    <div className={hienThi ? s.cuon : undefined}>
      <table className={s.bang}>
        <caption className="visually-hidden">Bảng so sánh {cot.length} vợt: giá, tồn kho và 5 thông số ghi trong kho</caption>
        <thead>
          <tr>
            <th scope="col"><span className="visually-hidden">Thông tin</span></th>
            {cot.map((c) => (
              <th scope="col" key={c.m.sanPhamId}>
                <span className={s.bangDau}>{hienThi && <DauVot i={c.i} />}{nhanVot(c.i)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Vợt</th>
            {cot.map((c) => {
              if (c.trangThai === "dang") return <td key={c.m.sanPhamId}>Đang tải…</td>;
              if (c.trangThai === "loi") return <td key={c.m.sanPhamId}>Không tải được vợt này.</td>;
              const sp = c.ct.sanPham;
              return <td key={c.m.sanPhamId}>{hienThi ? <Link href={`/Home/ChiTietSanPham/${sp.id}`}>{sp.tenSanPham}</Link> : sp.tenSanPham}{c.trangThai === "bien-the-sai" ? " (phiên bản trong liên kết không hợp lệ)" : ""}</td>;
            })}
          </tr>
          {hang("Phiên bản", (c) => nhanBienThe(c.bien))}
          {hang("Giá", (c) => <b>{vnd(c.bien.giaThucTe)}</b>)}
          {hang("Tồn kho", (c) => (c.bien.soLuongTon > 0 ? `Còn ${c.bien.soLuongTon}` : "Hết hàng"))}
          {hang("Điểm cân bằng", (c) => c.bien.thongSo?.doCanBang ?? CHUA)}
          {hang("Trọng lượng", (c) => c.bien.thongSo?.trongLuong ?? CHUA)}
          {hang("Độ cứng", (c) => c.bien.thongSo?.doCung ?? CHUA)}
          {hang("Chiều dài", (c) => c.bien.thongSo?.chieuDai ?? CHUA)}
          {hang("Sức căng", (c) => c.bien.thongSo?.sucCang ?? CHUA)}
        </tbody>
      </table>
    </div>
  );
  return hienThi ? bang : <div className="visually-hidden" data-bang-an="">{bang}</div>;
}
