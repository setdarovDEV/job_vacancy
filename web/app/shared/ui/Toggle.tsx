import * as C from "@radix-ui/react-checkbox";
import * as R from "@radix-ui/react-radio-group";
import * as Sw from "@radix-ui/react-switch";
import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "../lib/cn";

export function Switch({
  checked, onCheckedChange, label, description, disabled,
}: { checked: boolean; onCheckedChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-3">{description}</span>}
      </label>
      <Sw.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="relative h-6 w-10 shrink-0 rounded-full bg-line-strong transition-colors duration-200 data-[state=checked]:bg-lapis disabled:opacity-50"
      >
        <Sw.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out-quint)] data-[state=checked]:translate-x-[1.125rem]" />
      </Sw.Root>
    </div>
  );
}

export function Checkbox({
  checked, onCheckedChange, label, disabled,
}: { checked: boolean; onCheckedChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2.5">
      <C.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className="grid size-5 shrink-0 place-items-center rounded-[0.375rem] border border-line-strong bg-surface transition-colors data-[state=checked]:border-lapis data-[state=checked]:bg-lapis disabled:opacity-50"
      >
        <C.Indicator>
          <Check className="size-3.5 text-on-lapis" strokeWidth={3} />
        </C.Indicator>
      </C.Root>
      <label htmlFor={id} className="cursor-pointer text-sm text-ink">{label}</label>
    </div>
  );
}

export function RadioGroup({
  value, onValueChange, options, className,
}: { value: string; onValueChange: (v: string) => void; options: { value: string; label: ReactNode }[]; className?: string }) {
  const base = useId();
  return (
    <R.Root value={value} onValueChange={onValueChange} className={cn("flex flex-col gap-2.5", className)}>
      {options.map((o) => (
        <div key={o.value} className="flex items-center gap-2.5">
          <R.Item
            id={`${base}-${o.value}`}
            value={o.value}
            className="grid size-5 place-items-center rounded-full border border-line-strong bg-surface data-[state=checked]:border-lapis"
          >
            <R.Indicator className="size-2.5 rounded-full bg-lapis" />
          </R.Item>
          <label htmlFor={`${base}-${o.value}`} className="cursor-pointer text-sm text-ink">{o.label}</label>
        </div>
      ))}
    </R.Root>
  );
}
