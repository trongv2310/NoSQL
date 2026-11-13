"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { api, loiTuApi } from "@/lib/api";
import { fontTieuDe } from "@/components/landing/fonts";
import { taoBoCombo, type BoCombo, type KetQuaThemMon } from "@/lib/combo";
import { vnd } from "@/lib/format";
import type { BienTheV, SanPhamV, Trang } from "@/lib/types";
import { useThemBienTheKq } from "./useThemBienThe";
import s from "./bento.module.css";

interface LuaChonQuan { khoa: string; sanPham: SanPhamV; bien: BienTheV }
const LA_QUAN_CAN = /(cuốn|quấn)\s*cán/i;
const nhanBien = (b: BienTheV) => [b.mau?.tenMau, b.size?.tenSize].filter(Boolean).join(" / ");

/**
 * Combo thật: vợt đang chọn + một loại quấn cán CÓ SẴN trong catalog (truy vấn từ API, giá/tồn lấy từ máy chủ). Tổng = giá hiện tại của hai món;
 * nếu quấn cán đang có khuyến mãi hợp lệ của chính sản phẩm thì giá đó đã nằm trong giá hiện tại, không có giảm giá riêng cho combo và không có
 * dịch vụ căng cước. Thêm từng món qua giỏ M1 và nói đúng món nào đã vào giỏ (xem lib/combo.ts: bấm đúp, lỗi một phần, thử lại món thiếu).
 */
