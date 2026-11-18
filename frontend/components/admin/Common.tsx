"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Children, cloneElement, isValidElement, useId, useState } from "react";
import { ErrorBox, Pagination } from "../Ui";
import type { Trang } from "@/lib/types";

export function PageBar({ title, action }: { title?: string; action?: { href: string; text: string } }) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
      <h4 className="mb-0">{title}</h4>
      {action && <Link href={action.href} className="btn btn-primary"><i className="fa-solid fa-plus" /> {action.text}</Link>}
    </div>
  );
}

/** Thanh tìm kiếm + bộ lọc đặt trên query string (?keyword=&...), giữ nguyên khi phân trang. */
export function FilterBar({ children, fields = ["keyword"] }: { children?: (set: (k: string, v: string) => void, get: (k: string) => string) => React.ReactNode; fields?: string[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const keywordUrl = sp.get("keyword") ?? "";
  const [keyword, setKeyword] = useState(keywordUrl);
  const [keywordUrlCu, setKeywordUrlCu] = useState(keywordUrl);
  if (keywordUrlCu !== keywordUrl) { setKeywordUrlCu(keywordUrl); setKeyword(keywordUrl); } // URL đổi (Back/Forward, bộ lọc khác): ô tìm kiếm theo URL
  const di = (mut: (q: URLSearchParams) => void) => {
    const q = new URLSearchParams(sp.toString());
    mut(q);
    q.delete("page");
    router.push(`?${q.toString()}`);
  };
  return (
    <form className="d-flex flex-wrap gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); di((q) => (keyword.trim() ? q.set("keyword", keyword.trim()) : q.delete("keyword"))); }}>
      {fields.includes("keyword") && <input className="form-control w-auto" style={{ minWidth: 220 }} placeholder="Tìm kiếm..." value={keyword} onChange={(e) => setKeyword(e.target.value)} />}
      {children?.((k, v) => di((q) => (v ? q.set(k, v) : q.delete(k))), (k) => sp.get(k) ?? "")}
      <button className="btn btn-outline-primary" type="submit"><i className="fa-solid fa-magnifying-glass" /> Tìm</button>
    </form>
  );
}

export function ListState<T>({ loading, error, data, empty, children }: { loading: boolean; error: string | null; data: (Trang<T> | T[] | null); empty?: string; children: React.ReactNode }) {
  if (loading && !data) return <div className="text-center text-muted py-4"><i className="fa-solid fa-spinner fa-spin" /> Đang tải...</div>;
  if (error) return <ErrorBox message={error} />;
  const len = Array.isArray(data) ? data.length : (data?.items.length ?? 0);
  if (data && len === 0) return <div className="text-center text-muted py-4">{empty ?? "Không có dữ liệu."}</div>;
  return <>{children}</>;
}

export { Pagination };

/**
 * Một dòng form: nhãn gắn đúng với ô nhập (htmlFor/id) để trình đọc màn hình và bấm vào nhãn hoạt động. Con là MỘT phần tử (input/select/textarea) thì được gắn id
 * và aria-describedby tự động; nhiều phần tử (ví dụ ảnh xem trước + input) thì nhóm lại và nhãn đặt tên cho nhóm.
 */
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  const id = useId();
  const mo = hint ? `${id}-hint` : undefined;
  const mot = Children.toArray(children);
  // Ô cần gắn nhãn = phần tử HTML input/select/textarea ĐẦU TIÊN ở cấp trên cùng (kể cả khi có nút/ảnh xem trước đi kèm). Component bọc ngoài không được suy luận là nhận id.
  const dich = mot.find((c): c is React.ReactElement<{ id?: string; type?: string; "aria-describedby"?: string }> =>
    isValidElement(c) && typeof c.type === "string" && ["input", "select", "textarea"].includes(c.type) && (c.props as { type?: string }).type !== "hidden");
  const idDich = dich ? (dich.props.id ?? id) : undefined;
  return (
    <div className="mb-3" {...(dich ? {} : { role: "group", "aria-labelledby": `${id}-nhan` })}>
      <label className="form-label fw-semibold" id={`${id}-nhan`} {...(idDich ? { htmlFor: idDich } : {})}>{label}</label>
      {dich ? mot.map((c) => (c === dich ? cloneElement(dich, { id: idDich, "aria-describedby": dich.props["aria-describedby"] ?? mo }) : c)) : children}
      {hint && <div className="form-text" id={mo}>{hint}</div>}
    </div>
  );
}

export function SubmitBar({ dang, text = "Lưu", cancel }: { dang: boolean; text?: string; cancel: string }) {
  return (
    <div className="d-flex gap-2 mt-3">
      <button className="btn btn-primary" disabled={dang}>{dang ? "Đang lưu..." : text}</button>
      <Link href={cancel} className="btn btn-outline-secondary">Hủy</Link>
    </div>
  );
}
