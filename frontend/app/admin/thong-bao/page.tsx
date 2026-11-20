"use client";

import Link from "next/link";
import { useState } from "react";
import { ListState } from "@/components/admin/Common";
import { ngayGio } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface TB { id: string; noiDung: string; danhGia: number; ngayPhanHoi: string; tenKhachHang: string; sanPhamId: string | null; tenSanPham: string | null }

export default function ThongBaoPage() {
  const { data, error, loading, reload } = useApi<TB[]>("/admin/thong-bao");
  const [loc, setLoc] = useState<number | null>(null);
  const ketQua = data?.filter((r) => loc === null || loc === r.danhGia) ?? null;
  return (
    <>
      <div className="admin-segments mb-3" role="group" aria-label="Lọc theo số sao">
        <button type="button" aria-pressed={loc === null} onClick={() => setLoc(null)}>Tất cả · {data?.length ?? 0}</button>
        {[1, 2].map((sao) => <button key={sao} type="button" aria-pressed={loc === sao} onClick={() => setLoc(sao)}>
          {sao} sao · {data?.filter((r) => r.danhGia === sao).length ?? 0}
        </button>)}
      </div>
      <ListState loading={loading} error={error} data={ketQua} retry={reload} empty={loc ? `Chưa ghi nhận đánh giá ${loc} sao.` : "Chưa ghi nhận đánh giá từ 2 sao trở xuống."}>
      {ketQua?.map((r) => (
        <article key={r.id} className="card-custom admin-report-card mb-2">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
            <strong>{r.tenKhachHang}</strong><time className="text-muted small" dateTime={r.ngayPhanHoi}>{ngayGio(r.ngayPhanHoi)}</time>
          </div>
          <span className="badge bg-warning text-dark">{r.danhGia} / 5 sao</span>
          <p className="admin-review-copy">{r.noiDung || "Khách không để lại nội dung."}</p>
          {r.sanPhamId && r.tenSanPham && <Link href={`/admin/san-pham/${r.sanPhamId}`} className="small">{r.tenSanPham}</Link>}
        </article>
      ))}
      </ListState>
    </>
  );
}
