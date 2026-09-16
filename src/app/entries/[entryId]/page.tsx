import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canEditEntry, canReview } from "@/lib/permissions";
import { loadSubject, subjectKey, type EntryWithRelations } from "@/lib/subjects";
import { parseInfobox, type EntryType } from "@/lib/types";
import { formatDateTime, formatRelative, readingStats } from "@/lib/format";
import { TYPE_LABELS } from "@/lib/templates";
import MediaPreview from "@/components/MediaPreview";
import Markdown from "@/components/Markdown";
import Infobox from "@/components/Infobox";
import Icon from "@/components/Icon";
import {
  TypeBadge,
  LayerBadge,
  DisputedBanner,
  DisputedTag,
  StatusBadge,
  HostBadge,
} from "@/components/Badges";
import ActionButton from "@/components/ActionButton";
import DeleteButton from "@/components/DeleteButton";
import StarButton from "@/components/StarButton";
import ShareButton from "@/components/ShareButton";
import Discussion from "@/components/Discussion";
import ReportButton from "@/components/ReportButton";
import { setDisputed, deleteEntry } from "@/app/actions/review";

export const dynamic = "force-dynamic";

function Evidence({ items }: { items: EntryWithRelations["evidence"] }) {
  if (items.length === 0) return null;
  return (
    <div className="evidence">
      <h4>Evidence</h4>
      <div className="evidence-grid">
        {items.map((ev) => (
          <div key={ev.id} className="evidence-item">
            <MediaPreview url={ev.url} caption={ev.caption ?? "Evidence"} />
            <a href={ev.url} target="_blank" rel="noopener noreferrer" className="cap">{ev.caption || "View source"}</a>
          </div>
        ))}
      </div>
    </div>
  );
}

function Byline({
  entry,
  canEdit,
  isOwn,
  isLoggedIn,
}: {
  entry: EntryWithRelations;
  canEdit: boolean;
  isOwn: boolean;
  isLoggedIn: boolean;
}) {
  const stats = readingStats(entry.body);
  return (
    <div className="byline">
      <span>
        submitted by{" "}
        <Link href={`/users/${entry.author.username}`}>
          <strong>{entry.author.username}</strong>
        </Link>
        {entry.author.trusted && (
          <Icon name="sparkle" className="trusted-inline" />
        )}
      </span>
      <span title={formatDateTime(entry.createdAt)}>
        {formatRelative(entry.createdAt)}
      </span>
      {stats.words > 0 && (
        <span>
          {stats.words.toLocaleString()} words · ~{stats.minutes} min read
        </span>
      )}
      <Link href={`/entries/${entry.id}/history`}>Revision history</Link>
      {canEdit && <Link href={`/entries/${entry.id}/edit`}>Edit</Link>}
      {!isOwn && (
        <ReportButton
          targetType="entry"
          targetId={entry.id}
          isLoggedIn={isLoggedIn}
        />
      )}
    </div>
  );
}

