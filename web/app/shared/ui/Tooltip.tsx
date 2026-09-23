import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

// Each tooltip carries its own provider, so pages without tooltips don't load Radix Tooltip.
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <T.Provider delayDuration={300}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content sideOffset={6} className="anim-pop z-50 max-w-64 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-paper shadow-pop">
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
