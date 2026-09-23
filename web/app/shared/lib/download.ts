import { API_BASE } from "../api/client";
import { getToken, withAuth } from "../auth/session";

/** Downloads an authenticated file (e.g. a resume PDF) and saves it under its server name. */
export async function downloadAuthed(path: string, fallbackName: string) {
  const res = await withAuth(async () => {
    const response = await fetch(API_BASE + path, { headers: { Authorization: `Bearer ${getToken() ?? ""}` }, credentials: "include" });
    return { response };
  });
  if (!res.response.ok) throw new Error(String(res.response.status));
  const blob = await res.response.blob();
  const cd = res.response.headers.get("content-disposition") ?? "";
  const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1] ?? /filename="?([^";]+)/i.exec(cd)?.[1] ?? fallbackName);
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
