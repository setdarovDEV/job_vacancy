import { MapPin, Mic, Paperclip, SendHorizontal, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useTranslation, type TFunction } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { IconButton } from "~/shared/ui/Button";
import { toast } from "~/shared/ui/toast-store";
import { LIMITS } from "~/shared/upload/upload";

export type Outgoing =
  | { kind: "text"; body: string }
  | { kind: "image" | "file"; file: File; body?: string }
  | { kind: "voice"; blob: Blob; durationMs: number }
  | { kind: "location"; lat: number; lng: number };

const IMAGE = /^image\/(jpeg|png|webp|gif)$/;

/** A picked, pasted or dropped file as an outgoing message (null + toast when it's too large). */
export function fileMessage(f: File, t: TFunction, caption?: string): Outgoing | null {
  const image = IMAGE.test(f.type);
  if (f.size > (image ? LIMITS.chat_image : LIMITS.chat_file)) {
    toast({ tone: "error", title: t("validation.too_large") });
    return null;
  }
  return { kind: image ? "image" : "file", file: f, body: image ? caption : undefined };
}

// Browsers without `field-sizing: content` (Safari < 26, Firefox) grow the textarea by hand.
const fieldSizing = typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content");

/**
 * The composer dock: a glass capsule floating over the thread (the messages scroll under it).
 * Concentric geometry: rounded-sheet (28px) with p-1.5 holds 44px round buttons (22px radius).
 */
export function Composer({ onSend, onTyping }: { onSend: (o: Outgoing) => void; onTyping: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);
  const rec = useRecorder();
  const has = text.trim().length > 0;

  useLayoutEffect(() => {
    const el = area.current;
    if (!el || fieldSizing) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    onSend({ kind: "text", body });
    setText("");
    area.current?.focus();
  };

  const pickFile = (f: File) => {
    // A photo takes the typed text as its caption.
    const o = fileMessage(f, t, text.trim() || undefined);
    if (!o) return;
    onSend(o);
    if (o.kind === "image") setText("");
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
      <div role="group" aria-label={t("chat.recording")} className="glass-chrome flex items-center gap-2 rounded-sheet p-1.5">
        <IconButton type="button" label={t("common.cancel")} shape="pill" onClick={rec.cancel}>
          <X className="size-5" />
        </IconButton>
        <p className="flex min-w-0 flex-1 items-center gap-2.5 text-md text-ink">
          <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-anor" aria-hidden="true" />
          <span className="truncate" aria-live="polite">{t("chat.recording")}</span>
          <span role="timer" className="num text-ink-2">{Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, "0")}</span>
        </p>
        <button
          type="button"
          aria-label={t("chat.sendVoice")}
          title={t("chat.sendVoice")}
          onClick={async () => { const r = await rec.stop(); if (r && r.durationMs > 700) onSend({ kind: "voice", ...r }); }}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-lapis text-on-lapis shadow-2 transition-[background-color,scale] duration-150 ease-spring hover:bg-lapis-hover active:scale-95"
        >
          <SendHorizontal className="size-5" />
        </button>
      </div>
    );
  }

  return (
    <form
      className="glass-chrome flex items-end gap-1 rounded-sheet p-1.5 has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-focus"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pickFile(f); }} />
      <IconButton type="button" label={t("chat.attach")} shape="pill" onClick={() => fileRef.current?.click()}>
        <Paperclip className="size-5" />
      </IconButton>
      <label className="min-w-0 flex-1">
        <span className="sr-only">{t("chat.placeholder")}</span>
        <textarea
          ref={area}
          rows={1}
          value={text}
          maxLength={4000}
          enterKeyHint="send"
          placeholder={t("chat.placeholder")}
          onChange={(e) => {
            setText(e.target.value);
            if (Date.now() - lastTyping.current > 3000) { lastTyping.current = Date.now(); onTyping(); }
          }}
          onKeyDown={(e) => {
            // Enter sends with a keyboard; on touch keyboards Enter is a new line and the button sends.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); submit(); }
          }}
          onPaste={(e) => {
            const f = e.clipboardData.files?.[0];
            if (f) { e.preventDefault(); pickFile(f); }
          }}
          className="block max-h-40 min-h-11 w-full resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-md leading-snug text-ink field-sizing-content placeholder:text-ink-2 focus-visible:outline-none"
        />
      </label>
      {/* Location steps aside while typing, so the field grows to the right and the text never moves. */}
      {!has && (
        <IconButton type="button" label={t("chat.shareLocation")} shape="pill" onClick={shareLocation}>
          <MapPin className="size-5" />
        </IconButton>
      )}
      <div className="relative size-11 shrink-0">
        <IconButton
          type="button"
          label={t("chat.recordVoice")}
          shape="pill"
          inert={has}
          onClick={() => void rec.start()}
          className={cn("absolute inset-0 transition-[opacity,scale] duration-200 ease-spring", has && "scale-50 opacity-0")}
        >
          <Mic className="size-5" />
        </IconButton>
        <button
          type="submit"
          aria-label={t("chat.send")}
          title={t("chat.send")}
          inert={!has}
          // Keep the focus (and the phone keyboard) in the field when the send button is tapped.
          onPointerDown={(e) => e.preventDefault()}
          className={cn(
            "absolute inset-0 grid place-items-center rounded-full bg-lapis text-on-lapis shadow-2 transition-[opacity,scale] duration-200 ease-spring hover:bg-lapis-hover active:scale-90",
            !has && "scale-50 opacity-0",
          )}
        >
          <SendHorizontal className="size-5" />
        </button>
      </div>
    </form>
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
