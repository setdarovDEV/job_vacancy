export type Person = { id: string; full_name: string; avatar_url: string | null };
export type ChatFile = { id: string; content_type: string; size: number; name: string; meta?: { duration_ms?: number; width?: number; height?: number } | null; url?: string };
export type Message = {
  id: number; conversation_id: string; sender: Person | null; kind: "text" | "image" | "file" | "voice" | "location" | "system";
  body: string; file?: ChatFile; location?: { lat: number; lng: number; name?: string }; client_id: string; created_at: string; deleted: boolean;
  /** Client-only: still sending, or failed. */
  pending?: boolean; failed?: boolean;
};
export type Conversation = {
  id: string; application_id: string; vacancy: { id: string; title: string };
  company: { id: string; name: string; slug: string; logo_url: string | null }; seeker: Person;
  side: "seeker" | "company"; last_message: Message | null; last_message_at: string | null; unread: number; read_up_to: number; created_at: string;
};

/** Who the viewer is talking to, for avatars and titles. */
export function counterpart(c: Conversation) {
  return c.side === "seeker"
    ? { name: c.company.name, avatar: c.company.logo_url, square: true, userId: null as string | null }
    : { name: c.seeker.full_name, avatar: c.seeker.avatar_url, square: false, userId: c.seeker.id };
}

/** The application behind a conversation, from the viewer's side. */
export function applicationHref(c: Conversation) {
  return c.side === "company" ? `/employer/applications/${c.application_id}` : `/me/applications/${c.application_id}`;
}

/** Messages from one sender this close together stack as a group (tight gaps, shared corners). */
export const GROUP_MS = 5 * 60_000;

export function sameGroup(a: Message | undefined, b: Message | undefined): boolean {
  if (!a || !b || a.kind === "system" || b.kind === "system" || a.sender?.id !== b.sender?.id) return false;
  return Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < GROUP_MS;
}
