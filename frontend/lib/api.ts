/** Lỗi trả về từ API NestJS (message có thể là chuỗi hoặc mảng lỗi validation). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public messages: string[],
    public body?: unknown,
  ) {
    super(messages[0] ?? `Lỗi ${status}`);
  }
}

type Body = Record<string, unknown> | FormData | undefined;

export async function api<T = unknown>(path: string, opts: { method?: string; body?: Body } = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    credentials: "include",
    headers: opts.body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? (isForm ? (opts.body as FormData) : JSON.stringify(opts.body)) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const msg = (json as { message?: unknown } | null)?.message;
    const messages = Array.isArray(msg) ? msg.map(String) : msg ? [String(msg)] : [res.statusText || `Lỗi ${res.status}`];
    throw new ApiError(res.status, messages, json);
  }
  return json as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body: Body = {}) => api<T>(path, { method: "POST", body });
export const apiPut = <T>(path: string, body: Body = {}) => api<T>(path, { method: "PUT", body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: "DELETE" });

export function loiTuApi(e: unknown): string {
  if (e instanceof ApiError) {
    return e.messages.join(" ");
  }
  return e instanceof Error ? e.message : "Đã xảy ra lỗi.";
}

/** Chuyển object thành query string, bỏ qua giá trị rỗng; mảng được lặp lại khóa. */
export function qs(params: Record<string, string | number | boolean | string[] | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
