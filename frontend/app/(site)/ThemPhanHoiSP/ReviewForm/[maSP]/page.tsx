"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { ErrorBox, Page } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";

export default function ReviewFormPage() {
  const { maSP } = useParams<{ maSP: string }>();
  const { user, ready, flash } = useApp();
  const router = useRouter();
  const [danhGia, setDanhGia] = useState(5);
  const [noiDung, setNoiDung] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace(`/TaiKhoan/DangNhap?returnUrl=/ThemPhanHoiSP/ReviewForm/${maSP}`);
  }, [ready, user, router, maSP]);

  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    try {
      const r = await apiPost<{ message: string }>("/phan-hoi", { sanPhamId: maSP, danhGia, noiDung });
      flash("success", r.message);
      router.push(`/Home/ChiTietSanPham/${maSP}`);
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };

  return (
    <Page>
      <div className="card mx-auto" style={{ maxWidth: 560 }}><form className="card-body" onSubmit={gui}>
        <h4 className="mb-3">Đánh giá sản phẩm</h4>
        {loi && <ErrorBox message={loi} />}
        <div className="mb-3">
          <label className="form-label">Số sao</label>
          <div className="fs-2">{[1, 2, 3, 4, 5].map((i) => (
            <button type="button" key={i} className="btn p-0 border-0 bg-transparent" style={{ color: i <= danhGia ? "#f5a623" : "#ccc", fontSize: "inherit" }} onClick={() => setDanhGia(i)} aria-label={`${i} sao`}>★</button>
          ))}</div>
        </div>
        <div className="mb-3">
          <label className="form-label">Nội dung đánh giá</label>
          <textarea className="form-control" rows={4} required minLength={5} maxLength={255} value={noiDung} onChange={(e) => setNoiDung(e.target.value)} />
          <div className="form-text">{noiDung.length}/255</div>
        </div>
        <button className="btn btn-primary" disabled={dang}>Gửi đánh giá</button>
      </form></div>
    </Page>
  );
}
