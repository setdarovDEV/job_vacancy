import { MapPin, Mic, Paperclip, SendHorizontal, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { toast } from "~/shared/ui/toast-store";
import { LIMITS } from "~/shared/upload/upload";

export type Outgoing =
  | { kind: "text"; body: string }
  | { kind: "image" | "file"; file: File; body?: string }
  | { kind: "voice"; blob: Blob; durationMs: number }
  | { kind: "location"; lat: number; lng: number };

const IMAGE = /^image\/(jpeg|png|webp|gif)$/;

export function Composer({ onSend, onTyping }: { onSend: (o: Outgoing) => void; onTyping: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);
  const rec = useRecorder();

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    onSend({ kind: "text", body });
    setText("");
    area.current?.focus();
  };

  const pickFile = (f: File) => {
    const image = IMAGE.test(f.type);
    if (f.size > (image ? LIMITS.chat_image : LIMITS.chat_file)) return toast({ tone: "error", title: t("validation.too_large") });
    onSend({ kind: image ? "image" : "file", file: f, body: image ? text.trim() || undefined : undefined });
    if (image) setText("");
  };

  const shareLocation = () => {
    if (!navigator.geolocation) return toast({ tone: "error", title: t("chat.noGeo") });
    navigator.geolocation.getCurrentPosition(
      (p) => onSend({ kind: "location", lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast({ tone: "error", title: t("chat.geoDenied") }),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  if (rec.state !== "idle") {
    return (
      <div className="flex items-center gap-3 border-t border-line px-3 py-3">
        <button type="button" onClick={rec.cancel} aria-label={t("common.cancel")} className="grid size-10 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink">
          <X className="size-5" />
        </button>
        <span className="flex flex-1 items-center gap-2.5 text-sm text-ink" aria-live="polite">
          <span className="size-2.5 animate-pulse rounded-full bg-anor" aria-hidden="true" />
          {t("chat.recording")}
          <span className="num text-ink-3">{Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, "0")}</span>
        </span>
        <button type="button" aria-label={t("chat.sendVoice")}
          onClick={async () => { const r = await rec.stop(); if (r && r.durationMs > 700) onSend({ kind: "voice", ...r }); }}
          className="grid size-10 place-items-center rounded-full bg-lapis text-on-lapis hover:bg-lapis-hover">
          <Square className="size-4 fill-current" />
        </button>
      </div>
    );
  }

  return (
    <form className="flex items-end gap-1 border-t border-line px-2 py-2.5 md:px-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pickFile(f); }} />
      <Tool label={t("chat.attach")} onClick={() => fileRef.current?.click()}><Paperclip className="size-5" /></Tool>
      <Tool label={t("chat.shareLocation")} onClick={shareLocation} className="max-sm:hidden"><MapPin className="size-5" /></Tool>
      <label className="flex min-h-11 flex-1 items-center rounded-[1.375rem] border border-line-strong bg-surface px-4 focus-within:border-lapis">
        <span className="sr-only">{t("chat.placeholder")}</span>
        <textarea
          ref={area}
          rows={1}
          value={text}
          maxLength={4000}
          placeholder={t("chat.placeholder")}
          onChange={(e) => {
            setText(e.target.value);
            if (Date.now() - lastTyping.current > 3000) { lastTyping.current = Date.now(); onTyping(); }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); submit(); }
          }}
          className="max-h-40 w-full resize-none bg-transparent py-2.5 text-[0.9375rem] leading-snug text-ink outline-none placeholder:text-ink-3 [field-sizing:content]"
        />
      </label>
      {text.trim() ? (
        <button type="submit" aria-label={t("chat.send")} className="grid size-11 shrink-0 place-items-center rounded-full bg-lapis text-on-lapis transition-transform hover:bg-lapis-hover active:scale-95">
          <SendHorizontal className="size-5" />
        </button>
      ) : (
        <Tool label={t("chat.recordVoice")} onClick={() => void rec.start()}><Mic className="size-5" /></Tool>
      )}
    </form>
  );
}

function Tool({ label, onClick, children, className }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={cn("grid size-11 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-sunken hover:text-ink", className)}>
      {children}
    </button>
  );
}

/** Voice notes with MediaRecorder (Opus in WebM; AAC in MP4 on Safari). Max 5 minutes. */
function useRecorder() {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "recording">("idle");
  const [seconds, setSeconds] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => { clearInterval(tick.current); mr.current?.stream.getTracks().forEach((tr) => tr.stop()); }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return toast({ tone: "error", title: t("chat.noMic") });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return toast({ tone: "error", title: t("chat.micDenied") });
    }
    const type = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.start(250);
    mr.current = r;
    started.current = Date.now();
    setSeconds(0);
    setState("recording");
    tick.current = setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= 300) void stop();
    }, 250);
  };

  const finish = () => {
    clearInterval(tick.current);
    mr.current?.stream.getTracks().forEach((tr) => tr.stop());
    setState("idle");
  };

  const stop = () =>
    new Promise<{ blob: Blob; durationMs: number } | null>((resolve) => {
      const r = mr.current;
      if (!r) return resolve(null);
      r.onstop = () => {
        const base = (r.mimeType || "audio/webm").split(";")[0];
        resolve({ blob: new Blob(chunks.current, { type: base }), durationMs: Date.now() - started.current });
      };
      r.stop();
      finish();
    });

  const cancel = () => {
    if (mr.current) mr.current.onstop = null;
    mr.current?.stop();
    finish();
  };

  return { state, seconds, start, stop, cancel };
}
