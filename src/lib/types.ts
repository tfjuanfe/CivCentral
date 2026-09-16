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

export type AccountStatus = "active" | "suspended" | "banned";

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
  trusted: boolean;
  eventHost: boolean;
  email: string | null;
  emailVerified: boolean;
  // Moderation state, already resolved against suspendedUntil — `suspended` is
  // false once a timed suspension has lapsed, so callers never re-check the
  // clock. A ban has no end date.
  status: AccountStatus;
  suspended: boolean;
  suspendedUntil: Date | null;
}

// The host-controlled knobs on an event page. Kept as one shape so the page,
// the settings form, and the server action agree on what a host may change.
export interface EventSettings {
  ratingsEnabled: boolean;
  ratingsPublic: boolean;
  commentsEnabled: boolean;
  // "verified" requires a confirmed email to rate or comment here; "open"
  // admits any logged-in member.
  ratingMode: "open" | "verified";
}

export type RequestStatus = "pending" | "approved" | "rejected";

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
