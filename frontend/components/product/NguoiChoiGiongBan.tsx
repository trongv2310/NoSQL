"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProviders";
import { useHoSo } from "@/components/HoSoChoi";
import { NHAN_THE, nhanNguoiDanh, thamSoNhom } from "@/lib/danh-gia";
import { NHAN_TRINH_DO, type TrinhDoKhoa } from "@/lib/ho-so-choi";
import { useApi } from "@/lib/hooks";

interface ThongKe {
  tatCa: { trungBinh: number | null; so: number };
  phanBoSao: Record<string, number>;
  theNoiBat: { the: string; so: number }[];
  theoTrinhDo: { trinhDo: TrinhDoKhoa; trungBinh: number; so: number }[];
  soDaMuaHang: number;
  giongBan: null
    | { nhom: { trinhDo: TrinhDoKhoa; noiDung: string[] }; chuaDuDuLieu: true; so: number; canToiThieu: number }
    | { nhom: { trinhDo: TrinhDoKhoa; noiDung: string[] }; chuaDuDuLieu: false; trungBinh: number; so: number; theNoiBat: { the: string; so: number }[] };
  coDuLieuMau: boolean;
}

/**
 * "Người chơi giống bạn nói gì": số liệu từ MỘT lệnh aggregate $facet ở backend (GET /phan-hoi/san-pham/:id).
 * Nhóm lấy từ hồ sơ trong tài khoản, chưa đăng nhập thì từ trình độ đã chọn ở Quầy tư vấn. Nhóm ít người thì nói thẳng là chưa đủ dữ liệu.
 */
export function NguoiChoiGiongBan({ sanPhamId, lanTai }: { sanPhamId: string; lanTai: number }) {
  const { user, ready } = useApp();
  const quay = useHoSo();
  const hoSoTk = useApi<{ hoSoChoi: { trinhDo?: string; noiDung?: string[] } | null }>(ready && user && user.maQuyen === 3 ? "/auth/ho-so-choi" : null);
  const choHoSo = ready && !!user && user.maQuyen === 3 && hoSoTk.loading;
  const q = thamSoNhom(hoSoTk.data?.hoSoChoi ?? null, quay.kn);
  const { data } = useApi<ThongKe>(ready && !choHoSo ? `/phan-hoi/san-pham/${sanPhamId}${q}${q ? "&" : "?"}t=${lanTai}` : null);
  if (!data || data.tatCa.so === 0) return null;
  const tongMax = Math.max(1, ...Object.values(data.phanBoSao));
  const g = data.giongBan;

  return (
    <div className="nguoi-choi-giong-ban mb-3 p-3 border rounded-4 bg-light">
      {data.coDuLieuMau && <p className="small text-muted mb-2"><i className="fa-solid fa-flask" aria-hidden="true" /> Có dữ liệu mẫu để minh hoạ (máy chạy demo), không phải đánh giá thật.</p>}
      <div className="row g-3">
        <div className="col-md-6">
          <h3 className="fs-6 fw-semibold mb-2">Người chơi giống bạn nói gì</h3>
          {!g ? (
            <p className="small mb-0">
              Chọn trình độ ở <Link href="/#quay-tu-van">Quầy tư vấn</Link>
              {user ? <> hoặc khai <Link href="/TaiKhoan/HoSoChoi">hồ sơ người chơi</Link></> : null} để xem đánh giá từ người chơi cùng trình độ.
            </p>
          ) : g.chuaDuDuLieu ? (
            <p className="small mb-0">
              Nhóm <b>{nhanNguoiDanh(g.nhom)}</b> mới có {g.so} đánh giá, cần ít nhất {g.canToiThieu} mới đưa ra điểm riêng. Xem điểm chung của mọi người bên cạnh.
            </p>
          ) : (
            <>
              <p className="mb-1"><span className="fs-4 fw-bold">{g.trungBinh.toFixed(1)}</span><small className="text-muted"> / 5 từ {g.so} người {nhanNguoiDanh(g.nhom)}</small></p>
              {g.theNoiBat.length > 0 && <div className="d-flex flex-wrap gap-1">{g.theNoiBat.map((t) => <span key={t.the} className="badge rounded-pill text-bg-success">{NHAN_THE[t.the] ?? t.the} · {t.so}</span>)}</div>}
            </>
          )}
          {data.theoTrinhDo.length > 0 && (
            <ul className="list-unstyled small mt-2 mb-0">
              {data.theoTrinhDo.map((x) => <li key={x.trinhDo}>{NHAN_TRINH_DO[x.trinhDo] ?? x.trinhDo}: <b>{x.trungBinh.toFixed(1)}</b> ({x.so} đánh giá)</li>)}
            </ul>
          )}
        </div>
        <div className="col-md-6">
          <h3 className="fs-6 fw-semibold mb-2">Phân bố số sao</h3>
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="d-flex align-items-center gap-2 small">
              <span style={{ width: 28 }}>{s}★</span>
              <div className="progress flex-grow-1" style={{ height: 8 }} role="img" aria-label={`${data.phanBoSao[s] ?? 0} đánh giá ${s} sao`}>
                <div className="progress-bar bg-warning" style={{ width: `${((data.phanBoSao[s] ?? 0) / tongMax) * 100}%` }} />
              </div>
              <span style={{ width: 24 }} className="text-end">{data.phanBoSao[s] ?? 0}</span>
            </div>
          ))}
          {data.soDaMuaHang > 0 && <p className="small text-muted mt-2 mb-0"><i className="fa-solid fa-bag-shopping" aria-hidden="true" /> {data.soDaMuaHang} đánh giá từ người đã mua tại shop</p>}
          {data.theNoiBat.length > 0 && <div className="d-flex flex-wrap gap-1 mt-2">{data.theNoiBat.map((t) => <span key={t.the} className="badge rounded-pill text-bg-light border">{NHAN_THE[t.the] ?? t.the} · {t.so}</span>)}</div>}
        </div>
      </div>
    </div>
  );
}
