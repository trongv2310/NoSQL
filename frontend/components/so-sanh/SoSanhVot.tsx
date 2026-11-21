"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { fontTieuDe } from "@/components/landing/fonts";
import { Page } from "@/components/Ui";
import { api, loiTuApi } from "@/lib/api";
import { vnd } from "@/lib/format";
import { boKhoiSoSanh, docUrlSoSanh, duongDanSoSanh, thayTrongSoSanh, themVaoSoSanh, TOI_DA_SO_SANH, TOI_THIEU_SO_SANH, type MucSoSanh } from "@/lib/so-sanh";
import { goiYCapVot, moTaBieuDo, tinhTruc } from "@/lib/so-sanh-bieu-do";
import { bienTheMacDinh, taoHoSoDoiChieu, taoUngVien, tenNganVot } from "@/lib/so-sanh-du-lieu";
import type { SanPhamV, Trang } from "@/lib/types";
import { BangSoSanh } from "./BangSoSanh";
import { BieuDoNhen } from "./BieuDoNhen";
import { nhanVot, type ChiTietNgan, type Cot, type CotOk, type VotBieuDo } from "./chung";
import { DongThongSo } from "./DongThongSo";
import { ManHinhMoi } from "./ManHinhMoi";
import { datSoSanh } from "./so-sanh-store";
import s from "./so-sanh.module.css";
import { OChon, TheVot, type SoGia } from "./TheVot";

