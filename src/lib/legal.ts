// Operator details and the retention table used by the Privacy Policy and
// Terms of Use.
//
// ⚠ FILL THESE IN BEFORE LAUNCH. The policy text is written to be accurate
// about what CivCentral's code actually does with personal data, but it is not
// legal advice: who operates the site, where they are, and how to reach them
// are facts only the operator can supply, and a lawyer should review the result
// before the archive takes on real scale.
//
// Read from the environment so a fork can publish its own details without
// editing source.

export const LEGAL = {
  /** Name of the person or group running this instance. */
  operator: process.env.NEXT_PUBLIC_SITE_OPERATOR || "the CivCentral archivists",
  /** Where privacy requests and legal notices should be sent. */
  contactEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "",
  /** Where disputes are handled, e.g. "the Netherlands". */
  jurisdiction: process.env.NEXT_PUBLIC_LEGAL_JURISDICTION || "",
  /** Shown at the top of both documents. */
  lastUpdated: process.env.NEXT_PUBLIC_LEGAL_UPDATED || "16 September 2026",
  /** Minimum age to hold an account. */
  minimumAge: 13,
} as const;

// How long each kind of personal data is kept.
//
// These descriptions state what the code ACTUALLY does, not what would be
// tidy to promise. Two in particular are deliberately hedged:
//
//   - Rate-limit rows are swept opportunistically, on roughly 1% of calls
//     (see ratelimit.ts). On a quiet deployment an expired row can sit there
//     well past its window, so claiming a hard one-hour bound would be a
//     guarantee nothing in the code enforces.
//   - Verification tokens are deleted when consumed, when a resend replaces
//     them, or when an expired link is clicked — there is no scheduled job
//     that removes them the moment they expire.
//
// If either gains a real scheduled cleanup, tighten the wording here to match.
export const RETENTION: { what: string; how_long: string }[] = [
  {
    what: "Account record — username, email, password hash, Discord ID and handle, avatar, bio",
    how_long:
      "Until you delete the account. If you never published anything the row is removed outright; if you did, it is stripped of everything identifying and kept so the lore keeps its history.",
  },
  {
    what: "Email verification tokens",
    how_long:
      "Stored only as a SHA-256 hash, valid for a limited window. Deleted when used, when a resend replaces them, or when an expired link is clicked — not on a timer, so an unused expired token can sit until one of those happens.",
  },
  {
    what: "Session cookie",
    how_long: "30 days, or until you log out.",
  },
  {
    what: "Rate-limit counters, keyed by IP address or account",
    how_long:
      "Each counter expires at the end of its window (minutes to an hour) and stops counting against you then. Rows are cleared opportunistically rather than on a schedule, so an expired row may physically remain for a while on a quiet site.",
  },
  {
    what: "Entries, revisions, evidence links, comments, ratings, votes and stars",
    how_long:
      "Kept as part of the archive. Revision history is deliberately preserved — an archive that can be silently rewritten is not an archive.",
  },
  {
    what: "Uploaded images (avatars and evidence)",
    how_long:
      "Stored in object storage until the content referencing them is deleted or you ask us to remove them.",
  },
  {
    what: "Server and event requests, and support tickets",
    how_long:
      "Kept with their outcome so approvals and rejections can be explained later. Removed with your account.",
  },
  {
    what: "Reports you file",
    how_long:
      "Kept while open and while the moderation record is useful. Removed with your account.",
  },
  {
    what: "Moderation log — who approved, deleted, or suspended what",
    how_long:
      "Kept indefinitely. It stores names rather than links to accounts, so it survives deletion of the content and people it refers to. That is what makes moderation accountable.",
  },
];

// Third parties that receive personal data, and the only reason each one does.
export const PROCESSORS: { name: string; why: string }[] = [
  {
    name: "Our hosting and database provider",
    why: "Runs the site and stores the data behind it.",
  },
  {
    name: "Resend",
    why: "Receives your email address solely to deliver verification messages.",
  },
  {
    name: "Cloudflare R2",
    why: "Stores images you upload, such as an avatar or evidence screenshots.",
  },
  {
    name: "Discord",
    why: "Only if you sign in with Discord or opt into event notifications, and only as part of those features.",
  },
];
