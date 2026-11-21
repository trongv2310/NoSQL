/**
 * Thêm từng món vào giỏ và gộp các lần gọi đồng thời. Khi thử lại, chỉ gửi các món còn thiếu.
 * Kết quả chưa rõ cần kiểm tra giỏ. Khi đổi tài khoản hoặc hủy thao tác, dừng gửi các món còn lại.
 */
export type TrangThaiMon = "cho" | "dang" | "xong" | "loi" | "chua-ro" | "bo-qua";
export interface MonCombo { khoa: string; nhan: string; trangThai: TrangThaiMon; thongBao?: string }
export type KetQuaThemMon = { ok: true; doiTaiKhoan?: boolean } | { ok: false; chuaRo?: boolean; thongBao?: string; doiTaiKhoan?: boolean };
export type TongKetCombo = "chua-chay" | "dang-chay" | "tron-bo" | "thieu" | "gian-doan";

export interface BoCombo {
  doc(): { mon: MonCombo[]; tongKet: TongKetCombo; dangChay: boolean };
  /** Chạy (hoặc thử lại) các món chưa xong. Gọi lại trong lúc đang chạy trả về chính lần chạy đó. */
  chay(): Promise<void>;
  /** Dừng bộ này (gỡ component, đổi danh tính): không gửi thêm món nào nữa. Món đang bay vẫn có thể hoàn tất ở máy chủ nhưng không còn tác dụng phụ trên giao diện. */
  huy(): void;
  /** Người dùng đã tự kiểm tra giỏ và muốn thử lại món "chưa rõ". */
  xacNhanThuLai(khoa: string): void;
  /** Đặt lại về đầu (đổi vợt/biến thể/loại quấn cán): bỏ trạng thái đã thêm của bộ cũ. */
  datLai(mon: { khoa: string; nhan: string }[]): void;
}

export function taoBoCombo(
  mon: { khoa: string; nhan: string }[],
  them: (khoa: string) => Promise<KetQuaThemMon>,
  khiDoi?: () => void,
  /** Trả false khi danh tính đã đổi so với lúc bấm (kiểm tra ĐỒNG BỘ ngay trước mỗi món và sau mỗi phản hồi). */
  conHieuLuc?: () => boolean,
): BoCombo {
  let ds: MonCombo[] = mon.map((m) => ({ ...m, trangThai: "cho" }));
  let dangChay: Promise<void> | null = null;
  let gianDoan = false;
  const bao = () => khiDoi?.();
  const tongKet = (): TongKetCombo => {
    if (dangChay) return "dang-chay";
    if (gianDoan) return "gian-doan";
    if (ds.every((m) => m.trangThai === "xong")) return "tron-bo";
    if (ds.every((m) => m.trangThai === "cho")) return "chua-chay";
    return "thieu";
  };
  const dat = (khoa: string, p: Partial<MonCombo>) => { ds = ds.map((m) => (m.khoa === khoa ? { ...m, ...p } : m)); bao(); };

  return {
    doc: () => ({ mon: ds, tongKet: tongKet(), dangChay: dangChay !== null }),
    chay() {
      if (dangChay) return dangChay;
      const lanChay: Promise<void> = (async () => {
        for (const m of ds.map((x) => x.khoa)) {
            if (!gianDoan && conHieuLuc && !conHieuLuc()) gianDoan = true;
            if (gianDoan) { ds = ds.map((x) => (x.trangThai === "cho" || x.trangThai === "loi" ? { ...x, trangThai: "bo-qua" } : x)); bao(); break; }
            const hienTai = ds.find((x) => x.khoa === m)!;
            if (hienTai.trangThai === "xong" || hienTai.trangThai === "chua-ro") continue; // món đã vào giỏ không thêm lại; "chưa rõ" chờ người dùng xác nhận
            dat(m, { trangThai: "dang", thongBao: undefined });
            let kq: KetQuaThemMon;
            try { kq = await them(m); } catch { kq = { ok: false, chuaRo: true }; }
            if (kq.doiTaiKhoan) gianDoan = true;
            if (kq.ok) dat(m, { trangThai: "xong" });
            else dat(m, { trangThai: kq.doiTaiKhoan ? "bo-qua" : kq.chuaRo ? "chua-ro" : "loi", thongBao: kq.thongBao });
          }
          if (!gianDoan && conHieuLuc && !conHieuLuc()) gianDoan = true; // đổi danh tính ngay sau món cuối: không được báo trọn bộ
      })();
      dangChay = lanChay;
      void lanChay.then(() => { if (dangChay === lanChay) { dangChay = null; bao(); } });
      return dangChay;
    },
    huy() { gianDoan = true; bao(); },
    xacNhanThuLai(khoa) {
      if (ds.find((m) => m.khoa === khoa)?.trangThai === "chua-ro") dat(khoa, { trangThai: "loi" });
    },
    datLai(moi) {
      if (dangChay) return;
      gianDoan = false;
      ds = moi.map((m) => ({ ...m, trangThai: "cho" }));
      bao();
    },
  };
}
