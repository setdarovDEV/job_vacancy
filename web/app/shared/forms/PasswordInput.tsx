import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";

import { useTranslation } from "../i18n/i18n";
import { Input } from "../ui/Field";

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(props, ref) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <Input
      ref={ref}
      type={show ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? t("form.hidePassword") : t("form.showPassword")}
          aria-pressed={show}
          className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink"
        >
          {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
        </button>
      }
      {...props}
    />
  );
});
