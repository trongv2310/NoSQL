"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useApp } from "@/components/AppProviders";
import { PageHero } from "@/components/PageHero";
import { CheckoutSteps } from "@/components/Steps";
import { AnhSanPham, Empty, ErrorBox, Loading, Page } from "@/components/Ui";
import { api, apiDelete, apiPost, loiTuApi } from "@/lib/api";
import { imgUrl, vnd } from "@/lib/format";
import { dangKyGio, datSoLuongGio, gioMayChu, layGio, soLuongTrongGio, xoaKhoiGio } from "@/lib/gio-khach";
import { useApi } from "@/lib/hooks";
import type { BaoGiaV, BienTheV, GioHangV, TrangThaiDong } from "@/lib/types";

/** Một dòng giỏ đã chuẩn hóa để hiển thị, dùng chung cho giỏ khách (báo giá) và giỏ tài khoản. */
interface Dong {
  /** Khóa thao tác: id dòng giỏ ở tài khoản, id biến thể ở giỏ khách. */
  khoa: string;
  tenSanPham: string | null;
  sanPhamId: string | null;
  bienThe: BienTheV | null;
  soLuong: number;
  soLuongYeuCau: number;
  donGia: number;
  thanhTien: number;
  trangThai: TrangThaiDong;
}

const CHU_THICH: Partial<Record<TrangThaiDong, string>> = {
  het_hang: "Tạm hết hàng, không tính vào tổng tiền. Bạn có thể giữ lại để quay lại sau hoặc xóa khỏi giỏ.",
  ngung_kinh_doanh: "Sản phẩm này không còn kinh doanh, không tính vào tổng tiền.",
  khong_ton_tai: "Phiên bản sản phẩm này không còn tồn tại, không tính vào tổng tiền.",
};

const khongMua = (t: TrangThaiDong) => t === "het_hang" || t === "ngung_kinh_doanh" || t === "khong_ton_tai";

function dongTuTaiKhoan(it: GioHangV["items"][number]): Dong {
  const ton = it.bienThe.soLuongTon;
  const trangThai: TrangThaiDong = !it.sanPhamConKinhDoanh ? "ngung_kinh_doanh" : ton <= 0 ? "het_hang" : it.soLuong > ton ? "giam_so_luong" : "ok";
  return {
    khoa: it.id, tenSanPham: it.tenSanPham, sanPhamId: it.sanPhamId, bienThe: it.bienThe, soLuong: trangThai === "giam_so_luong" ? ton : it.soLuong,
    soLuongYeuCau: it.soLuong, donGia: it.donGia, thanhTien: it.thanhTien, trangThai,
  };
}

function dongTuBaoGia(it: BaoGiaV["items"][number]): Dong {
  return {
    khoa: it.id, tenSanPham: it.tenSanPham, sanPhamId: it.sanPhamId, bienThe: it.bienThe, soLuong: it.soLuong,
    soLuongYeuCau: it.soLuongYeuCau, donGia: it.donGia, thanhTien: it.thanhTien, trangThai: it.trangThai,
  };
}

/** Nhớ đơn giá của lần tải trước để báo khi giá đổi giữa hai lần xem (giỏ khách không lưu giá nên chỉ so trong phiên đang mở). */
function useGiaDoi(dong: Dong[]) {
  const truoc = useRef<Map<string, number>>(new Map());
  const [giaDoi, setGiaDoi] = useState<Record<string, { tu: number; den: number }>>({});
  useEffect(() => {
    const doi: Record<string, { tu: number; den: number }> = {};
    for (const d of dong) {
      const cu = truoc.current.get(d.khoa);
      if (cu !== undefined && cu !== d.donGia && d.donGia > 0) doi[d.khoa] = { tu: cu, den: d.donGia };
      if (d.donGia > 0) truoc.current.set(d.khoa, d.donGia);
    }
    if (Object.keys(doi).length) setGiaDoi((g) => ({ ...g, ...doi })); // eslint-disable-line react-hooks/set-state-in-effect
  }, [dong]);
  return giaDoi;
}

/** Số lượng khách chọn đã được tự giảm cho khớp tồn kho (chỉ giỏ khách; giỏ tài khoản để khách tự bấm "Giảm xuống"). */
type DaGiam = { yeuCau: number; con: number };

