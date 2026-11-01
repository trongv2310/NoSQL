"use client";

import { useEffect, useState } from "react";

export function FlashNotice({ kind, msg, onClose }: { kind: "success" | "danger"; msg: string; onClose: () => void }) {
  const [giu, setGiu] = useState(false);
  const [dong, setDong] = useState(false);
  useEffect(() => {
    if (giu || dong) return;
    const hen = setTimeout(() => setDong(true), kind === "danger" ? 8000 : 5000);
    return () => clearTimeout(hen);
  }, [giu, dong, kind]);
  useEffect(() => {
    if (!dong) return;
    const hen = setTimeout(onClose, 180);
    return () => clearTimeout(hen);
  }, [dong, onClose]);

  return (
    <div className={`flash-notice is-${kind}${dong ? " is-closing" : ""}`}
      onMouseEnter={() => setGiu(true)} onMouseLeave={() => setGiu(false)}
      onFocus={() => setGiu(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setGiu(false); }}>
      <span className="flash-notice-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {kind === "success" ? <path d="m5 12 4 4L19 6" /> : <><path d="M12 8v5M12 17h.01" /><circle cx="12" cy="12" r="9" /></>}
        </svg>
      </span>
      <div className="flash-notice-body" role={kind === "danger" ? "alert" : "status"}>
        <strong>{kind === "success" ? "Thành công" : "Chưa thể thực hiện"}</strong>
        <p>{msg}</p>
      </div>
      <button className="flash-notice-close" type="button" aria-label="Đóng thông báo" onClick={() => setDong(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </div>
  );
}
