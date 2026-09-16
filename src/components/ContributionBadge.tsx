import { contributionProgress } from "@/lib/contributions";

export default function ContributionBadge({ count, showProgress = false }: { count: number; showProgress?: boolean }) {
  const progress = contributionProgress(count);
  return <div className="contribution-progress">
    {progress.milestone > 0 && <span className="badge contribution-badge" title={`Reached ${progress.milestone} published articles`}>
      <span aria-hidden>✦</span> {progress.milestone} articles
    </span>}
    {showProgress && <>
      <label htmlFor="contribution-progress">{progress.remaining} more published article{progress.remaining === 1 ? "" : "s"} to the {progress.next}-article badge</label>
      <progress id="contribution-progress" max={5} value={progress.count - progress.milestone} />
      <p className="hint">Badges advance every five currently published articles. Drafts, pending articles, and edits do not count.</p>
    </>}
  </div>;
}
