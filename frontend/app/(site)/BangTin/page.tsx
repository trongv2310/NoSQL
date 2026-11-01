"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Empty, ErrorBox, Loading, Page, Pagination, ProductCard } from "@/components/Ui";
import { BangDiem, TinCard } from "@/components/News";
import { useApi } from "@/lib/hooks";
import type { SanPhamV, TinV, TranDauV, Trang } from "@/lib/types";

interface BangTinData extends Trang<TinV> {
  dsNoiBat: TinV[];
  loai: string | null;
  keyword: string;
  demLoai: Record<string, number>;
  tong: { tin: number; tran: number; luotXem: number };
  tranDauMoi: TranDauV[];
  spHot: SanPhamV[];
  spMoi: SanPhamV[];
  tickerTran: TranDauV[];
}

const LOAI_TIN: [string, string][] = [["", "Tất cả"], ["san-pham-hot", "Sản phẩm hot"], ["san-pham-moi", "Sản phẩm mới"], ["tran-dau", "Trận đấu"], ["tuyen-thu", "Tuyển thủ"], ["giai-dau", "Giải đấu"]];

export default function BangTinPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.toString();
  const { data, error, loading } = useApi<BangTinData>(`/ban-tin${q ? `?${q}` : ""}`);
  const [keyword, setKeyword] = useState(sp.get("keyword") ?? "");
  const loai = sp.get("loai") ?? "";

  const di = (l: string, k: string) => {
    const p = new URLSearchParams();
    if (l) p.set("loai", l);
    if (k.trim()) p.set("keyword", k.trim());
    router.push(`/BangTin${p.toString() ? `?${p}` : ""}`);
  };

  return (
    <Page>
      <link href="/css/bangtin.css" rel="stylesheet" />
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div>
          <h2 className="page-title mb-1">Bảng tin cầu lông</h2>
          {data && <div className="small text-muted">{data.tong.tin} bài viết · {data.tong.tran} trận đấu · {data.tong.luotXem.toLocaleString("vi-VN")} lượt xem</div>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); di(loai, keyword); }} className="d-flex gap-2">
          <input className="form-control" placeholder="Tìm bài viết..." value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <button className="btn btn-primary" aria-label="Tìm"><i className="fa-solid fa-magnifying-glass" /></button>
        </form>
      </div>
      <div className="d-flex flex-wrap gap-2 mb-4">
        {LOAI_TIN.map(([khoa, nhan]) => (
          <button key={khoa} className={`btn btn-sm ${loai === khoa ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => di(khoa, keyword)}>
            {nhan}{khoa && data?.demLoai[khoa] ? ` (${data.demLoai[khoa]})` : ""}
          </button>
        ))}
      </div>
      {loading && !data ? <Loading /> : error || !data ? <ErrorBox message={error ?? "Lỗi tải dữ liệu"} /> : (
        <div className="row g-4">
          <div className="col-lg-8">
            {data.dsNoiBat.map((t) => <TinCard key={t.id} t={t} />)}
            {data.items.length === 0 && data.dsNoiBat.length === 0 ? <Empty message="Chưa có bài viết phù hợp." /> : data.items.map((t) => <TinCard key={t.id} t={t} />)}
            <Pagination trang={data} />
          </div>
          <aside className="col-lg-4">
            <BangDiem ds={data.tranDauMoi} tieuDe="Kết quả thi đấu" />
            <h5>Sản phẩm hot</h5>
            <div className="row g-2">{data.spHot.map((s) => <div key={s.id} className="col-6"><ProductCard sp={s} /></div>)}</div>
          </aside>
        </div>
      )}
    </Page>
  );
}
