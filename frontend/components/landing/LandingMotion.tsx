"use client";

import { useEffect } from "react";
import { cuonToi } from "@/lib/cuon";

const TRE_MAC_DINH_MS = 85; // mỗi phần tử anh em hiện trễ hơn phần tử trước chừng này
const TRE_TOI_DA = 8;
const TRA_VE_SAU_MS = 1600; // sau khi hiện xong thì gỡ trạng thái để không ảnh hưởng transition hover của phần tử

/**
 * Hai việc cho cả trang chủ, không có giao diện riêng:
 * 1. Hiện dần khi cuộn tới: phần tử `[data-rv]` NẰM DƯỚI màn hình lúc tải mới bị ẩn (sau hydrate, ngoài tầm nhìn nên không
 *    nhấp nháy), rồi hiện khi cuộn tới; phần tử đã trong tầm nhìn hoặc đã cuộn qua thì để nguyên. JS lỗi/chưa chạy thì
 *    mọi thứ vẫn hiện sẵn. Anh em cùng cha hiện lần lượt (trễ 85ms/phần tử), tiêu đề `data-rv="words"` trồi từng từ.
 * 2. Liên kết `#...` trong trang cuộn mượt tới đích (chừa chỗ header), có focus cho bàn phím.
 */
export function LandingMotion() {
  useEffect(() => {
    const goc = document.querySelector<HTMLElement>("[data-landing]");
    if (!goc) return;
    const giam = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hen = new Set<number>();

    const ds = Array.from(goc.querySelectorAll<HTMLElement>("[data-rv]"));
    const nhom = new Map<Element, HTMLElement[]>();
    for (const el of ds) {
      const cha = el.parentElement;
      if (cha) nhom.set(cha, [...(nhom.get(cha) ?? []), el]);
    }
    nhom.forEach((anhEm) => anhEm.forEach((el, i) => el.style.setProperty("--rv-d", `${Math.min(i, TRE_TOI_DA) * TRE_MAC_DINH_MS}ms`)));

    const hien = (el: HTMLElement) => {
      el.dataset.rvState = "in";
      const t = window.setTimeout(() => { el.dataset.rvState = "done"; hen.delete(t); }, TRA_VE_SAU_MS + (parseFloat(el.style.getPropertyValue("--rv-d")) || 0));
      hen.add(t);
    };
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        hien(e.target as HTMLElement);
      }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.04 });

    for (const el of ds) {
      const st = el.dataset.rvState;
      if (st === "done" || st === "in") continue;
      const r = el.getBoundingClientRect();
      const daThay = r.top < window.innerHeight * 0.92; // đang trong tầm nhìn hoặc đã cuộn qua
      if (giam.matches || daThay) { el.dataset.rvState = "done"; continue; }
      el.dataset.rvState = "hidden";
      io.observe(el);
    }

    const khiBam = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href^='#']");
      const id = a?.getAttribute("href")?.slice(1);
      const dich = id ? document.getElementById(id) : null;
      if (!a || !dich) return;
      e.preventDefault();
      cuonToi(dich);
      window.history.replaceState(null, "", `#${id}`);
    };
    goc.addEventListener("click", khiBam);

    return () => {
      io.disconnect();
      hen.forEach((t) => window.clearTimeout(t));
      goc.removeEventListener("click", khiBam);
    };
  }, []);
  return null;
}
