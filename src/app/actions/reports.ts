"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canReview, isBanned, BANNED_MESSAGE } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { rateLimit, retryMessage } from "@/lib/ratelimit";
import {
  excerpt,
  isReportReason,
  REPORT_DETAILS_MAX,
  type ReportTargetType,
} from "@/lib/reports";
import type { SessionUser } from "@/lib/types";

export type ReportResult = { ok: true } | { ok: false; error: string };

export interface ReportInput {
  targetType: ReportTargetType;
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

// Look up what is being reported and snapshot it, so the report still makes
// sense to a reviewer after the content is deleted.
async function snapshotTarget(
  targetType: ReportTargetType,
  targetId: string,
): Promise<
  | {
      ok: true;
      excerpt: string;
      authorId: string;
      authorName: string;
      contextUrl: string;
    }
  | { ok: false; error: string }
> {
  if (targetType === "comment") {
    const comment = await prisma.comment.findUnique({
      where: { id: targetId },
      include: { author: { select: { id: true, username: true } } },
    });
    if (!comment)
      return { ok: false, error: "That comment no longer exists." };
    return {
      ok: true,
      excerpt: excerpt(comment.body),
      authorId: comment.author.id,
      authorName: comment.author.username,
      contextUrl: contextUrlForSubject(comment.subjectKey),
    };
  }

  const entry = await prisma.entry.findUnique({
    where: { id: targetId },
    include: { author: { select: { id: true, username: true } } },
  });
  if (!entry) return { ok: false, error: "That entry no longer exists." };
  return {
    ok: true,
    excerpt: excerpt(`${entry.name} — ${entry.body}`),
    authorId: entry.author.id,
    authorName: entry.author.username,
    contextUrl: `/entries/${entry.id}`,
  };
}

// Comments live on either an event thread (`event::<id>`) or an entry subject
// (`<eventId>::<type>::<name>`). Event threads link straight to the event; for
// entry subjects we only know the event, which is the useful landing spot.
function contextUrlForSubject(subjectKey: string): string {
  const parts = subjectKey.split("::");
  const eventId = parts[0] === "event" ? parts[1] : parts[0];
  return eventId ? `/events/${eventId}` : "";
}

export async function submitReport(input: ReportInput): Promise<ReportResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to report content." };
  if (isBanned(user)) return { ok: false, error: BANNED_MESSAGE };

  if (input.targetType !== "comment" && input.targetType !== "entry")
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

  const snap = await snapshotTarget(input.targetType, input.targetId);
  if (!snap.ok) return snap;

  if (snap.authorId === user.id)
    return { ok: false, error: "You can't report your own post." };

  // Re-reporting the same thing replaces that person's earlier report and
  // reopens it, rather than piling up duplicates.
  await prisma.report.upsert({
    where: {
      targetType_targetId_reporterId: {
        targetType: input.targetType,
        targetId: input.targetId,
        reporterId: user.id,
      },
    },
    create: {
      targetType: input.targetType,
      targetId: input.targetId,
      targetExcerpt: snap.excerpt,
      targetAuthorId: snap.authorId,
      targetAuthorName: snap.authorName,
      contextUrl: snap.contextUrl,
      reason: input.reason,
      details,
      reporterId: user.id,
      reporterName: user.username,
    },
    update: {
      reason: input.reason,
      details,
      targetExcerpt: snap.excerpt,
      status: "open",
      resolution: null,
      handledByName: null,
      handledAt: null,
      createdAt: new Date(),
    },
  });

  revalidatePath("/review/reports");
  return { ok: true };
}

// Close a report without touching the content.
export async function dismissReport(
  reportId: string,
  note: string,
): Promise<ReportResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return gate;

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, error: "Report not found." };

  await prisma.report.update({
    where: { id: reportId },
    data: {
      status: "dismissed",
      resolution: note.trim() || "No action needed.",
      handledByName: gate.user.username,
      handledAt: new Date(),
    },
  });

  await logAudit({
    action: "dismissed_report",
    actorId: gate.user.id,
    actorName: gate.user.username,
    targetType: report.targetType === "entry" ? "entry" : "comment",
    targetId: report.targetId,
    targetName: report.targetExcerpt.slice(0, 80),
    authorName: report.targetAuthorName,
    reason: note.trim() || null,
  });

  revalidatePath("/review/reports");
  return { ok: true };
}

