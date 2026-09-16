// Report vocabulary. Plain module (no server-only) so the report dialog and
// the archivist queue render the same labels.

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "sexual"
  | "offtopic"
  | "misinformation"
  | "personal_info"
  | "other";

export interface ReasonOption {
  value: ReportReason;
  label: string;
  hint: string;
}

export const REPORT_REASONS: ReasonOption[] = [
  {
    value: "spam",
    label: "Spam or advertising",
    hint: "Server ads, referral links, repeated pasted text.",
  },
  {
    value: "harassment",
    label: "Harassment or threats",
    hint: "Targeted abuse, insults, or threats against a person.",
  },
  {
    value: "hate",
    label: "Hate speech",
    hint: "Attacks on people for who they are.",
  },
  {
    value: "sexual",
    label: "Sexual or graphic content",
    hint: "Explicit or gratuitously violent material.",
  },
  {
    value: "offtopic",
    label: "Off-topic or disruptive",
    hint: "Derailing the discussion, trolling, or nonsense.",
  },
  {
    value: "misinformation",
    label: "False lore claim",
    hint: "A Record that misstates what actually happened in-game.",
  },
  {
    value: "personal_info",
    label: "Personal information",
    hint: "Real-world names, addresses, or contact details posted without consent.",
  },
  {
    value: "other",
    label: "Something else",
    hint: "Describe it below so an archivist can judge.",
  },
];

export const REPORT_REASON_LABELS: Record<ReportReason, string> =
  Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label])) as Record<
    ReportReason,
    string
  >;

export function isReportReason(value: string): value is ReportReason {
  return REPORT_REASONS.some((r) => r.value === value);
}

// The Report model allows entry | comment | user | event. The report button is
// offered on the first two; the others exist for future surfaces.
export type ReportTargetType = "entry" | "comment" | "user" | "event";

export function isReportTarget(value: string): value is ReportTargetType {
  return ["entry", "comment", "user", "event"].includes(value);
}

export type ReportStatus = "open" | "resolved" | "dismissed";

export const REPORT_DETAILS_MAX = 1000;
