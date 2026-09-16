"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  canReview,
  canContributeNow,
  canParticipateInEvent,
  isSuspended,
  SUSPENDED_MESSAGE,
  VERIFY_EMAIL_MESSAGE,
} from "@/lib/permissions";
import { eventIdFromSubjectKey } from "@/lib/ratings";
import { logAudit } from "@/lib/audit";
import { rateLimit, retryMessage } from "@/lib/ratelimit";
import { subjectExists } from "@/lib/subjects";
import type { SessionUser } from "@/lib/types";

export type StarResult =
  | { ok: true; starred: boolean; count: number }
  | { ok: false; error: string };

export type CommentResult = { ok: true } | { ok: false; error: string };

export type VoteResult =
  | { ok: true; score: number; userVote: number }
  | { ok: false; error: string };

const COMMENT_MAX = 2000;

// Toggle the current user's star on a subject. Returns the new state + count.
export async function toggleStar(subjectKey: string): Promise<StarResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to star articles." };
  if (isSuspended(user)) return { ok: false, error: SUSPENDED_MESSAGE };
  if (!canContributeNow(user))
    return { ok: false, error: VERIFY_EMAIL_MESSAGE };

  const rl = await rateLimit(`star:${user.id}`, 40, 60);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

  if (!(await subjectExists(subjectKey)))
    return { ok: false, error: "That subject doesn't exist." };

  const existing = await prisma.star.findUnique({
    where: { subjectKey_userId: { subjectKey, userId: user.id } },
  });

  let starred: boolean;
  if (existing) {
    await prisma.star.delete({ where: { id: existing.id } });
    starred = false;
  } else {
    await prisma.star.create({ data: { subjectKey, userId: user.id } });
    starred = true;
  }

  const count = await prisma.star.count({ where: { subjectKey } });
  revalidatePath("/popular");
  return { ok: true, starred, count };
}

// Check a would-be participant against the settings of the event that owns this
// subject. Hosts may waive email verification and close the thread on their own
// pages; login, role, and suspension checks always apply.
async function gateDiscussion(
  subjectKey: string,
  action: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const eventId = eventIdFromSubjectKey(subjectKey);
  const event = eventId
    ? await prisma.event.findUnique({
        where: { id: eventId },
        select: { ratingMode: true, commentsEnabled: true },
      })
    : null;

  // An unknown event can't relax anything: fall back to the strict default.
  const settings = event ?? { ratingMode: "verified", commentsEnabled: true };

  if (!settings.commentsEnabled)
    return {
      ok: false,
      error: "The host has closed the discussion on this event.",
    };

  const gate = canParticipateInEvent(
    user,
    { ratingMode: settings.ratingMode === "verified" ? "verified" : "open" },
    action,
  );
  if (!gate.ok) return gate;
  return { ok: true, user: user! };
}

export async function addComment(
  subjectKey: string,
  body: string,
): Promise<CommentResult> {
  const gate = await gateDiscussion(subjectKey, "comment");
  if (!gate.ok) return gate;

  const rl = await rateLimit(`comment:${gate.user.id}`, 10, 300);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

  if (!(await subjectExists(subjectKey)))
    return { ok: false, error: "That subject doesn't exist." };

  const clean = body.trim();
  if (clean.length === 0)
    return { ok: false, error: "Comment can't be empty." };
  if (clean.length > COMMENT_MAX)
    return {
      ok: false,
      error: `Comment is too long (${COMMENT_MAX} characters max).`,
    };

  await prisma.comment.create({
    data: { subjectKey, authorId: gate.user.id, body: clean },
  });
  return { ok: true };
}

// Delete a comment. Allowed for its author or any archivist. An archivist
// deleting someone else's comment is a moderation action, so it is logged.
export async function deleteComment(commentId: string): Promise<CommentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { author: { select: { username: true } } },
  });
  if (!comment) return { ok: false, error: "Comment not found." };

  const isOwn = comment.authorId === user.id;
  if (!isOwn && !canReview(user))
    return { ok: false, error: "You can only delete your own comments." };
  if (isOwn && isSuspended(user))
    return { ok: false, error: SUSPENDED_MESSAGE };

  await prisma.comment.delete({ where: { id: commentId } });
  // Votes reference the comment by id, not by relation, so clear them here.
  await prisma.vote.deleteMany({
    where: { targetType: "comment", targetId: commentId },
  });

  if (!isOwn) {
    await logAudit({
      action: "deleted_comment",
      actorId: user.id,
      actorName: user.username,
      targetType: "comment",
      targetId: comment.id,
      targetName: comment.body.slice(0, 80),
      authorName: comment.author.username,
    });
  }
  return { ok: true };
}

// Cast, flip, or clear a vote on a comment. Sending the direction already cast
// clears it, so the same button both votes and un-votes.
export async function voteComment(
  commentId: string,
  value: number,
): Promise<VoteResult> {
  if (value !== 1 && value !== -1)
    return { ok: false, error: "Invalid vote." };

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, subjectKey: true, authorId: true },
  });
  if (!comment) return { ok: false, error: "That comment no longer exists." };

  const gate = await gateDiscussion(comment.subjectKey, "vote on comments");
  if (!gate.ok) return gate;

  if (comment.authorId === gate.user.id)
    return { ok: false, error: "You can't vote on your own comment." };

  const rl = await rateLimit(`vote:${gate.user.id}`, 60, 60);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

  const key = {
    userId_targetType_targetId: {
      userId: gate.user.id,
      targetType: "comment",
      targetId: commentId,
    },
  };

  const existing = await prisma.vote.findUnique({ where: key });

  let userVote = value;
  if (existing && existing.value === value) {
    await prisma.vote.delete({ where: { id: existing.id } });
    userVote = 0;
  } else {
    await prisma.vote.upsert({
      where: key,
      create: {
        userId: gate.user.id,
        targetType: "comment",
        targetId: commentId,
        value,
      },
      update: { value },
    });
  }

  // Derived by summing, so two people voting at once can't drift a counter.
  const agg = await prisma.vote.aggregate({
    where: { targetType: "comment", targetId: commentId },
    _sum: { value: true },
  });

  return { ok: true, score: agg._sum.value ?? 0, userVote };
}
