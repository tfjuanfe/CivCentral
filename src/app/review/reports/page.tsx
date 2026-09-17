import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canReview } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { eventIdFromSubjectKey } from "@/lib/ratings";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/reports";
import ReportActions from "@/components/ReportActions";
import ModerationControls from "@/components/ModerationControls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reports | CivCentral" };

function reasonLabel(reason: string): string {
  return REPORT_REASON_LABELS[reason as ReportReason] ?? reason;
}

interface TargetView {
  excerpt: string;
  authorId: string | null;
  authorName: string;
  href: string | null;
  gone: boolean;
}

// Resolve what a report points at. The Report model stores no snapshot, so a
// target that has since been deleted shows as gone rather than as a blank card.
async function loadTarget(
  targetType: string,
  targetId: string,
): Promise<TargetView> {
  const missing: TargetView = {
    excerpt: "",
    authorId: null,
    authorName: "unknown",
    href: null,
    gone: true,
  };

  if (targetType === "comment") {
    const c = await prisma.comment.findUnique({
      where: { id: targetId },
      include: { author: { select: { id: true, username: true } } },
    });
    if (!c) return missing;
    const eventId = eventIdFromSubjectKey(c.subjectKey);
    return {
      excerpt: c.body,
      authorId: c.author.id,
      authorName: c.author.username,
      href: eventId ? `/events/${eventId}` : null,
      gone: false,
    };
  }

  if (targetType === "entry") {
    const e = await prisma.entry.findUnique({
      where: { id: targetId },
      include: { author: { select: { id: true, username: true } } },
    });
    if (!e) return missing;
    return {
      excerpt: `${e.name} — ${e.body.slice(0, 400)}`,
      authorId: e.author.id,
      authorName: e.author.username,
      href: `/entries/${e.id}`,
      gone: false,
    };
  }

  if (targetType === "user") {
    const u = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, username: true, bio: true },
    });
    if (!u) return missing;
    return {
      excerpt: u.bio || "(no bio)",
      authorId: u.id,
      authorName: u.username,
      href: `/users/${u.username}`,
      gone: false,
    };
  }

  const ev = await prisma.event.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, description: true, ownerId: true },
  });
  if (!ev) return missing;
  return {
    excerpt: `${ev.name} — ${ev.description.slice(0, 400)}`,
    authorId: ev.ownerId,
    authorName: "event host",
    href: `/events/${ev.id}`,
    gone: false,
  };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/review/reports");
  if (!canReview(user)) redirect("/");

  const showClosed = query.show === "closed";

  const [reports, openCount, closedCount, grouped] = await Promise.all([
    prisma.report.findMany({
      where: showClosed ? { status: { not: "open" } } : { status: "open" },
      include: { reporter: { select: { username: true } } },
      orderBy: { createdAt: showClosed ? "desc" : "asc" },
      take: 100,
    }),
    prisma.report.count({ where: { status: "open" } }),
    prisma.report.count({ where: { status: { not: "open" } } }),
    // How many separate people flagged the same thing — the strongest signal
    // in the queue, so it goes on each card.
    prisma.report.groupBy({
      by: ["targetType", "targetId"],
      where: { status: "open" },
      _count: { _all: true },
    }),
  ]);

  const flagCount = new Map(
    grouped.map((g) => [`${g.targetType}:${g.targetId}`, g._count._all]),
  );

  const targets = await Promise.all(
    reports.map((r) => loadTarget(r.targetType, r.targetId)),
  );

  const authorIds = [
    ...new Set(targets.map((t) => t.authorId).filter(Boolean)),
  ] as string[];
  const authors = authorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: {
          id: true,
          username: true,
          role: true,
          status: true,
          suspendedUntil: true,
        },
      })
    : [];
  const authorById = new Map(authors.map((a) => [a.id, a]));

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
        blocks posting, voting, and reporting while leaving reading open.
      </p>

      {reports.length === 0 ? (
        <div className="empty-state">
          {showClosed
            ? "Nothing has been closed yet."
            : "No open reports. The archive is behaving."}
        </div>
      ) : (
        <div className="list-stack">
          {reports.map((r, i) => {
            const t = targets[i];
            const author = t.authorId ? authorById.get(t.authorId) : null;
            const suspended =
              !!author &&
              (author.status === "banned" ||
                (author.status === "suspended" &&
                  (author.suspendedUntil === null ||
                    author.suspendedUntil > new Date())));
            const flags = flagCount.get(`${r.targetType}:${r.targetId}`) ?? 1;
            const removable =
              !t.gone && (r.targetType === "comment" || r.targetType === "entry");

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
                  Reported by <strong>{r.reporter.username}</strong>
                  {author ? (
                    <>
                      {" · posted by "}
                      <Link href={`/users/${author.username}`}>
                        <strong>{author.username}</strong>
                      </Link>
                    </>
                  ) : (
                    <> · author unknown</>
                  )}
                  {suspended && (
                    <span
                      className="badge badge-disputed"
                      style={{ marginLeft: 6 }}
                    >
                      {author?.status}
                    </span>
                  )}
                </p>

                {r.details && (
                  <blockquote className="report-details">{r.details}</blockquote>
                )}

                <div className="report-excerpt">
                  <span className="hint">Reported content:</span>
                  <p>
                    {t.gone ? (
                      <em className="muted">
                        No longer exists — it was deleted after this report was
                        filed.
                      </em>
                    ) : (
                      t.excerpt || "(empty)"
                    )}
                  </p>
                </div>

                <div className="tag-row" style={{ margin: "8px 0" }}>
                  {t.href && !t.gone && (
                    <Link href={t.href} className="btn btn-sm btn-secondary">
                      View in context
                    </Link>
                  )}
                  {author && author.role !== "archivist" && (
                    <ModerationControls
                      userId={author.id}
                      username={author.username}
                      suspended={suspended}
                    />
                  )}
                </div>

                {r.status === "open" ? (
                  <ReportActions
                    reportId={r.id}
                    targetType={r.targetType}
                    canRemove={removable}
                  />
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    Closed as <strong>{r.status}</strong>.
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
