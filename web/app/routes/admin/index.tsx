import { ShieldAlert, ShieldCheck } from "lucide-react";

import type { Route } from "./+types/index";
import { ModerationQueue } from "./ModerationQueue";
import { useSession } from "~/shared/auth/session";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { metaT } from "~/shared/seo/meta";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { PageHeader } from "~/shared/ui/Section";

export function meta({ matches }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return [{ title: `${t("adminPage.title")} | ${t("brand.name")}` }, { name: "robots", content: "noindex" }];
}

/**
 * Admin panel (TZ PG-15): the vacancy moderation queue and company verification, the admin
 * endpoints the API has today. Signed-in non-admins get an explanation instead of a 403.
 */
export default function Admin() {
  const { user } = useSession();
  return (
    <div className="container-page pb-16 pt-6 md:pb-24 md:pt-10">
      {user?.role === "admin" ? <Panel /> : <NotAdmin />}
    </div>
  );
}

function Panel() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        breadcrumbs={<Badge tone="lapis" icon={<ShieldCheck />}>{t("adminPage.role")}</Badge>}
        title={t("adminPage.title")}
        description={t("adminPage.description")}
      />
      <ModerationQueue />
    </>
  );
}

function NotAdmin() {
  const { t } = useTranslation();
  return (
    <Card padding="none" className="mx-auto max-w-2xl">
      <h1 className="sr-only">{t("adminPage.title")}</h1>
      <EmptyState
        icon={<ShieldAlert />}
        headingAs="h2"
        title={t("adminPage.deniedTitle")}
        body={t("adminPage.deniedBody")}
        action={
          <Button asChild variant="secondary">
            <LocalizedLink to="/" prefetch="intent">{t("errors.toHome")}</LocalizedLink>
          </Button>
        }
      />
    </Card>
  );
}
