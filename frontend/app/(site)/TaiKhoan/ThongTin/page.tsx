"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/components/AppProviders";
import { ErrorBox, Loading, Page } from "@/components/Ui";
import { ngay } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export default function ThongTinPage() {
  const { user, ready } = useApp();
  const router = useRouter();
  const { data, error, loading } = useApi<{ hoTen: string; email: string; soDienThoai: string; diaChi: string; ngayTao: string }>(ready && user ? "/auth/thong-tin" : null);

  useEffect(() => {
    if (ready && !user) router.replace("/TaiKhoan/DangNhap?returnUrl=/TaiKhoan/ThongTin");
  }, [ready, user, router]);

  if (!ready || loading) return <Page><Loading /></Page>;
  if (error || !data) return <Page><ErrorBox message={error ?? "Không có thông tin"} /></Page>;
  return (
    <Page>
      <div className="card mx-auto" style={{ maxWidth: 560 }}><div className="card-body p-4">
        <h4 className="mb-3">Thông tin tài khoản</h4>
        <dl className="row mb-0">
          <dt className="col-sm-4">Tên đăng nhập</dt><dd className="col-sm-8">{user?.tenDangNhap}</dd>
          <dt className="col-sm-4">Họ tên</dt><dd className="col-sm-8">{data.hoTen}</dd>
          <dt className="col-sm-4">Email</dt><dd className="col-sm-8">{data.email}</dd>
          <dt className="col-sm-4">Điện thoại</dt><dd className="col-sm-8">{data.soDienThoai || "—"}</dd>
          <dt className="col-sm-4">Địa chỉ</dt><dd className="col-sm-8">{data.diaChi || "—"}</dd>
          <dt className="col-sm-4">Ngày tạo</dt><dd className="col-sm-8">{ngay(data.ngayTao)}</dd>
        </dl>
      </div></div>
    </Page>
  );
}
