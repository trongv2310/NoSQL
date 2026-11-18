"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { datHoSo, useHoSo } from "@/components/HoSoChoi";
import { PageHero } from "@/components/PageHero";
import { ErrorBox, Loading, Page } from "@/components/Ui";
import { apiDelete, apiPut, loiTuApi } from "@/lib/api";
import { ngay } from "@/lib/format";
import { NHAN_LOI_CHOI, NHAN_TRINH_DO, type LoiChoiKhoa, type TrinhDoKhoa } from "@/lib/ho-so-choi";
import { useApi } from "@/lib/hooks";

/**
 * Hồ sơ người chơi lưu trong tài khoản (MongoDB: khachhangs.hoSoChoi, nhúng trong khách hàng). Mọi trường đều không bắt buộc.
 * Trình độ và lối chơi dùng CHUNG khoá với hồ sơ ở Quầy tư vấn (lib/ho-so-choi.ts): lưu xong thì hồ sơ của Quầy tư vấn trên máy này cũng đổi theo,
 * và lần đầu mở trang (tài khoản chưa có hồ sơ) thì điền sẵn từ lựa chọn ở Quầy tư vấn để người dùng chỉ việc xác nhận.
 */
type NoiDung = "don" | "doi";
type TayThuan = "phai" | "trai";
type ChanThuong = "co-tay" | "khuyu-tay" | "vai";
interface HoSoTaiKhoan {
  trinhDo?: TrinhDoKhoa;
  noiDung?: NoiDung[];
  loiChoi?: LoiChoiKhoa;
  tayThuan?: TayThuan;
  chanThuong?: ChanThuong[];
  soBuoiMoiTuan?: number;
  capNhatLuc?: string;
}
interface Form {
  trinhDo: TrinhDoKhoa | null;
  noiDung: NoiDung[];
  loiChoi: LoiChoiKhoa | null;
  tayThuan: TayThuan | null;
  chanThuong: ChanThuong[];
  soBuoiMoiTuan: string;
}

const NHAN_NOI_DUNG: Record<NoiDung, string> = { don: "Đánh đơn", doi: "Đánh đôi" };
const NHAN_TAY: Record<TayThuan, string> = { phai: "Tay phải", trai: "Tay trái" };
const NHAN_CHAN_THUONG: Record<ChanThuong, string> = { "co-tay": "Cổ tay", "khuyu-tay": "Khuỷu tay", vai: "Vai" };
const FORM_TRONG: Form = { trinhDo: null, noiDung: [], loiChoi: null, tayThuan: null, chanThuong: [], soBuoiMoiTuan: "" };

const tuHoSo = (h: HoSoTaiKhoan | null): Form =>
  h
    ? {
        trinhDo: h.trinhDo ?? null, noiDung: h.noiDung ?? [], loiChoi: h.loiChoi ?? null, tayThuan: h.tayThuan ?? null,
        chanThuong: h.chanThuong ?? [], soBuoiMoiTuan: h.soBuoiMoiTuan === undefined ? "" : String(h.soBuoiMoiTuan),
      }
    : FORM_TRONG;

/** Một nhóm nút chọn một (có nút "Chưa chọn") hoặc chọn nhiều, dùng btn-check của Bootstrap nên bấm được bằng bàn phím. */
function NhomChon<K extends string>({ ten, nhan, giaTri, chon, nhieu, onDoi }: {
  ten: string; nhan: Record<K, string>; giaTri: K | K[] | null; chon?: boolean; nhieu?: boolean; onDoi: (v: K | K[] | null) => void;
}) {
  const ds = Object.keys(nhan) as K[];
  const dangChon = (k: K) => (nhieu ? (giaTri as K[]).includes(k) : giaTri === k);
  const bam = (k: K) => {
    if (!nhieu) return onDoi(k);
    const cu = giaTri as K[];
    onDoi(cu.includes(k) ? cu.filter((x) => x !== k) : [...cu, k]);
  };
  return (
    <div className="d-flex flex-wrap gap-2" role="group">
      {ds.map((k) => (
        <span key={k}>
          <input type={nhieu ? "checkbox" : "radio"} className="btn-check" name={ten} id={`${ten}-${k}`} checked={dangChon(k)} onChange={() => bam(k)} />
          <label className="btn btn-outline-primary rounded-pill" htmlFor={`${ten}-${k}`}>{nhan[k]}</label>
        </span>
      ))}
      {!nhieu && chon !== false && (
        <span>
          <input type="radio" className="btn-check" name={ten} id={`${ten}-trong`} checked={giaTri === null} onChange={() => onDoi(null)} />
          <label className="btn btn-outline-secondary rounded-pill" htmlFor={`${ten}-trong`}>Chưa chọn</label>
        </span>
      )}
    </div>
  );
}

