"use client";

import { useApp } from "@/components/AppProviders";
import { Loading, Page } from "@/components/Ui";
import { TuVot } from "./TuVot";
import { TuVotTaiKhoan } from "./TuVotTaiKhoan";

/** Khách đã đăng nhập: tủ vợt lưu trong tài khoản (MongoDB). Khách vãng lai: tủ vợt lưu trên trình duyệt như trước. */
export function TuVotTheoTaiKhoan() {
  const { user, ready } = useApp();
  if (!ready) return <Page><Loading /></Page>;
  return user?.maQuyen === 3 ? <TuVotTaiKhoan /> : <TuVot />;
}
