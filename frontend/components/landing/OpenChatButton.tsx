"use client";

/** Mở khung chat tư vấn có sẵn của site (Chatbot lắng nghe sự kiện này). */
export function OpenChatButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("sf:open-chat"))}>{children}</button>;
}
