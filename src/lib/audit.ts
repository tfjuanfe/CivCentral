import { prisma } from "./db";

export type AuditAction =
  | "approved"
  | "requested_changes"
  | "disputed"
  | "undisputed"
  | "rolled_back"
  | "deleted_entry"
  | "deleted_event"
  | "deleted_server"
  | "deleted_comment"
  | "resolved_report"
  | "dismissed_report"
  | "banned_user"
  | "unbanned_user";

export interface AuditInput {
  action: AuditAction;
  actorId: string;
  actorName: string;
  targetType: "entry" | "event" | "server" | "comment" | "user";
  targetId?: string | null;
  targetName: string;
  authorName?: string | null;
  reason?: string | null;
}

// Write a durable, denormalized record of a moderation/review action.
export async function logAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      actorId: input.actorId,
      actorName: input.actorName,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      targetName: input.targetName,
      authorName: input.authorName ?? null,
      reason: input.reason ?? null,
    },
  });
}

export const AUDIT_LABELS: Record<AuditAction, string> = {
  approved: "Approved & published",
  requested_changes: "Requested changes",
  disputed: "Marked disputed",
  undisputed: "Cleared disputed flag",
  rolled_back: "Rolled back",
  deleted_entry: "Deleted entry",
  deleted_event: "Deleted event",
  deleted_server: "Deleted server",
  deleted_comment: "Deleted comment",
  resolved_report: "Actioned a report",
  dismissed_report: "Dismissed a report",
  banned_user: "Suspended account",
  unbanned_user: "Lifted suspension",
};
