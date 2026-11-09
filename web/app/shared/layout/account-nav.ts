import { Plus, ShieldCheck, type LucideIcon } from "lucide-react";

import type { User } from "../auth/session";

export type AccountLink = { to: string; key: string };

/** What a role sees in the account area: section links and an optional header shortcut. */
type RoleNav = { links: AccountLink[]; cta?: AccountLink & { icon: LucideIcon } };

const NAV: Record<User["role"], RoleNav> = {
  seeker: {
    links: [
      { to: "/me/resumes", key: "account.myResumes" },
      { to: "/me/applications", key: "nav.applications" },
      { to: "/me/saved", key: "nav.saved" },
      { to: "/me/searches", key: "account.searches" },
      { to: "/chat", key: "nav.messages" },
      { to: "/me/notifications", key: "account.notifications" },
      { to: "/me", key: "account.settings" },
    ],
  },
  employer: {
    links: [
      { to: "/employer", key: "account.dashboard" },
      { to: "/employer/candidates", key: "account.candidates" },
      { to: "/employer/company", key: "employer.company" },
      { to: "/chat", key: "nav.messages" },
      { to: "/me/notifications", key: "account.notifications" },
      { to: "/me", key: "account.settings" },
    ],
    cta: { to: "/employer/vacancies/new", key: "nav.postVacancy", icon: Plus },
  },
  admin: {
    links: [
      { to: "/admin", key: "admin.nav.overview" },
      { to: "/admin/moderation", key: "admin.nav.moderation" },
      { to: "/admin/reports", key: "admin.nav.reports" },
      { to: "/admin/companies", key: "admin.nav.companies" },
      { to: "/admin/users", key: "admin.nav.users" },
      { to: "/admin/skills", key: "admin.nav.skills" },
      { to: "/me/notifications", key: "account.notifications" },
      { to: "/me", key: "account.settings" },
    ],
    cta: { to: "/admin", key: "admin.nav.overview", icon: ShieldCheck },
  },
};

/** Section roots: their nav item is active only on the exact path, not on sub-pages. */
export const SECTION_ROOTS = new Set(["/me", "/employer", "/admin"]);

export function accountLinks(user: Pick<User, "role">): AccountLink[] {
  return NAV[user.role].links;
}

export function headerShortcut(user: Pick<User, "role">) {
  return NAV[user.role].cta;
}
