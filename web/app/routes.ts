import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

// Every page sits under an optional language segment: /…, /uz-cyrl/…, /ru/…, /en/….
export default [
  route("sitemap.xml", "routes/sitemap.ts"),
  route(":lang?", "routes/site.tsx", [
    index("routes/home.tsx"),
    layout("routes/auth/layout.tsx", [
      route("login", "routes/auth/login.tsx"),
      route("register", "routes/auth/register.tsx"),
      route("verify-email", "routes/auth/verify-email.tsx"),
      route("forgot-password", "routes/auth/forgot-password.tsx"),
    ]),
    route("vacancies", "routes/vacancies/index.tsx"),
    route("vacancies/:slug", "routes/vacancy/index.tsx"),
    route("companies", "routes/companies.tsx"),
    route("companies/:slug", "routes/company.tsx"),
    route("employers", "routes/employers.tsx"),
    ...["about", "contacts", "privacy", "terms"].map((p) => route(p, "routes/page.tsx", { id: `page-${p}` })),
    layout("routes/private.tsx", [
      layout("routes/account/layout.tsx", [
        route("me", "routes/account/settings.tsx"),
        route("me/resumes", "routes/account/resumes.tsx"),
        route("me/resumes/new", "routes/account/resume-edit.tsx", { id: "resume-new" }),
        route("me/resumes/:id/edit", "routes/account/resume-edit.tsx"),
        route("me/applications", "routes/account/applications.tsx"),
        route("me/applications/:id", "routes/account/application.tsx"),
        route("me/saved", "routes/account/saved.tsx"),
        route("me/searches", "routes/account/searches.tsx"),
        route("me/notifications", "routes/account/notifications.tsx"),
        route("employer", "routes/employer/dashboard.tsx"),
        route("employer/company", "routes/employer/company.tsx"),
        route("employer/vacancies/new", "routes/employer/vacancy-edit.tsx", { id: "vacancy-new" }),
        route("employer/vacancies/:id/edit", "routes/employer/vacancy-edit.tsx"),
        route("employer/vacancies/:id/applications", "routes/employer/kanban.tsx"),
        route("employer/applications/:id", "routes/employer/application.tsx"),
        route("employer/candidates", "routes/employer/candidates.tsx"),
      ]),
      route("resumes/:id", "routes/resume.tsx"),
      route("admin", "routes/admin/index.tsx"),
      route("chat/:id?", "routes/chat/index.tsx"),
    ]),
    // Design system reference; not shipped to production.
    ...(process.env.NODE_ENV === "production" ? [] : [route("ui", "routes/ui.tsx")]),
    route("*", "routes/not-found.tsx"),
  ]),
] satisfies RouteConfig;