// Mark a report handled — used when the archivist acted some other way
// (a warning, a ban) and wants the queue cleared.
export async function resolveReport(
  reportId: string,
  note: string,
): Promise<ReportResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return gate;

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, error: "Report not found." };

  await closeReportsFor(
    report.targetType as ReportTargetType,
    report.targetId,
    gate.user.username,
    note.trim() || "Actioned.",
  );

  await logAudit({
    action: "resolved_report",
    actorId: gate.user.id,
    actorName: gate.user.username,
    targetType: report.targetType === "entry" ? "entry" : "comment",
    targetId: report.targetId,
    targetName: report.targetExcerpt.slice(0, 80),
    authorName: report.targetAuthorName,
    reason: note.trim() || null,
  });

  revalidatePath("/review/reports");
  return { ok: true };
}

// Delete the reported content and close every open report filed against it.
export async function removeReportedContent(
  reportId: string,
): Promise<ReportResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return gate;

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, error: "Report not found." };

  if (report.targetType === "comment") {
    await prisma.comment.deleteMany({ where: { id: report.targetId } });
  } else {
    await prisma.entry.deleteMany({ where: { id: report.targetId } });
  }

  await closeReportsFor(
    report.targetType as ReportTargetType,
    report.targetId,
    gate.user.username,
    "Content removed.",
  );

  await logAudit({
    action: report.targetType === "entry" ? "deleted_entry" : "deleted_comment",
    actorId: gate.user.id,
    actorName: gate.user.username,
    targetType: report.targetType === "entry" ? "entry" : "comment",
    targetId: report.targetId,
    targetName: report.targetExcerpt.slice(0, 80),
    authorName: report.targetAuthorName,
    reason: "removed after report",
  });

  revalidatePath("/review/reports");
  revalidatePath("/");
  return { ok: true };
}

// One action on a piece of content settles every report about it.
async function closeReportsFor(
  targetType: ReportTargetType,
  targetId: string,
  handledByName: string,
  resolution: string,
): Promise<void> {
  await prisma.report.updateMany({
    where: { targetType, targetId, status: "open" },
    data: {
      status: "resolved",
      resolution,
      handledByName,
      handledAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Bans
// ---------------------------------------------------------------------------

// Suspend an account. `days` of 0 (or less) means permanent. A ban blocks
// posting, voting, reporting, and editing; the account can still read and can
// still see why it was suspended on its My Contributions page.
export async function banUser(
  userId: string,
  reason: string,
  days: number,
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

  const note = reason.trim();
  if (!note)
    return { ok: false, error: "Give a reason — the user is shown it." };
  if (note.length > 500)
    return { ok: false, error: "Reason is too long (500 characters max)." };

  const duration = Number.isFinite(days) ? Math.floor(days) : 0;
  const until =
    duration > 0
      ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
      : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      bannedAt: new Date(),
      bannedUntil: until,
      banReason: note,
      bannedByName: gate.user.username,
    },
  });

  await logAudit({
    action: "banned_user",
    actorId: gate.user.id,
    actorName: gate.user.username,
    targetType: "user",
    targetId: target.id,
    targetName: target.username,
    reason: until ? `${duration} day(s): ${note}` : `permanent: ${note}`,
  });

  revalidatePath("/review");
  revalidatePath("/review/reports");
  revalidatePath(`/users/${target.username}`);
  return { ok: true };
}

export async function unbanUser(userId: string): Promise<ReportResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return gate;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });
  if (!target) return { ok: false, error: "User not found." };

  await prisma.user.update({
    where: { id: userId },
    data: {
      bannedAt: null,
      bannedUntil: null,
      banReason: null,
      bannedByName: null,
    },
  });

  await logAudit({
    action: "unbanned_user",
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
