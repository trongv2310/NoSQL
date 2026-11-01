"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useApp } from "@/components/AppProviders";
import { ErrorBox, Loading, Page } from "@/components/Ui";
import { useApi } from "@/lib/hooks";

interface KetQua { isSuccess: boolean; soDonHang: number | null; message: string; description: string }

/** Trang MoMo chuyển hướng về: gửi toàn bộ query cho backend để xác thực chữ ký và cập nhật đơn. */
export default function MomoKetQuaPage() {
  const sp = useSearchParams();
  const { refreshUser } = useApp();
  const { data, error, loading } = useApi<KetQua>(`/don-hang/momo/ket-qua?${sp.toString()}`);
  const daLamMoi = useRef(false);

  useEffect(() => {
    if (data?.isSuccess && !daLamMoi.current) {
      daLamMoi.current = true;
      void refreshUser();
    }
  }, [data, refreshUser]);

  if (loading) return <Page><Loading text="Đang xác thực giao dịch..." /></Page>;
  if (error || !data) return <Page><ErrorBox message={error ?? "Không xác thực được giao dịch"} /></Page>;
  return (
    <Page className="text-center">
      <div className="card mx-auto" style={{ maxWidth: 520 }}><div className="card-body py-5">
        <i className={`fa-solid ${data.isSuccess ? "fa-circle-check text-success" : "fa-circle-xmark text-danger"} fa-4x mb-3`} />
        <h3>{data.message}</h3>
        {data.soDonHang && <p className="mb-1">Mã đơn hàng: <strong>#{data.soDonHang}</strong></p>}
        {data.description && <p className="text-muted">{data.description}</p>}
        <div className="d-flex gap-2 justify-content-center mt-3">
          <Link href="/DonHang/Index" className="btn btn-primary">Xem đơn hàng</Link>
          <Link href="/" className="btn btn-outline-secondary">Về trang chủ</Link>
        </div>
      </div></div>
    </Page>
  );
}
