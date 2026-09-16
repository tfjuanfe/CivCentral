"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  canReview,
  canContributeNow,
  canParticipateInEvent,
  isBanned,
  BANNED_MESSAGE,
  VERIFY_EMAIL_MESSAGE,
} from "@/lib/permissions";
import { eventIdFromSubjectKey } from "@/lib/ratings";
import { logAudit } from "@/lib/audit";
import { rateLimit, retryMessage } from "@/lib/ratelimit";
import type { SessionUser } from "@/lib/types";

export type StarResult =
  | { ok: true; starred: boolean; count: number }
  | { ok: false; error: string };

export type CommentResult = { ok: true } | { ok: false; error: string };

export type VoteResult =
  | { ok: true; score: number; ups: number; downs: number; userVote: number }
  | { ok: false; error: string };

const COMMENT_MAX = 2000;

// Toggle the current user's star on a subject. Returns the new state + count.
export async function toggleStar(subjectKey: string): Promise<StarResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to star articles." };
  if (isBanned(user)) return { ok: false, error: BANNED_MESSAGE };
  if (!canContributeNow(user))
    return { ok: false, error: VERIFY_EMAIL_MESSAGE };

  const rl = await rateLimit(`star:${user.id}`, 40, 60);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

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

// Check a would-be commenter against the settings of the event that owns this
// subject. Hosts may waive email verification and close the thread on their own
// pages; everything else (login, role, bans) still applies.
async function gateDiscussion(
  subjectKey: string,
  action: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const eventId = eventIdFromSubjectKey(subjectKey);
  const event = eventId
    ? await prisma.event.findUnique({
        where: { id: eventId },
        select: { requireVerifiedEmail: true, commentsEnabled: true },
      })
    : null;

  // An unknown event can't relax anything: fall back to the strict default.
  const settings = event ?? {
    requireVerifiedEmail: true,
    commentsEnabled: true,
  };

  if (!settings.commentsEnabled)
    return {
      ok: false,
      error: "The host has closed the discussion on this event.",
    };

  const gate = canParticipateInEvent(user, settings, action);
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
// deleting someone else's comment is a moderation action, so it's logged.
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
  if (isOwn && isBanned(user))
    return { ok: false, error: BANNED_MESSAGE };

  await prisma.comment.delete({ where: { id: commentId } });

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

// Cast, flip, or clear a vote on a comment. Sending the direction the user has
// already cast clears it, so the same button both votes and un-votes.
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

  const existing = await prisma.commentVote.findUnique({
    where: { commentId_userId: { commentId, userId: gate.user.id } },
  });

  let userVote = value;
  if (existing && existing.value === value) {
    await prisma.commentVote.delete({ where: { id: existing.id } });
    userVote = 0;
  } else {
    await prisma.commentVote.upsert({
      where: { commentId_userId: { commentId, userId: gate.user.id } },
      create: { commentId, userId: gate.user.id, value },
      update: { value },
    });
  }

  const tally = await tallyVotes(commentId);
  return { ok: true, ...tally, userVote };
}

async function tallyVotes(
  commentId: string,
): Promise<{ score: number; ups: number; downs: number }> {
  const [ups, downs] = await Promise.all([
    prisma.commentVote.count({ where: { commentId, value: 1 } }),
    prisma.commentVote.count({ where: { commentId, value: -1 } }),
  ]);
  return { score: ups - downs, ups, downs };
}
