// Operator details used by the Privacy Policy and Terms of Use.
//
// ⚠ FILL THESE IN BEFORE LAUNCH. The policy text is written to be accurate
// about what WikiCiv's code actually does with personal data, but it is not
// legal advice: who operates the site, where they are, and how to reach them
// are facts only you can supply, and a lawyer should review the result if the
// archive takes on real scale.
//
// Set them from the environment so a fork can publish its own details without
// editing source.

export const LEGAL = {
  /** Name of the person or group running this instance. */
  operator: process.env.NEXT_PUBLIC_SITE_OPERATOR || "the WikiCiv archivists",
  /** Where privacy requests and legal notices should be sent. */
  contactEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "",
  /** Where disputes are handled, e.g. "the Netherlands". */
  jurisdiction: process.env.NEXT_PUBLIC_LEGAL_JURISDICTION || "",
  /** Shown at the top of both documents. */
  lastUpdated: process.env.NEXT_PUBLIC_LEGAL_UPDATED || "16 September 2026",
  /** Minimum age to hold an account. */
  minimumAge: 13,
} as const;

// How long each kind of personal data is kept. Mirrors what the code does, so
// update this table whenever retention behaviour changes.
export const RETENTION: { what: string; how_long: string }[] = [
  {
    what: "Account record (username, email, password hash, Discord ID, bio)",
    how_long: "Until you ask us to delete the account.",
  },
  {
    what: "Email verification tokens",
    how_long:
      "Deleted as soon as they are used, replaced, or expire — only a SHA-256 hash is ever stored.",
  },
  {
    what: "Session cookie",
    how_long: "30 days, or until you log out.",
  },
  {
    what: "Rate-limit counters (keyed by IP address or account)",
    how_long: "Overwritten each window; nothing older than one hour is kept.",
  },
  {
    what: "Entries, revisions, comments, ratings, votes and stars",
    how_long:
      "Kept as part of the archive. Revisions deliberately preserve the editing history of an entry.",
  },
  {
    what: "Reports you file or that are filed about your posts",
    how_long:
      "Kept while open and for as long as the moderation record is needed. Reports store a snapshot of the reported text so they still make sense after the content is removed.",
  },
  {
    what: "Moderation log (who approved, deleted, or suspended what)",
    how_long:
      "Kept indefinitely. It records archivists' actions and survives deletion of the content it refers to, which is what makes moderation accountable.",
  },
];
