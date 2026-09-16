export type Role = "reader" | "contributor" | "archivist";
export type EntryType =
  | "civilization"
  | "character"
  | "war"
  | "place"
  | "artifact";
export type Layer = "record" | "account";
export type EntryStatus = "draft" | "pending" | "published";
export type EventStatus = "upcoming" | "ongoing" | "concluded";

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
  trusted: boolean;
  email: string | null;
  emailVerified: boolean;
  // Ban state, already resolved against `bannedUntil` — `banned` is false once
  // a timed ban has lapsed, so callers never re-check the clock.
  banned: boolean;
  banReason: string | null;
  bannedUntil: Date | null;
}

// The host-controlled knobs on an event page. Kept as a standalone shape so
// pages, forms, and server actions agree on what a host can change.
export interface EventSettings {
  ratingsEnabled: boolean;
  ratingsPublic: boolean;
  requireVerifiedEmail: boolean;
  commentsEnabled: boolean;
}

export type Infobox = Record<string, string>;

export function parseInfobox(raw: string | null | undefined): Infobox {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Infobox;
    }
  } catch {
    // fall through to empty infobox
  }
  return {};
}
