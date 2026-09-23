import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router";

import { api, type Schemas } from "~/shared/api/client";
import { useTranslation } from "~/shared/i18n/i18n";
import { ApiFailure, authed } from "~/shared/query/query";
import { ResumeView } from "~/shared/resume/ResumeView";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Skeleton } from "~/shared/ui/Skeleton";

type Detail = Schemas["ResumeDetail"];

export default function ResumePage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["resume", id],
    queryFn: () => authed<Detail>(() => api.GET("/resumes/{resume}", { params: { path: { resume: id! } } })),
  });
  if (q.error) {
    const notFound = q.error instanceof ApiFailure && q.error.status === 404;
    return <div className="container-page py-16"><EmptyState title={notFound ? t("apiErrors.resume_not_found") : t("errors.network")} /></div>;
  }
  return (
    <div className="container-page max-w-4xl pb-20 pt-6 md:pt-8">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" />{t("common.back")}
      </button>
      {q.data ? <ResumeView r={q.data} /> : <Skeleton className="mt-5 h-[36rem] rounded-sheet" />}
    </div>
  );
}

