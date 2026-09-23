import { CircleAlert } from "lucide-react";

export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-control bg-anor-soft px-3.5 py-3 text-sm text-anor-ink">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
