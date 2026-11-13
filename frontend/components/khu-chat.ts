"use client";

import { useSyncExternalStore } from "react";

/**
 * Khung "Hỏi người bán" nhúng trong trang. Chỉ có MỘT chatbot (components/Chatbot.tsx) trong toàn site: khi một trang đặt khung nhúng,
 * chatbot vẽ chính khung chat của nó vào đó (portal) và ẩn nút nổi; trang không có khung nhúng thì giữ nút nổi như cũ.
 */
let host: HTMLElement | null = null;
const nguoiNghe = new Set<() => void>();

export function datKhuChat(el: HTMLElement | null) {
  if (host === el) return;
  host = el;
  nguoiNghe.forEach((f) => f());
}

export const useKhuChat = (): HTMLElement | null =>
  useSyncExternalStore((f) => { nguoiNghe.add(f); return () => { nguoiNghe.delete(f); }; }, () => host, () => null);

/** Gửi một câu hỏi cho chatbot (cùng logic/lịch sử/API với khung chat nổi). */
export function hoiNguoiBan(text: string) {
  window.dispatchEvent(new CustomEvent("sf:chat-ask", { detail: { text } }));
}
