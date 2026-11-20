"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Children, cloneElement, isValidElement, useId, useState } from "react";
import { ErrorBox, Pagination } from "../Ui";
import type { Trang } from "@/lib/types";

export function PageBar({ title, action }: { title?: string; action?: { href: string; text: string } }) {
  return (
    <div className="admin-section-bar">
      {title && <h2>{title}</h2>}
      {action && <Link href={action.href} className="btn btn-primary"><i className="fa-solid fa-plus" aria-hidden="true" /> {action.text}</Link>}
    </div>
  );
}

/** Thanh tìm kiếm và bộ lọc theo URL, giữ bộ lọc khi phân trang. */
export function FilterBar({ children, fields = ["keyword"], placeholder = "Tìm kiếm…", keep = [] }: {
  children?: (set: (k: string, v: string) => void, get: (k: string) => string) => React.ReactNode;
  fields?: string[];
  placeholder?: string;
  keep?: string[];
}) {
  const sp = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const keywordUrl = sp.get("keyword") ?? "";
  const [keyword, setKeyword] = useState(keywordUrl);
  const [keywordUrlCu, setKeywordUrlCu] = useState(keywordUrl);
  if (keywordUrlCu !== keywordUrl) { setKeywordUrlCu(keywordUrl); setKeyword(keywordUrl); } // URL đổi (Back/Forward, bộ lọc khác): ô tìm kiếm theo URL
  const di = (mut: (q: URLSearchParams) => void) => {
    const q = new URLSearchParams(sp.toString());
    mut(q);
    q.delete("page");
    const query = q.toString();
    router.push(query ? path + "?" + query : path, { scroll: false });
  };
  const coLoc = [...sp.keys()].some((k) => k !== "page" && !keep.includes(k));
  return (
    <form className="admin-filterbar" role="search" aria-label="Tìm và lọc danh sách"
      onSubmit={(e) => { e.preventDefault(); di((q) => (keyword.trim() ? q.set("keyword", keyword.trim()) : q.delete("keyword"))); }}>
      {fields.includes("keyword") && <input className="form-control admin-filter-input" type="search" aria-label={placeholder}
        placeholder={placeholder} value={keyword} onChange={(e) => setKeyword(e.target.value)} />}
      {children?.((k, v) => di((q) => (v ? q.set(k, v) : q.delete(k))), (k) => sp.get(k) ?? "")}
      {fields.includes("keyword") && <button className="btn btn-outline-primary" type="submit"><i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Tìm</button>}
      {coLoc && <button className="btn btn-outline-secondary" type="button" onClick={() => {
        setKeyword("");
        di((q) => [...q.keys()].forEach((key) => { if (!keep.includes(key)) q.delete(key); }));
      }}>Xóa bộ lọc</button>}
    </form>
  );
}

export function FilterLinks({ label, field, options }: { label: string; field: string; options: { value: string; label: string }[] }) {
  const path = usePathname();
  const search = useSearchParams();
  const active = search.get(field) ?? "";
  return <nav className="admin-segments mb-3" aria-label={label}>
    {options.map(({ value, label }) => {
      const params = new URLSearchParams(search.toString());
      params.delete("page");
      if (value) params.set(field, value);
      else params.delete(field);
      const query = params.toString();
      return <Link key={value} href={query ? path + "?" + query : path} scroll={false} aria-current={active === value ? "true" : undefined}>{label}</Link>;
    })}
  </nav>;
}

export function ListState<T>({ loading, error, data, empty, children, retry }: {
  loading: boolean; error: string | null; data: Trang<T> | T[] | null; empty?: string; children: React.ReactNode; retry?: () => void;
}) {
  if (loading && !data) return <div className="card-custom admin-list-empty" role="status">Đang tải danh sách…</div>;
  if (error && !loading) return <div className="card-custom p-3"><ErrorBox message={error} />
    {retry && <button type="button" className="btn btn-outline-primary" onClick={retry}>Thử lại</button>}
  </div>;
  const len = Array.isArray(data) ? data.length : (data?.items.length ?? 0);
  const total = Array.isArray(data) ? data.length : data?.total ?? 0;
  if (data && len === 0 && !loading) return <div className="card-custom admin-list-empty" role="status">
    <i className="fa-solid fa-inbox" aria-hidden="true" /><strong>Không có kết quả</strong>
    <p>{empty ?? "Thử đổi từ khóa hoặc bộ lọc."}</p>
  </div>;
  return <div aria-busy={loading}>
    <div className="admin-list-info" role="status">{loading ? "Đang cập nhật danh sách…" : total.toLocaleString("vi-VN") + " kết quả"}</div>
    {children}
  </div>;
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
