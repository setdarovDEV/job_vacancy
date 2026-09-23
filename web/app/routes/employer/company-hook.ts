import { useQuery } from "@tanstack/react-query";

import { api, type Schemas } from "~/shared/api/client";
import { authed } from "~/shared/query/query";

export type Company = Schemas["Company"];

/** The employer's company (the first one they belong to), or null before they create one. */
export function useMyCompany() {
  const q = useQuery({ queryKey: ["my-companies"], queryFn: () => authed<Company[]>(() => api.GET("/me/companies")) });
  return { ...q, company: q.data ? (q.data[0] ?? null) : undefined };
}

export type Candidate = {
  user_id: string; full_name: string; avatar_url: string | null; resume_title: string;
  experience_months: number; desired_salary: { amount: number; currency: string } | null; region_id: number | null;
};
export type EmployerApplication = Schemas["Application"] & { candidate: Candidate };
