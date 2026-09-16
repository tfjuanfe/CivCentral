"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { voteComment } from "@/app/actions/social";

// Up/downvote control for a single comment. The score updates optimistically
// from the server's own tally, so two people voting at once can't drift.
export default function CommentVotes({
  commentId,
  initialScore,
  initialUserVote,
  canVote,
  disabledReason,
}: {
  commentId: string;
  initialScore: number;
  initialUserVote: number; // 1, -1, or 0
  canVote: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [score, setScore] = useState(initialScore);
  const [userVote, setUserVote] = useState(initialUserVote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cast(value: 1 | -1) {
    if (!canVote) {
      if (disabledReason) setError(disabledReason);
      else router.push("/login");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await voteComment(commentId, value);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setScore(res.score);
    setUserVote(res.userVote);
  }

  const scoreClass =
    score > 0 ? "vote-score up" : score < 0 ? "vote-score down" : "vote-score";

  return (
    <div className="vote-box">
      <button
        type="button"
        className={`vote-btn${userVote === 1 ? " on up" : ""}`}
        onClick={() => cast(1)}
        disabled={busy}
        aria-pressed={userVote === 1}
        aria-label={userVote === 1 ? "Remove your upvote" : "Upvote this comment"}
        title={canVote ? "Upvote" : disabledReason || "Log in to vote"}
      >
        ▲
      </button>
      <span className={scoreClass} aria-live="polite">
        {score}
      </span>
      <button
        type="button"
        className={`vote-btn${userVote === -1 ? " on down" : ""}`}
        onClick={() => cast(-1)}
        disabled={busy}
        aria-pressed={userVote === -1}
        aria-label={
          userVote === -1 ? "Remove your downvote" : "Downvote this comment"
        }
        title={canVote ? "Downvote" : disabledReason || "Log in to vote"}
      >
        ▼
      </button>
      {error && (
        <span className="vote-error" role="status">
          {error}
        </span>
      )}
    </div>
  );
}