export function ComboQuanCan({ bienVot, tenVot }: { bienVot: BienTheV | null; tenVot: string }) {
  const them = useThemBienTheKq();
  const { user, taiKhoanHienTai } = useApp();
  const nguoiId = user?.id ?? null;
  const [dsQuan, setDsQuan] = useState<LuaChonQuan[] | null>(null);
  const [loiTai, setLoiTai] = useState<string | null>(null);
  const [chon, setChon] = useState<string | null>(null);
  const [lanTai, setLanTai] = useState(0);
  const [, veLai] = useState(0);

  useEffect(() => {
    let huy = false;
    (async () => {
      try {
        const r = await api<Trang<SanPhamV>>("/san-pham?loai=PhuKien");
        const cac = r.items.filter((x) => LA_QUAN_CAN.test(x.tenSanPham));
        const ra: LuaChonQuan[] = [];
        for (const sp of cac) {
          const ct = await api<{ sanPham: SanPhamV; bienThes: BienTheV[] }>(`/san-pham/${sp.id}`);
          for (const b of ct.bienThes) if (b.soLuongTon > 0) ra.push({ khoa: b.id, sanPham: ct.sanPham, bien: b });
        }
        if (huy) return;
        setDsQuan(ra); setLoiTai(null);
        setChon((c) => c ?? ra[0]?.khoa ?? null);
      } catch (e) { if (!huy) setLoiTai(loiTuApi(e)); }
    })();
    return () => { huy = true; };
  }, [lanTai]);

  const quan = dsQuan?.find((q) => q.khoa === chon) ?? null;
  const dangChayToanCuc = useRef(false);
  const idVot = bienVot?.id ?? null;
  const idQuan = quan?.khoa ?? null;
  // Bộ combo gắn với đúng (phiên bản vợt, loại quấn cán) và được tạo khi bấm nút: đổi một trong hai là bộ mới, không mang trạng thái "đã thêm" của bộ cũ.
  // `nguoi` = danh tính (tài khoản hoặc khách) lúc người dùng bấm: bộ này KHÔNG BAO GIỜ gửi món nào cho danh tính khác.
  const [bo, setBo] = useState<{ khoa: string; bo: BoCombo; nguoi: string | null } | null>(null);
  const boRef = useRef<BoCombo | null>(null);
  useEffect(() => { boRef.current = bo?.bo ?? null; }, [bo]);
  // Gỡ component hoặc danh tính đổi (đăng xuất/đăng nhập tài khoản khác): dừng bộ đang chạy để món còn lại không bị gửi theo phiên mới.
  useEffect(() => () => boRef.current?.huy(), []);
  useEffect(() => { if (bo && bo.nguoi !== nguoiId) bo.bo.huy(); }, [bo, nguoiId]);
  const khoaBo = idVot && idQuan ? `${idVot}|${idQuan}` : null;
  const boHienTai = bo && bo.khoa === khoaBo ? bo.bo : null;

  if (loiTai) {
    return <div className={s.combo}><p className={`${s.thongBao} ${s.thongBaoCanh}`}>Chưa tải được danh sách quấn cán: {loiTai}. <button type="button" className={s.lienKet} style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => setLanTai((n) => n + 1)}>Thử lại</button></p></div>;
  }
  if (dsQuan === null) return <p className={s.ghiChu}>Đang tải quấn cán đang bán…</p>;
  if (!dsQuan.length) return <p className={s.thongBao}>Hiện chưa có quấn cán còn hàng để ghép bộ.</p>;

  const daDoiDanhTinh = !!bo && bo.nguoi !== nguoiId;
  const trangThai = boHienTai?.doc();
  const gianDoan = trangThai?.tongKet === "gian-doan" || (!!boHienTai && daDoiDanhTinh);
  const giaVot = bienVot?.giaThucTe ?? null;
  const tong = giaVot !== null && quan ? giaVot + quan.bien.giaThucTe : null;
  const votCon = !!bienVot && bienVot.soLuongTon > 0;
  const dangChay = !!trangThai?.dangChay;
  const gocQuan = quan?.bien.giaBan ?? null;
  const giamQuan = quan && quan.sanPham.dangGiamGia && gocQuan !== null && gocQuan > quan.bien.giaThucTe;
  const nhanTrang = (tt: string) => ({ cho: "", dang: "Đang thêm…", xong: "Đã vào giỏ", loi: "Chưa vào giỏ", "chua-ro": "Chưa rõ", "bo-qua": "Không thêm (đã dừng)" } as Record<string, string>)[tt] ?? "";

  const bam = async () => {
    if (!khoaBo || !bienVot || !quan || dangChayToanCuc.current) return;
    const nguoiBam = taiKhoanHienTai();
    let b = boHienTai;
    // Bộ cũ bị gián đoạn hoặc thuộc danh tính khác thì KHÔNG dùng lại: tạo bộ mới cho danh tính hiện tại (ý định cũ không được mang sang).
    if (b && (bo?.nguoi !== nguoiBam || b.doc().tongKet === "gian-doan")) { b.huy(); b = null; }
    if (!b) {
      const vot = bienVot, qc = quan;
      const goiThem = async (k: string): Promise<KetQuaThemMon> => {
        const bien = k === "vot" ? vot : qc.bien;
        const ten = k === "vot" ? tenVot : qc.sanPham.tenSanPham;
        const kq = await them(bien, 1, ten, false, nguoiBam);
        return kq.ok ? { ok: true, doiTaiKhoan: kq.doiTaiKhoan } : { ok: false, chuaRo: kq.chuaRo, thongBao: kq.thongBao, doiTaiKhoan: kq.doiTaiKhoan };
      };
      b = taoBoCombo([{ khoa: "vot", nhan: tenVot }, { khoa: "quan", nhan: "Quấn cán" }], goiThem, () => veLai((n) => n + 1), () => taiKhoanHienTai() === nguoiBam);
      boRef.current = b;
      setBo({ khoa: khoaBo, bo: b, nguoi: nguoiBam });
    }
    dangChayToanCuc.current = true;
    try { await b.chay(); } finally { dangChayToanCuc.current = false; veLai((n) => n + 1); }
  };

  return (
    <div className={s.combo}>
      <p className={s.ghiChu}>Vợt bạn đang chọn kèm một quấn cán đang bán. Giá lấy từ máy chủ, mỗi món 1 sản phẩm. Không có giảm giá riêng cho bộ này và không gồm căng cước.</p>
      <div className={s.hang} role="radiogroup" aria-label="Chọn quấn cán">
        {dsQuan.map((q) => (
          <button key={q.khoa} type="button" role="radio" aria-checked={chon === q.khoa} className={s.chip} onClick={() => { if (!dangChay) setChon(q.khoa); }} disabled={dangChay}>
            {q.sanPham.tenSanPham.replace(/^Dây Cuốn Cán Vợt Cầu Lông\s*/i, "Dây cuốn cán ")}
          </button>
        ))}
      </div>
      <div className={s.monCombo}>
        <b>{tenVot}</b>
        <small>{bienVot ? `Phiên bản ${nhanBien(bienVot) || "tiêu chuẩn"} · SL 1 · ${votCon ? `còn ${bienVot.soLuongTon}` : "hết hàng"}` : "Chọn phiên bản vợt ở trên"}</small>
        <span className={`${s.monGia} ${fontTieuDe.className}`}>{giaVot !== null ? vnd(giaVot) : "—"}</span>
      </div>
      {quan && (
        <div className={s.monCombo}>
          <b>{quan.sanPham.tenSanPham}</b>
          <small>SL 1 · còn {quan.bien.soLuongTon}{giamQuan ? ` · đang giảm giá${quan.sanPham.khuyenMai?.tenChuongTrinh ? ` (${quan.sanPham.khuyenMai.tenChuongTrinh})` : ""}, giá gốc ${vnd(gocQuan)}` : ""}</small>
          <span className={`${s.monGia} ${fontTieuDe.className}`}>{vnd(quan.bien.giaThucTe)}</span>
        </div>
      )}
      <div className={s.tong}><span>Tổng 2 món</span><strong className={fontTieuDe.className}>{tong !== null ? vnd(tong) : "—"}</strong></div>

      {trangThai && trangThai.tongKet !== "chua-chay" && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }} aria-live="polite">
          {trangThai.mon.map((m) => (
            <li key={m.khoa} className={s.ghiChu}>
              <span className={`${s.trangThaiMon} ${m.trangThai === "xong" ? s.xong : ""}`}>{m.khoa === "vot" ? "Vợt" : "Quấn cán"}: {nhanTrang(m.trangThai)}</span>
              {m.thongBao && m.trangThai !== "xong" ? ` — ${m.thongBao}` : ""}
              {m.trangThai === "chua-ro" && (
                <span> Chưa xác nhận được món này đã vào giỏ hay chưa. Hãy <Link href="/Home/ViewCart">kiểm tra giỏ hàng</Link> rồi{" "}
                  <button type="button" className={s.lienKet} style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => boHienTai?.xacNhanThuLai(m.khoa)}>tôi đã kiểm tra, cho phép thử lại món này</button>.</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {trangThai?.tongKet === "tron-bo" && <p className={s.thongBao} role="status">Đã thêm đủ 2 món vào giỏ. <Link href="/Home/ViewCart">Xem giỏ hàng</Link></p>}
      {gianDoan && <p className={`${s.thongBao} ${s.thongBaoCanh}`} role="alert">Việc thêm bộ đã dừng vì tài khoản đăng nhập thay đổi. Món đã vào giỏ của tài khoản trước vẫn nằm ở đó và không có món nào được thêm vào tài khoản hiện tại. Bấm nút bên dưới nếu bạn muốn thêm lại cho tài khoản hiện tại.</p>}
      {trangThai?.tongKet === "thieu" && <p className={`${s.thongBao} ${s.thongBaoLoi}`} role="alert">Chưa thêm đủ bộ: một món chưa vào giỏ. Món đã vào giỏ sẽ không bị thêm lại khi bạn thử lại.</p>}

      <div className={s.hang}>
        <button type="button" className={`${s.nut} ${s.nutChinh}`} disabled={!khoaBo || !votCon || dangChay || trangThai?.tongKet === "tron-bo"} aria-busy={dangChay} onClick={bam}>
          {dangChay ? "Đang thêm…" : trangThai?.tongKet === "thieu" ? "Thử lại món chưa thêm" : "Thêm cả hai vào giỏ"}
        </button>
      </div>
    </div>
  );
}
