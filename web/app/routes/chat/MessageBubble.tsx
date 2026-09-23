import { Check, CheckCheck, Download, FileText, MapPin, Pause, Play, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Message } from "./types";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { clock, fileSize } from "~/shared/lib/format";
import { Spinner } from "~/shared/ui/Spinner";

export function MessageBubble({ m, mine, seen, onDelete, onRetry }: {
  m: Message; mine: boolean; seen: boolean; onDelete?: () => void; onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const canDelete = mine && !m.deleted && !m.pending && Date.now() - new Date(m.created_at).getTime() < 48 * 3600_000;
  const media = (m.kind === "image" || m.kind === "location") && !m.deleted;
  return (
    <div className={cn("group flex items-end gap-1.5", mine ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "relative max-w-[min(80%,28rem)] rounded-[1.125rem] text-[0.9375rem] leading-snug",
          media ? "overflow-hidden p-1" : "px-3.5 py-2",
          mine ? "rounded-br-md" : "rounded-bl-md",
          // Photos and maps sit on a neutral card so they aren't tinted by the bubble colour.
          m.kind === "image" && !m.deleted ? "bg-sunken text-ink" : mine ? "bg-lapis text-on-lapis" : "bg-sunken text-ink",
          m.deleted && "bg-transparent italic text-ink-3 ring-1 ring-line",
          m.failed && "opacity-70",
        )}
      >
        {m.deleted ? t("chat.deleted") : <Body m={m} mine={mine} />}
        <span className={cn("num flex items-center justify-end gap-1 text-[0.6875rem]", media ? "absolute bottom-2 right-2.5 rounded-full bg-black/45 px-1.5 py-0.5 text-white" : "mt-0.5", !media && (mine ? "text-on-lapis/70" : "text-ink-3"))}>
          {clock(m.created_at)}
          {mine && !m.deleted && (m.pending ? <Spinner className="size-3" /> : seen ? <CheckCheck className="size-3.5" aria-label={t("chat.seen")} /> : <Check className="size-3.5" aria-label={t("chat.sent")} />)}
        </span>
      </div>
      {m.failed && onRetry && (
        <button type="button" onClick={onRetry} className="mb-1 flex items-center gap-1 text-xs font-medium text-anor-ink hover:underline">
          <RotateCw className="size-3.5" />{t("chat.retry")}
        </button>
      )}
      {canDelete && onDelete && (
        <button type="button" onClick={onDelete} aria-label={t("common.delete")} title={t("common.delete")}
          className="mb-1 grid size-7 place-items-center rounded-full text-ink-3 opacity-0 transition-opacity hover:bg-sunken hover:text-anor-ink focus-visible:opacity-100 group-hover:opacity-100">
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function Body({ m, mine }: { m: Message; mine: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  switch (m.kind) {
    case "image": {
      const w = m.file?.meta?.width, h = m.file?.meta?.height;
      return (
        <>
          <a href={m.file?.url} target="_blank" rel="noopener noreferrer" className="block">
            {m.file?.url ? (
              <img src={m.file.url} alt={m.body || t("chat.photo")} loading="lazy" decoding="async" width={w} height={h}
                className="max-h-80 w-auto max-w-full rounded-[0.875rem] bg-black/5 object-cover" style={w && h ? { aspectRatio: `${w} / ${h}` } : undefined} />
            ) : <div className="grid h-40 w-56 place-items-center rounded-[0.875rem] bg-black/10"><Spinner /></div>}
          </a>
          {m.body && <p className="whitespace-pre-wrap break-words px-2.5 pb-5 pt-1.5">{m.body}</p>}
        </>
      );
    }
    case "file":
      return (
        <a href={m.file?.url} target="_blank" rel="noopener noreferrer" download={m.file?.name} className="flex items-center gap-3 py-1">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", mine ? "bg-white/15" : "bg-surface")}><FileText className="size-5" /></span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{m.file?.name ?? t("chat.file")}</span>
            <span className={cn("num block text-xs", mine ? "text-on-lapis/70" : "text-ink-3")}>{m.file ? fileSize(m.file.size, locale) : ""}</span>
          </span>
          <Download className="ml-1 size-4 shrink-0 opacity-70" />
        </a>
      );
    case "voice":
      return <VoicePlayer src={m.file?.url} durationMs={m.file?.meta?.duration_ms} mine={mine} />;
    case "location": {
      const l = m.location!;
      const href = `https://yandex.uz/maps/?pt=${l.lng},${l.lat}&z=16&l=map`;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block w-60">
          <div className={cn("relative grid h-32 place-items-center overflow-hidden rounded-[0.875rem]", mine ? "bg-white/10" : "bg-surface")}>
            {/* A tiny drawn "map" instead of loading map tiles for every message. */}
            <svg className="absolute inset-0 size-full opacity-40" aria-hidden="true">
              <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="currentColor" strokeWidth="0.6" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              <path d="M0 90 C 60 70, 120 110, 240 60" stroke="currentColor" strokeWidth="5" fill="none" opacity="0.5" />
            </svg>
            <MapPin className="relative size-8 fill-anor text-white drop-shadow" />
          </div>
          <p className="px-2.5 pb-5 pt-2 text-sm">
            <span className="block font-medium">{l.name || t("chat.location")}</span>
            <span className="num block text-xs opacity-70">{l.lat.toFixed(5)}, {l.lng.toFixed(5)}</span>
          </p>
        </a>
      );
    }
    default:
      return <p className="whitespace-pre-wrap break-words">{m.body}</p>;
  }
}

function VoicePlayer({ src, durationMs, mine }: { src?: string; durationMs?: number; mine: boolean }) {
  const { t } = useTranslation();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = (durationMs ?? 0) / 1000;
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const tick = () => setPos(a.currentTime);
    const end = () => { setPlaying(false); setPos(0); };
    a.addEventListener("timeupdate", tick);
    a.addEventListener("ended", end);
    return () => { a.removeEventListener("timeupdate", tick); a.removeEventListener("ended", end); };
  }, []);
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); } else { void a.play(); setPlaying(true); }
  };
  const dur = total || audio.current?.duration || 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <div className="flex w-56 items-center gap-2.5 py-1">
      <audio ref={audio} src={src} preload="metadata" />
      <button type="button" onClick={toggle} disabled={!src} aria-label={playing ? t("chat.pause") : t("chat.play")}
        className={cn("grid size-9 shrink-0 place-items-center rounded-full", mine ? "bg-white/20 text-on-lapis" : "bg-lapis text-on-lapis")}>
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
      </button>
      <div className="flex-1">
        <div className={cn("h-1 overflow-hidden rounded-full", mine ? "bg-white/25" : "bg-line-strong")}>
          <div className={cn("h-full rounded-full", mine ? "bg-on-lapis" : "bg-lapis")} style={{ width: dur ? `${Math.min(100, (pos / dur) * 100)}%` : "0%" }} />
        </div>
        <span className={cn("num mt-1 block text-[0.6875rem]", mine ? "text-on-lapis/70" : "text-ink-3")}>{fmt(playing || pos ? pos : dur)}</span>
      </div>
    </div>
  );
}
