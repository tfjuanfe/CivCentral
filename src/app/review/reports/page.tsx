import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canReview } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/reports";
import ReportActions from "@/components/ReportActions";
import BanControls from "@/components/BanControls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reports | WikiCiv" };

function reasonLabel(reason: string): string {
  return REPORT_REASON_LABELS[reason as ReportReason] ?? reason;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { show?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/review/reports");
  if (!canReview(user)) redirect("/");

  const showClosed = searchParams.show === "closed";

  const [reports, openCount, closedCount] = await Promise.all([
    prisma.report.findMany({
      where: showClosed ? { status: { not: "open" } } : { status: "open" },
      orderBy: { createdAt: showClosed ? "desc" : "asc" },
      take: 100,
    }),
    prisma.report.count({ where: { status: "open" } }),
    prisma.report.count({ where: { status: { not: "open" } } }),
  ]);

  // Reported authors, so a reviewer can suspend straight from the queue and
  // see who is already suspended.
  const authorIds = [
    ...new Set(reports.map((r) => r.targetAuthorId).filter(Boolean)),
  ] as string[];
  const authors = authorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: {
          id: true,
          username: true,
          role: true,
          bannedAt: true,
          bannedUntil: true,
        },
      })
    : [];
  const authorById = new Map(authors.map((a) => [a.id, a]));

  // How many separate people flagged the same thing — the strongest signal in
  // the queue, so it's shown on each card.
  const grouped = await prisma.report.groupBy({
    by: ["targetType", "targetId"],
    where: { status: "open" },
    _count: { _all: true },
  });
  const flagCount = new Map(
    grouped.map((g) => [`${g.targetType}:${g.targetId}`, g._count._all]),
  );

  return (
    <>
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> / <Link href="/review">Review queue</Link> /
        Reports
      </nav>

      <div className="entry-header">
        <h1 className="page-title" style={{ margin: 0 }}>
          Reports
        </h1>
        <span className="inline-actions">
          <Link
            href="/review/reports"
            className={`btn btn-sm ${showClosed ? "btn-secondary" : ""}`}
          >
            Open ({openCount})
          </Link>
          <Link
            href="/review/reports?show=closed"
            className={`btn btn-sm ${showClosed ? "" : "btn-secondary"}`}
          >
            Closed ({closedCount})
          </Link>
        </span>
      </div>

      <p className="lede">
        What members have flagged for a look. Delete the content, mark a report
        handled if you acted another way, or dismiss it. Suspending an account
        blocks posting, voting, and reporting — the reason you give is shown to
        the person.
      </p>

      {reports.length === 0 ? (
        <div className="empty-state">
          {showClosed
            ? "Nothing has been closed yet."
            : "No open reports. The archive is behaving."}
        </div>
      ) : (
        <div className="list-stack">
          {reports.map((r) => {
            const author = r.targetAuthorId
              ? authorById.get(r.targetAuthorId)
              : null;
            const banned =
              !!author?.bannedAt &&
              (author.bannedUntil === null || author.bannedUntil > new Date());
            const flags = flagCount.get(`${r.targetType}:${r.targetId}`) ?? 1;

            return (
              <article key={r.id} className="card report-card">
                <div className="tag-row">
                  <span className="badge badge-report">
                    ⚑ {reasonLabel(r.reason)}
                  </span>
                  <span className="badge badge-type">{r.targetType}</span>
                  {flags > 1 && !showClosed && (
                    <span className="badge badge-disputed">
                      {flags} people flagged this
                    </span>
                  )}
                  {r.status !== "open" && (
                    <span className="badge badge-status status-draft">
                      {r.status}
                    </span>
                  )}
                  <span className="muted">{formatDateTime(r.createdAt)}</span>
                </div>

                <p className="muted" style={{ margin: "6px 0" }}>
                  Reported by <strong>{r.reporterName}</strong> · posted by{" "}
                  {author ? (
                    <Link href={`/users/${author.username}`}>
                      <strong>{r.targetAuthorName}</strong>
                    </Link>
                  ) : (
                    <strong>{r.targetAuthorName || "unknown"}</strong>
                  )}
                  {banned && (
                    <span className="badge badge-disputed" style={{ marginLeft: 6 }}>
                      suspended
                    </span>
                  )}
                </p>

                {r.details && (
                  <blockquote className="report-details">{r.details}</blockquote>
                )}

                <div className="report-excerpt">
                  <span className="hint">Reported content (as filed):</span>
                  <p>{r.targetExcerpt || "(empty)"}</p>
                </div>

                <div className="tag-row" style={{ margin: "8px 0" }}>
                  {r.targetType === "entry" ? (
                    <Link
                      href={`/entries/${r.targetId}`}
                      className="btn btn-sm btn-secondary"
                    >
                      View entry
                    </Link>
                  ) : r.contextUrl ? (
                    <Link
                      href={r.contextUrl}
                      className="btn btn-sm btn-secondary"
                    >
                      View in context
                    </Link>
                  ) : null}
                  {author && author.role !== "archivist" && (
                    <BanControls
                      userId={author.id}
                      username={author.username}
                      banned={banned}
                    />
                  )}
                </div>

                {r.status === "open" ? (
                  <ReportActions reportId={r.id} targetType={r.targetType} />
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    {r.status === "dismissed" ? "Dismissed" : "Handled"} by{" "}
                    <strong>{r.handledByName}</strong>
                    {r.handledAt ? ` on ${formatDateTime(r.handledAt)}` : ""}
                    {r.resolution ? ` — ${r.resolution}` : ""}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
