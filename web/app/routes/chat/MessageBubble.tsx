import {
  Ban, Check, CheckCheck, CircleAlert, Clock3, Copy, Download, Ellipsis, FileArchive, FileImage, FileSpreadsheet, FileText,
  MapPin, Pause, Play, RotateCw, Trash2, type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import type { Message } from "./types";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { clock, fileSize } from "~/shared/lib/format";
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "~/shared/ui/Menu";
import { Spinner } from "~/shared/ui/Spinner";
import { toast } from "~/shared/ui/toast-store";

const DELETE_WINDOW = 48 * 3600_000;

/**
 * One message on solid tokens: own = lapis, the other side = surface with a hairline. Corners on
 * the sender's side tighten inside a group (first/last), so a burst of messages reads as one.
 * Actions (copy, delete, retry) open from a context menu (right click, or long press on touch)
 * or from the focusable "…" button beside the bubble — never from hover alone.
 */
export function MessageBubble({ m, mine, seen, first = true, onDelete, onRetry }: {
  m: Message; mine: boolean; seen: boolean; first?: boolean; onDelete?: () => void; onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const canDelete = !!onDelete && mine && !m.deleted && !m.pending && !m.failed && m.id > 0 && Date.now() - new Date(m.created_at).getTime() < DELETE_WINDOW;
  const canCopy = !m.deleted && !!m.body && (m.kind === "text" || m.kind === "image");
  const canRetry = !!m.failed && !!onRetry;
  const hasActions = canDelete || canCopy || canRetry;
  const press = useLongPress(() => setOpen(true), hasActions);

  const photo = m.kind === "image" && !m.deleted;
  const bare = photo && !m.body; // a photo without a caption: the picture is the bubble
  const tone = m.deleted
    ? "border border-dashed border-line-strong text-ink-3"
    : bare ? "bg-sunken" : mine ? "bg-lapis text-on-lapis shadow-1" : "border border-line bg-surface text-ink shadow-1";
  const shape = mine
    ? cn("rounded-panel rounded-br-control", !first && "rounded-tr-control")
    : cn("rounded-panel rounded-bl-control", !first && "rounded-tl-control");

  const copy = () => {
    if (!navigator.clipboard) return toast({ tone: "error", title: t("chatPage.copyFailed") });
    navigator.clipboard.writeText(m.body).then(
      () => toast({ tone: "success", title: t("chatPage.copied") }),
      () => toast({ tone: "error", title: t("chatPage.copyFailed") }),
    );
  };

  return (
    <div className={cn("group/msg flex items-end gap-1", mine ? "flex-row-reverse" : "flex-row")}>
      <div
        {...press}
        onContextMenu={(e) => {
          if (!hasActions) return;
          // A text selection keeps the browser's own menu (copy part of a message).
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed && e.currentTarget.contains(sel.anchorNode)) return;
          e.preventDefault();
          setOpen(true);
        }}
        className={cn(
          "relative min-w-0 max-w-4/5 break-words text-md leading-snug md:max-w-lg",
          "pointer-coarse:select-none [-webkit-touch-callout:none]",
          photo || m.kind === "location" ? "overflow-hidden" : "px-3.5 py-2",
          m.kind === "location" && !m.deleted && "p-1.5",
          m.kind === "file" && !m.deleted && "px-2.5 py-2.5",
          tone,
          shape,
          // The bubble whose menu is open lifts, so it's clear what the actions apply to.
          open && "shadow-3",
          m.failed && "opacity-75",
        )}
      >
        {m.deleted ? (
          <p className="flex items-center gap-1.5 italic">
            <Ban className="size-4 shrink-0" aria-hidden="true" />
            <span>{t("chat.deleted")}<Spacer mine={false} /></span>
            <Meta m={m} mine={false} seen={seen} />
          </p>
        ) : <Body m={m} mine={mine} seen={seen} />}
      </div>

      {canRetry && (
        <button type="button" onClick={onRetry} className="mb-0.5 flex min-h-11 items-center gap-1 rounded-control px-2 text-xs font-medium text-anor-ink hover:bg-anor-soft">
          <RotateCw className="size-3.5" aria-hidden="true" />{t("chat.retry")}
        </button>
      )}

      {hasActions && (
        <MenuRoot open={open} onOpenChange={setOpen}>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label={t("chatPage.actions")}
              className={cn(
                "mb-0.5 grid size-8 shrink-0 place-items-center rounded-full text-ink-3 transition-[opacity,scale] duration-150",
                "hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken data-[state=open]:opacity-100",
                "opacity-0 focus-visible:opacity-100 group-hover/msg:opacity-100",
                // Touch uses long press; the button stays for screen readers and anchors the menu.
                "pointer-coarse:pointer-events-none",
              )}
            >
              <Ellipsis className="size-4" />
            </button>
          </MenuTrigger>
          <MenuContent align={mine ? "end" : "start"}>
            {canRetry && <MenuItem icon={<RotateCw className="size-4" />} onSelect={onRetry}>{t("chat.retry")}</MenuItem>}
            {canCopy && <MenuItem icon={<Copy className="size-4" />} onSelect={copy}>{t("chatPage.copy")}</MenuItem>}
            {canDelete && <MenuItem tone="danger" icon={<Trash2 className="size-4" />} onSelect={onDelete}>{t("common.delete")}</MenuItem>}
          </MenuContent>
        </MenuRoot>
      )}

    </div>
  );
}

/** Time + delivery state. Inline messages reserve its width with <Spacer/> so it floats into the last line. */
function Meta({ m, mine, seen, overlay }: { m: Message; mine: boolean; seen: boolean; overlay?: boolean }) {
  const { t } = useTranslation();
  const status = !mine || m.deleted ? null
    : m.failed ? <CircleAlert className="size-3.5" role="img" aria-label={t("chatPage.failed")} />
    : m.pending ? <Clock3 className="size-3.5" role="img" aria-label={t("chatPage.sending")} />
    : seen ? <CheckCheck className="size-3.5" role="img" aria-label={t("chat.seen")} />
    : <Check className="size-3.5" role="img" aria-label={t("chat.sent")} />;
  return (
    <span
      className={cn(
        "num pointer-events-none absolute flex items-center gap-1 text-2xs leading-none",
        overlay ? "bottom-2 right-2 rounded-pill bg-scrim px-1.5 py-1 text-on-scrim" : "bottom-2 right-3",
        !overlay && (mine && !m.deleted ? "text-on-lapis/75" : "text-ink-3"),
      )}
    >
      <time dateTime={m.created_at}>{clock(m.created_at)}</time>
      {status}
    </span>
  );
}

// Invisible room at the end of the text for the absolutely placed time (+ ticks for own messages).
function Spacer({ mine }: { mine: boolean }) {
  return <span aria-hidden="true" className={cn("inline-block h-3", mine ? "w-14" : "w-10")} />;
}

const linkRe = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])/g;

