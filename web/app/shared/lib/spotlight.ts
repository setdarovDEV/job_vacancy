import { useEffect, useRef } from "react";

/**
 * Drives the `spotlight` utility (app.css) for a whole list with one delegated listener: the glow
 * follows the pointer over the card under it. rAF-throttled, fine pointers only (nothing is bound
 * on touch), and it writes CSS variables, never React state (no re-render per pointer move).
 *   const list = useSpotlight<HTMLUListElement>();
 *   <ul ref={list}>… <li><a className="surface-card surface-card-interactive spotlight relative …">
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    let card: HTMLElement | null = null;
    const paint = () => {
      raf = 0;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${x - r.left}px`);
      card.style.setProperty("--my", `${y - r.top}px`);
    };
    const move = (e: PointerEvent) => {
      const hit = (e.target as Element).closest<HTMLElement>(".spotlight");
      card = hit && root.contains(hit) ? hit : null;
      x = e.clientX;
      y = e.clientY;
      if (card && !raf) raf = requestAnimationFrame(paint);
    };
    root.addEventListener("pointermove", move, { passive: true });
    return () => {
      root.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}
