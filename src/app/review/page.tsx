import Link from "next/link";
import Icon from "@/components/Icon";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canReview } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { EntryType, Layer } from "@/lib/types";
import { TypeBadge, LayerBadge, EventStatusBadge } from "@/components/Badges";
import ActionButton from "@/components/ActionButton";
import DeleteButton from "@/components/DeleteButton";
import RequestChangesForm from "@/components/RequestChangesForm";
import ModerationControls from "@/components/ModerationControls";
import {
  approveEntry,
  setDisputed,
  toggleTrusted,
  toggleEventHost,
  deleteEntry,
} from "@/app/actions/review";
import {
  approveServerRequest,
  rejectServerRequest,
  approveEventRequest,
  rejectEventRequest,
} from "@/app/actions/requests";

export const dynamic = "force-dynamic";

// A timed suspension lapses on its own, so "is this account suspended right
// now" is a clock comparison, not just a status read.
function isSuspendedRow(u: {
  status: string;
  suspendedUntil: Date | null;
}): boolean {
  if (u.status === "banned") return true;
  if (u.status !== "suspended") return false;
  return u.suspendedUntil === null || u.suspendedUntil > new Date();
}

export default async function ReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/review");
  if (!canReview(user)) redirect("/");

  const [pending, serverRequests, eventRequests, contributors, allServers] =
    await Promise.all([
      prisma.entry.findMany({
        where: { status: "pending" },
        include: {
          author: { select: { username: true } },
          event: { select: { id: true, name: true } },
          evidence: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.serverRequest.findMany({
        where: { status: "pending" },
        include: { requester: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.eventRequest.findMany({
        where: { status: "pending" },
        include: { requester: { select: { username: true } } },
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
          eventHost: true,
          status: true,
          suspendedUntil: true,
          _count: { select: { entries: true } },
        },
      }),
      prisma.server.findMany({ select: { id: true, name: true } }),
    ]);
  const openReports = await prisma.report.count({ where: { status: "open" } });
  const serverNames = new Map(allServers.map((s) => [s.id, s.name]));

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
            className={`btn btn-sm ${
              openReports > 0 ? "btn-danger" : "btn-secondary"
            }`}
          >
            ⚑ Reports{openReports > 0 ? ` (${openReports})` : ""}
          </Link>
          <Link href="/review/log" className="btn btn-sm btn-secondary">
            <Icon name="clipboard" /> Activity log
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
                <Icon name="check" /> Approve &amp; publish
              </ActionButton>
              {e.layer === "record" && (
                <ActionButton
                  action={setDisputed.bind(null, e.id, true)}
                  className="btn btn-sm btn-secondary"
                  title="Publish, but flag it as conflicting with another record"
                >
                  <Icon name="warning" /> Mark disputed &amp; publish
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
                <Icon name="trash" /> Delete
              </DeleteButton>
            </div>
          </article>
        ))
      )}

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Server requests (
        {serverRequests.length})
      </h2>
      {serverRequests.length === 0 ? (
        <div className="empty-state">No server suggestions waiting.</div>
      ) : (
        serverRequests.map((r) => (
          <article key={r.id} className="queue-item">
            <div className="layer-block-head">
              <strong>{r.name}</strong>
              <span className="muted">
                · by {r.requester.username} · {formatDate(r.createdAt)}
              </span>
            </div>
            {r.description && (
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                {r.description}
              </p>
            )}
            <p style={{ fontSize: "0.85rem" }}>
              Discord:{" "}
              <a href={r.discordUrl} target="_blank" rel="noopener noreferrer">
                {r.discordUrl}
              </a>
            </p>
            <div className="btn-row">
              <ActionButton
                action={approveServerRequest.bind(null, r.id)}
                className="btn btn-sm"
              >
                <Icon name="check" /> Approve &amp; create
              </ActionButton>
              <ActionButton
                action={rejectServerRequest.bind(null, r.id, "")}
                className="btn btn-sm btn-secondary"
                confirm="Reject this server suggestion?"
              >
                Reject
              </ActionButton>
            </div>
          </article>
        ))
      )}

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Event requests (
        {eventRequests.length})
      </h2>
      {eventRequests.length === 0 ? (
        <div className="empty-state">No event suggestions waiting.</div>
      ) : (
        eventRequests.map((r) => {
          const serverLabel = r.serverId
            ? (serverNames.get(r.serverId) ?? "(removed server)")
            : `${r.proposedServerName} (new server)`;
          return (
            <article key={r.id} className="queue-item">
              <div className="layer-block-head">
                <EventStatusBadge status={r.eventStatus} />
                <strong>{r.name}</strong>
                <span className="muted">
                  · {serverLabel} · by {r.requester.username} ·{" "}
                  {formatDate(r.createdAt)}
                </span>
              </div>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                {r.theme ? `${r.theme} · ` : ""}
                {formatDate(r.startDate)}
                {r.endDate ? ` – ${formatDate(r.endDate)}` : ""}
              </p>
              {r.description && (
                <pre
                  className="queue-preview"
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {r.description}
                </pre>
              )}
              <p style={{ fontSize: "0.85rem" }}>
                Discord:{" "}
                <a href={r.discordUrl} target="_blank" rel="noopener noreferrer">
                  {r.discordUrl}
                </a>
              </p>
              <div className="btn-row">
                <ActionButton
                  action={approveEventRequest.bind(null, r.id)}
                  className="btn btn-sm"
                >
                  <Icon name="check" /> Approve &amp; create
                </ActionButton>
                <ActionButton
                  action={rejectEventRequest.bind(null, r.id, "")}
                  className="btn btn-sm btn-secondary"
                  confirm="Reject this event suggestion?"
                >
                  Reject
                </ActionButton>
              </div>
            </article>
          );
        })
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
              <th>Trusted</th>
              <th>Event host</th>
              <th>Standing</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contributors.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.username}</strong>
                </td>
                <td>{c.role}</td>
                <td>{c._count.entries}</td>
                <td>
                  {c.trusted ? (
                    <span className="trusted-tag">
                      <Icon name="sparkle" /> trusted
                    </span>
                  ) : (
                    "no"
                  )}
                </td>
                <td>
                  {c.eventHost ? (
                    <span className="trusted-tag">
                      <Icon name="sparkle" /> host
                    </span>
                  ) : (
                    "no"
                  )}
                </td>
                <td>
                  {isSuspendedRow(c) ? (
                    <span className="badge badge-disputed">
                      {c.status}
                      {c.status === "suspended" && c.suspendedUntil
                        ? ` until ${formatDate(c.suspendedUntil)}`
                        : ""}
                    </span>
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
                      <ActionButton
                        action={toggleEventHost.bind(null, c.id)}
                        className="btn btn-sm btn-secondary"
                      >
                        {c.eventHost ? "Revoke host" : "Make host"}
                      </ActionButton>
                      <ModerationControls
                        userId={c.id}
                        username={c.username}
                        suspended={isSuspendedRow(c)}
                      />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
