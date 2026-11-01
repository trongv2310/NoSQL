"use client";

import Link from "next/link";
import { ErrorBox, Loading } from "@/components/Ui";
import { ngayGio } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface TB { id: string; noiDung: string; danhGia: number; ngayPhanHoi: string; tenKhachHang: string; sanPhamId: string | null; tenSanPham: string | null }

export default function ThongBaoPage() {
  const { data, error, loading } = useApi<TB[]>("/admin/thong-bao");
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Lỗi tải thông báo"} />;
  return (
    <>
      <h5 className="mb-3">Đánh giá từ 2 sao trở xuống ({data.length})</h5>
      {data.length === 0 ? <div className="text-center text-muted py-4">Chưa có đánh giá thấp nào. 🎉</div> : data.map((r) => (
        <div key={r.id} className="card-custom p-3 mb-2">
          <div className="d-flex justify-content-between flex-wrap">
            <strong>{r.tenKhachHang}</strong><small className="text-muted">{ngayGio(r.ngayPhanHoi)}</small>
          </div>
          <div className="text-warning">{"★".repeat(r.danhGia)}<span className="text-muted">{"★".repeat(5 - r.danhGia)}</span></div>
          <div>{r.noiDung}</div>
          {r.sanPhamId && <Link href={`/Home/ChiTietSanPham/${r.sanPhamId}`} className="small">{r.tenSanPham}</Link>}
        </div>
      ))}
    </>
  );
}
