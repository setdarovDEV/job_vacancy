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
