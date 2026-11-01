"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { ErrorBox, Loading, Page, ProductCard } from "@/components/Ui";
import { imgUrl, ngayGio } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { SanPhamV, TinV, TranDauV } from "@/lib/types";
import { BangDiem, TinCard } from "@/components/News";

interface ChiTietTin { tin: TinV; lienQuan: TinV[]; tranDauMoi: TranDauV[]; spHot: SanPhamV[]; spMoi: SanPhamV[] }

export default function ChiTietTinPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<ChiTietTin>(`/ban-tin/${id}`);

  useEffect(() => {
    if (data) document.title = `${data.tin.tieuDe} - Bảng tin`;
  }, [data]);

  if (loading) return <Page><Loading /></Page>;
  if (error || !data) return <Page><ErrorBox message={error ?? "Không tìm thấy bài viết"} /></Page>;
  const { tin } = data;
  return (
    <Page>
      <link href="/css/bangtin.css" rel="stylesheet" />
      <nav className="small text-muted mb-3"><Link href="/">Trang chủ</Link> / <Link href="/BangTin">Bảng tin</Link> / {tin.nhanLoai}</nav>
      <div className="row g-4">
        <article className="col-lg-8">
          <span className="badge bg-secondary mb-2"><i className={`fa-solid ${tin.iconLoai}`} /> {tin.nhanLoai}</span>
          <h1 className="h2">{tin.tieuDe}</h1>
          <div className="text-muted small mb-3">{ngayGio(tin.ngayDang)} · {tin.luotXem} lượt xem{tin.tacGia ? ` · ${tin.tacGia}` : ""}</div>
          { }
          <img src={imgUrl(tin.hinhAnh)} alt="" className="img-fluid rounded mb-3" />
          {tin.tomTat && <p className="lead">{tin.tomTat}</p>}
          {/* Nội dung HTML do admin/nhân viên soạn trong trang quản trị (đáng tin cậy). */}
          <div className="bt-content" dangerouslySetInnerHTML={{ __html: tin.noiDung }} />
          {tin.nguonTin && <p className="small text-muted mt-3">Nguồn: {tin.lienKetNguon ? <a href={tin.lienKetNguon} target="_blank" rel="noopener noreferrer nofollow">{tin.nguonTin}</a> : tin.nguonTin}</p>}
          {tin.sanPham && <div className="mt-4" style={{ maxWidth: 260 }}><h6>Sản phẩm liên quan</h6><ProductCard sp={tin.sanPham} /></div>}
          {data.lienQuan.length > 0 && <section className="mt-4"><h5>Bài viết liên quan</h5>{data.lienQuan.map((t) => <TinCard key={t.id} t={t} />)}</section>}
        </article>
        <aside className="col-lg-4">
          <BangDiem ds={data.tranDauMoi} tieuDe="Kết quả thi đấu" />
          <h5>Sản phẩm mới</h5>
          <div className="row g-2">{data.spMoi.map((s) => <div key={s.id} className="col-6"><ProductCard sp={s} /></div>)}</div>
        </aside>
      </div>
    </Page>
  );
}