export default async function EntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const [anchor, user] = await Promise.all([
    prisma.entry.findUnique({
      where: { id: (await params).entryId },
      include: {
        author: { select: { id: true, username: true, trusted: true } },
        evidence: true,
        event: { include: { server: true } },
      },
    }),
    getCurrentUser(),
  ]);

  if (!anchor) notFound();

  const type = anchor.type as EntryType;
  const subject = await loadSubject(anchor);

  let records = subject.records;
  let accounts = subject.accounts;
  const isArchivist = canReview(user);

  // Allow the author/archivist to preview a not-yet-published anchor in place.
  const previewing =
    anchor.status !== "published" && canEditEntry(user, anchor);
  if (previewing) {
    const a = anchor as unknown as EntryWithRelations;
    if (anchor.layer === "record" && !records.some((r) => r.id === anchor.id)) {
      records = [...records, a];
    } else if (
      anchor.layer === "account" &&
      !accounts.some((r) => r.id === anchor.id)
    ) {
      accounts = [...accounts, a];
    }
  }

  if (records.length === 0 && accounts.length === 0) {
    // Nothing published and nothing previewable.
    notFound();
  }

  const primaryRecord = records[0] ?? null;
  const sidebarInfoboxSource = primaryRecord ?? accounts[0] ?? anchor;
  const conflict = records.length > 1;
  const anyDisputed = records.some((r) => r.disputed) || subject.anyDisputed;

  // Stars + comments live on the subject, so they survive any anchor change.
  const sk = subjectKey(anchor.eventId, anchor.type, anchor.name);
  const hasPublished =
    subject.records.length > 0 || subject.accounts.length > 0;

  const [starCount, userStar] = await Promise.all([
    hasPublished
      ? prisma.star.count({ where: { subjectKey: sk } })
      : Promise.resolve(0),
    hasPublished && user
      ? prisma.star.findUnique({
          where: { subjectKey_userId: { subjectKey: sk, userId: user.id } },
        })
      : Promise.resolve(null),
  ]);
  const userStarred = !!userStar;

  return (
    <>
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> /{" "}
        <Link href={`/servers/${anchor.event.serverId}`}>
          {anchor.event.server.name}
        </Link>{" "}
        / <Link href={`/events/${anchor.eventId}`}>{anchor.event.name}</Link> /{" "}
        {anchor.name}
      </nav>

      <div className="entry-header">
        <TypeBadge type={type} />
        <h1 className="page-title" style={{ margin: 0 }}>
          {anchor.name}
        </h1>
        {anyDisputed && <DisputedTag />}
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        {TYPE_LABELS[type]} in{" "}
        <Link href={`/events/${anchor.eventId}`}>{anchor.event.name}</Link>
      </p>
      <div className="tag-row" style={{ marginTop: 6 }}>
        <HostBadge server={anchor.event.server} />
      </div>

      {hasPublished && (
        <div className="entry-tools">
          <StarButton
            subjectKey={sk}
            initialCount={starCount}
            initialStarred={userStarred}
            isLoggedIn={!!user}
          />
          <ShareButton />
          <a
            href={`/entries/${anchor.id}/export`}
            className="btn btn-sm btn-secondary"
          >
            <Icon name="download" /> Download as Markdown
          </a>
        </div>
      )}

      {previewing && (
        <div className="notice-pending">
          You are previewing this entry. Its status is{" "}
          <StatusBadge status={anchor.status as any} />. It is not visible to
          readers yet.
        </div>
      )}

      <div className="subject-layout">
        <div>
          {/* ---------- RECORD LAYER ---------- */}
          <h2 className="section-title">
            <Icon name="record" className="section-ico record-tint" /> Record
          </h2>
          {records.length === 0 ? (
            <div className="empty-state">
              No Record entry yet. The verifiable facts for this subject have not
              been documented.
            </div>
          ) : (
            <>
              {(anyDisputed || conflict) && <DisputedBanner />}
              {records.map((rec) => {
                const canEdit = canEditEntry(user, rec);
                return (
                  <article
                    key={rec.id}
                    className={`layer-block record${
                      rec.disputed ? " disputed" : ""
                    }`}
                  >
                    <div className="layer-block-head">
                      <LayerBadge layer="record" />
                      {conflict && (
                        <span className="muted">
                          claim by {rec.author.username}
                        </span>
                      )}
                      {rec.disputed && <DisputedTag />}
                      {rec.status !== "published" && (
                        <StatusBadge status={rec.status as any} />
                      )}
                    </div>

                    {conflict && (
                      <Infobox
                        type={type}
                        name={rec.name}
                        data={parseInfobox(rec.infobox)}
                      />
                    )}

                    {rec.body ? (
                      <Markdown>{rec.body}</Markdown>
                    ) : (
                      <p className="muted">No description written.</p>
                    )}

                    <Evidence items={rec.evidence} />
                    <Byline
                      entry={rec}
                      canEdit={canEdit}
                      isOwn={user?.id === rec.authorId}
                      isLoggedIn={!!user}
                    />

                    {isArchivist && (
                      <div className="byline" style={{ border: 0, paddingTop: 4 }}>
                        <ActionButton
                          action={setDisputed.bind(null, rec.id, !rec.disputed)}
                          className="btn btn-sm btn-secondary"
                        >
                          {rec.disputed ? "Clear disputed flag" : "Mark disputed"}
                        </ActionButton>
                        <DeleteButton
                          action={deleteEntry.bind(null, rec.id)}
                          redirectTo={`/events/${anchor.eventId}`}
                          confirm={`Permanently delete this Record of "${rec.name}"? This cannot be undone.`}
                        >
                          <Icon name="trash" /> Delete
                        </DeleteButton>
                      </div>
                    )}
                  </article>
                );
              })}
            </>
          )}

          {/* ---------- ACCOUNT LAYER ---------- */}
          <h2 className="section-title">
            <Icon name="account" className="section-ico account-tint" /> Accounts
          </h2>
          {accounts.length === 0 ? (
            <div className="empty-state">
              No Accounts yet. In-character stories, motivations, and propaganda
              go here, each credited to its author.
            </div>
          ) : (
            accounts.map((acc) => {
              const canEdit = canEditEntry(user, acc);
              return (
                <article key={acc.id} className="layer-block account">
                  <div className="layer-block-head">
                    <LayerBadge layer="account" />
                    {acc.status !== "published" && (
                      <StatusBadge status={acc.status as any} />
                    )}
                  </div>
                  <div className="attributed">
                    as told by <strong>{acc.attributedTo || "Unknown"}</strong>
                  </div>
                  {acc.body ? (
                    <Markdown>{acc.body}</Markdown>
                  ) : (
                    <p className="muted">No description written.</p>
                  )}
                  <Byline
                    entry={acc}
                    canEdit={canEdit}
                    isOwn={user?.id === acc.authorId}
                    isLoggedIn={!!user}
                  />
                  {isArchivist && (
                    <div className="byline" style={{ border: 0, paddingTop: 4 }}>
                      <DeleteButton
                        action={deleteEntry.bind(null, acc.id)}
                        redirectTo={`/events/${anchor.eventId}`}
                        confirm={`Permanently delete this Account as told by "${acc.attributedTo || "Unknown"}"? This cannot be undone.`}
                      >
                        <Icon name="trash" /> Delete
                      </DeleteButton>
                    </div>
                  )}
                </article>
              );
            })
          )}

          {/* ---------- DISCUSSION ---------- */}
          {hasPublished && (
            <Discussion
              subjectKey={sk}
              user={user}
              commentsEnabled={anchor.event.commentsEnabled}
              requireVerifiedEmail={anchor.event.ratingMode === "verified"}
            />
          )}
        </div>

        {/* ---------- SIDEBAR INFOBOX ---------- */}
        <aside>
          {!conflict && (
            <Infobox
              type={type}
              name={anchor.name}
              data={parseInfobox(sidebarInfoboxSource.infobox)}
            />
          )}
          <div className="card" style={{ marginTop: 16, fontSize: "0.85rem" }}>
            <strong>About this subject</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {records.length} record{records.length === 1 ? "" : "s"} ·{" "}
              {accounts.length} account{accounts.length === 1 ? "" : "s"}.
            </p>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Records and Accounts about this subject are shown together. Each
              Account is credited to the player or faction that wrote it.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
