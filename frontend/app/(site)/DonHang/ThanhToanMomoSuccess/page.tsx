"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useApp } from "@/components/AppProviders";
import { CheckoutSteps } from "@/components/Steps";
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
    <Page className="ct-wrap">
      <CheckoutSteps buoc={data.isSuccess ? 3 : 2} />
      <div className="rs-card">
        <span className={`rs-icon ${data.isSuccess ? "is-ok" : "is-fail"}`}><i className={`fa-solid ${data.isSuccess ? "fa-check" : "fa-xmark"}`} aria-hidden="true" /></span>
        <h1>{data.message}</h1>
        {data.soDonHang && <p className="rs-code">Mã đơn hàng <strong>#{data.soDonHang}</strong></p>}
        {data.description && <p className="rs-desc">{data.description}</p>}
        <div className="rs-actions">
          <Link href="/DonHang/Index" className="od-btn is-solid">Xem đơn hàng <i className="fa-solid fa-arrow-right" aria-hidden="true" /></Link>
          <Link href="/" className="od-btn is-danger" style={{ borderColor: "var(--line-strong)", color: "var(--ink)" }}>Về trang chủ</Link>
        </div>
      </div>
    </Page>
  );
}
