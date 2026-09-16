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
  | "approved_server"
  | "approved_event"
  | "rejected_server"
  | "rejected_event"
  | "deleted_comment"
  | "resolved_report"
  | "dismissed_report"
  | "suspended_user"
  | "banned_user"
  | "reinstated_user";

export interface AuditInput {
  action: AuditAction;
  actorId: string;
  actorName: string;
  targetType:
    | "entry"
    | "event"
    | "server"
    | "server_request"
    | "event_request"
    | "comment"
    | "user";
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
  approved_server: "Approved server",
  approved_event: "Approved event",
  rejected_server: "Rejected server request",
  rejected_event: "Rejected event request",
  deleted_comment: "Deleted comment",
  resolved_report: "Actioned a report",
  dismissed_report: "Dismissed a report",
  suspended_user: "Suspended account",
  banned_user: "Banned account",
  reinstated_user: "Reinstated account",
};
