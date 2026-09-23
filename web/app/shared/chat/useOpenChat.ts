import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { api } from "../api/client";
import { errorText } from "../api/errors";
import { localizedPath } from "../i18n/config";
import { useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { ApiFailure, authed } from "../query/query";
import { toast } from "../ui/toast-store";

/** Opens (or creates) the application's chat and goes there. */
export function useOpenChat() {
  const locale = useLocale();
  const navigate = useNavigate();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (applicationId: string) =>
      authed<{ id: string }>(() => api.POST("/applications/{application}/conversation", { params: { path: { application: applicationId } } })),
    onSuccess: (c) => navigate(localizedPath(locale, `/chat/${c.id}`)),
    onError: (e) => toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") }),
  });
}
