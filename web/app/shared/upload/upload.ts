import { api } from "../api/client";
import { authed } from "../query/query";

export type Purpose = "avatar" | "company_logo" | "chat_image" | "chat_file" | "chat_voice";
export type UploadedFile = { id: string; url?: string | null; name?: string; content_type: string; size: number; meta?: Record<string, unknown> };

export const LIMITS: Record<Purpose, number> = {
  avatar: 5 << 20, company_logo: 5 << 20, chat_image: 10 << 20, chat_voice: 5 << 20, chat_file: 25 << 20,
};

/**
 * Presigned upload straight to object storage: ask the API for a POST policy, send the
 * bytes to storage (they never pass through the API), then let the API verify the content.
 */
export async function uploadFile(
  file: Blob & { name?: string },
  purpose: Purpose,
  opts: { meta?: Record<string, unknown>; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<UploadedFile> {
  const start = await authed<{ file: UploadedFile; upload: { url: string; method: string; fields: Record<string, string> } }>(() =>
    api.POST("/files", { body: { purpose, content_type: file.type || "application/octet-stream", size: file.size, name: file.name, meta: opts.meta } }),
  );
  const form = new FormData();
  for (const [k, v] of Object.entries(start.upload.fields)) form.append(k, v);
  form.append("file", file);
  await new Promise<void>((resolve, reject) => {
    // XHR rather than fetch: it reports upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open(start.upload.method || "POST", start.upload.url);
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`storage ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("storage network"));
    opts.signal?.addEventListener("abort", () => xhr.abort());
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    xhr.send(form);
  });
  return authed<UploadedFile>(() => api.POST("/files/{file}/complete", { params: { path: { file: start.file.id } } }));
}
