import Link from "next/link";
import Icon from "@/components/Icon";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canEditEntry, canReview } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { parseInfobox } from "@/lib/types";
import { INFOBOX_FIELDS } from "@/lib/templates";
import type { EntryType } from "@/lib/types";
import ActionButton from "@/components/ActionButton";
import { rollbackEntry } from "@/app/actions/review";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const [entry, user] = await Promise.all([
    prisma.entry.findUnique({
      where: { id: (await params).entryId },
      include: {
        revisions: {
          include: { editor: { select: { username: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    getCurrentUser(),
  ]);

  if (!entry) notFound();

  // Don't leak unpublished bodies (drafts / pending review) through the history
  // view. Only the author or an archivist may see a non-published entry's
  // revisions — every other surface hides them too.
  if (entry.status !== "published" && !canEditEntry(user, entry) && !canReview(user))
    notFound();

  const isArchivist = canReview(user);
  const type = entry.type as EntryType;

  return (
    <>
      <nav className="breadcrumbs">
        <Link href={`/entries/${entry.id}`}>{entry.name}</Link> / Revision
        history
      </nav>
      <h1 className="page-title">Revision history</h1>
      <p className="lede">
        Every edit is saved as a revision. Archivists can restore any earlier
        version, which creates a new revision instead of overwriting.
      </p>

      {entry.revisions.length === 0 ? (
        <div className="empty-state">No revisions recorded.</div>
      ) : (
        <div className="list-stack">
          {entry.revisions.map((rev, idx) => {
            const infobox = parseInfobox(rev.infobox);
            const fields = INFOBOX_FIELDS[type].filter(
              (f) => (infobox[f.key] ?? "").trim().length > 0,
            );
            const isCurrent = idx === 0;
            return (
              <article key={rev.id} className="card">
                <div
                  className="tag-row"
                  style={{ justifyContent: "space-between" }}
                >
                  <div className="tag-row">
                    <strong>{formatDateTime(rev.createdAt)}</strong>
                    {isCurrent && (
                      <span className="badge badge-status status-published">
                        current
                      </span>
                    )}
                    <span className="badge badge-type">{rev.note}</span>
                  </div>
                  <span className="muted">by {rev.editor.username}</span>
                </div>

                {fields.length > 0 && (
                  <dl
                    className="infobox-grid"
                    style={{ margin: "10px 0", maxWidth: 480 }}
                  >
                    {fields.map((f) => (
                      <div className="infobox-row" key={f.key}>
                        <dt>{f.label}</dt>
                        <dd>{infobox[f.key]}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <pre className="queue-preview" style={{ whiteSpace: "pre-wrap" }}>
                  {rev.body || "(empty body)"}
                </pre>

                {isArchivist && !isCurrent && (
                  <ActionButton
                    action={rollbackEntry.bind(null, entry.id, rev.id)}
                    className="btn btn-sm btn-secondary"
                    confirm="Restore this version? This creates a new revision and does not erase any history."
                  >
                    <Icon name="undo" /> Roll back to this version
                  </ActionButton>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
