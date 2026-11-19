"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { useThemBienTheKq } from "@/components/product/useThemBienThe";
import { AnhSanPham } from "@/components/Ui";
import { taoBoCombo, type BoCombo, type KetQuaThemMon } from "@/lib/combo";
import { apiPost, loiTuApi } from "@/lib/api";
import { imgUrl, vnd } from "@/lib/format";
import { layGio, soLuongTrongGio, TOI_DA_SO_LUONG } from "@/lib/gio-khach";
import { chonGoiYMuaCung, ketQuaKiemTon, type KetQuaKiemTon } from "@/lib/goi-y";
import { useApi } from "@/lib/hooks";
import type { ComboGoiY, SanPhamGoiY } from "@/lib/types";

/** API gợi ý chỉ trả id biến thể còn hàng, không trả số tồn. Giỏ tài khoản: máy chủ kiểm tồn khi thêm; giỏ khách: kiểm bằng /gio-hang/tinh trước khi thêm. 100 = trần giỏ, chỉ để qua cổng kiểm của hook khi đã đăng nhập. */
const TON_CHUA_BIET = 100;
const NHAN_TRANG_THAI: Record<string, string> = { dang: "Đang thêm…", xong: "Đã vào giỏ", loi: "Chưa vào giỏ", "chua-ro": "Chưa rõ", "bo-qua": "Không thêm (đã dừng)" };
const nutLienKet = { background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline", font: "inherit" } as const;

/**
 * Một combo mua chung: các món và tổng giá hiện hành (không có giảm giá riêng cho combo). "Thêm combo vào giỏ" thêm từng món `chiTietMacDinh` số lượng 1 bằng
 * `useThemBienTheKq` + `taoBoCombo` (cùng cơ chế giỏ như Vợt + quấn cán: khách chưa đăng nhập dùng giỏ trình duyệt, đã đăng nhập dùng giỏ tài khoản),
 * nên nói đúng món nào đã vào giỏ/chưa, bấm đúp không thêm trùng, thử lại chỉ món chưa thêm, và đổi tài khoản giữa chừng thì dừng.
 */
function TheCombo({ combo }: { combo: ComboGoiY }) {
  const them = useThemBienTheKq();
  const { user, taiKhoanHienTai } = useApp();
  const nguoiId = user?.id ?? null;
  const [bo, setBo] = useState<{ bo: BoCombo; nguoi: string | null } | null>(null);
  const [, veLai] = useState(0);
  const dangChayToanCuc = useRef(false);
  const boRef = useRef<BoCombo | null>(null);
  useEffect(() => { boRef.current = bo?.bo ?? null; }, [bo]);
  useEffect(() => () => boRef.current?.huy(), []); // gỡ khối: món chưa gửi không được gửi theo sau
  useEffect(() => { if (bo && bo.nguoi !== nguoiId) bo.bo.huy(); }, [bo, nguoiId]); // đổi danh tính: dừng bộ cũ

  const trangThai = bo?.bo.doc();
  const dangChay = !!trangThai?.dangChay;
  const gianDoan = trangThai?.tongKet === "gian-doan" || (!!bo && bo.nguoi !== nguoiId);
  const n = combo.sanPhams.length;

  const bam = async () => {
    if (dangChayToanCuc.current) return;
    const nguoiBam = taiKhoanHienTai();
    let b = bo?.bo ?? null;
    // Bộ cũ bị gián đoạn hoặc thuộc danh tính khác thì không dùng lại: tạo bộ mới cho danh tính hiện tại.
    if (b && (bo?.nguoi !== nguoiBam || b.doc().tongKet === "gian-doan")) { b.huy(); b = null; }
    if (!b) {
      const theoKhoa = new Map(combo.sanPhams.map((s) => [s.chiTietMacDinh, s]));
      const goiThem = async (khoa: string): Promise<KetQuaThemMon> => {
        let ton = TON_CHUA_BIET;
        if (!nguoiBam) {
          // Giỏ khách không có máy chủ kiểm lúc thêm: hỏi báo giá công khai (cùng nguồn trang giỏ dùng) để món hết hàng không bị báo "đã vào giỏ".
          let ktra: KetQuaKiemTon;
          try { ktra = ketQuaKiemTon(await apiPost<unknown>("/gio-hang/tinh", { dong: [{ chiTietId: khoa, soLuong: Math.min(soLuongTrongGio(layGio(), khoa) + 1, TOI_DA_SO_LUONG) }] }), khoa); }
          catch (e) { ktra = { ok: false, thongBao: `Không kiểm tra được tồn kho: ${loiTuApi(e)}` }; }
          if (!ktra.ok) return { ok: false, chuaRo: false, thongBao: ktra.thongBao }; // chưa thêm gì nên chắc chắn chưa vào giỏ
          ton = ktra.soLuongTon;
        }
        const kq = await them({ id: khoa, soLuongTon: ton }, 1, theoKhoa.get(khoa)?.tenSanPham, false, nguoiBam);
        return kq.ok ? { ok: true, doiTaiKhoan: kq.doiTaiKhoan } : { ok: false, chuaRo: kq.chuaRo, thongBao: kq.thongBao, doiTaiKhoan: kq.doiTaiKhoan };
      };
      b = taoBoCombo(combo.sanPhams.map((s) => ({ khoa: s.chiTietMacDinh, nhan: s.tenSanPham })), goiThem, () => veLai((x) => x + 1), () => taiKhoanHienTai() === nguoiBam);
      boRef.current = b;
      setBo({ bo: b, nguoi: nguoiBam });
    }
    dangChayToanCuc.current = true;
    try { await b.chay(); } finally { dangChayToanCuc.current = false; veLai((x) => x + 1); }
  };

  return (
    <article className="goi-y-combo" aria-label={`Combo ${n} món`}>
      <h3 className="goi-y-combo-ten">Combo {n} món</h3>
      <ul className="goi-y-combo-mon">
        {combo.sanPhams.map((s) => (
          <li key={s.id}>
            <Link href={`/Home/ChiTietSanPham/${s.id}`} className="goi-y-anh" tabIndex={-1} aria-hidden="true"><AnhSanPham src={imgUrl(s.hinhAnhDaiDien)} alt="" /></Link>
            <Link href={`/Home/ChiTietSanPham/${s.id}`} className="goi-y-ten">{s.tenSanPham}</Link>
            <span className="goi-y-gia">{vnd(s.gia)}</span>
          </li>
        ))}
      </ul>
      <div className="goi-y-tong"><span>Tổng {n} món</span><strong>{vnd(combo.tongGia)}</strong></div>

      {trangThai && trangThai.tongKet !== "chua-chay" && (
        <ul className="goi-y-trang-thai" aria-live="polite">
          {trangThai.mon.map((m) => (
            <li key={m.khoa}>
              <span className={m.trangThai === "xong" ? "goi-y-xong" : undefined}>{m.nhan}: {NHAN_TRANG_THAI[m.trangThai] ?? ""}</span>
              {m.thongBao && m.trangThai !== "xong" ? ` — ${m.thongBao}` : ""}
              {m.trangThai === "chua-ro" && (
                <span> Chưa xác nhận được món này đã vào giỏ hay chưa. Hãy <Link href="/Home/ViewCart">kiểm tra giỏ hàng</Link> rồi{" "}
                  <button type="button" style={nutLienKet} onClick={() => bo?.bo.xacNhanThuLai(m.khoa)}>tôi đã kiểm tra, cho phép thử lại món này</button>.</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {trangThai?.tongKet === "tron-bo" && <p className="goi-y-thong-bao" role="status">Đã thêm đủ {n} món vào giỏ. <Link href="/Home/ViewCart">Xem giỏ hàng</Link></p>}
      {trangThai?.tongKet === "thieu" && <p className="goi-y-thong-bao goi-y-loi" role="alert">Chưa thêm đủ combo: có món chưa vào giỏ. Món đã vào giỏ sẽ không bị thêm lại khi bạn thử lại.</p>}
      {gianDoan && <p className="goi-y-thong-bao goi-y-loi" role="alert">Việc thêm combo đã dừng vì tài khoản đăng nhập thay đổi. Món đã vào giỏ của tài khoản trước vẫn nằm ở đó, không có món nào được thêm vào tài khoản hiện tại. Bấm nút bên dưới nếu bạn muốn thêm lại cho tài khoản hiện tại.</p>}

      <button type="button" className="btn goi-y-nut" disabled={dangChay || trangThai?.tongKet === "tron-bo"} aria-busy={dangChay} onClick={bam}>
        <i className="fa-solid fa-cart-plus" aria-hidden="true" /> {dangChay ? "Đang thêm…" : trangThai?.tongKet === "thieu" ? "Thử lại món chưa thêm" : "Thêm combo vào giỏ"}
      </button>
    </article>
  );
}

/** Lưới combo (đã được `chonComboHienThi` làm sạch ở chỗ gọi). */
export function LuoiCombo({ combos }: { combos: ComboGoiY[] }) {
  return <div className="goi-y-luoi">{combos.map((c) => <TheCombo key={c.khoa} combo={c} />)}</div>;
}

function TheGoiY({ sp }: { sp: SanPhamGoiY }) {
  return (
    <Link href={`/Home/ChiTietSanPham/${sp.id}`} className="goi-y-the">
      <span className="goi-y-the-anh"><AnhSanPham src={imgUrl(sp.hinhAnhDaiDien)} alt={sp.tenSanPham} /></span>
      <span className="goi-y-the-ten">{sp.tenSanPham}</span>
      <strong className="goi-y-the-gia">{vnd(sp.gia)}</strong>
    </Link>
  );
}

/**
 * "Thường được mua cùng" ở trang chi tiết: tối đa 4 sản phẩm từ GET /goi-y/san-pham/:id. Đang tải, lỗi, hoặc không có gợi ý thì ẩn cả khối
 * (không báo lỗi, không làm vỡ trang). Gắn `key={sanPhamId}` ở chỗ gọi để đổi sản phẩm thì tải lại từ đầu.
 */
export function GoiYMuaCung({ sanPhamId }: { sanPhamId: string }) {
  const { data, loading, error } = useApi<{ sanPhams: unknown }>(`/goi-y/san-pham/${encodeURIComponent(sanPhamId)}`);
  const ds = chonGoiYMuaCung(data, sanPhamId);
  if (loading || error || !ds.length) return null;
  return (
    <section className="pdp-related" aria-labelledby="goi-y-mua-cung-tieu-de">
      <div className="pdp-related-heading"><div><span>MUA KÈM</span><h2 id="goi-y-mua-cung-tieu-de">Thường được mua cùng</h2><p>Sản phẩm đi kèm với món bạn đang xem. Giá là giá hiện hành.</p></div></div>
      <div className="goi-y-the-luoi">{ds.map((sp) => <TheGoiY key={sp.id} sp={sp} />)}</div>
    </section>
  );
}
