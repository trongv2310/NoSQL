"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProviders";
import b from "@/components/product/bento.module.css";
import { Page } from "@/components/Ui";
import { api, loiTuApi } from "@/lib/api";
import { vnd } from "@/lib/format";
import { boKhoiSoSanh, docUrlSoSanh, doiChieu, duongDanSoSanh, thayTrongSoSanh, themVaoSoSanh, TOI_DA_SO_SANH, TOI_THIEU_SO_SANH, type MucSoSanh } from "@/lib/so-sanh";
import { diemKhacBiet, goiYCapVot, moTaBieuDo, tinhTruc } from "@/lib/so-sanh-bieu-do";
import { bienTheMacDinh, taoHoSoDoiChieu, taoUngVien, tenNganVot } from "@/lib/so-sanh-du-lieu";
import type { SanPhamV, Trang } from "@/lib/types";
import { BangSoSanh } from "./BangSoSanh";
import { BieuDoNhen } from "./BieuDoNhen";
import { DauVot, nhanVot, type ChiTietNgan, type Cot, type CotOk, type VotBieuDo } from "./chung";
import { KhacBiet } from "./KhacBiet";
import { ManHinhMoi } from "./ManHinhMoi";
import { datSoSanh } from "./so-sanh-store";
import s from "./so-sanh.module.css";
import { TheVot } from "./TheVot";
import { ThanhGiaTon, ThuocDo } from "./ThuocDo";

type Tai = { trangThai: "dang" } | { trangThai: "loi"; thongBao: string } | { trangThai: "ok"; ct: ChiTietNgan };
interface VotChon { id: string; ten: string; sp: SanPhamV }
type KieuXem = "bieu-do" | "bang";

const NOI_DUNG_LOI_URL: Record<string, string> = {
  "id-sai": "Một mã vợt trong liên kết không hợp lệ nên đã bỏ qua.",
  "bien-the-sai": "Một mã phiên bản trong liên kết không hợp lệ nên đã bỏ qua.",
  "trung": "Liên kết có một vợt bị lặp, đã chỉ giữ một lần.",
  "vuot-ba": "Liên kết có nhiều hơn 3 vợt, chỉ so sánh 3 vợt đầu.",
  "thieu-id": "Liên kết có mã phiên bản nhưng thiếu mã vợt tương ứng nên đã bỏ qua.",
};

/** Tải danh sách vợt (id + tên + dữ liệu thô) để chọn thêm/thay và gợi ý cặp. */
function useDanhSachVot() {
  const [ds, setDs] = useState<VotChon[] | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [lan, setLan] = useState(0);
  useEffect(() => {
    let huy = false;
    (async () => {
      try {
        const tat: VotChon[] = [];
        for (let p = 1; p <= 6; p++) {
          const r = await api<Trang<SanPhamV>>(`/san-pham?loai=Vot&page=${p}`);
          tat.push(...r.items.map((x) => ({ id: x.id, ten: x.tenSanPham, sp: x })));
          if (p >= r.pages) break;
        }
        if (!huy) { setDs(tat); setLoi(null); }
      } catch (e) { if (!huy) setLoi(loiTuApi(e)); }
    })();
    return () => { huy = true; };
  }, [lan]);
  return { ds, loi, thuLai: () => setLan((n) => n + 1) };
}

/**
 * Trang so sánh 2–3 vợt. URL là nguồn chính (chia sẻ/reload/Back-Forward): `/so-sanh?v1=…&b1=…&v2=…`. Dữ liệu giá, tồn kho, 5 thông số lấy thật từ API
 * cho đúng phiên bản; biểu đồ/thước đo/điểm khác biệt chỉ từ dữ liệu thật và thang minh họa (xem `lib/so-sanh-bieu-do.ts`). ID sai/404/phiên bản không thuộc vợt
 * được báo ngay trong thẻ của cột đó, không so nhầm cấu hình. Bảng đầy đủ luôn có trong trang (ẩn thị giác khi xem dạng biểu đồ) làm bản dự phòng truy cập.
 */
