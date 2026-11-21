"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProviders";
import { ErrorBox, Page } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";

export default function DoiMatKhauPage() {
  const { user, ready, flash } = useApp();
  const router = useRouter();
  const [f, setF] = useState({ matKhauCu: "", matKhauMoi: "", xacNhanMoi: "" });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, setDang] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace("/TaiKhoan/DangNhap?returnUrl=/TaiKhoan/DoiMatKhau");
  }, [ready, user, router]);

  const dat = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const gui = async (e: React.FormEvent) => {
    e.preventDefault();
    setDang(true);
    setLoi(null);
    try {
      const r = await apiPost<{ message: string }>("/auth/doi-mat-khau", f);
      flash("success", r.message);
      router.push(user?.maQuyen === 1 ? "/admin" : "/");
    } catch (err) {
      setLoi(loiTuApi(err));
      setDang(false);
    }
  };

  return (
    <Page>
      <form className="card mx-auto" style={{ maxWidth: 440 }} onSubmit={gui}><div className="card-body p-4">
        <h1 className="h4 mb-3">Đổi mật khẩu</h1>
        {loi && <ErrorBox message={loi} />}
        <div className="mb-3"><label className="form-label" htmlFor="dmk-1">Mật khẩu cũ</label><input id="dmk-1" type="password" className="form-control" required value={f.matKhauCu} onChange={dat("matKhauCu")} /></div>
        <div className="mb-3"><label className="form-label" htmlFor="dmk-2">Mật khẩu mới</label><input id="dmk-2" type="password" className="form-control" required minLength={6} value={f.matKhauMoi} onChange={dat("matKhauMoi")} /></div>
        <div className="mb-3"><label className="form-label" htmlFor="dmk-3">Xác nhận mật khẩu mới</label><input id="dmk-3" type="password" className="form-control" required value={f.xacNhanMoi} onChange={dat("xacNhanMoi")} /></div>
        <button className="btn btn-primary w-100" disabled={dang}>Đổi mật khẩu</button>
      </div></form>
    </Page>
  );
}
