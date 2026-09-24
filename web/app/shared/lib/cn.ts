import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default scales. Without these, text-lead reads as a
// colour (so cn("text-lead", "text-ink") dropped the size), and two rounded-*/shadow-*/
// tracking-* token classes were both kept, leaving stylesheet order to pick the winner.
// text-2xs and text-md already pass as t-shirt sizes.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["lead"],
      radius: ["control", "panel", "sheet", "pill", "check"],
      shadow: ["1", "2", "3", "4", "ring", "ring-danger", "pop"],
      tracking: ["display", "heading", "snug", "caps"],
      ease: ["spring", "out-quint"],
    },
  },
});

/** Joins class names; later Tailwind utilities override earlier conflicting ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
