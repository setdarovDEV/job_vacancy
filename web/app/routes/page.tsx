import { data } from "react-router";

import type { Route } from "./+types/page";
import { getPage, SLUGS, type Slug } from "~/shared/content/pages.server";
import { localeFromPath } from "~/shared/i18n/config";
import { seo } from "~/shared/seo/seo";

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const slug = url.pathname.split("/").pop() as Slug;
  if (!SLUGS.includes(slug)) throw data(null, { status: 404 });
  return { page: getPage(slug, localeFromPath(url.pathname)), slug };
}

export function meta({ loaderData, location }: Route.MetaArgs) {
  if (!loaderData) return [];
  return seo({ title: `${loaderData.page.title} | Job Vacancy`, description: loaderData.page.lead, path: location.pathname });
}

export default function StaticPage({ loaderData }: Route.ComponentProps) {
  const { page, slug } = loaderData;
  return (
    <article className="container-page max-w-3xl pb-10 pt-10 md:pt-16">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink md:text-4xl">{page.title}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-2">{page.lead}</p>
      <div className="mt-10 flex flex-col gap-9">
        {page.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">{s.h}</h2>
            <div className="mt-3 flex max-w-[65ch] flex-col gap-3 leading-relaxed text-ink-2">
              {s.p.map((p) => (slug === "contacts" && p.includes("@") && !p.includes(" ")
                ? <a key={p} href={`mailto:${p}`} className="text-lg font-medium text-lapis-ink hover:underline">{p}</a>
                : <p key={p}>{p}</p>))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