/** Plain text with web links made clickable (split on URLs; no HTML is ever injected). */
function Linkified({ text, mine }: { text: string; mine: boolean }) {
  const parts = text.split(linkRe);
  return (
    <>
      {parts.map((p, i) => i % 2 ? (
        <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow"
          className={cn("break-all underline underline-offset-2", mine ? "text-on-lapis" : "text-lapis-ink")}>{p}</a>
      ) : p)}
    </>
  );
}

function fileIcon(name = "", type = ""): LucideIcon {
  if (/^image\//.test(type)) return FileImage;
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return FileArchive;
  if (/\.(xlsx?|csv|ods)$/i.test(name)) return FileSpreadsheet;
  return FileText;
}

function Body({ m, mine, seen }: { m: Message; mine: boolean; seen: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const text = (children: ReactNode, className?: string) => (
    <p className={cn("whitespace-pre-wrap", className)}>{children}<Spacer mine={mine} /></p>
  );
  switch (m.kind) {
    case "image": {
      const w = m.file?.meta?.width, h = m.file?.meta?.height;
      return (
        <>
          <a href={m.file?.url} target="_blank" rel="noopener noreferrer" className="relative block w-72 max-w-full" aria-label={t("chatPage.openPhoto")}>
            {m.file?.url ? (
              // width/height reserve the exact box before the photo arrives (no jump in the thread).
              <img src={m.file.url} alt={m.body || t("chat.photo")} loading="lazy" decoding="async" width={w ?? 4} height={h ?? 3}
                className="block h-auto max-h-96 w-full bg-sunken object-cover" />
            ) : <span className="block aspect-4/3 w-full bg-sunken" />}
            {m.pending && (
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-11 place-items-center rounded-full bg-scrim text-on-scrim"><Spinner className="size-5" /></span>
              </span>
            )}
          </a>
          {m.body ? (
            <div className="relative px-3.5 pb-2 pt-1.5">
              {text(<Linkified text={m.body} mine={mine} />)}
              <Meta m={m} mine={mine} seen={seen} />
            </div>
          ) : <Meta m={m} mine={mine} seen={seen} overlay />}
        </>
      );
    }
    case "file": {
      const Icon = fileIcon(m.file?.name, m.file?.content_type);
      const ext = m.file?.name.split(".").pop();
      const inner = (
        <>
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-control", mine ? "bg-on-lapis/15" : "bg-lapis-soft text-lapis-ink")}>
            {m.pending ? <Spinner className="size-5" /> : <Icon className="size-5" aria-hidden="true" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{m.file?.name ?? t("chat.file")}</span>
            <span className={cn("num block text-xs", mine ? "text-on-lapis/75" : "text-ink-2")}>
              {[ext && ext !== m.file?.name ? ext.toUpperCase() : null, m.file ? fileSize(m.file.size, locale) : null].filter(Boolean).join(" · ")}
              <Spacer mine={mine} />
            </span>
          </span>
          {m.file?.url && <Download className="size-4 shrink-0 self-start opacity-70" aria-hidden="true" />}
        </>
      );
      return (
        <>
          {m.file?.url ? (
            <a href={m.file.url} target="_blank" rel="noopener noreferrer" download={m.file.name} className="flex w-64 max-w-full items-center gap-3 rounded-control">
              {inner}
              <span className="sr-only">{t("chatPage.download")}</span>
            </a>
          ) : <div className="flex w-64 max-w-full items-center gap-3">{inner}</div>}
          <Meta m={m} mine={mine} seen={seen} />
        </>
      );
    }
    case "voice":
      return (
        <>
          <VoicePlayer src={m.file?.url} durationMs={m.file?.meta?.duration_ms} mine={mine} />
          <Meta m={m} mine={mine} seen={seen} />
        </>
      );
    case "location":
      return <Location m={m} mine={mine} seen={seen} />;
    case "system":
      return text(m.body, "text-sm text-ink-2");
    default:
      return (
        <>
          {text(<Linkified text={m.body} mine={mine} />)}
          <Meta m={m} mine={mine} seen={seen} />
        </>
      );
  }
}

function Location({ m, mine, seen }: { m: Message; mine: boolean; seen: boolean }) {
  const { t } = useTranslation();
  const grid = useId(); // one pattern id per message: ids must be unique in the page
  const l = m.location!;
  const href = `https://yandex.uz/maps/?pt=${l.lng},${l.lat}&z=16&l=map`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block w-64 max-w-full" aria-label={`${l.name || t("chat.location")} · ${t("chatPage.openMap")}`}>
      <span className={cn("relative grid h-32 place-items-center overflow-hidden rounded-control", mine ? "bg-on-lapis/10" : "bg-sunken text-ink-3")}>
        {/* A tiny drawn "map" instead of loading map tiles for every message. */}
        <svg className="absolute inset-0 size-full opacity-40" aria-hidden="true">
          <defs><pattern id={grid} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="currentColor" strokeWidth="0.6" /></pattern></defs>
          <rect width="100%" height="100%" fill={`url(#${grid})`} />
          <path d="M0 90 C 60 70, 120 110, 260 60" stroke="currentColor" strokeWidth="5" fill="none" opacity="0.5" />
        </svg>
        <MapPin className="relative size-9 fill-anor text-on-anor" aria-hidden="true" />
      </span>
      <span className="relative block px-2 pb-1.5 pt-2">
        <span className="block font-medium">{l.name || t("chat.location")}</span>
        <span className={cn("num block text-xs", mine ? "text-on-lapis/75" : "text-ink-2")}>{l.lat.toFixed(5)}, {l.lng.toFixed(5)}<Spacer mine={mine} /></span>
        <Meta m={m} mine={mine} seen={seen} />
      </span>
    </a>
  );
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
    <div className="flex w-60 max-w-full items-center gap-3 py-0.5">
      <audio ref={audio} src={src} preload="metadata" />
      <button type="button" onClick={toggle} disabled={!src} aria-label={playing ? t("chat.pause") : t("chat.play")}
        className={cn("grid size-11 shrink-0 place-items-center rounded-full transition-[scale] duration-150 ease-spring active:scale-95 disabled:opacity-50",
          mine ? "bg-on-lapis text-lapis" : "bg-lapis text-on-lapis")}>
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("relative h-1 overflow-hidden rounded-pill", mine ? "bg-on-lapis/25" : "bg-line")}>
          {/* Progress moves with a transform only (no width animation). */}
          <div className={cn("absolute inset-0 origin-left rounded-pill", mine ? "bg-on-lapis" : "bg-lapis")}
            style={{ transform: `scaleX(${dur ? Math.min(1, pos / dur) : 0})` }} />
        </div>
        <span className={cn("num mt-1.5 block text-2xs", mine ? "text-on-lapis/75" : "text-ink-2")}>{fmt(playing || pos ? pos : dur)}</span>
      </div>
    </div>
  );
}

/**
 * Long press (touch/pen) → onLong, with the click that follows the lift swallowed. Movement
 * beyond 10px (a scroll) cancels. Android also fires `contextmenu`; the handler above covers both.
 */
function useLongPress(onLong: () => void, enabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!enabled) return {};
  const cancel = () => { clearTimeout(timer.current); start.current = null; };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(8);
        onLong();
      }, 450);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture: (e: React.MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
