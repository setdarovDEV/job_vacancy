/**
 * Places a fixed-position popover under its trigger, or above it when there's clearly more
 * room there; keeps it on screen and caps its height to the space available.
 */
export function placeUnder(el: HTMLElement, anchor: HTMLElement, opts: { minWidth?: number; width?: number; maxHeight?: number } = {}) {
  const r = anchor.getBoundingClientRect();
  const width = Math.min(opts.width ?? Math.max(r.width, opts.minWidth ?? 0), window.innerWidth - 16);
  const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
  const below = window.innerHeight - r.bottom - 12;
  const above = r.top - 12;
  const need = Math.min(opts.maxHeight ?? 384, el.scrollHeight || 240);
  const up = below < need && above > below;
  el.style.width = `${width}px`;
  el.style.left = `${left}px`;
  el.style.maxHeight = `${Math.min(opts.maxHeight ?? 384, up ? above : below)}px`;
  el.style.top = up ? "auto" : `${r.bottom + 6}px`;
  el.style.bottom = up ? `${window.innerHeight - r.top + 6}px` : "auto";
  el.dataset.side = up ? "top" : "bottom";
}
