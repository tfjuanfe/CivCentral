"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canReview, isSuspended, SUSPENDED_MESSAGE } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { rateLimit, retryMessage } from "@/lib/ratelimit";
import {
  isReportReason,
  isReportTarget,
  REPORT_DETAILS_MAX,
  type ReportTargetType,
} from "@/lib/reports";
import type { SessionUser } from "@/lib/types";

export type ReportResult = { ok: true } | { ok: false; error: string };

export interface ReportInput {
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
}

async function gateArchivist(): Promise<
  { ok: true; user: SessionUser } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user || !canReview(user))
    return { ok: false, error: "Archivists only." };
  return { ok: true, user };
}

// Confirm the reported thing exists and find who wrote it, so a report can't be
// filed against nothing and an archivist knows whose post it is.
async function resolveTargetAuthor(
  targetType: ReportTargetType,
  targetId: string,
): Promise<{ ok: true; authorId: string | null } | { ok: false; error: string }> {
  if (targetType === "comment") {
    const c = await prisma.comment.findUnique({
      where: { id: targetId },
      select: { authorId: true },
    });
    return c
      ? { ok: true, authorId: c.authorId }
      : { ok: false, error: "That comment no longer exists." };
  }
  if (targetType === "entry") {
    const e = await prisma.entry.findUnique({
      where: { id: targetId },
      select: { authorId: true },
    });
    return e
      ? { ok: true, authorId: e.authorId }
      : { ok: false, error: "That entry no longer exists." };
  }
  if (targetType === "user") {
    const u = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    return u
      ? { ok: true, authorId: u.id }
      : { ok: false, error: "That account no longer exists." };
  }
  const ev = await prisma.event.findUnique({
    where: { id: targetId },
    select: { ownerId: true },
  });
  return ev
    ? { ok: true, authorId: ev.ownerId }
    : { ok: false, error: "That event no longer exists." };
}

export async function submitReport(input: ReportInput): Promise<ReportResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to report content." };
  if (isSuspended(user)) return { ok: false, error: SUSPENDED_MESSAGE };

  if (!isReportTarget(input.targetType))
    return { ok: false, error: "Unknown report target." };
  if (!isReportReason(input.reason))
    return { ok: false, error: "Pick a reason for the report." };

  const details = (input.details ?? "").trim();
  if (details.length > REPORT_DETAILS_MAX)
    return {
      ok: false,
      error: `Please keep the details under ${REPORT_DETAILS_MAX} characters.`,
    };
  if (input.reason === "other" && details.length === 0)
    return {
      ok: false,
      error: "Tell us what's wrong so an archivist can judge it.",
    };

  const rl = await rateLimit(`report:${user.id}`, 10, 3600);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

  const target = await resolveTargetAuthor(input.targetType, input.targetId);
  if (!target.ok) return target;
  if (target.authorId && target.authorId === user.id)
    return { ok: false, error: "You can't report your own post." };

  // The model has no unique constraint across reporter+target, so re-reporting
  // is folded into the reporter's own existing report rather than stacking
  // duplicates in the queue. Other people's reports still count separately.
  const existing = await prisma.report.findFirst({
    where: {
      reporterId: user.id,
      targetType: input.targetType,
      targetId: input.targetId,
    },
  });

  if (existing) {
    await prisma.report.update({
      where: { id: existing.id },
      data: {
        reason: input.reason,
        details,
        status: "open",
        createdAt: new Date(),
      },
    });
  } else {
    await prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details,
      },
    });
  }

  revalidatePath("/review/reports");
  return { ok: true };
}

// One decision on a piece of content settles every open report about it.
async function closeReportsFor(
  targetType: string,
  targetId: string,
  status: "resolved" | "dismissed",
): Promise<void> {
  await prisma.report.updateMany({
    where: { targetType, targetId, status: "open" },
    data: { status },
  });
}

