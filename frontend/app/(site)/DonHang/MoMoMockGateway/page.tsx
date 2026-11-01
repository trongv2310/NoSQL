"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ErrorBox, Loading, Page } from "@/components/Ui";
import { apiPost, loiTuApi } from "@/lib/api";
import { vnd } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Cổng MoMo giả lập (MOMO_MOCK=true): xác nhận hoặc hủy thanh toán rồi quay về trang kết quả kèm chữ ký hợp lệ. */
export default function MomoMockPage() {
  const orderId = useSearchParams().get("orderId");
  const { data, error, loading } = useApi<{ soDonHang: number; tongTien: number; hoTen: string | null }>(orderId ? `/don-hang/momo/mock/${orderId}` : null);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const xuLy = async (action: "success" | "cancel") => {
    setDang(true);
    try {
      const kq = await apiPost<Record<string, string>>("/don-hang/momo/mock/xu-ly", { orderId, action });
      window.location.href = `/DonHang/ThanhToanMomoSuccess?${new URLSearchParams(kq).toString()}`;
    } catch (e) {
      setLoi(loiTuApi(e));
      setDang(false);
    }
  };

  if (loading) return <Page><Loading /></Page>;
  if (error || !data) return <Page><ErrorBox message={error ?? "Đơn hàng không tồn tại hoặc đã được xử lý."} /></Page>;
  return (
    <Page>
      <div className="card mx-auto" style={{ maxWidth: 460 }}>
        <div className="card-header text-white" style={{ background: "#a50064" }}><strong>MoMo Sandbox (giả lập)</strong></div>
        <div className="card-body">
          {loi && <ErrorBox message={loi} />}
          <p className="mb-1">Đơn hàng: <strong>#{data.soDonHang}</strong></p>
          {data.hoTen && <p className="mb-1">Khách hàng: {data.hoTen}</p>}
          <p className="fs-4 text-danger fw-bold">{vnd(data.tongTien)}</p>
          <div className="d-grid gap-2">
            <button className="btn btn-success" disabled={dang} onClick={() => xuLy("success")}>Xác nhận thanh toán</button>
            <button className="btn btn-outline-danger" disabled={dang} onClick={() => xuLy("cancel")}>Hủy giao dịch</button>
          </div>
        </div>
      </div>
    </Page>
  );
}