type Tai = { trangThai: "dang" } | { trangThai: "loi"; thongBao: string } | { trangThai: "ok"; ct: ChiTietNgan };
interface VotChon { id: string; ten: string; sp: SanPhamV }

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
 * Trang so sánh 2–3 vợt. URL là nguồn chính (chia sẻ/reload/Back-Forward): `/so-sanh?v1=…&b1=…&v2=…`. Giá, tồn kho, 5 thông số lấy thật từ API
 * cho đúng phiên bản; thước và biểu đồ chỉ từ dữ liệu thật trên thang minh họa (xem `lib/so-sanh-bieu-do.ts`). ID sai/404/phiên bản không thuộc vợt
 * được báo ngay trong thẻ của cột đó, không so nhầm cấu hình.
 *
 * Bố cục: hàng thẻ vợt (kèm ô trống để thêm vợt) → năm hàng thông số thẳng cột với thẻ → biểu đồ nhện. Bảng chữ đầy đủ luôn nằm trong trang
 * (ẩn thị giác) làm bản cho trình đọc màn hình.
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
  const [chiKhac, setChiKhac] = useState(false);
  const oSao = useRef<HTMLInputElement>(null);

  // URL là nguồn chính: giữ khay so sánh (localStorage) khớp URL để chọn tiếp từ thẻ ở các trang khác.
  useEffect(() => { if (muc.length) datSoSanh(muc); }, [muc]);

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
  const url = typeof window === "undefined" ? "" : `${window.location.origin}${pathname}${query ? `?${query}` : ""}`;

  // Dữ liệu so sánh: tính từ hồ sơ thật của các vợt đã tải; đổi phiên bản thì tính lại ngay (vài chục phép tính).
  const du = dayDu.length >= TOI_THIEU_SO_SANH;
  const truc = tinhTruc(hs);
  const vot: VotBieuDo[] = dayDu.map((c) => ({ i: c.i, ten: c.ct.sanPham.tenSanPham, ngan: tenNganVot(c.ct.sanPham.tenSanPham) }));
  const viTri = new Map(dayDu.map((c, k) => [c.i, k]));
  const gias = dayDu.map((c) => c.bien.giaThucTe);
  const giaMin = Math.min(...gias), giaMax = Math.max(...gias);
  const soGia = (c: Cot): SoGia => {
    if (!du || c.trangThai !== "ok" || giaMin === giaMax) return null;
    return c.bien.giaThucTe === giaMin ? { re: true } : { re: false, chenh: c.bien.giaThucTe - giaMin };
  };
  const soKhac = truc.filter((t) => t.trangThai === "khac").length;
  const soGiong = truc.filter((t) => t.trangThai === "giong").length;

  const ungViens = useMemo(() => (dsVot ?? []).map((v) => taoUngVien(v.sp)), [dsVot]);
  const anhCua = useMemo(() => new Map((dsVot ?? []).map((v) => [v.id, v.sp.hinhAnhDaiDien ?? undefined])), [dsVot]);
  const giu = muc.length === 1 ? muc[0].sanPhamId : null;
  const goiY = useMemo(() => (muc.length < TOI_THIEU_SO_SANH && ungViens.length ? goiYCapVot(ungViens, { giu }) : []), [ungViens, muc.length, giu]);
  const daChon = giu ? ungViens.find((u) => u.id === giu) ?? null : null;
  const chuaChon = (dsVot ?? []).filter((v) => !muc.some((m) => m.sanPhamId === v.id));

  const sao = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("không có clipboard");
      await navigator.clipboard.writeText(url);
      setTrangSao("da");
      setTimeout(() => setTrangSao((x) => (x === "da" ? "" : x)), 2400);
    } catch {
      setTrangSao("that-bai");
      setTimeout(() => { oSao.current?.focus(); oSao.current?.select(); }, 0);
    }
  };
  const them = (id: string) => {
    const kq = themVaoSoSanh(muc, { sanPhamId: id, bienTheId: null });
    if (!kq.ok) { flash("danger", kq.lyDo === "day" ? `Chỉ so sánh tối đa ${TOI_DA_SO_SANH} vợt. Hãy bỏ hoặc thay bớt một vợt.` : "Mã vợt không hợp lệ."); return; }
    diDen(kq.muc);
  };
  const doiBien = (vi: number, bienId: string | null) => diDen(muc.map((x, k) => (k === vi ? { ...x, bienTheId: bienId } : x)), true);

  // Ô trống: chưa đủ 2 vợt thì mời chọn cho đủ; đã đủ thì chừa một ô thêm vợt thứ 3.
  const soO = muc.length < TOI_THIEU_SO_SANH ? TOI_THIEU_SO_SANH - muc.length : muc.length < TOI_DA_SO_SANH ? 1 : 0;
  const oTrong = Array.from({ length: soO }, (_, k) => k);
  // --n: số cột trên màn hình rộng (vợt + ô trống); --m: số vợt (điện thoại: ô thêm vợt xuống hàng riêng).
  const cotLuoi = { ["--n" as string]: muc.length + soO, ["--m" as string]: Math.max(muc.length, 1) };
  const dsChon = chuaChon.map((v) => ({ id: v.id, ten: v.ten }));

  const tomTat = muc.length === 0
    ? "Chọn 2 hoặc 3 cây vợt để đặt cạnh nhau."
    : muc.length === 1
      ? "Chọn thêm 1 vợt nữa để bắt đầu so sánh."
      : du
        ? <>{dayDu.length} vợt · {giaMin === giaMax ? "cùng giá" : <>chênh giá <b>{vnd(giaMax - giaMin)}</b></>} · khác nhau ở <b>{soKhac}/{truc.length}</b> thông số</>
        : "Đang tải thông tin vợt…";

  return (
    <Page>
      <div className={s.goc}>
        <nav className={s.vet} aria-label="Đường dẫn"><Link href="/">Trang chủ</Link> / <Link href="/SanPham/Index?loai=Vot">Vợt</Link> / So sánh</nav>
        <header className={s.dauTrang}>
          <div>
            <h1 className={`${s.tieuDe} ${fontTieuDe.className}`}>So sánh vợt</h1>
            <p className={s.tomTat} role="status">{tomTat}</p>
          </div>
          {muc.length >= TOI_THIEU_SO_SANH && (
            <button type="button" className={`${s.nut} ${s.nutVien}`} onClick={sao}>
              <i className={`fa-solid ${trangSao === "da" ? "fa-check" : "fa-link"}`} aria-hidden="true" />{trangSao === "da" ? "Đã sao chép" : "Sao chép liên kết"}
            </button>
          )}
        </header>

        {trangSao === "that-bai" && (
          <div className={s.dai}>
            <span>Trình duyệt không cho sao chép tự động. Hãy chọn và sao chép liên kết này:</span>
            <input ref={oSao} className={s.oLienKet} readOnly value={url} aria-label="Liên kết so sánh" onFocus={(e) => e.currentTarget.select()} />
          </div>
        )}
        {loiUrl.length > 0 && <p className={s.dai} role="status">{[...new Set(loiUrl.map((l) => NOI_DUNG_LOI_URL[l.loai]))].join(" ")}</p>}

        <div className={`${s.luoi} ${muc.length < TOI_THIEU_SO_SANH ? s.luoiMoi : ""}`} style={cotLuoi}>
          {cot.map((c) => (
            <TheVot key={c.m.sanPhamId} c={c} soGia={soGia(c)} dsDoi={dsChon}
              onBo={() => diDen(boKhoiSoSanh(muc, c.m.sanPhamId))}
              onDoiBien={(id) => doiBien(c.i, id)}
              onDoiVot={(id) => diDen(thayTrongSoSanh(muc, c.i, { sanPhamId: id, bienTheId: null }))} />
          ))}
          {oTrong.map((k) => (
            <OChon key={k} ds={dsChon} dangTai={!dsVot && !loiDs} loi={!!loiDs} thuLai={thuLai} onChon={them} ngang={muc.length >= TOI_THIEU_SO_SANH} />
          ))}
        </div>

        {muc.length < TOI_THIEU_SO_SANH && <ManHinhMoi muc={muc} goiY={goiY} dangTai={!dsVot && !loiDs} loi={!!loiDs} daChon={daChon} anhCua={anhCua} />}

        {muc.length >= TOI_THIEU_SO_SANH && !du && dayDu.length + cot.filter((c) => c.trangThai === "dang").length < TOI_THIEU_SO_SANH && (
          <p className={s.dai} role="status">Cần ít nhất {TOI_THIEU_SO_SANH} vợt tải được để đối chiếu. Hãy đổi hoặc bỏ vợt bị lỗi ở trên.</p>
        )}

        {du && (
          <>
            <section className={s.khoi} aria-labelledby="thong-so">
              <div className={s.khoiDau}>
                <h2 id="thong-so" className={s.khoiTen}>Thông số</h2>
                {soGiong > 0 && (
                  <label className={s.congTac}>
                    <input type="checkbox" role="switch" checked={chiKhac} onChange={(e) => setChiKhac(e.target.checked)} />
                    <span aria-hidden="true" />Chỉ hiện điểm khác
                  </label>
                )}
              </div>
              <div style={cotLuoi}>
                <DongThongSo truc={truc} cot={cot} viTri={viTri} chiKhac={chiKhac} />
              </div>
            </section>

            <section className={s.khoi} aria-labelledby="hinh-dang">
              <div className={s.khoiDau}>
                <h2 id="hinh-dang" className={s.khoiTen}>Hình dáng thông số</h2>
                <p className={s.khoiPhu}>Càng ra xa tâm: càng nặng đầu, cứng, nặng, dài, căng cao.</p>
              </div>
              <BieuDoNhen vot={vot} truc={truc} moTa={moTaBieuDo(hs, truc)} />
            </section>
          </>
        )}

        {muc.length >= TOI_THIEU_SO_SANH && <BangSoSanh cot={cot} hienThi={false} />}
      </div>
    </Page>
  );
}