function DongGio({ d, giaDoi, daGiam, onDoiSoLuong, onXoa }: {
  d: Dong; giaDoi?: { tu: number; den: number }; daGiam?: DaGiam; onDoiSoLuong: (q: number) => void; onXoa: () => void;
}) {
  const ton = d.bienThe?.soLuongTon ?? 0;
  const mua = !khongMua(d.trangThai);
  const ten = d.tenSanPham ?? "Sản phẩm không còn trong cửa hàng";
  return (
    <div className={`cart-item${mua ? "" : " is-unavailable"}`}>
      <span className="cart-item-thumb">
        <AnhSanPham src={imgUrl(d.bienThe?.hinhAnh)} alt="" />
      </span>
      <div className="cart-item-body">
        {d.sanPhamId && mua ? <Link href={`/Home/ChiTietSanPham/${d.sanPhamId}`} className="cart-item-name">{ten}</Link> : <span className="cart-item-name">{ten}</span>}
        {d.bienThe && (
          <div className="small text-muted">{[d.bienThe.mau?.tenMau, d.bienThe.size?.tenSize].filter(Boolean).join(" · ")}{d.bienThe.sku ? ` · SKU ${d.bienThe.sku}` : ""}</div>
        )}
        {mua && <div className="small">Đơn giá: <span className="text-danger fw-semibold">{vnd(d.donGia)}</span></div>}
        {giaDoi && mua && <p className="cart-item-note is-warn" role="status">Giá đã thay đổi kể từ lần bạn xem trước: {vnd(giaDoi.tu)} → {vnd(giaDoi.den)}.</p>}
        {daGiam && d.trangThai === "ok" && d.soLuong === daGiam.con && (
          <p className="cart-item-note is-warn" role="status">Số lượng đã được giảm từ {daGiam.yeuCau} xuống {daGiam.con} vì kho chỉ còn {daGiam.con} sản phẩm.</p>
        )}
        {d.trangThai === "giam_so_luong" && (
          <p className="cart-item-note is-warn" role="status">
            Kho chỉ còn {d.soLuong} sản phẩm (bạn chọn {d.soLuongYeuCau}).{" "}
            <button type="button" className="cart-link-btn" onClick={() => onDoiSoLuong(d.soLuong)}>Giảm xuống {d.soLuong}</button>
          </p>
        )}
        {CHU_THICH[d.trangThai] && <p className="cart-item-note is-bad" role="status">{CHU_THICH[d.trangThai]}</p>}
        <div className="cart-item-actions">
          {mua && (
            <input key={`${d.khoa}-${d.soLuong}`} type="number" min={1} max={Math.max(1, Math.min(100, ton))} defaultValue={d.soLuong} className="form-control form-control-sm" style={{ width: 80 }}
              onBlur={(e) => { const q = Number(e.target.value); if (Number.isInteger(q) && q >= 1 && q !== d.soLuong) onDoiSoLuong(q); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              aria-label={`Số lượng ${ten}`} />
          )}
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={onXoa} aria-label={`Xóa ${ten} khỏi giỏ hàng`}><i className="fa-solid fa-trash" aria-hidden="true" /> Xóa</button>
        </div>
      </div>
      <div className="cart-item-total">{mua ? vnd(d.thanhTien) : "—"}</div>
    </div>
  );
}

function BoCuc({ dong, tongTien, tongSoLuong, giaDoi, daGiam = {}, onDoiSoLuong, onXoa, canhBao, hanhDong, dangCapNhat }: {
  dong: Dong[]; tongTien: number; tongSoLuong: number; giaDoi: Record<string, { tu: number; den: number }>; daGiam?: Record<string, DaGiam>;
  onDoiSoLuong: (d: Dong, q: number) => void; onXoa: (d: Dong) => void; canhBao?: React.ReactNode; hanhDong: React.ReactNode; dangCapNhat?: boolean;
}) {
  return (
    <>
      <PageHero compact tone="green" kicker="Giỏ hàng" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Giỏ hàng" }]}
        title={<>Giỏ hàng <em>của bạn</em></>} sub={dong.length ? `${tongSoLuong} sản phẩm đang chờ bạn chốt đơn.` : "Chưa có sản phẩm nào trong giỏ."} />
      <Page className="ct-wrap">
        <CheckoutSteps buoc={1} />
        {canhBao}
        {dong.length === 0 ? <Empty message="Giỏ hàng của bạn đang trống." linkUrl="/SanPham/Index" linkText="Tiếp tục mua sắm" /> : (
          <div className="row g-4">
            <div className="col-lg-8" aria-busy={dangCapNhat}>
              {dong.map((d) => <DongGio key={d.khoa} d={d} giaDoi={giaDoi[d.khoa]} daGiam={daGiam[d.khoa]} onDoiSoLuong={(q) => onDoiSoLuong(d, q)} onXoa={() => onXoa(d)} />)}
            </div>
            <div className="col-lg-4">
              <div className="card cart-summary"><div className="card-body">
                <h2 className="ct-sum-title">Tóm tắt đơn hàng</h2>
                <div className="d-flex justify-content-between mb-2"><span>Số lượng</span><strong>{tongSoLuong}</strong></div>
                <div className="d-flex justify-content-between mb-3"><span>Tạm tính</span><strong className="text-danger fs-5">{vnd(tongTien)}</strong></div>
                {hanhDong}
                <Link href="/SanPham/Index" className="ct-continue"><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Tiếp tục mua sắm</Link>
                <ul className="ct-assure">
                  <li><i className="fa-solid fa-wallet" aria-hidden="true" /> Thanh toán COD hoặc MoMo</li>
                  <li><i className="fa-solid fa-tag" aria-hidden="true" /> Giá đã gồm khuyến mãi đang áp dụng, được tính lại mỗi lần bạn xem giỏ và khi đặt hàng</li>
                  <li><i className="fa-solid fa-truck" aria-hidden="true" /> Phí và thời gian giao hàng: <Link href="/ChinhSach/giao-hang">đang cập nhật</Link></li>
                </ul>
              </div></div>
            </div>
          </div>
        )}
      </Page>
    </>
  );
}

// ---------------------------------------------------------------------------
// Giỏ của khách chưa đăng nhập
// ---------------------------------------------------------------------------

function GioKhachTrang() {
  const { flash } = useApp();
  const gio = useSyncExternalStore(dangKyGio, layGio, gioMayChu);
  const khoa = gio.dong.map((d) => `${d.id}:${d.sl}`).join("|");
  const [bg, setBg] = useState<{ khoa: string; data: BaoGiaV | null; loi: string | null }>({ khoa: "", data: null, loi: null });
  const [thuLai, setThuLai] = useState(0);

  useEffect(() => {
    if (!khoa) return;
    let huy = false;
    apiPost<BaoGiaV>("/gio-hang/tinh", { dong: khoa.split("|").map((x) => { const [chiTietId, sl] = x.split(":"); return { chiTietId, soLuong: Number(sl) }; }) })
      .then((data) => { if (!huy) setBg({ khoa, data, loi: null }); })
      .catch((e) => { if (!huy) setBg((cu) => ({ khoa, data: cu.data, loi: loiTuApi(e) })); });
    return () => { huy = true; };
  }, [khoa, thuLai]);

  const dong = useMemo(() => (bg.data ? bg.data.items.filter((i) => gio.dong.some((d) => d.id === i.id)).map(dongTuBaoGia) : []), [bg.data, gio.dong]);
  const giaDoi = useGiaDoi(dong);

  // Kho đã giảm so với số khách chọn: hạ số lượng trong giỏ xuống đúng tồn kho để huy hiệu giỏ và tổng tiền khớp nhau, và nói rõ cho khách.
  const [daGiam, setDaGiam] = useState<Record<string, DaGiam>>({});
  useEffect(() => {
    const can = (bg.data?.items ?? []).filter((i) => i.trangThai === "giam_so_luong" && i.soLuong >= 1 && soLuongTrongGio(layGio(), i.id) === i.soLuongYeuCau);
    if (!can.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDaGiam((g) => ({ ...g, ...Object.fromEntries(can.map((i) => [i.id, { yeuCau: i.soLuongYeuCau, con: i.soLuong }])) }));
    for (const i of can) datSoLuongGio(i.id, i.soLuong);
  }, [bg.data]);

  if (gio.dong.length === 0) return <BoCuc dong={[]} tongTien={0} tongSoLuong={0} giaDoi={{}} onDoiSoLuong={() => {}} onXoa={() => {}} hanhDong={null} />;
  if (!bg.data && !bg.loi) return <Page><Loading text="Đang kiểm tra giá và tồn kho..." /></Page>;
  if (!bg.data) return <Page><ErrorBox message={bg.loi ?? "Không tải được giỏ hàng."} /><button type="button" className="btn btn-primary" onClick={() => setThuLai((n) => n + 1)}>Thử lại</button></Page>;

  const dangCapNhat = bg.khoa !== khoa;
  const mua = dong.filter((d) => !khongMua(d.trangThai));
  return (
    <BoCuc
      dong={dong} giaDoi={giaDoi} daGiam={daGiam} dangCapNhat={dangCapNhat}
      tongTien={mua.reduce((t, d) => t + d.thanhTien, 0)} tongSoLuong={mua.reduce((t, d) => t + d.soLuong, 0)}
      onDoiSoLuong={(d, q) => { setDaGiam((g) => Object.fromEntries(Object.entries(g).filter(([k]) => k !== d.khoa))); datSoLuongGio(d.khoa, q); }}
      onXoa={(d) => { xoaKhoiGio(d.khoa); flash("success", "Đã xóa sản phẩm khỏi giỏ hàng."); }}
      canhBao={
        <>
          <p className="cart-banner" role="status">
            <i className="fa-solid fa-circle-info" aria-hidden="true" /> Bạn đang xem giỏ hàng chưa đăng nhập, lưu trên trình duyệt này. Đăng nhập khi thanh toán, giỏ sẽ được chuyển vào tài khoản.
          </p>
          {bg.loi && <p className="cart-banner is-bad" role="alert">Chưa cập nhật được giá mới nhất: {bg.loi} <button type="button" className="cart-link-btn" onClick={() => setThuLai((n) => n + 1)}>Thử lại</button></p>}
        </>
      }
      hanhDong={
        <>
          {mua.length === 0 && <p className="cart-banner is-bad" role="alert">Chưa có sản phẩm nào có thể đặt. Hãy xóa các dòng không còn bán hoặc chọn sản phẩm khác.</p>}
          <Link href={`/TaiKhoan/DangNhap?returnUrl=${encodeURIComponent("/DonHang/Checkout")}`} className={`btn btn-primary w-100 ct-pay-btn${mua.length ? "" : " disabled"}`} aria-disabled={mua.length === 0}>
            Đăng nhập để thanh toán <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
          <p className="cart-aside">Chưa có tài khoản? <Link href={`/TaiKhoan/DangKy?returnUrl=${encodeURIComponent("/DonHang/Checkout")}`}>Đăng ký</Link> chỉ mất một phút.</p>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Giỏ của tài khoản
// ---------------------------------------------------------------------------

function GioTaiKhoanTrang() {
  const { setCartCount, flash, dongBo, thuLaiDongBo } = useApp();
  const { data, error, loading, reload } = useApi<GioHangV>("/gio-hang");

  useEffect(() => {
    if (data) setCartCount(data.tongSoLuong);
  }, [data, setCartCount]);

  // Một lượt đồng bộ giỏ khách vừa xong: tải lại để thấy các sản phẩm vừa được gộp.
  const lanTruoc = useRef(dongBo.lanXong);
  useEffect(() => {
    if (dongBo.lanXong !== lanTruoc.current) {
      lanTruoc.current = dongBo.lanXong;
      void reload();
    }
  }, [dongBo.lanXong, reload]);

  const dong = useMemo(() => (data ? data.items.map(dongTuTaiKhoan) : []), [data]);
  const giaDoi = useGiaDoi(dong);

  const doiSoLuong = async (id: string, quantity: number) => {
    try {
      await api(`/gio-hang/${id}`, { method: "PATCH", body: { quantity } });
    } catch (e) {
      flash("danger", loiTuApi(e));
    }
    await reload();
  };
  const xoa = async (id: string) => {
    try {
      await apiDelete(`/gio-hang/${id}`);
      flash("success", "Đã xóa sản phẩm khỏi giỏ hàng.");
    } catch (e) {
      flash("danger", loiTuApi(e));
    }
    await reload();
  };

  if (loading && !data) return <Page><Loading /></Page>;
  if (error || !data) return <Page><ErrorBox message={error ?? "Lỗi tải giỏ hàng"} /></Page>;

  const vuong = dong.some((d) => khongMua(d.trangThai) || d.trangThai === "giam_so_luong");
  return (
    <BoCuc
      dong={dong} giaDoi={giaDoi} tongTien={data.tongTien} tongSoLuong={data.tongSoLuong}
      onDoiSoLuong={(d, q) => void doiSoLuong(d.khoa, q)} onXoa={(d) => void xoa(d.khoa)}
      canhBao={
        <>
          {dongBo.trangThai === "dang" && <p className="cart-banner" role="status"><i className="fa-solid fa-rotate" aria-hidden="true" /> Đang chuyển giỏ hàng bạn thêm trước khi đăng nhập vào tài khoản...</p>}
          {dongBo.trangThai === "loi" && (
            <p className="cart-banner is-bad" role="alert">
              Chưa đồng bộ được giỏ hàng bạn thêm trước khi đăng nhập ({dongBo.soBanChupCho} lượt đang chờ): {dongBo.loi}. Giỏ vẫn được giữ lại.{" "}
              <button type="button" className="cart-link-btn" onClick={thuLaiDongBo}>Thử lại</button>
            </p>
          )}
        </>
      }
      hanhDong={
        <>
          {vuong && <p className="cart-banner is-bad" role="alert">Giỏ có sản phẩm hết hàng, ngừng kinh doanh hoặc vượt tồn kho. Hãy xử lý các dòng đó trước khi thanh toán.</p>}
          <Link href="/DonHang/Checkout" className={`btn btn-primary w-100 ct-pay-btn${vuong || dongBo.trangThai !== "rong" ? " disabled" : ""}`} aria-disabled={vuong || dongBo.trangThai !== "rong"}>
            Tiến hành thanh toán <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
        </>
      }
    />
  );
}

export function GioHangTrang() {
  const { user, ready } = useApp();
  if (!ready) return <Page><Loading /></Page>;
  return user ? <GioTaiKhoanTrang /> : <GioKhachTrang />;
}
