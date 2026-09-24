import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { api, type Schemas } from "~/shared/api/client";
import { authed } from "~/shared/query/query";

export type Company = Schemas["Company"];

/* ---- selected company ------------------------------------------------------------------
 * People who belong to several companies pick one in the dashboard's switcher; every employer
 * page (dashboard, company profile, new vacancy) then works with that one. The choice is kept
 * per browser (a convenience, not state that must survive): storage can be blocked, so every
 * access is guarded and the first company is the fallback.
 */
const STORE_KEY = "jv_company";
let selected: string | null = null;
const listeners = new Set<() => void>();

function readSelected(): string {
  if (selected === null) {
    try {
      selected = localStorage.getItem(STORE_KEY) ?? "";
    } catch {
      selected = "";
    }
  }
  return selected;
}

/** Make `id` the company the employer pages work with. */
export function selectCompany(id: string) {
  selected = id;
  try {
    localStorage.setItem(STORE_KEY, id);
  } catch {
    // Private mode / blocked storage: the choice lasts for this page session only.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * The employer's current company (the one picked in the switcher, else the first they belong
 * to), or null before they create one. `companies` lists all of them for the switcher.
 */
export function useMyCompany() {
  const q = useQuery({ queryKey: ["my-companies"], queryFn: () => authed<Company[]>(() => api.GET("/me/companies")) });
  // Private pages render in the browser only; the server snapshot is never shown.
  const id = useSyncExternalStore(subscribe, readSelected, () => "");
  const list = q.data;
  const company = list ? (list.find((c) => c.id === id) ?? list[0] ?? null) : undefined;
  return { ...q, company, companies: list ?? [], selectCompany };
}

export type Candidate = {
  user_id: string; full_name: string; avatar_url: string | null; resume_title: string;
  experience_months: number; desired_salary: { amount: number; currency: string } | null; region_id: number | null;
};
export type EmployerApplication = Schemas["Application"] & { candidate: Candidate };