export default function HoSoChoiPage() {
  const { user, ready, flash } = useApp();
  const router = useRouter();
  const quay = useHoSo();
  const { data, error, loading } = useApi<{ hoSoChoi: HoSoTaiKhoan | null }>(ready && user ? "/auth/ho-so-choi" : null);
  const [f, setF] = useState<Form>(FORM_TRONG);
  const [capNhatLuc, setCapNhatLuc] = useState<string | null>(null);
  const [tuQuay, setTuQuay] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace("/TaiKhoan/DangNhap?returnUrl=/TaiKhoan/HoSoChoi");
  }, [ready, user, router]);

  // Nạp một lần khi có dữ liệu: hồ sơ trong tài khoản; chưa có thì điền sẵn trình độ/lối chơi đã chọn ở Quầy tư vấn (chưa lưu).
  useEffect(() => {
    if (!data) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (data.hoSoChoi) {
      setF(tuHoSo(data.hoSoChoi));
      setCapNhatLuc(data.hoSoChoi.capNhatLuc ?? null);
    } else if (quay.kn || quay.lc) {
      setF({ ...FORM_TRONG, trinhDo: quay.kn, loiChoi: quay.lc });
      setTuQuay(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Chỉ chạy khi dữ liệu tài khoản về; đổi hồ sơ Quầy tư vấn sau đó không được ghi đè form đang sửa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const luu = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    setLoi(null);
    try {
      const so = f.soBuoiMoiTuan.trim();
      const r = await apiPut<{ hoSoChoi: HoSoTaiKhoan | null; message: string }>("/auth/ho-so-choi", {
        trinhDo: f.trinhDo, noiDung: f.noiDung, loiChoi: f.loiChoi, tayThuan: f.tayThuan, chanThuong: f.chanThuong,
        soBuoiMoiTuan: so === "" ? null : Number(so),
      });
      setF(tuHoSo(r.hoSoChoi));
      setCapNhatLuc(r.hoSoChoi?.capNhatLuc ?? null);
      setTuQuay(false);
      datHoSo({ kn: r.hoSoChoi?.trinhDo ?? null, lc: r.hoSoChoi?.loiChoi ?? null }, false);
      flash("success", r.message);
    } catch (err) {
      setLoi(loiTuApi(err));
    } finally {
      setDang(false);
    }
  };

  const xoa = async () => {
    if (!window.confirm("Xoá toàn bộ hồ sơ người chơi, kể cả thông tin chấn thương?")) return;
    setDang(true);
    setLoi(null);
    try {
      const r = await apiDelete<{ message: string }>("/auth/ho-so-choi");
      setF(FORM_TRONG);
      setCapNhatLuc(null);
      setTuQuay(false);
      datHoSo({ kn: null, lc: null }, false);
      flash("success", r.message);
    } catch (err) {
      setLoi(loiTuApi(err));
    } finally {
      setDang(false);
    }
  };

  if (!ready || loading) return <Page><Loading /></Page>;
  if (error || !data) return <Page><ErrorBox message={error ?? "Không tải được hồ sơ"} /></Page>;

  return (
    <>
      <PageHero compact tone="green" kicker="Tài khoản" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Thông tin tài khoản", href: "/TaiKhoan/ThongTin" }, { nhan: "Hồ sơ người chơi" }]} title={<>Hồ sơ <em>người chơi</em></>} sub="Bạn tự khai cách mình chơi. Mọi mục đều không bắt buộc, sửa hoặc xoá lúc nào cũng được." />
      <Page className="pf-wrap">
        <form className="pf-card sf-reveal mx-auto" style={{ maxWidth: 720 }} onSubmit={luu}>
          {loi && <ErrorBox message={loi} />}
          {tuQuay && <div className="alert alert-info py-2">Đã điền sẵn trình độ và lối chơi bạn chọn ở Quầy tư vấn. Bấm <b>Lưu hồ sơ</b> để giữ vào tài khoản.</div>}

          <fieldset className="mb-4">
            <legend className="fs-6 fw-semibold">Trình độ (tự đánh giá)</legend>
            <NhomChon ten="trinhDo" nhan={NHAN_TRINH_DO} giaTri={f.trinhDo} onDoi={(v) => setF({ ...f, trinhDo: v as TrinhDoKhoa | null })} />
          </fieldset>

          <fieldset className="mb-4">
            <legend className="fs-6 fw-semibold">Thường đánh</legend>
            <NhomChon ten="noiDung" nhieu nhan={NHAN_NOI_DUNG} giaTri={f.noiDung} onDoi={(v) => setF({ ...f, noiDung: v as NoiDung[] })} />
          </fieldset>

          <fieldset className="mb-4">
            <legend className="fs-6 fw-semibold">Lối chơi thích</legend>
            <NhomChon ten="loiChoi" nhan={NHAN_LOI_CHOI} giaTri={f.loiChoi} onDoi={(v) => setF({ ...f, loiChoi: v as LoiChoiKhoa | null })} />
          </fieldset>

          <div className="row g-3 mb-4">
            <fieldset className="col-sm-7">
              <legend className="fs-6 fw-semibold">Tay thuận</legend>
              <NhomChon ten="tayThuan" nhan={NHAN_TAY} giaTri={f.tayThuan} onDoi={(v) => setF({ ...f, tayThuan: v as TayThuan | null })} />
            </fieldset>
            <div className="col-sm-5">
              <label className="fs-6 fw-semibold form-label" htmlFor="hsc-buoi">Số buổi chơi mỗi tuần</label>
              <input id="hsc-buoi" type="number" inputMode="numeric" min={0} max={14} step={1} className="form-control" placeholder="Bỏ trống nếu không muốn khai" value={f.soBuoiMoiTuan} onChange={(e) => setF({ ...f, soBuoiMoiTuan: e.target.value })} />
            </div>
          </div>

          <fieldset className="mb-4">
            <legend className="fs-6 fw-semibold">Đang hoặc từng đau ở</legend>
            <p className="small text-muted mb-2">
              <i className="fa-solid fa-lock" aria-hidden="true" /> Thông tin sức khoẻ: không bắt buộc, chỉ bạn xem được, không bao giờ hiện kèm tên bạn ở trang công khai.
            </p>
            <NhomChon ten="chanThuong" nhieu nhan={NHAN_CHAN_THUONG} giaTri={f.chanThuong} onDoi={(v) => setF({ ...f, chanThuong: v as ChanThuong[] })} />
          </fieldset>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <button className="btn btn-primary" disabled={dang}>Lưu hồ sơ</button>
            {/* capNhatLuc chỉ có khi tài khoản đang có hồ sơ (nạp, lưu, xoá đều cập nhật nó), nên dùng làm dấu "có gì để xoá". */}
            {capNhatLuc && <button type="button" className="btn btn-outline-danger" disabled={dang} onClick={xoa}>Xoá hồ sơ</button>}
            <Link href="/TaiKhoan/ThongTin" className="btn btn-link">Quay lại tài khoản</Link>
            {capNhatLuc && <small className="text-muted ms-auto">Cập nhật lần cuối: {ngay(capNhatLuc)}</small>}
          </div>
        </form>
      </Page>
    </>
  );
}
