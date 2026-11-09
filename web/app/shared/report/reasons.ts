import type { Schemas } from "~/shared/api/client";

export type ReportReason = Schemas["ReportReason"];

/** What can be reported, as the report dialog needs it. */
export type ReportTarget = { type: "vacancy" | "company"; id: string; name: string };

/** Report reasons in display order (shared by the report dialog and the admin queue). */
export const REASONS: ReportReason[] = ["fraud", "misleading", "offensive", "spam", "other"];