export function SoSanhVot() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { flash } = useApp();
  const query = sp.toString();
  const { muc, loi: loiUrl } = useMemo(() => docUrlSoSanh(new URLSearchParams(query)), [query]);
  const khoa = useMemo(() => muc.map((m) => m.sanPhamId).join(","), [muc]);
  const [tai, setTai] = useState<Record<string, Tai>>({});
  const { ds: dsVot, loi: loiDs, thuLai } = useDanhSachVot();
  const [trangSao, setTrangSao] = useState<"" | "da" | "that-bai">("");
  const [xem, setXem] = useState<KieuXem>("bieu-do");
  const oSao = useRef<HTMLInputElement>(null);

  // URL là nguồn chính: giữ khay so sánh (localStorage) khớp URL để chọn tiếp từ thẻ ở các trang khác.
  useEffect(() => { if (muc.length) datSoSanh(muc); }, [muc]);

  const chonXem = (k: KieuXem) => setXem(k);

  // Tải chi tiết từng vợt theo URL (một lần cho mỗi id; đổi phiên bản không gọi lại).
  useEffect(() => {
    let huy = false;
    for (const id of khoa ? khoa.split(",") : []) {
      api<ChiTietNgan>(`/san-pham/${id}`)
        .then((ct) => { if (!huy) setTai((t) => ({ ...t, [id]: { trangThai: "ok", ct } })); })
        .catch((e) => { if (!huy) setTai((t) => ({ ...t, [id]: { trangThai: "loi", thongBao: /không tìm thấy|404/i.test(loiTuApi(e)) ? "Không tìm thấy vợt này (mã không tồn tại hoặc đã ngừng kinh doanh)." : loiTuApi(e) } })); });
    }
    return () => { huy = true; };
  }, [khoa]);

  const diDen = (ds: MucSoSanh[], thay = false) => {
    const url = duongDanSoSanh(ds);
    if (thay) router.replace(url); else router.push(url);
    if (!ds.length) datSoSanh([]);
  };

  const cot: Cot[] = muc.map((m, i) => {
    const t = tai[m.sanPhamId];
    if (!t || t.trangThai === "dang") return { m, i, trangThai: "dang" };
    if (t.trangThai === "loi") return { m, i, trangThai: "loi", thongBao: t.thongBao };
    const bien = m.bienTheId ? t.ct.bienThes.find((x) => x.id === m.bienTheId) ?? null : bienTheMacDinh(t.ct.bienThes);
    if (!bien) return { m, i, trangThai: "bien-the-sai", ct: t.ct };
    return { m, i, trangThai: "ok", ct: t.ct, bien, hs: taoHoSoDoiChieu(t.ct.sanPham, bien) };
  });
  const dayDu = cot.filter((c): c is CotOk => c.trangThai === "ok");
  const hs = dayDu.map((c) => ({ ...c.hs, nhan: nhanVot(c.i) }));
  const loiDoiChieu = dayDu.length >= TOI_THIEU_SO_SANH ? doiChieu(hs) : [];
  const url = typeof window === "undefined" ? "" : `${window.location.origin}${pathname}${query ? `?${query}` : ""}`;

  // Dữ liệu biểu đồ: tính từ hồ sơ thật của các vợt đã tải; đổi phiên bản thì tính lại ngay (rẻ, chỉ vài chục phép tính).
  const coBieuDo = dayDu.length >= TOI_THIEU_SO_SANH;
  const truc = tinhTruc(hs);
  const vot: VotBieuDo[] = dayDu.map((c) => ({ i: c.i, ten: c.ct.sanPham.tenSanPham, ngan: tenNganVot(c.ct.sanPham.tenSanPham) }));
  const khacBiet = coBieuDo ? diemKhacBiet(hs, truc) : [];
  const viTri = dayDu.map((c) => c.i);

  const ungViens = useMemo(() => (dsVot ?? []).map((v) => taoUngVien(v.sp)), [dsVot]);
  const giu = muc.length === 1 ? muc[0].sanPhamId : null;
  const goiY = useMemo(() => (muc.length < TOI_THIEU_SO_SANH && ungViens.length ? goiYCapVot(ungViens, { giu }) : []), [ungViens, muc.length, giu]);

  const sao = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("không có clipboard");
      await navigator.clipboard.writeText(url);
      setTrangSao("da");
    } catch {
      setTrangSao("that-bai");
      setTimeout(() => { oSao.current?.focus(); oSao.current?.select(); }, 0);
    }
  };
  const them = (id: string) => {
    if (!id) return;
    const kq = themVaoSoSanh(muc, { sanPhamId: id, bienTheId: null });
    if (!kq.ok) { flash("danger", kq.lyDo === "day" ? `Chỉ so sánh tối đa ${TOI_DA_SO_SANH} vợt. Hãy bỏ hoặc thay bớt một vợt.` : "Mã vợt không hợp lệ."); return; }
    diDen(kq.muc);
  };
  const doiBien = (vi: number, bienId: string | null) => diDen(muc.map((x, k) => (k === vi ? { ...x, bienTheId: bienId } : x)), true);
  const chuaChon = (dsVot ?? []).filter((v) => !muc.some((m) => m.sanPhamId === v.id));
  const daChon = giu ? ungViens.find((u) => u.id === giu) ?? null : null;

  return (
    <Page>
      <div className={s.goc}>
        <nav className="mb-3 small text-muted"><Link href="/">Trang chủ</Link> / <Link href="/SanPham/Index?loai=Vot">Vợt</Link> / So sánh</nav>
        <h1 className={`h3 ${s.tieuDe}`}>So sánh vợt</h1>
        <p className={s.gioiThieu}>Đối chiếu giá, tồn kho và 5 thông số ghi trong kho. Lời đối chiếu chỉ nêu khác biệt của dữ liệu thật, không dự đoán kết quả thi đấu.</p>

        {loiUrl.length > 0 && <p className={`${b.thongBao} ${b.thongBaoCanh}`} role="status">{[...new Set(loiUrl.map((l) => NOI_DUNG_LOI_URL[l.loai]))].join(" ")}</p>}

        {muc.length > 0 && (
          <div className={s.luoiThe} style={{ ["--n" as string]: muc.length }}>
            {cot.map((c) => <TheVot key={c.m.sanPhamId} c={c} onBo={() => diDen(boKhoiSoSanh(muc, c.m.sanPhamId))} onDoiBien={(id) => doiBien(c.i, id)} />)}
          </div>
        )}

        {muc.length < TOI_THIEU_SO_SANH && <ManHinhMoi muc={muc} goiY={goiY} dangTai={!dsVot && !loiDs} loi={!!loiDs} daChon={daChon} />}

        {muc.length >= TOI_THIEU_SO_SANH && (
          <>
            <div className={s.thanhDieuKhien}>
              <div className={s.chuyen} role="group" aria-label="Kiểu xem so sánh">
                <button type="button" aria-pressed={xem === "bieu-do"} onClick={() => chonXem("bieu-do")}><i className="fa-solid fa-chart-simple" aria-hidden="true" />Dạng biểu đồ</button>
                <button type="button" aria-pressed={xem === "bang"} onClick={() => chonXem("bang")}><i className="fa-solid fa-table-list" aria-hidden="true" />Dạng bảng</button>
              </div>
              <div className={b.hang}>
                <button type="button" className={`${b.nut} ${s.nutPhu}`} onClick={sao}><i className="fa-solid fa-link" aria-hidden="true" />Sao chép liên kết so sánh</button>
                {trangSao === "da" && <span className={b.thongBao} role="status">Đã sao chép liên kết.</span>}
              </div>
            </div>
            {trangSao === "that-bai" && (
              <div style={{ marginBottom: 12 }}>
                <p className={`${b.thongBao} ${b.thongBaoCanh}`} role="status">Trình duyệt không cho sao chép tự động. Hãy chọn và sao chép liên kết dưới đây.</p>
                <input ref={oSao} className={b.nhap} readOnly value={url} aria-label="Liên kết so sánh" onFocus={(e) => e.currentTarget.select()} />
              </div>
            )}

            {!coBieuDo && <p className={`${b.thongBao} ${b.thongBaoCanh}`} role="status">Cần ít nhất {TOI_THIEU_SO_SANH} vợt tải được để vẽ biểu đồ và đối chiếu. Hãy xem thông báo ở thẻ vợt bị lỗi phía trên.</p>}

            {coBieuDo && xem === "bieu-do" && (
              <div>
                <div className={s.dinh} role="group" aria-label="Chú giải các vợt đang so sánh">
                  {dayDu.map((c) => (
                    <span key={c.m.sanPhamId} className={`${s.dinhMuc} ${s[`v${c.i % 3}`]}`}>
                      <DauVot i={c.i} /><span>{nhanVot(c.i)}</span><span className={s.dinhTen}>{tenNganVot(c.ct.sanPham.tenSanPham)}</span><span className={s.dinhGia}>{vnd(c.bien.giaThucTe)}</span>
                    </span>
                  ))}
                  <span className={s.dinhGhiChu}>Thang minh họa theo thông số ghi trong kho</span>
                </div>
                <div className={s.luoiBieuDo}>
                  <section className={s.khung} aria-labelledby="bd-nhen">
                    <h2 id="bd-nhen" className={s.khungTen}>Biểu đồ nhện</h2>
                    <p className={s.khungMo}>Hình càng ra xa tâm thì thông số càng về phía “cao” của thang (nặng đầu, thân cứng, nặng, dài, căng cao).</p>
                    <BieuDoNhen vot={vot} truc={truc} moTa={moTaBieuDo(hs, truc)} />
                  </section>
                  <section className={s.khung} aria-labelledby="bd-thuoc">
                    <h2 id="bd-thuoc" className={s.khungTen}>Thước đo từng thông số</h2>
                    <p className={s.khungMo}>Các vợt nằm trên cùng một thang; dải mờ cho thấy khoảng cách giữa vợt thấp nhất và cao nhất.</p>
                    <ThuocDo truc={truc} vot={vot} />
                  </section>
                </div>
                <div className={s.hai}>
                  <section className={s.khung} aria-labelledby="bd-gia">
                    <h2 id="bd-gia" className={s.khungTen}>Giá</h2>
                    <p className={s.khungMo}>Giá của phiên bản đang chọn.</p>
                    <ThanhGiaTon hs={hs} vot={vot} loai="gia" />
                  </section>
                  <section className={s.khung} aria-labelledby="bd-ton">
                    <h2 id="bd-ton" className={s.khungTen}>Tồn kho</h2>
                    <p className={s.khungMo}>Số lượng còn của phiên bản đang chọn.</p>
                    <ThanhGiaTon hs={hs} vot={vot} loai="ton" />
                  </section>
                </div>
                {khacBiet.length > 0 && <KhacBiet muc={khacBiet} viTri={viTri} />}
              </div>
            )}

            {/* Bảng đầy đủ: hiện khi chọn dạng bảng, nếu không thì ẩn thị giác nhưng vẫn là bản chữ cho trình đọc màn hình. */}
            <div style={{ marginTop: xem === "bang" ? 4 : 0 }}>
              <BangSoSanh cot={cot} hienThi={xem === "bang" || !coBieuDo} />
            </div>
            {xem === "bang" && loiDoiChieu.length > 0 && (
              <section aria-labelledby="doi-chieu" style={{ marginTop: 16 }}>
                <h2 id="doi-chieu" className="h5">Đối chiếu từ dữ liệu</h2>
                <ul>{loiDoiChieu.map((d) => <li key={d}>{d}</li>)}</ul>
              </section>
            )}
          </>
        )}

        <section className={s.chonThem} aria-label="Thêm vợt và chia sẻ">
          {muc.length < TOI_DA_SO_SANH && (
            <div className={b.hang}>
              <label className={b.truong} htmlFor="them-vot">Thêm vợt để so sánh
                <select id="them-vot" className={b.nhap} defaultValue="" onChange={(e) => { them(e.target.value); e.target.value = ""; }} disabled={!dsVot}>
                  <option value="">{dsVot ? "Chọn một vợt…" : loiDs ? "Không tải được danh sách vợt" : "Đang tải danh sách vợt…"}</option>
                  {chuaChon.map((v) => <option key={v.id} value={v.id}>{v.ten}</option>)}
                </select>
              </label>
              {loiDs && <button type="button" className={b.nut} onClick={thuLai}>Thử tải lại danh sách</button>}
            </div>
          )}
          {muc.length >= 2 && dsVot && (
            <div className={b.hang}>
              {muc.map((m, i) => (
                <label key={m.sanPhamId} className={b.truong} htmlFor={`thay-${i}`}>Thay vợt {i + 1} bằng
                  <select id={`thay-${i}`} className={b.nhap} defaultValue="" onChange={(e) => { const v = e.target.value; if (v) diDen(thayTrongSoSanh(muc, i, { sanPhamId: v, bienTheId: null })); e.target.value = ""; }}>
                    <option value="">Giữ nguyên</option>
                    {chuaChon.map((v) => <option key={v.id} value={v.id}>{v.ten}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
          <p className={b.ghiChu}>Liên kết giữ mã vợt và phiên bản bạn đang so, nên người nhận mở ra đúng cấu hình. Tồn kho và giá luôn là dữ liệu hiện tại của cửa hàng.</p>
        </section>
      </div>
    </Page>
  );
}
