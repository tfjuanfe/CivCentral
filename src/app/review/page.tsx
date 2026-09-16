import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canReview } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { EntryType, Layer } from "@/lib/types";
import { TypeBadge, LayerBadge } from "@/components/Badges";
import ActionButton from "@/components/ActionButton";
import DeleteButton from "@/components/DeleteButton";
import RequestChangesForm from "@/components/RequestChangesForm";
import BanControls from "@/components/BanControls";
import {
  approveEntry,
  setDisputed,
  toggleTrusted,
  deleteEntry,
} from "@/app/actions/review";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/review");
  if (!canReview(user)) redirect("/");

  const openReports = await prisma.report.count({ where: { status: "open" } });
  const [pending, contributors] = await Promise.all([
    prisma.entry.findMany({
      where: { status: "pending" },
      include: {
        author: { select: { username: true } },
        event: { select: { id: true, name: true } },
        evidence: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["contributor", "archivist"] } },
      orderBy: [{ trusted: "desc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        role: true,
        trusted: true,
        bannedAt: true,
        bannedUntil: true,
        banReason: true,
        _count: { select: { entries: true } },
      },
    }),
  ]);

  return (
    <>
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> / Review queue
      </nav>
      <div className="entry-header">
        <h1 className="page-title" style={{ margin: 0 }}>
          Review queue
        </h1>
        <span className="inline-actions">
          <Link
            href="/review/reports"
            className={`btn btn-sm ${openReports > 0 ? "btn-danger" : "btn-secondary"}`}
          >
            ⚑ Reports{openReports > 0 ? ` (${openReports})` : ""}
          </Link>
          <Link href="/review/log" className="btn btn-sm btn-secondary">
            📋 Activity log
          </Link>
        </span>
      </div>
      <p className="lede">
        Approve submissions or send them back to the author with feedback. If
        two Record claims conflict, mark them <strong>disputed</strong> so both
        stay visible instead of rejecting either one.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Pending ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <div className="empty-state">The queue is empty. Nicely kept.</div>
      ) : (
        pending.map((e) => (
          <article
            key={e.id}
            className={`queue-item ${e.layer === "record" ? "record" : ""}`}
          >
            <div className="layer-block-head">
              <TypeBadge type={e.type as EntryType} />
              <LayerBadge layer={e.layer as Layer} />
              <strong>{e.name}</strong>
              <span className="muted">
                · {e.event.name} · by {e.author.username} ·{" "}
                {formatDate(e.createdAt)}
              </span>
            </div>

            {e.layer === "account" && e.attributedTo && (
              <div className="attributed">
                as told by <strong>{e.attributedTo}</strong>
              </div>
            )}

            <pre className="queue-preview" style={{ whiteSpace: "pre-wrap" }}>
              {e.body || "(no body)"}
            </pre>

            {e.layer === "record" && (
              <p className="muted" style={{ fontSize: "0.84rem" }}>
                {e.evidence.length} evidence attachment
                {e.evidence.length === 1 ? "" : "s"}
              </p>
            )}

            <div className="btn-row">
              <ActionButton
                action={approveEntry.bind(null, e.id)}
                className="btn btn-sm"
              >
                ✓ Approve &amp; publish
              </ActionButton>
              {e.layer === "record" && (
                <ActionButton
                  action={setDisputed.bind(null, e.id, true)}
                  className="btn btn-sm btn-secondary"
                  title="Publish, but flag it as conflicting with another record"
                >
                  ⚠ Mark disputed &amp; publish
                </ActionButton>
              )}
              <RequestChangesForm entryId={e.id} />
              <Link href={`/entries/${e.id}`} className="btn btn-sm btn-secondary">
                Preview
              </Link>
              <DeleteButton
                action={deleteEntry.bind(null, e.id)}
                confirm={`Permanently delete "${e.name}"? This removes the entry, its evidence, and revisions. This cannot be undone.`}
              >
                🗑 Delete
              </DeleteButton>
            </div>
          </article>
        ))
      )}

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Contributors
      </h2>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Contributor</th>
              <th>Role</th>
              <th>Entries</th>
              <th>Standing</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contributors.map((c) => {
              const banned =
                !!c.bannedAt &&
                (c.bannedUntil === null || c.bannedUntil > new Date());
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/users/${c.username}`}>
                      <strong>{c.username}</strong>
                    </Link>
                  </td>
                  <td>{c.role}</td>
                  <td>{c._count.entries}</td>
                  <td>
                    {banned ? (
                      <span
                        className="badge badge-disputed"
                        title={c.banReason ?? undefined}
                      >
                        suspended
                        {c.bannedUntil
                          ? ` until ${formatDate(c.bannedUntil)}`
                          : ""}
                      </span>
                    ) : c.trusted ? (
                      "✦ trusted"
                    ) : (
                      <span className="muted">ok</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {c.id !== user.id && c.role !== "archivist" && (
                      <span className="inline-actions">
                        <ActionButton
                          action={toggleTrusted.bind(null, c.id)}
                          className="btn btn-sm btn-secondary"
                        >
                          {c.trusted ? "Revoke trust" : "Grant trust"}
                        </ActionButton>
                        <BanControls
                          userId={c.id}
                          username={c.username}
                          banned={banned}
                        />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
