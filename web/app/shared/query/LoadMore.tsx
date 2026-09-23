import { useTranslation } from "../i18n/i18n";
import { Button } from "../ui/Button";

export function LoadMore({ hasNext, loading, onClick }: { hasNext: boolean; loading: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  if (!hasNext) return null;
  return (
    <div className="mt-5 flex justify-center">
      <Button variant="secondary" loading={loading} onClick={onClick}>{t("jobs.loadMore")}</Button>
    </div>
  );
}
