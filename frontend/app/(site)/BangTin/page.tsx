"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CountUp } from "@/components/Motion";
import { BangDiem, NewsCard, NewsLead, SpMini, TinCard } from "@/components/News";
import { PageHero } from "@/components/PageHero";
import { Empty, ErrorBox, Loading, Page, Pagination } from "@/components/Ui";
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

  const tatCa = data ? [...data.dsNoiBat, ...data.items] : [];
  const lead = tatCa[0];
  const phu = tatCa.slice(1, 3);
  const con = tatCa.slice(3);

  return (
    <>
      <link href="/css/bangtin.css" rel="stylesheet" />
      <PageHero compact tone="navy" kicker="Tin tức & kết quả" crumbs={[{ nhan: "Trang chủ", href: "/" }, { nhan: "Bảng tin" }]}
        title={<>Bảng tin <em>cầu lông</em></>}
        sub="Tin thi đấu, hồ sơ tuyển thủ và sản phẩm mới — cập nhật cho người chơi cầu lông."
        stats={data ? [{ value: <CountUp to={data.tong.tin} />, nhan: "Bài viết" }, { value: <CountUp to={data.tong.tran} />, nhan: "Trận đấu" }, { value: <CountUp to={data.tong.luotXem} />, nhan: "Lượt xem" }] : undefined}
        aside={
          <form className="nw-search" onSubmit={(e) => { e.preventDefault(); di(loai, keyword); }} role="search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input placeholder="Tìm bài viết..." value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="Tìm bài viết" />
            <button aria-label="Tìm">Tìm</button>
          </form>
        } />
      <Page className="nw-wrap">
        <div className="nw-filters" role="tablist" aria-label="Loại bài viết">
          {LOAI_TIN.map(([khoa, nhan]) => (
            <button key={khoa} type="button" role="tab" aria-selected={loai === khoa} onClick={() => di(khoa, keyword)}>
              {nhan}{khoa && data?.demLoai[khoa] ? <b>{data.demLoai[khoa]}</b> : null}
            </button>
          ))}
        </div>
        {loading && !data ? <Loading /> : error || !data ? <ErrorBox message={error ?? "Lỗi tải dữ liệu"} /> : (
          <div className="row g-4">
            <div className="col-lg-8">
              {!lead ? <Empty message="Chưa có bài viết phù hợp." /> : (
                <>
                  <div className="nw-top">
                    <NewsLead t={lead} />
                    {phu.length > 0 && <div className="nw-top-side">{phu.map((t) => <TinCard key={t.id} t={t} />)}</div>}
                  </div>
                  {con.length > 0 && <div className="nw-grid">{con.map((t) => <NewsCard key={t.id} t={t} />)}</div>}
                </>
              )}
              <Pagination trang={data} />
            </div>
            <aside className="col-lg-4 nw-side">
              <BangDiem ds={data.tranDauMoi} tieuDe="Kết quả thi đấu" />
              <section className="nw-board">
                <h3 className="nw-side-title"><span><i className="fa-solid fa-fire" aria-hidden="true" /></span>Sản phẩm hot</h3>
                <div className="nw-minis">{data.spHot.map((s) => <SpMini key={s.id} sp={s} />)}</div>
                <Link href="/SanPham/Index" className="nw-side-link">Xem tất cả sản phẩm <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
              </section>
            </aside>
          </div>
        )}
      </Page>
    </>
  );
}
