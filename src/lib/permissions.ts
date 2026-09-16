import type { EntryStatus, EventSettings, Layer, SessionUser } from "./types";

// Decide the publish status of a submission, encoding the review rules:
//
//   - archivists publish directly
//   - RECORD-layer entries ALWAYS go through review (status "pending")
//   - trusted contributors auto-publish ACCOUNT-layer entries
//   - everyone else lands in the review queue
//
// `asDraft` lets an author deliberately park work as a draft.
export function resolveSubmissionStatus(
  user: SessionUser,
  layer: Layer,
  asDraft: boolean,
): EntryStatus {
  if (asDraft) return "draft";
  if (user.role === "archivist") return "published";
  if (layer === "record") return "pending";
  if (layer === "account" && user.trusted) return "published";
  return "pending";
}

export function canEditEntry(
  user: SessionUser | null,
  entry: { authorId: string },
): boolean {
  if (!user) return false;
  if (isSuspended(user)) return false;
  if (user.role === "archivist") return true;
  return entry.authorId === user.id;
}

// Suspended or banned. Resolved in the session, so this is a plain read.
export function isSuspended(user: SessionUser | null): boolean {
  return !!user?.suspended;
}

export function canReview(user: SessionUser | null): boolean {
  return user?.role === "archivist";
}

// Whether a user may submit servers/events for review. Archivists can always do
// this (they also create directly); event hosts submit requests.
export function canHostEvents(user: SessionUser | null): boolean {
  return !!user && (user.eventHost || user.role === "archivist");
}

export function canContribute(user: SessionUser | null): boolean {
  if (isSuspended(user)) return false;
  return user?.role === "contributor" || user?.role === "archivist";
}

// Whether a user may take a contributing action RIGHT NOW. Contributing
// (creating/editing entries, commenting, starring) requires a verified email.
// Readers and unverified users can still browse.
export function canContributeNow(user: SessionUser | null): boolean {
  return canContribute(user) && !!user?.emailVerified;
}

// ---------------------------------------------------------------------------
// Event hosting
// ---------------------------------------------------------------------------

// Who may change an event and its page settings: the member who owns it, or
// any archivist. Events with no owner stay archivist-only.
export function canManageEvent(
  user: SessionUser | null,
  event: { ownerId: string | null },
): boolean {
  if (!user || isSuspended(user)) return false;
  if (user.role === "archivist") return true;
  return !!event.ownerId && event.ownerId === user.id;
}

// Whether the aggregate rating is visible to this viewer. An owner who keeps
// the score private still sees the numbers, as do archivists — otherwise
// nobody could act on the feedback.
export function canSeeEventRatings(
  user: SessionUser | null,
  event: { ownerId: string | null } & Pick<
    EventSettings,
    "ratingsEnabled" | "ratingsPublic"
  >,
): boolean {
  if (!event.ratingsEnabled) return canManageEvent(user, event);
  if (event.ratingsPublic) return true;
  return canManageEvent(user, event);
}

export type ParticipationCheck = { ok: true } | { ok: false; error: string };

// Gate for rating or commenting on a specific event page. This is where a
// host's ratingMode applies: they may waive email verification for their own
// page, but never the login, role, or suspension checks.
export function canParticipateInEvent(
  user: SessionUser | null,
  event: Pick<EventSettings, "ratingMode">,
  action: string,
): ParticipationCheck {
  if (!user) return { ok: false, error: `Log in to ${action}.` };
  if (isSuspended(user)) return { ok: false, error: SUSPENDED_MESSAGE };
  if (!canContribute(user))
    return { ok: false, error: `Your account can't ${action}.` };
  if (event.ratingMode === "verified" && !user.emailVerified)
    return { ok: false, error: VERIFY_EMAIL_MESSAGE };
  return { ok: true };
}

export const VERIFY_EMAIL_MESSAGE =
  "Verify your email before contributing. Add or confirm your email on your My Contributions page.";

export const SUSPENDED_MESSAGE =
  "Your account is suspended, so you can't post, vote, or contribute. The banner at the top of the page explains why and for how long.";
