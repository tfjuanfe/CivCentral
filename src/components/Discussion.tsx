import Link from "next/link";
import { prisma } from "@/lib/db";
import { canReview } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { deleteComment } from "@/app/actions/social";
import ActionButton from "@/components/ActionButton";
import CommentForm from "@/components/CommentForm";
import CommentVotes from "@/components/CommentVotes";
import ReportButton from "@/components/ReportButton";
import type { SessionUser } from "@/lib/types";

// The discussion thread shared by event pages and entry subject pages: the
// comment list with its votes, report links and moderation controls, plus the
// composer. Both callers pass the host's settings for the owning event, which
// decide whether the thread is open and whether a verified email is required.
export default async function Discussion({
  subjectKey,
  user,
  commentsEnabled = true,
  requireVerifiedEmail = true,
  emptyText = "No comments yet. Start the discussion.",
}: {
  subjectKey: string;
  user: SessionUser | null;
  commentsEnabled?: boolean;
  requireVerifiedEmail?: boolean;
  emptyText?: string;
}) {
  const comments = await prisma.comment.findMany({
    where: { subjectKey },
    include: { author: { select: { username: true } } },
    orderBy: { createdAt: "asc" },
  });

  const ids = comments.map((c) => c.id);
  const [tallies, myVotes] = await Promise.all([
    ids.length
      ? prisma.commentVote.groupBy({
          by: ["commentId"],
          where: { commentId: { in: ids } },
          _sum: { value: true },
        })
      : Promise.resolve([]),
    ids.length && user
      ? prisma.commentVote.findMany({
          where: { commentId: { in: ids }, userId: user.id },
          select: { commentId: true, value: true },
        })
      : Promise.resolve([]),
  ]);

  const scoreById = new Map(tallies.map((t) => [t.commentId, t._sum.value ?? 0]));
  const voteById = new Map(myVotes.map((v) => [v.commentId, v.value]));

  // Now that comments can be voted on, show the thread best-first. Ties fall
  // back to oldest-first so the ordering is stable.
  const ordered = [...comments].sort((a, b) => {
    const diff = (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0);
    if (diff !== 0) return diff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const isArchivist = canReview(user);
  const needsVerify = requireVerifiedEmail && !!user && !user.emailVerified;
  const canVote = !!user && !user.banned && !needsVerify && commentsEnabled;
  const voteBlockedReason = !user
    ? undefined // no reason string: the control sends them to /login
    : user.banned
      ? "Your account is suspended."
      : needsVerify
        ? "Verify your email to vote."
        : !commentsEnabled
          ? "The host has closed this discussion."
          : undefined;

  return (
    <section className="discussion">
      <h2 className="section-title">💬 Discussion ({comments.length})</h2>

      {ordered.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <ul className="comment-list">
          {ordered.map((c) => {
            const isOwn = user?.id === c.authorId;
            return (
              <li key={c.id} className="comment">
                <CommentVotes
                  commentId={c.id}
                  initialScore={scoreById.get(c.id) ?? 0}
                  initialUserVote={voteById.get(c.id) ?? 0}
                  canVote={canVote && !isOwn}
                  disabledReason={
                    isOwn ? "You can't vote on your own comment." : voteBlockedReason
                  }
                />
                <div className="comment-main">
                  <div className="comment-head">
                    <Link href={`/users/${c.author.username}`}>
                      <strong>{c.author.username}</strong>
                    </Link>
                    <span className="muted">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="comment-body">{c.body}</p>
                  <div className="comment-actions">
                    {!isOwn && (
                      <ReportButton
                        targetType="comment"
                        targetId={c.id}
                        isLoggedIn={!!user}
                      />
                    )}
                    {(isOwn || isArchivist) && (
                      <ActionButton
                        action={deleteComment.bind(null, c.id)}
                        className="link-button"
                        confirm="Delete this comment?"
                      >
                        Delete
                      </ActionButton>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!commentsEnabled ? (
        <p className="muted notice-closed">
          🔒 The host has closed the discussion on this event. Existing comments
          stay visible.
        </p>
      ) : !user ? (
        <p className="muted">
          <Link href="/login">Log in</Link> to join the discussion.
        </p>
      ) : user.banned ? (
        <p className="muted">
          Your account is suspended, so you can&apos;t post right now.
        </p>
      ) : needsVerify ? (
        <p className="muted">
          The host requires a verified email to post here.{" "}
          <Link href="/me">Verify your email</Link> to join in.
        </p>
      ) : (
        <CommentForm subjectKey={subjectKey} />
      )}
    </section>
  );
}
