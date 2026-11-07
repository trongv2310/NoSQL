"use client";

import { useRef, type HTMLAttributes, type Ref } from "react";
import { useScrollVar, type ScrollMode } from "./useScrollVar";

/**
 * Phần tử bọc ghi tiến độ cuộn vào biến CSS `--p` (xem `useScrollVar`) để phần con tự chuyển động bằng CSS.
 * Dùng cho server component: các phần con vẫn là server component, chỉ vỏ bọc này là client.
 */
export function HeroScroll({ as: Tag = "div", mode = "hero", drift = false, children, ...rest }: {
  as?: "div" | "section";
  mode?: ScrollMode;
  drift?: boolean;
  children: React.ReactNode;
} & HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  useScrollVar(ref, mode, drift);
  return <Tag ref={ref as Ref<HTMLDivElement>} {...rest}>{children}</Tag>;
}