export async function dismissReport(reportId: string): Promise<ReportResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return gate;

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, error: "Report not found." };

  await prisma.report.update({
    where: { id: reportId },
    data: { status: "dismissed" },
  });

  await logAudit({
    action: "dismissed_report",
    actorId: gate.user.id,
    actorName: gate.user.username,
    targetType: report.targetType === "entry" ? "entry" : "comment",
    targetId: report.targetId,
    targetName: `${report.targetType} report`,
    reason: report.reason,
  });

  revalidatePath("/review/reports");
  return { ok: true };
}

// Mark handled — used when the archivist acted some other way (a warning, a
// suspension) and wants the queue cleared for that target.
export async function resolveReport(reportId: string): Promise<ReportResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return gate;

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, error: "Report not found." };

  await closeReportsFor(report.targetType, report.targetId, "resolved");

  await logAudit({
    action: "resolved_report",
    actorId: gate.user.id,
    actorName: gate.user.username,
    targetType: report.targetType === "entry" ? "entry" : "comment",
    targetId: report.targetId,
    targetName: `${report.targetType} report`,
    reason: report.reason,
  });

  revalidatePath("/review/reports");
  return { ok: true };
}

// Delete the reported content and close every open report against it.
export async function removeReportedContent(
  reportId: string,
): Promise<ReportResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return gate;

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, error: "Report not found." };
  if (report.targetType !== "comment" && report.targetType !== "entry")
    return {
      ok: false,
      error: "Only comments and entries can be removed from here.",
    };

  if (report.targetType === "comment") {
    await prisma.comment.deleteMany({ where: { id: report.targetId } });
    await prisma.vote.deleteMany({
      where: { targetType: "comment", targetId: report.targetId },
    });
  } else {
    await prisma.entry.deleteMany({ where: { id: report.targetId } });
  }

  await closeReportsFor(report.targetType, report.targetId, "resolved");

  await logAudit({
    action: report.targetType === "entry" ? "deleted_entry" : "deleted_comment",
    actorId: gate.user.id,
    actorName: gate.user.username,
    targetType: report.targetType === "entry" ? "entry" : "comment",
    targetId: report.targetId,
    targetName: `${report.targetType} removed after report`,
    reason: report.reason,
  });

  revalidatePath("/review/reports");
  revalidatePath("/");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Account moderation
// ---------------------------------------------------------------------------

// Suspend (optionally for a set number of days) or ban an account. Both block
// posting, voting, reporting, and editing while leaving reading open.
// `days` of 0 or less means no end date.
export async function suspendUser(
  userId: string,
  days: number,
  ban: boolean,
): Promise<ReportResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return gate;

  if (userId === gate.user.id)
    return { ok: false, error: "You can't suspend your own account." };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "archivist")
    return {
      ok: false,
      error: "Demote this archivist before suspending the account.",
    };

  const duration = Number.isFinite(days) ? Math.floor(days) : 0;
  const until =
    !ban && duration > 0
      ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
      : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: ban ? "banned" : "suspended",
      suspendedUntil: until,
    },
  });

  await logAudit({
    action: ban ? "banned_user" : "suspended_user",
    actorId: gate.user.id,
    actorName: gate.user.username,
    targetType: "user",
    targetId: target.id,
    targetName: target.username,
    reason: ban
      ? "permanent ban"
      : until
        ? `${duration} day(s)`
        : "suspended indefinitely",
  });

  revalidatePath("/review");
  revalidatePath("/review/reports");
  revalidatePath(`/users/${target.username}`);
  return { ok: true };
}

export async function reinstateUser(userId: string): Promise<ReportResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return gate;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });
  if (!target) return { ok: false, error: "User not found." };

  await prisma.user.update({
    where: { id: userId },
    data: { status: "active", suspendedUntil: null },
  });

  await logAudit({
    action: "reinstated_user",
    actorId: gate.user.id,
    actorName: gate.user.username,
    targetType: "user",
    targetId: target.id,
    targetName: target.username,
  });

  revalidatePath("/review");
  revalidatePath(`/users/${target.username}`);
  return { ok: true };
}
