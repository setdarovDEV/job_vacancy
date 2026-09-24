import { CircleAlert, FileUp, ImagePlus, Trash2, UserRound } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";

import { useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { fileSize } from "../lib/format";

type Variant = "avatar" | "logo" | "cover" | "file";

export type FileDropzoneProps = {
  /** Same syntax as <input accept>: "image/*", "image/png,image/jpeg", ".pdf,.docx". */
  accept: string;
  /** Bytes; bigger files are rejected with a per-file message. */
  maxSize: number;
  multiple?: boolean;
  /** The accepted files (never empty). Uploading stays with the caller (shared/upload). */
  onFiles: (files: File[]) => void;
  /** 0–100 while uploading (null/undefined = idle). */
  progress?: number | null;
  /** Current or just-picked image (e.g. URL.createObjectURL(file)). */
  previewUrl?: string | null;
  variant?: Variant;
  /** Action text, e.g. t("settings.uploadPhoto"). */
  label: string;
  /** Default: accepted types and size limit ("JPG, PNG, WebP, up to 5 MB"). */
  hint?: ReactNode;
  /** Caller's error (upload failed, server rejected). */
  error?: ReactNode;
  disabled?: boolean;
  /** Shows a remove button when there's a preview. */
  onRemove?: () => void;
  removeLabel?: string;
  id?: string;
  className?: string;
};

const rulesOf = (accept: string) => accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

function accepts(file: File, rules: string[]) {
  if (!rules.length) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return rules.some((r) => (r.startsWith(".") ? name.endsWith(r) : r.endsWith("/*") ? type.startsWith(r.slice(0, -1)) : type === r));
}

// "image/png,.pdf" → "PNG, PDF" for the hint line.
const TYPE_NAMES: Record<string, string> = { jpeg: "JPG", msword: "DOC", "svg+xml": "SVG", webp: "WebP" };
function typesLabel(rules: string[]) {
  const names = rules.flatMap((r) => {
    if (r === "image/*") return ["JPG", "PNG", "WebP"];
    const ext = r.startsWith(".") ? r.slice(1) : (r.split("/")[1] ?? r);
    if (ext.includes("wordprocessingml")) return ["DOCX"];
    return [TYPE_NAMES[ext] ?? ext.toUpperCase()];
  });
  return [...new Set(names)].join(", ");
}

const RING = 2 * Math.PI * 20; // circumference of the r=20 progress ring

/**
 * File picker for avatars, logos, covers and documents: click, keyboard (it's a real button) or
 * drag & drop. Checks type and size per file before anything is uploaded, previews images in
 * the final shape (round avatar, square logo, wide cover) and shows upload progress.
 */
export function FileDropzone({
  accept, maxSize, multiple, onFiles, progress, previewUrl, variant = "file", label, hint, error, disabled,
  onRemove, removeLabel, id: idProp, className,
}: FileDropzoneProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const genId = useId();
  const id = idProp ?? genId;
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const picker = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const rules = rulesOf(accept);
  const uploading = progress != null && Number.isFinite(progress);
  const pct = uploading ? Math.min(100, Math.max(0, Math.round(progress))) : 0;
  const busy = disabled || uploading;
  const errors = [...rejected, ...(error ? [error] : [])];
  const hintText = hint ?? t("inputs.fileHint", { types: typesLabel(rules), size: fileSize(maxSize, locale) });

  const take = (list: File[]) => {
    if (busy || !list.length) return;
    const problems: string[] = [];
    const ok: File[] = [];
    for (const f of list) {
      if (!accepts(f, rules)) problems.push(t("inputs.fileNotAllowed", { name: f.name }));
      else if (f.size > maxSize) problems.push(t("inputs.fileTooLarge", { name: f.name, size: fileSize(maxSize, locale) }));
      else ok.push(f);
    }
    if (!multiple && ok.length > 1) problems.push(t("inputs.oneFile"));
    setRejected(problems);
    const picked = multiple ? ok : ok.slice(0, 1);
    if (picked.length) onFiles(picked);
  };

  const dragProps = {
    onDragEnter: (e: DragEvent) => {
      if (busy) return;
      e.preventDefault();
      setDrag(true);
    },
    onDragOver: (e: DragEvent) => {
      if (busy) return;
      e.preventDefault(); // required for drop to fire
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDrag(false);
      take(Array.from(e.dataTransfer.files));
    },
  };

  const image = variant !== "file";
  const round = variant === "avatar";
  const EmptyIcon = variant === "avatar" ? UserRound : variant === "file" ? FileUp : ImagePlus;

  // A real <button> stretched over the whole zone: one tab stop, Enter/Space open the picker.
  const button = (
    <button
      type="button"
      id={id}
      disabled={busy}
      aria-describedby={[hintId, errors.length ? errId : ""].filter(Boolean).join(" ")}
      onClick={() => picker.current?.click()}
      className={cn(
        "text-left font-semibold text-lapis-ink outline-hidden disabled:cursor-not-allowed",
        "after:absolute after:inset-0 after:cursor-pointer disabled:after:cursor-not-allowed",
        variant === "cover" && previewUrl
          ? // Over a photo: the button itself is the scrim chip, still stretched over the whole cover.
            "m-3 self-end justify-self-start rounded-pill bg-scrim px-3 py-1.5 text-sm font-medium text-on-scrim"
          : "text-md",
      )}
    >
      {label}
    </button>
  );

  const hintLine = (
    <p id={hintId} className="text-sm text-ink-2">
      {drag ? t("inputs.dropNow") : hintText}
      {!drag && <span className="pointer-coarse:hidden" aria-hidden="true"> · {t("inputs.dropHere")}</span>}
    </p>
  );

  const progressBar = (className: string) => (
    <span
      role="progressbar"
      aria-label={t("inputs.uploading")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("block overflow-hidden", className)}
    >
      {/* scaleX, not width: the fill animates on the compositor. */}
      <span className="block h-full origin-left bg-lapis transition-transform duration-300 ease-out-quint" style={{ transform: `scaleX(${pct / 100})` }} />
    </span>
  );

  const removeButton = onRemove && previewUrl && !uploading && (
    <button
      type="button"
      onClick={onRemove}
      disabled={disabled}
      aria-label={removeLabel ?? t("common.delete")}
      title={removeLabel ?? t("common.delete")}
      className={cn(
        "relative z-10 grid size-11 shrink-0 place-items-center rounded-control transition-[background-color,color] duration-150",
        variant === "cover" ? "bg-scrim text-on-scrim" : "text-ink-3 hover:bg-sunken hover:text-anor-ink",
      )}
    >
      <Trash2 className="size-4.5" aria-hidden="true" />
    </button>
  );

  return (
    <div className={cn("min-w-0", className)}>
      <div
        {...dragProps}
        data-drag={drag || undefined}
        aria-busy={uploading || undefined}
        className={cn(
          "relative rounded-panel border border-dashed border-line-strong bg-surface transition-[border-color,background-color,box-shadow] duration-150",
          !busy && "hover:border-ink-3",
          "has-focus-visible:border-solid has-focus-visible:border-focus has-focus-visible:shadow-ring",
          "data-drag:border-solid data-drag:border-lapis data-drag:bg-lapis-soft",
          errors.length > 0 && "border-anor",
          disabled && "opacity-50",
          variant === "cover" ? "overflow-hidden" : "flex items-center gap-4 p-4",
        )}
      >
        {variant === "cover" ? (
          <div className="relative grid aspect-[3/1] min-h-40 w-full place-items-center">
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="" width={1200} height={400} decoding="async" className="absolute inset-0 size-full object-cover" />
                {button}
                {removeButton && <span className="absolute right-3 top-3 z-10">{removeButton}</span>}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <span className="grid size-12 place-items-center rounded-control bg-lapis-soft text-lapis" aria-hidden="true">
                  <ImagePlus className="size-6" />
                </span>
                {button}
                {hintLine}
              </div>
            )}
            {uploading && progressBar("absolute inset-x-0 bottom-0 h-1 bg-scrim")}
          </div>
        ) : (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "relative grid shrink-0 place-items-center overflow-hidden",
                image ? "size-20" : "size-12 rounded-control bg-lapis-soft text-lapis",
                round ? "rounded-full bg-sunken text-ink-3" : variant === "logo" && "rounded-panel border border-line bg-surface text-ink-3",
              )}
            >
              {image && previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  width={80}
                  height={80}
                  decoding="async"
                  className={cn("size-full", variant === "logo" ? "object-contain p-1.5" : "object-cover")}
                />
              ) : (
                <EmptyIcon className={image ? "size-7" : "size-6"} />
              )}
              {uploading && image && (
                <span className="absolute inset-0 grid place-items-center bg-scrim text-on-scrim">
                  <svg viewBox="0 0 48 48" className="size-12 -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="4" />
                    <circle
                      cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={RING}
                      strokeDashoffset={RING * (1 - pct / 100)}
                      className="transition-[stroke-dashoffset] duration-300 ease-out-quint"
                    />
                  </svg>
                  <span className="num absolute text-2xs font-semibold">{pct}%</span>
                </span>
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {button}
              {hintLine}
              {uploading && !image && progressBar("mt-2 h-1.5 rounded-pill bg-sunken")}
            </div>
            {removeButton}
            {/* Ring and bar are aria-hidden visuals; this is the spoken progress. */}
            {uploading && image && (
              <span role="progressbar" aria-label={t("inputs.uploading")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="sr-only" />
            )}
          </>
        )}
        <input
          ref={picker}
          type="file"
          accept={accept}
          multiple={multiple}
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
          onChange={(e) => {
            take(Array.from(e.target.files ?? []));
            e.target.value = ""; // picking the same file again still fires change
          }}
        />
      </div>
      {errors.length > 0 && (
        <ul id={errId} role="alert" className="mt-2 flex flex-col gap-1 text-sm text-anor-ink">
          {errors.map((m, i) => (
            <li key={i} className="anim-fade flex items-start gap-1.5">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{m}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
